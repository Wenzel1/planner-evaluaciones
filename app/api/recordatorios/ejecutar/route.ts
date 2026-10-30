import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { tokensDeEstudiantes, urlPortal } from '@/lib/portal'
import { enviarLoteN8n, fechaBonita, nombreLimpio, nuevoId, primerNombre, ZONA_HORARIA, type MensajeLote } from '@/lib/whatsappLotes'
import { ultramsgConfigurado } from '@/lib/ultramsg'

export const maxDuration = 60

const HORA = 60 * 60 * 1000
// Con UltraMsg directo los mensajes salen desde aquí y la función tiene 60 s: se mandan menos por pasada (la siguiente, en 15 min, sigue)
const maxPorPasada = () => (ultramsgConfigurado() ? 120 : 300)

// Ventanas: se envía el recordatorio que corresponde al tiempo que falta (si ya pasó la ventana de 3 días, va el de 1 día)
function tipoSegunTiempo(msFaltan: number): '3D' | '1D' | '2H' | null {
  if (msFaltan <= 0) return null
  if (msFaltan <= 2 * HORA) return '2H'
  if (msFaltan <= 24 * HORA) return '1D'
  if (msFaltan <= 72 * HORA) return '3D'
  return null
}

// Días de calendario (en la hora de Venezuela) entre hoy y la fecha: 0 = hoy, 1 = mañana...
const diaLocal = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(d) // AAAA-MM-DD
function diasDeCalendario(desde: Date, hasta: Date): number {
  return Math.round((Date.parse(diaLocal(hasta)) - Date.parse(diaLocal(desde))) / 86400000)
}

function texto(tipo: '3D' | '1D' | '2H', d: { nombre: string; evaluacion: string; materia: string; seccion: string; fecha: Date; peso: number | null; actividad: string | null; enlace: string }) {
  const cuando = fechaBonita(d.fecha)
  const extra = [d.actividad ? `Estrategia: ${d.actividad}` : '', d.peso != null ? `Peso: ${d.peso}%` : ''].filter(Boolean).join(' · ')
  // Antes decía "mañana" aunque fuera hoy en la tarde, y "en 3 días" aunque faltaran 30 horas
  const dias = diasDeCalendario(new Date(), d.fecha)
  const minutos = Math.max(1, Math.round((d.fecha.getTime() - Date.now()) / 60000))
  const encabezado = tipo === '2H'
    ? `🔔 *Recordatorio:* en ${minutos >= 90 ? '2 horas' : minutos >= 50 ? '1 hora' : `${minutos} minutos`} comienza tu evaluación`
    : dias <= 0 ? '⏰ *Recordatorio:* hoy tienes una evaluación'
    : dias === 1 ? '⏰ *Recordatorio:* mañana tienes una evaluación'
    : `📅 *Recordatorio:* en ${dias} días tienes una evaluación`
  return `Hola ${d.nombre} 👋\n${encabezado}.\n\n*${d.evaluacion}*\n${d.materia} · Sección ${d.seccion}\n🗓️ ${cuando}${extra ? `\n${extra}` : ''}\n\n📚 Repasa los recursos y la rúbrica aquí:\n${d.enlace}\n\n¡Mucho éxito! 💪`
}

function autorizado(request: Request): boolean {
  const clave = process.env.RECORDATORIOS_CLAVE || process.env.N8N_CLAVE_WHATSAPP || ''
  const url = new URL(request.url)
  const recibida = request.headers.get('x-clave-app') || url.searchParams.get('clave') || ''
  const a = Buffer.from(recibida), b = Buffer.from(clave)
  return !!clave && a.length === b.length && crypto.timingSafeEqual(a, b)
}

