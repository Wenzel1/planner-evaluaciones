import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { mensajesChat } from '@/lib/chatSeccion'
import { datosAdjuntoEn, carpetaChat } from '@/lib/adjuntos'
import { enlaceArchivo } from '@/lib/almacenamiento'
import { getActor } from '@/lib/authServer'
import { bloqueado, registrarFallo } from '@/lib/rateLimit'
import { accesoChatEstudiante } from './acceso'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token/chat?materiaId=… — el chat de su sección (&adjunto=<id> abre un archivo o nota de voz)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const q = new URL(request.url).searchParams
    const r = await accesoChatEstudiante(request, token, q.get('materiaId'))
    if (r.error) return r.error
    const adjunto = q.get('adjunto')
    if (adjunto) {
      const m = await prisma.mensajeSeccion.findFirst({ where: { id: adjunto, materiaId: r.materia.id, seccion: r.seccion }, select: { adjuntoRuta: true, adjuntoNombre: true } })
      if (!m?.adjuntoRuta) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(m.adjuntoRuta, q.get('descargar') ? m.adjuntoNombre || undefined : undefined))
    }
    const items = await mensajesChat(r.materia.id, r.seccion, { estudianteId: r.est.id })
    return NextResponse.json({ items, materia: r.materia.nombre, seccion: r.seccion }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar el chat.' }, { status: 500 })
  }
}

// POST /api/portal/:token/chat  { materiaId, texto?, adjunto? } — el estudiante escribe en el chat de su sección
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const r = await accesoChatEstudiante(request, token, body.materiaId)
    if (r.error) return r.error
    const clave = `chat-seccion:${r.est.id}`
    if (bloqueado(clave, 60)) return NextResponse.json({ error: 'Escribiste muchos mensajes seguidos. Espera unos minutos.' }, { status: 429 })
    const texto = String(body.texto || '').trim().slice(0, 2000)
    const adj = datosAdjuntoEn(carpetaChat(r.materia.id, r.seccion), body.adjunto)
    if (adj === 'invalido') return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 })
    if (!texto && !adj) return NextResponse.json({ error: 'Escribe tu mensaje.' }, { status: 400 })
    registrarFallo(clave)
    const actor = await getActor(request)
    const m = await prisma.mensajeSeccion.create({ data: { materiaId: r.materia.id, seccion: r.seccion, autorTipo: 'ESTUDIANTE', estudianteId: r.est.id, usuarioId: actor?.rol === 'ESTUDIANTE' ? actor.id : null, autorNombre: r.est.nombre, texto, ...(adj || {}) } })
    return NextResponse.json({ id: m.id }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar.' }, { status: 500 })
  }
}
