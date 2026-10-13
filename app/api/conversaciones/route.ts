import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { requerirActor, verificarAcceso } from '@/lib/permisos';

// POST /api/conversaciones
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()

    // Si la conversación se asocia a una planificación, esa planificación debe ser del usuario
    if (body.planificacionId) {
      const plan = await prisma.planificacion.findUnique({
        where: { id: body.planificacionId },
        select: { materia: { select: { usuarioId: true } } },
      })
      if (!plan) return NextResponse.json({ error: 'Planificación no encontrada' }, { status: 404 })
      const denegado = verificarAcceso(actor, plan.materia.usuarioId, 'escribir')
      if (denegado) return denegado
    }

    const conversacion = await prisma.conversacion.create({
      data: {
        titulo: body.titulo || null,
        planificacionId: body.planificacionId || null,
        usuarioId: actor.id,
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
