import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';

// POST /api/conversaciones
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const conversacion = await prisma.conversacion.create({
      data: {
        titulo: body.titulo || null,
        planificacionId: body.planificacionId || null,
        mensajes: {
          create: {
            rol: body.rol || 'USER',
            contenido: body.contenido,
            completo: body.completo ?? true,
          },
        },
      },
      include: {
        mensajes: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json(conversacion, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear conversación' }, { status: 500 })
  }
}