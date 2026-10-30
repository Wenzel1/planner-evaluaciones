import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/chat/uso?dias=14 — uso del agente (solo superadmin): respuestas por día, modelos, respaldos y valoraciones
export async function GET(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ error: 'Solo el superadmin.' }, { status: 403 })
  const dias = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get('dias')) || 14))
  const desde = new Date(Date.now() - dias * 86400000)
  const msgs = await prisma.mensaje.findMany({
    where: { createdAt: { gte: desde }, rol: 'AGENT' }, take: 20000,
    select: { createdAt: true, modelo: true, respaldo: true, valoracion: true, completo: true, conversacion: { select: { usuarioId: true } } },
  })
  const zona = process.env.ZONA_HORARIA || 'America/Caracas'
  const dia = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(d)
  const porDia: Record<string, number> = {}
  for (let i = dias - 1; i >= 0; i--) porDia[dia(new Date(Date.now() - i * 86400000))] = 0
  const porModelo: Record<string, number> = {}
  const usuarios = new Set<string>()
  let respaldos = 0, positivas = 0, negativas = 0, incompletas = 0
  for (const m of msgs) {
    const k = dia(m.createdAt); if (k in porDia) porDia[k]++
    const mod = m.modelo || 'desconocido'; porModelo[mod] = (porModelo[mod] || 0) + 1
    if (m.respaldo) respaldos++
    if (m.valoracion === 1) positivas++; else if (m.valoracion === -1) negativas++
    if (!m.completo) incompletas++
    if (m.conversacion?.usuarioId) usuarios.add(m.conversacion.usuarioId)
  }
  return NextResponse.json({ dias, respuestas: msgs.length, usuarios: usuarios.size, respaldos, positivas, negativas, incompletas, porDia, porModelo })
}
