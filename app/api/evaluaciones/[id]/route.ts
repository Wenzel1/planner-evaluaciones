import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarAPapelera } from '@/lib/papelera'

// DELETE /api/evaluaciones/:id
// El dueño puede eliminar la suya; ADMIN y SUPERADMIN pueden eliminar la de cualquier profesor (moderación).
// Nadie puede EDITAR evaluaciones ajenas.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id },
      include: {
        planificacion: {
          select: { materia: { select: { nombre: true, usuarioId: true, usuario: { select: { nombre: true } } } } },
        },
      },
    })
    if (!evaluacion) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

    const materia = evaluacion.planificacion.materia
    const denegado = verificarAcceso(actor, materia.usuarioId, 'eliminar')
    if (denegado) return denegado

    // Si la elimina un admin, el profesor dueño la encuentra en SU papelera y puede restaurarla
    if (materia.usuarioId) {
      const { planificacion: _plan, id: _id, ...campos } = evaluacion as any
      await enviarAPapelera([{
        usuarioId: materia.usuarioId,
        tipo: 'EVALUACION',
        nombre: evaluacion.nombre,
        contexto: materia.nombre,
        eliminadoPorId: actor.id,
        eliminadoPorNombre: actor.nombre,
        datos: { ...campos, fecha: evaluacion.fecha ? evaluacion.fecha.toISOString() : null, createdAt: undefined, updatedAt: undefined },
      }])
    }
    await prisma.evaluacion.delete({ where: { id } })

    const esPropia = materia.usuarioId === actor.id
    await registrarActividad({
      actor,
      accion: 'ELIMINAR',
      entidad: 'Evaluación',
      detalle: esPropia
        ? `Eliminó "${evaluacion.nombre}" (materia "${materia.nombre}")`
        : `Moderación: eliminó "${evaluacion.nombre}" de ${materia.usuario?.nombre ?? 'una cuenta sin dueño'} (materia "${materia.nombre}")`,
    })
    return NextResponse.json({ eliminado: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al eliminar la evaluación' }, { status: 500 })
  }
}
