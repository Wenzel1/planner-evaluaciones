import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { requerirActor, verificarAcceso } from '@/lib/permisos';

// POST /api/comentarios
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()

    // Si el comentario se asocia a una planificación, esa planificación debe ser del usuario
    if (body.planificacionId) {
      const plan = await prisma.planificacion.findUnique({
        where: { id: body.planificacionId },
        select: { materia: { select: { usuarioId: true } } },
      })
      if (!plan) return NextResponse.json({ error: 'Planificación no encontrada' }, { status: 404 })
      const denegado = verificarAcceso(actor, plan.materia.usuarioId, 'escribir')
      if (denegado) return denegado
    }

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
