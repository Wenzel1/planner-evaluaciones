import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TOKEN_VALIDO } from '@/lib/portal'

// POST /api/portal/:token/opinion  { materiaId, deAcuerdo: boolean, comentario?: string }
// El estudiante dice si está de acuerdo con el plan. Si ya había opinado, se reemplaza (y le vuelve a aparecer al profesor como nueva).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!TOKEN_VALIDO.test(token)) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })
    const est = await prisma.estudiante.findUnique({ where: { enlaceToken: token }, select: { id: true, estado: true, usuarioId: true } })
    if (!est || est.estado !== 'ACTIVO' || !est.usuarioId) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    if (typeof body.deAcuerdo !== 'boolean') return NextResponse.json({ error: 'Elige si estás de acuerdo o no.' }, { status: 400 })
    const comentario = String(body.comentario ?? '').replace(/\s+\n/g, '\n').trim().slice(0, 600)
    if (!body.deAcuerdo && comentario.length < 5) return NextResponse.json({ error: 'Cuéntale a tu profesor qué cambiarías (al menos unas palabras).' }, { status: 400 })

    // Solo materias de SU profesor
    const materia = await prisma.materia.findFirst({ where: { id: String(body.materiaId ?? ''), usuarioId: est.usuarioId }, select: { id: true } })
    if (!materia) return NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 })

    const datos = { deAcuerdo: body.deAcuerdo, comentario: comentario || null, leida: false }
    const op = await prisma.opinionPlan.upsert({
      where: { estudianteId_materiaId: { estudianteId: est.id, materiaId: materia.id } },
      create: { ...datos, estudianteId: est.id, materiaId: materia.id },
      update: datos,
      select: { deAcuerdo: true, comentario: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, opinion: { deAcuerdo: op.deAcuerdo, comentario: op.comentario, fecha: op.updatedAt } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar tu opinión. Intenta de nuevo.' }, { status: 500 })
  }
}
