import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/chat/conversaciones/:id — mensajes de una conversación propia
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const c = await prisma.conversacion.findFirst({ where: { id, usuarioId: actor.id }, select: { id: true, titulo: true } })
    if (!c) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 })
    const mensajes = await prisma.mensaje.findMany({ where: { conversacionId: id }, orderBy: { createdAt: 'asc' }, take: 200, select: { id: true, rol: true, contenido: true, acciones: true, modelo: true, respaldo: true, valoracion: true, createdAt: true } })
    return NextResponse.json({ ...c, mensajes })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo abrir la conversación.' }, { status: 500 })
  }
}

// DELETE /api/chat/conversaciones/:id
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const r = await prisma.conversacion.deleteMany({ where: { id, usuarioId: actor.id } })
    return NextResponse.json({ eliminada: r.count > 0 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo eliminar.' }, { status: 500 })
  }
}
