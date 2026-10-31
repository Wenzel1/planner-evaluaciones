import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { admiteExamenEnLinea } from '@/lib/examen'

export const dynamic = 'force-dynamic'

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const DIA = 86400000
const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').trim()
const cuando = (d: Date) => {
  const k = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(x)
  const dias = Math.round((Date.parse(k(d)) - Date.parse(k(new Date()))) / DIA)
  const hora = new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }).format(d)
  return dias === 0 ? `hoy ${hora}` : dias === 1 ? `mañana ${hora}` : new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'long', day: 'numeric' }).format(d)
}

export interface Aviso { tipo: 'proxima' | 'confirmar' | 'notas' | 'opiniones' | 'envios' | 'rubrica' | 'examen'; texto: string; pedido: string; seccion?: string; urgente?: boolean }

// GET /api/chat/avisos?planificacionId=… — pendientes del profesor para mostrarlos al abrir el chat (sin usar IA)
export async function GET(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error
  try {
    const id = new URL(request.url).searchParams.get('planificacionId')
    const plan = id ? await prisma.planificacion.findFirst({ where: { id, materia: { usuarioId: actor.id } }, select: { id: true, materiaId: true } }) : null
    const avisos: Aviso[] = []
    const ahora = Date.now()

    if (plan) {
      const [evs, alumnos] = await Promise.all([
        prisma.evaluacion.findMany({
          where: { planificacionId: plan.id, estado: { not: 'CANCELADA' } },
          orderBy: { fecha: 'asc' },
          select: { id: true, nombre: true, fecha: true, estado: true, grupoSeccion: true, rubrica: true, recursos: true, examen: true, tipoActividad: true, enfoque: true, descripcion: true, _count: { select: { calificaciones: { where: { puntaje: { not: null } } } as any, preparaciones: true } } },
        }),
        prisma.estudiante.findMany({ where: { usuarioId: actor.id, estado: 'ACTIVO' }, select: { grupo: true, portalVisitas: true } }),
      ])
      const enSeccion = (s: string) => alumnos.filter(a => a.grupo === s)

      // Próximas 3 días: cuántos no han abierto su página / se prepararon
      for (const e of evs.filter(e => e.fecha && e.fecha.getTime() > ahora && e.fecha.getTime() < ahora + 3 * DIA && e.estado !== 'REALIZADA').slice(0, 3)) {
        const grupo = enSeccion(e.grupoSeccion)
        const sinAbrir = grupo.filter(a => !a.portalVisitas).length
        const prep = (e._count as any).preparaciones || 0
        avisos.push({
          tipo: 'proxima', seccion: e.grupoSeccion, urgente: e.fecha!.getTime() - ahora < DIA,
          texto: `«${limpio(e.nombre)}» es ${cuando(e.fecha!)} (Sección ${e.grupoSeccion})${grupo.length ? ` · ${prep} de ${grupo.length} se prepararon${sinAbrir ? ` · ${sinAbrir} no han abierto su página` : ''}` : ''}`,
          pedido: sinAbrir ? `Mándale el plan por WhatsApp a los de la Sección ${e.grupoSeccion} que no han abierto su página` : `¿Cómo se ve la Sección ${e.grupoSeccion} para «${limpio(e.nombre)}»?`,
        })
        if (!e.rubrica) avisos.push({ tipo: 'rubrica', seccion: e.grupoSeccion, texto: `«${limpio(e.nombre)}» todavía no tiene rúbrica`, pedido: `Crea la rúbrica de «${limpio(e.nombre)}» (Sección ${e.grupoSeccion})` })
      }
      // Ya pasaron y siguen como programadas
      const vencidas = evs.filter(e => e.fecha && e.fecha.getTime() < ahora - 2 * 3600000 && (e.estado === 'PROGRAMADA' || e.estado === 'REPROGRAMADA'))
      if (vencidas.length) avisos.push({ tipo: 'confirmar', seccion: vencidas[0].grupoSeccion, texto: `${vencidas.length === 1 ? `«${limpio(vencidas[0].nombre)}» ya pasó` : `${vencidas.length} evaluaciones ya pasaron`} y sigue${vencidas.length === 1 ? '' : 'n'} como programada${vencidas.length === 1 ? '' : 's'}`, pedido: `Marca como realizadas las evaluaciones que ya pasaron en la Sección ${vencidas[0].grupoSeccion}` })
      // Realizadas con notas incompletas
      for (const e of evs.filter(e => e.estado === 'REALIZADA').slice(-4)) {
        const total = enSeccion(e.grupoSeccion).length
        const conNota = (e._count as any).calificaciones || 0
        if (total && conNota < total) avisos.push({ tipo: 'notas', seccion: e.grupoSeccion, texto: `Faltan ${total - conNota} nota(s) de «${limpio(e.nombre)}» (Sección ${e.grupoSeccion})`, pedido: `¿Quiénes no tienen nota en «${limpio(e.nombre)}» de la Sección ${e.grupoSeccion}?` })
      }
      // Exámenes en línea: entregados sin publicar y evaluaciones teóricas próximas que aún no tienen examen
      const porPublicar = await prisma.respuestaExamen.groupBy({ by: ['evaluacionId'], where: { evaluacion: { planificacionId: plan.id }, entregadoEn: { not: null }, publicada: false }, _count: { _all: true } }).catch(() => [] as any[])
      for (const g of (Array.isArray(porPublicar) ? porPublicar : []).slice(0, 2)) {
        const e = evs.find(x => x.id === g.evaluacionId)
        if (e) avisos.push({ tipo: 'examen', seccion: e.grupoSeccion, urgente: true, texto: `${g._count._all} examen(es) de «${limpio(e.nombre)}» entregados esperan tu revisión (Sección ${e.grupoSeccion})`, pedido: `¿Cómo les fue en el examen de «${limpio(e.nombre)}» de la Sección ${e.grupoSeccion}?` })
      }
      const sinExamen = evs.filter(e => !e.examen && e.fecha && e.fecha.getTime() > ahora && e.fecha.getTime() < ahora + 14 * DIA && admiteExamenEnLinea(e.tipoActividad, e.enfoque, e.descripcion))
      if (sinExamen.length) avisos.push({ tipo: 'examen', seccion: sinExamen[0].grupoSeccion, texto: `«${limpio(sinExamen[0].nombre)}» es teórica y todavía no tiene examen en línea${sinExamen.length > 1 ? ` (y ${sinExamen.length - 1} más)` : ''}`, pedido: `Prepárame el examen en línea de «${limpio(sinExamen[0].nombre)}» (Sección ${sinExamen[0].grupoSeccion})` })
      const sinLeer = await prisma.opinionPlan.count({ where: { materiaId: plan.materiaId, leida: false } })
      if (sinLeer) avisos.push({ tipo: 'opiniones', texto: `${sinLeer} opinión(es) nueva(s) de estudiantes sobre el plan`, pedido: 'Resúmeme las opiniones nuevas de los estudiantes' })
    }
    const fallidos = await prisma.envioWhatsApp.count({ where: { usuarioId: actor.id, estado: 'FALLIDO', createdAt: { gt: new Date(ahora - 2 * DIA) } } })
    if (fallidos) avisos.push({ tipo: 'envios', urgente: true, texto: `${fallidos} WhatsApp no se pudieron enviar en los últimos 2 días`, pedido: '¿Qué WhatsApp fallaron y por qué?' })

    return NextResponse.json({ avisos: avisos.slice(0, 6) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ avisos: [] })
  }
}
