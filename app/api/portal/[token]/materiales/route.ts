import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken } from '@/lib/entregas'
import { unidadesDeMateria } from '@/lib/materiales'
import { enlaceArchivo } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token/materiales?materiaId=…            — unidades visibles de la materia (solo de su profesor y su clase)
// GET /api/portal/:token/materiales?materiaId=…&abrir=<id>  — abre un archivo (enlace temporal)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const q = new URL(request.url).searchParams
    const materia = await prisma.materia.findUnique({ where: { id: q.get('materiaId') || '' }, select: { id: true, usuarioId: true } })
    if (!materia || materia.usuarioId !== est.usuarioId || (est.materiaId && est.materiaId !== materia.id)) return NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 })

    const abrir = q.get('abrir')
    if (abrir) {
      const m = await prisma.material.findFirst({
        where: { id: abrir, unidad: { materiaId: materia.id, OR: [{ visibleDesde: null }, { visibleDesde: { lte: new Date() } }] } },
        select: { ruta: true, titulo: true },
      })
      if (!m?.ruta) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(m.ruta, q.get('descargar') ? m.titulo : undefined))
    }
    return NextResponse.json(await unidadesDeMateria(materia.id, { soloVisibles: true, seccion: est.grupo || 'A' }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los materiales.' }, { status: 500 })
  }
}
