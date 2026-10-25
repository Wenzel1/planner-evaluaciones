import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { claveN8n } from '@/lib/whatsappLotes'

// POST /api/whatsapp/estado  { id, ok, error? }  — la llama n8n después de cada mensaje (público, protegido con x-clave-app)
export async function POST(request: Request) {
  try {
    const clave = claveN8n()
    const recibida = request.headers.get('x-clave-app') || ''
    const a = Buffer.from(recibida), b = Buffer.from(clave)
    if (!clave || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
    const ok = body.ok === true || body.ok === 'true'
    await prisma.envioWhatsApp.updateMany({
      where: { id, estado: 'PENDIENTE' },
      data: ok
        ? { estado: 'ENVIADO', enviadoEn: new Date(), error: null }
        : { estado: 'FALLIDO', error: String(body.error ?? 'No se pudo enviar').slice(0, 300) },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al registrar el estado' }, { status: 500 })
  }
}
