import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActor } from '@/lib/authServer'
import { hashPassword, verifyPassword } from '@/lib/password'
import { crearToken, COOKIE_SESION, DURACION_SESION_SEG } from '@/lib/session'
import { validarNombre, validarEmail, validarPassword, validarTelefono, validarCedula, normalizarTelefono, normalizarCedula } from '@/lib/validacionesUsuario'
import { opcionesCookieSesion } from '@/lib/cookies'
import { mensajeDuplicado } from '@/lib/duplicados'
import { bloqueado, registrarFallo, limpiar } from '@/lib/rateLimit'
import { registrarActividad } from '@/lib/actividad'

// Perfil del usuario autenticado: cualquier rol puede ver y editar SU PROPIA cuenta.
// El rol y el estado (activo) NO se pueden cambiar desde aquí.

// GET /api/perfil
export async function GET(request: Request) {
  const actor = await getActor(request)
  if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const u = await prisma.usuario.findUnique({
    where: { id: actor.id },
    select: { id: true, nombre: true, email: true, rol: true, telefono: true, cedula: true, debeCambiarPassword: true, createdAt: true },
  })
  return NextResponse.json(u)
}

// PUT /api/perfil  { nombre, email, passwordActual?, passwordNueva? }
export async function PUT(request: Request) {
  try {
    const actor = await getActor(request)
    if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const passwordActual = String(body.passwordActual ?? '')
    const passwordNueva = String(body.passwordNueva ?? '')

    const msg = validarNombre(nombre) || validarEmail(email)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    const actual = await prisma.usuario.findUnique({ where: { id: actor.id } })
    if (!actual) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const cambiaEmail = email !== actual.email.toLowerCase()
    const cambiaPassword = passwordNueva.length > 0

    // Teléfono: por ahí el administrador contacta a la persona, así que cambiarlo exige la contraseña actual
    const telefonoPedido = body.telefono === undefined ? undefined : String(body.telefono).trim()
    if (telefonoPedido) { const e = validarTelefono(telefonoPedido); if (e) return NextResponse.json({ error: e }, { status: 400 }) }
    const telefonoFinal = telefonoPedido ? normalizarTelefono(telefonoPedido) : undefined
    const cambiaTelefono = telefonoFinal !== undefined && telefonoFinal !== (actual.telefono ?? '')

    // Cédula: se puede registrar una sola vez; después solo la cambia un administrador
    const cedulaPedida = body.cedula === undefined ? '' : String(body.cedula).trim()
    let cedulaFinal: string | undefined
    if (cedulaPedida) {
      const e = validarCedula(cedulaPedida); if (e) return NextResponse.json({ error: e }, { status: 400 })
      if (actual.cedula && normalizarCedula(cedulaPedida) !== actual.cedula) {
        return NextResponse.json({ error: 'La cédula no se puede cambiar desde tu perfil. Pídele a un administrador que la corrija.' }, { status: 403 })
      }
      if (!actual.cedula) cedulaFinal = normalizarCedula(cedulaPedida)
    }

    // Con una clave temporal, lo único permitido es elegir una nueva
    if (actual.debeCambiarPassword && !cambiaPassword) {
      return NextResponse.json({ error: 'Debes elegir una nueva contraseña para continuar.' }, { status: 400 })
    }

    // Cambiar el correo o la contraseña exige confirmar la contraseña actual
    if (cambiaEmail || cambiaPassword || cambiaTelefono) {
      if (!passwordActual) {
        return NextResponse.json({ error: 'Ingresa tu contraseña actual para confirmar este cambio.' }, { status: 400 })
      }
      const clave = `perfil:${actor.id}`
      if (bloqueado(clave)) {
        return NextResponse.json({ error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' }, { status: 429 })
      }
      if (!(await verifyPassword(passwordActual, actual.passwordHash))) {
        registrarFallo(clave)
        return NextResponse.json({ error: 'La contraseña actual es incorrecta.' }, { status: 401 })
      }
      limpiar(clave)
    }

    if (cambiaPassword) {
      const p = validarPassword(passwordNueva)
      if (p) return NextResponse.json({ error: p }, { status: 400 })
      if (passwordNueva === passwordActual) {
        return NextResponse.json({ error: 'La nueva contraseña debe ser distinta a la actual.' }, { status: 400 })
      }
    }

    const data: any = { nombre, email }
    if (telefonoFinal !== undefined) data.telefono = telefonoFinal
    if (cedulaFinal) data.cedula = cedulaFinal
    if (cambiaPassword) {
      data.passwordHash = await hashPassword(passwordNueva)
      data.debeCambiarPassword = false
      // Las demás sesiones abiertas con la clave anterior se cierran. Se redondea al segundo anterior porque el token
      // nuevo guarda la hora en segundos; con milisegundos podía quedar "más viejo" que esta marca e invalidarse solo.
      data.sesionesDesde = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000)
    }

    const u = await prisma.usuario.update({
      where: { id: actor.id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, cedula: true },
    })

    const cambiosPerfil: string[] = []
    if (nombre !== actual.nombre) cambiosPerfil.push('nombre')
    if (cambiaEmail) cambiosPerfil.push('correo')
    if (cambiaPassword) cambiosPerfil.push('contraseña')
    if (cambiaTelefono) cambiosPerfil.push('teléfono')
    if (cedulaFinal) cambiosPerfil.push('cédula')
    if (cambiosPerfil.length) await registrarActividad({ actor: { id: u.id, nombre: u.nombre, rol: u.rol }, accion: 'EDITAR', entidad: 'Perfil', detalle: `Cambió su ${cambiosPerfil.join(', ')}` })

    // Renueva la sesión para que el token refleje el nombre/correo nuevos
    const token = await crearToken({ sub: u.id, nombre: u.nombre, email: u.email, rol: u.rol })
    const res = NextResponse.json(u)
    res.cookies.set(COOKIE_SESION, token, opcionesCookieSesion(request, DURACION_SESION_SEG))
    return res
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: mensajeDuplicado(e) }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al actualizar el perfil.' }, { status: 500 })
  }
}
