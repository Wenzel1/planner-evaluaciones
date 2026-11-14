import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { prepararAdjunto } from '@/lib/adjuntos'

export const dynamic = 'force-dynamic'

// POST /api/evaluaciones/:id/comentarios/subida  { estudianteId, nombre, tamano, tipo } — el profesor adjunta un archivo o una nota de voz
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const ev = await prisma.evaluacion.findUnique({ where: { id }, select: { id: true, planificacion: { select: { materia: { select: { usuarioId: true } } } } } })
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    const denegado = verificarAcceso(actor, ev.planificacion.materia.usuarioId, 'escribir')
    if (denegado) return denegado
    const est = await prisma.estudiante.findFirst({ where: { id: String(body.estudianteId || ''), usuarioId: ev.planificacion.materia.usuarioId }, select: { id: true } })
    if (!est) return NextResponse.json({ error: 'Estudiante no encontrado.' }, { status: 404 })
    return await prepararAdjunto(ev.id, est.id, body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
