import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';

// POST /api/comentarios
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const comentario = await prisma.comentarioAgente.create({
      data: {
        tipo: body.tipo,
        mensaje: body.mensaje,
        planificacionId: body.planificacionId || null,
      },
    })

    return NextResponse.json(comentario, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 })
  }
}