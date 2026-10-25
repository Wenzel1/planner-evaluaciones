import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { requerirActor, verificarAcceso } from '@/lib/permisos';

// POST /api/conversaciones
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()
    const rol = String(body.rol || 'USER').toUpperCase()
    const contenido = String(body.contenido ?? '').trim()
    if (rol !== 'USER' && rol !== 'AGENT') return NextResponse.json({ error: 'Rol de mensaje no válido.' }, { status: 400 })
    if (!contenido) return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 })

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
            rol: rol as any,
            contenido,
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
