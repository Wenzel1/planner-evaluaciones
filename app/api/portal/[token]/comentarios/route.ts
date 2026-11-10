import { NextResponse } from 'next/server'
import { accesoPortal } from '@/lib/portalAcceso'
import prisma from '@/lib/prisma'
import { estudianteDeToken, evaluacionDelEstudiante } from '@/lib/entregas'
import { bloqueado, registrarFallo } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token/comentarios?evaluacionId=…  — conversación privada con el profesor sobre una evaluación
// (al leerla, los mensajes del profesor quedan como leídos)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const ev = await evaluacionDelEstudiante(est, new URL(request.url).searchParams.get('evaluacionId') || '')
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    const lista = await prisma.comentarioEvaluacion.findMany({ where: { evaluacionId: ev.id, estudianteId: est.id }, orderBy: { createdAt: 'asc' }, take: 200, select: { id: true, autor: true, texto: true, createdAt: true } })
    await prisma.comentarioEvaluacion.updateMany({ where: { evaluacionId: ev.id, estudianteId: est.id, autor: 'PROFESOR', leido: false }, data: { leido: true } })
    return NextResponse.json(lista)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los comentarios.' }, { status: 500 })
  }
}

// POST /api/portal/:token/comentarios  { evaluacionId, texto }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const clave = `comentario:${est.id}`
    if (bloqueado(clave, 40)) return NextResponse.json({ error: 'Escribiste muchos mensajes seguidos. Espera unos minutos.' }, { status: 429 })
    const body = await request.json().catch(() => ({}))
    const ev = await evaluacionDelEstudiante(est, String(body.evaluacionId || ''))
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    const texto = String(body.texto || '').trim().slice(0, 1000)
    if (texto.length < 2) return NextResponse.json({ error: 'Escribe tu mensaje.' }, { status: 400 })
    registrarFallo(clave) // cuenta mensajes para el límite (muchos en poco tiempo = espera)
    const c = await prisma.comentarioEvaluacion.create({ data: { evaluacionId: ev.id, estudianteId: est.id, autor: 'ESTUDIANTE', texto }, select: { id: true, autor: true, texto: true, createdAt: true } })
    return NextResponse.json(c, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar tu mensaje.' }, { status: 500 })
  }
}
