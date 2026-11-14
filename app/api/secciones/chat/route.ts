import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { mensajesChat, extrasProfesor, borrarMensaje } from '@/lib/chatSeccion'
import { datosAdjuntoEn, carpetaChat } from '@/lib/adjuntos'
import { enlaceArchivo } from '@/lib/almacenamiento'
import { accesoChat } from './acceso'

export const dynamic = 'force-dynamic'

// GET /api/secciones/chat?materiaId=…&seccion=A — el chat de la sección (con observaciones y opiniones, solo para el profesor)
//   &adjunto=<id> → abre el archivo o la nota de voz de un mensaje
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const r = await accesoChat(request, q.get('materiaId'), q.get('seccion'), 'leer')
    if (r.error) return r.error
    const { actor, materia, seccion } = r
    const adjunto = q.get('adjunto')
    if (adjunto) {
      const m = await prisma.mensajeSeccion.findFirst({ where: { id: adjunto, materiaId: materia.id, seccion }, select: { adjuntoRuta: true, adjuntoNombre: true } })
      if (!m?.adjuntoRuta) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(m.adjuntoRuta, q.get('descargar') ? m.adjuntoNombre || undefined : undefined))
    }
    const [mensajes, extras, estudiantes] = await Promise.all([
      mensajesChat(materia.id, seccion, { usuarioId: actor.id }),
      extrasProfesor(materia.id, seccion),
      prisma.estudiante.count({ where: { usuarioId: materia.usuarioId, grupo: seccion, estado: 'ACTIVO', OR: [{ materiaId: materia.id }, { materiaId: null }] } }),
    ])
    // Al abrir el chat, las observaciones y opiniones quedan como leídas
    prisma.observacion.updateMany({ where: { materiaId: materia.id, leida: false }, data: { leida: true } }).catch(() => {})
    prisma.opinionPlan.updateMany({ where: { materiaId: materia.id, leida: false, estudiante: { grupo: seccion } }, data: { leida: true } }).catch(() => {})
    const items = [...mensajes, ...extras].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return NextResponse.json({ items, estudiantes, materia: materia.nombre, seccion }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar el chat.' }, { status: 500 })
  }
}

// POST /api/secciones/chat  { materiaId, seccion, texto?, adjunto? } — el profesor escribe en el chat de la sección
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await accesoChat(request, body.materiaId, body.seccion, 'escribir')
    if (r.error) return r.error
    const { actor, materia, seccion } = r
    const texto = String(body.texto || '').trim().slice(0, 2000)
    const adj = datosAdjuntoEn(carpetaChat(materia.id, seccion), body.adjunto)
    if (adj === 'invalido') return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 })
    if (!texto && !adj) return NextResponse.json({ error: 'Escribe tu mensaje.' }, { status: 400 })
    const m = await prisma.mensajeSeccion.create({ data: { materiaId: materia.id, seccion, autorTipo: 'PROFESOR', usuarioId: actor.id, autorNombre: actor.nombre, texto, ...(adj || {}) } })
    return NextResponse.json({ id: m.id }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar.' }, { status: 500 })
  }
}

// DELETE /api/secciones/chat?materiaId=…&seccion=A&id=… — el profesor borra un mensaje del chat de su sección
export async function DELETE(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const r = await accesoChat(request, q.get('materiaId'), q.get('seccion'), 'escribir')
    if (r.error) return r.error
    const m = await prisma.mensajeSeccion.findFirst({ where: { id: q.get('id') || '', materiaId: r.materia.id, seccion: r.seccion }, select: { id: true } })
    if (!m) return NextResponse.json({ error: 'Mensaje no encontrado.' }, { status: 404 })
    await borrarMensaje(m.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 })
  }
}
