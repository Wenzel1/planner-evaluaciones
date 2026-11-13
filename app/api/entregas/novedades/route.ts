import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

export const dynamic = 'force-dynamic'

// GET /api/entregas/novedades?desde=ISO — entregas, mensajes y solicitudes de estudiantes desde esa fecha (para la campanita del profesor)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const d = new Date(new URL(request.url).searchParams.get('desde') || Date.now() - 86400000)
    const desde = isNaN(d.getTime()) ? new Date(Date.now() - 86400000) : d
    const propias = { evaluacion: { planificacion: { materia: { usuarioId: actor.id } } } }
    const [entregas, mensajes, solicitudes, pendientes, sinRevisar] = await Promise.all([
      prisma.entrega.findMany({ where: { ...propias, entregadaEn: { gt: desde } }, orderBy: { entregadaEn: 'desc' }, take: 30, select: { entregadaEn: true, estudiante: { select: { nombre: true } }, evaluacion: { select: { id: true, nombre: true } } } }),
      prisma.comentarioEvaluacion.findMany({ where: { ...propias, autor: 'ESTUDIANTE', createdAt: { gt: desde } }, orderBy: { createdAt: 'desc' }, take: 30, select: { createdAt: true, texto: true, estudiante: { select: { nombre: true } }, evaluacion: { select: { id: true, nombre: true } } } }),
      // Estudiantes que pidieron unirse con el código de clase
      prisma.estudiante.findMany({ where: { usuarioId: actor.id, estado: 'PENDIENTE', solicitadoEn: { gt: desde } }, orderBy: { solicitadoEn: 'desc' }, take: 20, select: { nombre: true, grupo: true, materia: { select: { nombre: true } } } }),
      prisma.estudiante.count({ where: { usuarioId: actor.id, estado: 'PENDIENTE' } }),
      // Entregas que todavía no revisa (contador rojo de la pestaña Entregas)
      prisma.entrega.count({ where: { ...propias, revisada: false, devuelta: false } }),
    ])
    return NextResponse.json({
      entregas: entregas.map(e => ({ en: e.entregadaEn, estudiante: e.estudiante.nombre, evaluacion: e.evaluacion.nombre, evaluacionId: e.evaluacion.id })),
      mensajes: mensajes.map(m => ({ en: m.createdAt, estudiante: m.estudiante.nombre, evaluacion: m.evaluacion.nombre, evaluacionId: m.evaluacion.id, texto: m.texto.slice(0, 120) })),
      solicitudes: solicitudes.map(x => ({ estudiante: x.nombre, seccion: x.grupo, materia: x.materia?.nombre || null })),
      pendientes,
      sinRevisar,
      ahora: new Date().toISOString(),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las novedades.' }, { status: 500 })
  }
}
