import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

const MAX = 25

// GET /api/chat/memoria — lo que el agente recuerda del profesor
export async function GET(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  const items = await prisma.memoriaAgente.findMany({ where: { usuarioId: actor.id }, orderBy: { createdAt: 'desc' }, take: MAX, select: { id: true, texto: true, createdAt: true } })
  return NextResponse.json(items)
}

// POST /api/chat/memoria { texto } — guarda una preferencia (se ignora si ya existe una igual)
export async function POST(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  const body = await request.json().catch(() => ({}))
  const texto = String(body.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (texto.length < 4) return NextResponse.json({ error: 'Texto muy corto.' }, { status: 400 })
  const existentes = await prisma.memoriaAgente.findMany({ where: { usuarioId: actor.id }, orderBy: { createdAt: 'asc' }, select: { id: true, texto: true } })
  if (existentes.some(m => m.texto.toLowerCase() === texto.toLowerCase())) return NextResponse.json({ ok: true, repetida: true })
  if (existentes.length >= MAX) await prisma.memoriaAgente.delete({ where: { id: existentes[0].id } }) // se olvida la más vieja
  const m = await prisma.memoriaAgente.create({ data: { usuarioId: actor.id, texto }, select: { id: true, texto: true } })
  return NextResponse.json({ ok: true, memoria: m })
}

// DELETE /api/chat/memoria?id=… (sin id: borra todo)
export async function DELETE(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  const id = new URL(request.url).searchParams.get('id')
  const r = await prisma.memoriaAgente.deleteMany({ where: { usuarioId: actor.id, ...(id ? { id } : {}) } })
  return NextResponse.json({ eliminadas: r.count })
}
