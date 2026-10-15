import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, quiereTodos, verificarAcceso, bloquearSiSuperadmin } from '@/lib/permisos'
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
    if (grupo) where.grupo = grupo
    if (estado) where.estado = estado.toUpperCase()
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { email: { contains: buscar, mode: 'insensitive' } },
        { telefono: { contains: buscar } },
      ]
    }

    const estudiantes = await prisma.estudiante.findMany({
      where,
      ...(todos ? { include: { usuario: { select: { id: true, nombre: true } } } } : {}),
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(estudiantes)
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
    const bloqueado = bloquearSiSuperadmin(actor)
    if (bloqueado) return bloqueado
    const body = await request.json()

    // Validaciones
    if (!body.nombre || body.nombre.trim().length < 3) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!body.email || !emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 })
    }
    if (!body.telefono || body.telefono.trim().length < 7) {
      return NextResponse.json({ error: 'El teléfono debe tener al menos 7 dígitos.' }, { status: 400 })
    }

    const estudiante = await prisma.estudiante.create({
      data: {
        nombre: body.nombre.trim(),
        email: body.email.trim().toLowerCase(),
        telefono: body.telefono.trim(),
        grupo: body.grupo || 'A',
        estado: body.estado || 'ACTIVO',
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
    if (!body.nombre || body.nombre.trim().length < 3) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 3 caracteres.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!body.email || !emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 })
    }
    if (!body.telefono || body.telefono.trim().length < 7) {
      return NextResponse.json({ error: 'El teléfono debe tener al menos 7 dígitos.' }, { status: 400 })
    }

    const estudiante = await prisma.estudiante.update({
      where: { id: body.id },
      data: {
        nombre: body.nombre.trim(),
        email: body.email.trim().toLowerCase(),
        telefono: body.telefono.trim(),
        grupo: body.grupo || 'A',
        estado: body.estado ? body.estado.toUpperCase() : undefined,
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
    const denegado = verificarAcceso(actor, existente.usuarioId, 'escribir')
    if (denegado) return denegado

    if (existente.usuarioId) {
      const { id: _id, usuarioId: _dueno, createdAt: _c, updatedAt: _u, ...campos } = existente as any
      await enviarAPapelera([{ usuarioId: existente.usuarioId, tipo: 'ESTUDIANTE', nombre: existente.nombre, contexto: existente.email, eliminadoPorId: actor.id, eliminadoPorNombre: actor.nombre, datos: campos }])
    }
    await prisma.estudiante.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Estudiante', detalle: `Eliminó a ${existente.nombre}` })
    return NextResponse.json({ eliminado: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
