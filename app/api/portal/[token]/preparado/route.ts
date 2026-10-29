import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TOKEN_VALIDO } from '@/lib/portal'

// POST /api/portal/:token/preparado  { evaluacionId, preparado: boolean } — el estudiante marca "Ya me preparé"
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!TOKEN_VALIDO.test(token)) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })
    const est = await prisma.estudiante.findUnique({ where: { enlaceToken: token }, select: { id: true, estado: true, usuarioId: true, grupo: true } })
    if (!est || est.estado !== 'ACTIVO' || !est.usuarioId) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    // Solo evaluaciones de SU profesor y de SU sección
    const ev = await prisma.evaluacion.findFirst({
      where: { id: String(body.evaluacionId ?? ''), grupoSeccion: est.grupo || 'A', planificacion: { materia: { usuarioId: est.usuarioId } } },
      select: { id: true },
    })
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    if (body.preparado === true) {
      await prisma.preparacionEvaluacion.upsert({
        where: { estudianteId_evaluacionId: { estudianteId: est.id, evaluacionId: ev.id } },
        create: { estudianteId: est.id, evaluacionId: ev.id }, update: {},
      })
    } else {
      await prisma.preparacionEvaluacion.deleteMany({ where: { estudianteId: est.id, evaluacionId: ev.id } })
    }
    return NextResponse.json({ ok: true, preparado: body.preparado === true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar. Intenta de nuevo.' }, { status: 500 })
  }
}
