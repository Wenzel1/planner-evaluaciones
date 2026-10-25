import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { requerirActor, verificarAcceso } from '@/lib/permisos';

// POST /api/comentarios
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()
    const tipo = String(body.tipo ?? '').toUpperCase()
    const mensaje = String(body.mensaje ?? '').trim()
    if (!['SUGERENCIA', 'ALERTA', 'INFO', 'EXITO'].includes(tipo)) return NextResponse.json({ error: 'Tipo de comentario no válido.' }, { status: 400 })
    if (!mensaje) return NextResponse.json({ error: 'El comentario está vacío.' }, { status: 400 })

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
        tipo: tipo as any,
        mensaje,
        planificacionId: body.planificacionId || null,
      },
    })

    return NextResponse.json(comentario, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 })
  }
}
