import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// PATCH /api/chat/mensajes/:id { valoracion: 1 | -1 | 0 } — 👍 / 👎 de una respuesta del agente
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const v = Number(body.valoracion)
  if (![1, -1, 0].includes(v)) return NextResponse.json({ error: 'Valoración no válida.' }, { status: 400 })
  const r = await prisma.mensaje.updateMany({ where: { id, rol: 'AGENT', conversacion: { usuarioId: actor.id } }, data: { valoracion: v === 0 ? null : v } })
  return NextResponse.json({ ok: r.count > 0 })
}
