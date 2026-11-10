import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'

export const dynamic = 'force-dynamic'

async function contexto(request: Request, id: string, estudianteId: string, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const ev = await prisma.evaluacion.findUnique({ where: { id }, select: { id: true, planificacion: { select: { materia: { select: { usuarioId: true } } } } } })
  if (!ev) return { error: NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, ev.planificacion.materia.usuarioId, modo)
  if (denegado) return { error: denegado }
  const est = await prisma.estudiante.findFirst({ where: { id: estudianteId, usuarioId: ev.planificacion.materia.usuarioId }, select: { id: true } })
  if (!est) return { error: NextResponse.json({ error: 'Estudiante no encontrado.' }, { status: 404 }) }
  return { ok: true }
}

// GET /api/evaluaciones/:id/comentarios?estudianteId=…  — conversación privada con un estudiante (marca leídos los suyos)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const estudianteId = new URL(request.url).searchParams.get('estudianteId') || ''
    const r = await contexto(request, id, estudianteId, 'leer')
    if (r.error) return r.error
    const lista = await prisma.comentarioEvaluacion.findMany({ where: { evaluacionId: id, estudianteId }, orderBy: { createdAt: 'asc' }, take: 200, select: { id: true, autor: true, texto: true, createdAt: true } })
    await prisma.comentarioEvaluacion.updateMany({ where: { evaluacionId: id, estudianteId, autor: 'ESTUDIANTE', leido: false }, data: { leido: true } })
    return NextResponse.json(lista)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los comentarios.' }, { status: 500 })
  }
}

// POST /api/evaluaciones/:id/comentarios  { estudianteId, texto }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const estudianteId = String(body.estudianteId || '')
    const r = await contexto(request, id, estudianteId, 'escribir')
    if (r.error) return r.error
    const texto = String(body.texto || '').trim().slice(0, 1000)
    if (texto.length < 2) return NextResponse.json({ error: 'Escribe tu mensaje.' }, { status: 400 })
    const c = await prisma.comentarioEvaluacion.create({ data: { evaluacionId: id, estudianteId, autor: 'PROFESOR', texto }, select: { id: true, autor: true, texto: true, createdAt: true } })
    return NextResponse.json(c, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 })
  }
}
