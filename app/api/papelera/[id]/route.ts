import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

// DELETE /api/papelera/:id — eliminar definitivamente (solo el dueño)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params

    const item = await prisma.papeleraItem.findUnique({ where: { id }, select: { usuarioId: true, nombre: true, tipo: true } })
    if (!item || item.usuarioId !== actor.id) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await prisma.papeleraItem.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Papelera', detalle: `Eliminó definitivamente "${item.nombre}" (${item.tipo === 'ESTUDIANTE' ? 'estudiante' : 'evaluación'})` })
    return NextResponse.json({ eliminado: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
