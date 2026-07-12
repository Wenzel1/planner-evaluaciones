import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';

// POST /api/conversaciones/:id/mensajes
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const mensaje = await prisma.mensaje.create({
      data: {
        rol: body.rol,
        contenido: body.contenido,
        completo: body.completo ?? true,
        conversacionId: params.id,
      },
    })

    await prisma.conversacion.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(mensaje, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al agregar mensaje' }, { status: 500 })
  }
}