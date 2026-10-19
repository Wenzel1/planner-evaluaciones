import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActor } from '@/lib/authServer'
import { hashPassword } from '@/lib/password'
import { validarNombre, validarEmail, validarPassword, validarTelefono, validarCedula, normalizarTelefono, normalizarCedula, ROLES_VALIDOS } from '@/lib/validacionesUsuario'
import { mensajeDuplicado } from '@/lib/duplicados'
import { registrarActividad } from '@/lib/actividad'

const SELECT = { id: true, nombre: true, email: true, rol: true, activo: true, pendiente: true, telefono: true, cedula: true, debeCambiarPassword: true, createdAt: true } as const

// Reglas:
//  - SUPERADMIN: gestiona a todos (no puede eliminarse/desactivarse/degradarse a sí mismo ni dejar el sistema sin superadmin).
//  - ADMIN: solo puede crear/editar/eliminar usuarios con rol USUARIO.
//  - USUARIO: sin acceso (también bloqueado en middleware).

async function requerirAdmin(request: Request) {
  const actor = await getActor(request)
  if (!actor) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (actor.rol === 'USUARIO') return { error: NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 }) }
  if (actor.debeCambiarPassword) return { error: NextResponse.json({ error: 'Debes cambiar tu contraseña temporal antes de continuar.', codigo: 'CAMBIO_OBLIGATORIO' }, { status: 403 }) }
  return { actor }
}

// GET /api/usuarios
export async function GET(request: Request) {
  const { actor, error } = await requerirAdmin(request)
  if (error) return error
  const usuarios = await prisma.usuario.findMany({ select: SELECT, orderBy: [{ rol: 'asc' }, { nombre: 'asc' }] })
  return NextResponse.json({ actor, usuarios })
}

// POST /api/usuarios
export async function POST(request: Request) {
  const { actor, error } = await requerirAdmin(request)
  if (error || !actor) return error!
  try {
    const body = await request.json()
    const rol = String(body.rol || 'USUARIO')
    if (!ROLES_VALIDOS.includes(rol as any)) return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 })
    if (actor.rol === 'ADMIN' && rol !== 'USUARIO') {
      return NextResponse.json({ error: 'Un administrador solo puede crear usuarios con rol USUARIO.' }, { status: 403 })
    }
    const msg = validarNombre(body.nombre) || validarEmail(body.email) || validarPassword(body.password) || validarTelefono(String(body.telefono ?? '')) || validarCedula(String(body.cedula ?? ''))
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    const creado = await prisma.usuario.create({
      data: {
        nombre: String(body.nombre).trim(),
        email: String(body.email).trim().toLowerCase(),
        passwordHash: await hashPassword(String(body.password)),
        rol: rol as any,
        telefono: normalizarTelefono(String(body.telefono)),
        cedula: normalizarCedula(String(body.cedula)),
        debeCambiarPassword: true, // la clave la puso quien creó la cuenta: la persona debe elegir la suya al entrar
      },
      select: SELECT,
    })
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Usuario', detalle: `Creó la cuenta de ${creado.nombre} (${creado.rol})` })
    return NextResponse.json(creado, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: mensajeDuplicado(e) }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al crear usuario.' }, { status: 500 })
  }
}

