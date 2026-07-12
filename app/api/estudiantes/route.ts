import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/estudiantes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const grupo = searchParams.get('grupo')
    const estado = searchParams.get('estado')
    const buscar = searchParams.get('buscar')

    const where: any = {}
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
      },
    })
    return NextResponse.json(estudiante, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El email ya está registrado.' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al crear estudiante' }, { status: 500 })
  }
}

// PUT /api/estudiantes (EDITAR)
export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }
    
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
    return NextResponse.json(estudiante)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El email ya está registrado por otro estudiante.' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE /api/estudiantes?id=xxx
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    await prisma.estudiante.delete({ where: { id } })
    return NextResponse.json({ eliminado: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}