// GET/POST /api/recordatorios/ejecutar?clave=...  — la llama cron-job.org cada 15 minutos.
// Busca evaluaciones programadas en las próximas 72 horas y envía por WhatsApp el recordatorio que toque
// (3 días, 1 día o 2 horas antes) a los estudiantes activos de esa sección. Nunca repite un recordatorio.
async function ejecutar(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const ahora = Date.now()
    const evaluaciones = await prisma.evaluacion.findMany({
      where: {
        fecha: { gt: new Date(ahora), lte: new Date(ahora + 72 * HORA) },
        estado: { in: ['PROGRAMADA', 'REPROGRAMADA'] },
      },
      orderBy: { fecha: 'asc' }, // las más cercanas primero
      select: {
        id: true, nombre: true, fecha: true, peso: true, tipoActividad: true, grupoSeccion: true,
        recordatorios: { select: { tipo: true, fechaEvaluacion: true } },
        planificacion: { select: { materia: { select: { nombre: true, usuarioId: true, usuario: { select: { activo: true } } } } } },
      },
    })

    const mensajes: MensajeLote[] = []
    const filas: any[] = []
    const resumen: { evaluacion: string; tipo: string; estudiantes: number }[] = []

    for (const ev of evaluaciones) {
      if (!ev.fecha) continue
      const tipo = tipoSegunTiempo(ev.fecha.getTime() - ahora)
      const materia = ev.planificacion.materia
      if (!tipo || !materia.usuarioId || materia.usuario?.activo === false) continue
      if (ev.recordatorios.some(r => r.tipo === tipo && r.fechaEvaluacion.getTime() === ev.fecha!.getTime())) continue

      const seccion = ev.grupoSeccion || 'A'
      const estudiantes = (await prisma.estudiante.findMany({
        where: { usuarioId: materia.usuarioId, grupo: seccion, estado: 'ACTIVO', telefono: { not: null } },
        select: { id: true, nombre: true, telefono: true },
      })).filter(e => (e.telefono || '').replace(/\D/g, '').length >= 7)
      // Si la sección completa no cabe en esta pasada, queda para la siguiente (salvo que sea la primera: esa va entera)
      if (mensajes.length > 0 && mensajes.length + estudiantes.length > maxPorPasada()) break

      // Se registra ANTES de enviar: si dos pasadas coinciden, la segunda choca con el registro único y no repite
      try {
        await prisma.recordatorioEnviado.create({ data: { evaluacionId: ev.id, tipo, fechaEvaluacion: ev.fecha } })
      } catch (e: any) {
        if (e?.code === 'P2002') continue
        throw e
      }

      const loteId = nuevoId()
      const tokens = await tokensDeEstudiantes(estudiantes.map(e => e.id))
      let cuenta = 0
      for (const est of estudiantes) {
        const id = nuevoId()
        mensajes.push({
          id, telefono: est.telefono as string,
          texto: texto(tipo, { nombre: primerNombre(est.nombre), evaluacion: nombreLimpio(ev.nombre), materia: materia.nombre, seccion, fecha: ev.fecha, peso: ev.peso, actividad: ev.tipoActividad, enlace: urlPortal(request, tokens.get(est.id) as string) }),
        })
        filas.push({ id, loteId, usuarioId: materia.usuarioId, tipo: 'RECORDATORIO', estudianteId: est.id, nombre: est.nombre, telefono: est.telefono })
        cuenta++
      }
      await prisma.recordatorioEnviado.updateMany({ where: { evaluacionId: ev.id, tipo, fechaEvaluacion: ev.fecha }, data: { enviados: cuenta } })
      resumen.push({ evaluacion: nombreLimpio(ev.nombre), tipo, estudiantes: cuenta })
    }

    if (filas.length > 0) await prisma.envioWhatsApp.createMany({ data: filas })
    const r = await enviarLoteN8n(request, mensajes)
    return NextResponse.json({ ok: r.ok, error: r.error, revisadas: evaluaciones.length, mensajes: mensajes.length, resumen })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al procesar los recordatorios' }, { status: 500 })
  }
}

export const GET = ejecutar
export const POST = ejecutar
