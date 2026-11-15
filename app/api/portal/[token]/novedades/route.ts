import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken } from '@/lib/entregas'
import { textoCambio } from '@/lib/cambiosPlan'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token/novedades?materiaId=… — los avisos de cambios del plan que su profesor envió (últimas 3 semanas),
// agrupados por envío: { en, nota, cambios: [texto] }. El estudiante los ve al entrar aunque no lea el correo.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const materiaId = new URL(request.url).searchParams.get('materiaId') || ''
    const materia = await prisma.materia.findUnique({ where: { id: materiaId }, select: { id: true, usuarioId: true } })
    if (!materia || materia.usuarioId !== est.usuarioId || (est.materiaId && est.materiaId !== materia.id)) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    const filas = await prisma.cambioPlan.findMany({
      where: { materiaId: materia.id, seccion: (est.grupo || 'A').toUpperCase(), avisadoEn: { gte: new Date(Date.now() - 21 * 86400000) } },
      orderBy: { createdAt: 'asc' }, take: 200,
    })
    const ids = filas.map(f => f.evaluacionId).filter(Boolean) as string[]
    const evs = ids.length ? await prisma.evaluacion.findMany({ where: { id: { in: ids } }, select: { id: true, fecha: true, peso: true } }) : []
    const porId = new Map(evs.map(e => [e.id, e]))
    const grupos = new Map<string, { en: string; nota: string | null; cambios: string[] }>()
    for (const f of filas) {
      const k = f.avisadoEn!.toISOString()
      const g = grupos.get(k) || { en: k, nota: f.nota, cambios: [] }
      const ev = f.evaluacionId ? porId.get(f.evaluacionId) : undefined
      g.cambios.push(textoCambio(f, { fecha: ev?.fecha?.toISOString() ?? null, peso: ev?.peso ?? null }))
      grupos.set(k, g)
    }
    return NextResponse.json([...grupos.values()].sort((a, b) => b.en.localeCompare(a.en)).slice(0, 5), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json([], { status: 200 })
  }
}
