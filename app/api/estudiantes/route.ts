import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, quiereTodos, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarAPapelera } from '@/lib/papelera'

// GET /api/estudiantes  (solo los del usuario; ADMIN/SUPERADMIN pueden pedir ?todos=1)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { searchParams } = new URL(request.url)
    const grupo = searchParams.get('grupo')
    const estado = searchParams.get('estado')
    const buscar = searchParams.get('buscar')
    const todos = quiereTodos(request, actor)

    const where: any = {}
    if (!todos) where.usuarioId = actor.id
    else if (searchParams.get('duenoId')) where.usuarioId = searchParams.get('duenoId') // un admin mira los estudiantes de un profesor
    if (grupo) where.grupo = grupo
    if (estado && ['ACTIVO', 'INACTIVO'].includes(estado.toUpperCase())) where.estado = estado.toUpperCase()
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { email: { contains: buscar, mode: 'insensitive' } },
        { telefono: { contains: buscar } },
      ]
    }

    const estudiantes = await prisma.estudiante.findMany({
      where,
      include: {
        ...(todos ? { usuario: { select: { id: true, nombre: true } } } : {}),
        _count: { select: { calificaciones: { where: { puntaje: { not: null } } } } }, // cuántas notas tiene
      },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(estudiantes.map(({ _count, ...e }: any) => ({ ...e, notasCargadas: _count?.calificaciones ?? 0 })))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener estudiantes' }, { status: 500 })
  }
}

// POST /api/estudiantes
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()

    // Validaciones
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 3) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (typeof body.email !== 'string' || !emailRegex.test(body.email.trim())) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 })
    }
    const telefono = String(body.telefono ?? '').trim()
    const grupo = String(body.grupo || 'A').trim().toUpperCase()
    const estado = body.estado ? String(body.estado).trim().toUpperCase() : undefined
    if (!/^[A-Z]$/.test(grupo)) return NextResponse.json({ error: 'El grupo debe ser una letra (A, B, C...).' }, { status: 400 })
    if (estado && estado !== 'ACTIVO' && estado !== 'INACTIVO') return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 })
    if (telefono.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'El teléfono debe tener al menos 7 dígitos.' }, { status: 400 })
    }

    const estudiante = await prisma.estudiante.create({
      data: {
        nombre: body.nombre.trim(),
        email: body.email.trim().toLowerCase(),
        telefono,
        grupo,
        estado: (estado as any) || 'ACTIVO',
        usuarioId: actor.id,
      },
    })
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Estudiante', detalle: `Agregó a ${estudiante.nombre}` })
    return NextResponse.json(estudiante, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya tienes un estudiante registrado con ese email.' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al crear estudiante' }, { status: 500 })
  }
}

// PUT /api/estudiantes (EDITAR)
export async function PUT(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const existente = await prisma.estudiante.findUnique({ where: { id: body.id }, select: { usuarioId: true } })
    if (!existente) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    const denegado = verificarAcceso(actor, existente.usuarioId, 'escribir')
    if (denegado) return denegado
    
    // Validaciones
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 3) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (typeof body.email !== 'string' || !emailRegex.test(body.email.trim())) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 })
    }
    const telefono = String(body.telefono ?? '').trim()
    const grupo = String(body.grupo || 'A').trim().toUpperCase()
    const estado = body.estado ? String(body.estado).trim().toUpperCase() : undefined
    if (!/^[A-Z]$/.test(grupo)) return NextResponse.json({ error: 'El grupo debe ser una letra (A, B, C...).' }, { status: 400 })
    if (estado && estado !== 'ACTIVO' && estado !== 'INACTIVO') return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 })
    if (telefono.replace(/\D/g, '').length < 7) {
      return NextResponse.json({ error: 'El teléfono debe tener al menos 7 dígitos.' }, { status: 400 })
    }

    const estudiante = await prisma.estudiante.update({
      where: { id: body.id },
      data: {
        nombre: body.nombre.trim(),
        email: body.email.trim().toLowerCase(),
        telefono,
        grupo,
        estado: (estado as any) ?? undefined,
      },
    })
    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Estudiante', detalle: `Editó a ${estudiante.nombre}` })
    return NextResponse.json(estudiante)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya tienes otro estudiante con ese email.' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE /api/estudiantes?id=xxx
export async function DELETE(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const existente = await prisma.estudiante.findUnique({ where: { id } })
    if (!existente) return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    const denegado = verificarAcceso(actor, existente.usuarioId, 'eliminar')
    if (denegado) return denegado

    if (existente.usuarioId) {
      const { id: _id, usuarioId: _dueno, createdAt: _c, updatedAt: _u, ...campos } = existente as any
      // Sus notas viajan con él a la papelera: al restaurarlo vuelven (si la evaluación todavía existe)
      const calificaciones = await prisma.calificacion.findMany({ where: { estudianteId: id }, select: { evaluacionId: true, puntaje: true, observaciones: true, detalle: true } })
      await enviarAPapelera([{ usuarioId: existente.usuarioId, tipo: 'ESTUDIANTE', nombre: existente.nombre, contexto: existente.email, eliminadoPorId: actor.id, eliminadoPorNombre: actor.nombre, datos: { ...campos, calificaciones } }])
    }
    await prisma.estudiante.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Estudiante', detalle: `Eliminó a ${existente.nombre}` })
    return NextResponse.json({ eliminado: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