// PUT /api/usuarios  (id, nombre, email, rol, activo, password opcional)
export async function PUT(request: Request) {
  const { actor, error } = await requerirAdmin(request)
  if (error || !actor) return error!
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const objetivo = await prisma.usuario.findUnique({ where: { id: body.id } })
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

    const esUnoMismo = objetivo.id === actor.id
    if (actor.rol === 'ADMIN' && objetivo.rol !== 'USUARIO' && !esUnoMismo) {
      return NextResponse.json({ error: 'No puedes modificar a administradores ni al superadmin.' }, { status: 403 })
    }

    const telefonoNuevo = String(body.telefono ?? '').trim()
    const cedulaNueva = String(body.cedula ?? '').trim()
    const msg = validarNombre(body.nombre) || validarEmail(body.email) || (body.password ? validarPassword(body.password) : null) ||
      (telefonoNuevo ? validarTelefono(telefonoNuevo) : null) || (cedulaNueva ? validarCedula(cedulaNueva) : null)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    const nuevoRol = body.rol ? String(body.rol) : objetivo.rol
    if (!ROLES_VALIDOS.includes(nuevoRol as any)) return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 })
    if (actor.rol === 'ADMIN' && nuevoRol !== objetivo.rol) {
      return NextResponse.json({ error: 'Un administrador no puede cambiar roles.' }, { status: 403 })
    }
    const nuevoActivo = typeof body.activo === 'boolean' ? body.activo : objetivo.activo

    if (esUnoMismo && (nuevoRol !== objetivo.rol || nuevoActivo === false)) {
      return NextResponse.json({ error: 'No puedes cambiar tu propio rol ni desactivarte.' }, { status: 400 })
    }
    // Nunca dejar el sistema sin un SUPERADMIN activo
    if (objetivo.rol === 'SUPERADMIN' && (nuevoRol !== 'SUPERADMIN' || nuevoActivo === false)) {
      const otros = await prisma.usuario.count({ where: { rol: 'SUPERADMIN', activo: true, id: { not: objetivo.id } } })
      if (otros === 0) return NextResponse.json({ error: 'Debe existir al menos un superadmin activo.' }, { status: 400 })
    }

    const data: any = {
      nombre: String(body.nombre).trim(),
      email: String(body.email).trim().toLowerCase(),
      rol: nuevoRol,
      activo: nuevoActivo,
    }
    if (telefonoNuevo) data.telefono = normalizarTelefono(telefonoNuevo)
    if (cedulaNueva) data.cedula = normalizarCedula(cedulaNueva)
    if (body.password) {
      data.passwordHash = await hashPassword(String(body.password))
      // Si la clave se la pone otra persona, es temporal: debe cambiarla al entrar y se cierran sus sesiones abiertas
      if (!esUnoMismo) { data.debeCambiarPassword = true; data.sesionesDesde = new Date() }
    }
    if (nuevoActivo === true) data.pendiente = false // activar una cuenta pendiente equivale a aprobarla

    const actualizado = await prisma.usuario.update({ where: { id: body.id }, data, select: SELECT })
    const cambios: string[] = []
    if (nuevoRol !== objetivo.rol) cambios.push(`rol ${objetivo.rol} → ${nuevoRol}`)
    if (nuevoActivo !== objetivo.activo) cambios.push(nuevoActivo ? 'cuenta activada' : 'cuenta desactivada')
    if (body.password) cambios.push('contraseña restablecida')
    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Usuario', detalle: `Editó la cuenta de ${actualizado.nombre}${cambios.length ? ` (${cambios.join(', ')})` : ''}` })
    return NextResponse.json(actualizado)
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: mensajeDuplicado(e) }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al actualizar usuario.' }, { status: 500 })
  }
}

// PATCH /api/usuarios  { id, accion: 'aprobar' }  — aprueba una cuenta que se registró desde el login.
// (Rechazarla = eliminarla con DELETE.)
export async function PATCH(request: Request) {
  const { actor, error } = await requerirAdmin(request)
  if (error || !actor) return error!
  try {
    const body = await request.json()
    if (!body.id || body.accion !== 'aprobar') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })

    const objetivo = await prisma.usuario.findUnique({ where: { id: body.id } })
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    if (!objetivo.pendiente) return NextResponse.json({ error: 'Esta cuenta no está pendiente de aprobación.' }, { status: 400 })
    if (actor.rol === 'ADMIN' && objetivo.rol !== 'USUARIO') {
      return NextResponse.json({ error: 'No puedes aprobar esta cuenta.' }, { status: 403 })
    }

    const aprobado = await prisma.usuario.update({ where: { id: body.id }, data: { activo: true, pendiente: false }, select: SELECT })
    await registrarActividad({ actor, accion: 'APROBAR', entidad: 'Usuario', detalle: `Aprobó la cuenta de ${aprobado.nombre} (${aprobado.email})` })
    return NextResponse.json(aprobado)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al aprobar la cuenta.' }, { status: 500 })
  }
}

// DELETE /api/usuarios?id=xxx
export async function DELETE(request: Request) {
  const { actor, error } = await requerirAdmin(request)
  if (error || !actor) return error!
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    if (id === actor.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 })

    const objetivo = await prisma.usuario.findUnique({ where: { id } })
    if (!objetivo) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    if (actor.rol === 'ADMIN' && objetivo.rol !== 'USUARIO') {
      return NextResponse.json({ error: 'No puedes eliminar a administradores ni al superadmin.' }, { status: 403 })
    }
    if (objetivo.rol === 'SUPERADMIN') {
      const otros = await prisma.usuario.count({ where: { rol: 'SUPERADMIN', activo: true, id: { not: id } } })
      if (otros === 0) return NextResponse.json({ error: 'Debe existir al menos un superadmin activo.' }, { status: 400 })
    }
    await prisma.usuario.delete({ where: { id } })
    await registrarActividad({ actor, accion: objetivo.pendiente ? 'RECHAZAR' : 'ELIMINAR', entidad: 'Usuario', detalle: `${objetivo.pendiente ? 'Rechazó la solicitud de' : 'Eliminó la cuenta de'} ${objetivo.nombre} (${objetivo.email})` })
    return NextResponse.json({ eliminado: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al eliminar usuario.' }, { status: 500 })
  }
}
