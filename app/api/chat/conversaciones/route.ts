import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/chat/conversaciones?planificacionId=… — conversaciones del profesor (las más recientes primero)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const planId = new URL(request.url).searchParams.get('planificacionId')
    const lista = await prisma.conversacion.findMany({
      where: { usuarioId: actor.id, ...(planId ? { OR: [{ planificacionId: planId }, { planificacionId: null }] } : {}), mensajes: { some: {} } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, titulo: true, updatedAt: true, _count: { select: { mensajes: true } } },
    })
    return NextResponse.json(lista.map(c => ({ id: c.id, titulo: c.titulo || 'Conversación', fecha: c.updatedAt, mensajes: c._count.mensajes })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las conversaciones.' }, { status: 500 })
  }
}
