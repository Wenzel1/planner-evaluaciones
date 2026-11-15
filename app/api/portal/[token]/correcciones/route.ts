import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken, evaluacionDelEstudiante } from '@/lib/entregas'
import { vistaCorreccion } from '@/lib/correcciones'
import { enlaceArchivo } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token/correcciones?evaluacionId=…             — las correcciones del profesor sobre SU entrega
// GET /api/portal/:token/correcciones?evaluacionId=…&abrir=<id>  — abre la copia corregida
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const q = new URL(request.url).searchParams
    const ev = await evaluacionDelEstudiante(est, q.get('evaluacionId') || '')
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    const entrega = await prisma.entrega.findFirst({ where: { evaluacionId: ev.id, estudianteId: est.id }, select: { id: true } })
    if (!entrega) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
    const abrir = q.get('abrir')
    if (abrir) {
      const c = await prisma.correccionArchivo.findFirst({ where: { id: abrir, entregaId: entrega.id } })
      if (!c?.rutaCorregida) return NextResponse.json({ error: 'No hay copia corregida.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(c.rutaCorregida, q.get('descargar') ? c.nombreCorregido || undefined : undefined))
    }
    const lista = await prisma.correccionArchivo.findMany({ where: { entregaId: entrega.id }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json(lista.map(vistaCorreccion), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las correcciones.' }, { status: 500 })
  }
}
