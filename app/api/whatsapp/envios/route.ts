import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/whatsapp/envios?lote=ID — estado de cada mensaje de un envío (solo el profesor que lo hizo)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const lote = new URL(request.url).searchParams.get('lote') || ''
    if (!lote) return NextResponse.json({ error: 'Falta el lote.' }, { status: 400 })
    const items = await prisma.envioWhatsApp.findMany({
      where: { loteId: lote, usuarioId: actor.id },
      orderBy: { nombre: 'asc' },
      select: { id: true, estudianteId: true, nombre: true, estado: true, error: true, enviadoEn: true },
    })
    return NextResponse.json({ items })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al consultar el envío.' }, { status: 500 })
  }
}
