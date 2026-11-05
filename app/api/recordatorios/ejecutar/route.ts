import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { nombreLimpio } from '@/lib/whatsappLotes'
import { correoConfigurado } from '@/lib/correo'
import { ultramsgConfigurado } from '@/lib/ultramsg'
import {
  leerPref, ventanaQueToca, enHorario, enviarAviso, notaDe, anotarEstadoCron, anotarNoAutorizado,
  leerProgramados, guardarProgramados, enviarProgramado, type PrefRecordatorios,
} from '@/lib/recordatorios'

export const maxDuration = 60

const HORA = 60 * 60 * 1000
// cron-job.org espera 30 s como máximo: con correo o UltraMsg directo se mandan pocos por pasada (la siguiente, en 15 min, sigue)
const maxPorPasada = () => (correoConfigurado() ? 40 : ultramsgConfigurado() ? 60 : 300)
const TIEMPO_MAXIMO = 22_000

function autorizado(request: Request): boolean {
  const clave = process.env.RECORDATORIOS_CLAVE || process.env.N8N_CLAVE_WHATSAPP || ''
  const url = new URL(request.url)
  const recibida = request.headers.get('x-clave-app') || url.searchParams.get('clave') || ''
  const a = Buffer.from(recibida), b = Buffer.from(clave)
  return !!clave && a.length === b.length && crypto.timingSafeEqual(a, b)
}

// GET/POST /api/recordatorios/ejecutar?clave=...  — la llama cron-job.org cada 15 minutos.
// Revisa las evaluaciones de los próximos 7 días y envía el recordatorio que toque según lo que eligió cada profesor
// (1 semana, 3 días, 1 día o 2 horas antes; dentro de su horario), más los mensajes programados que ya vencieron.
// Nunca repite un recordatorio. Con ?prueba=1 solo dice qué enviaría, sin enviar nada.
// Cada llamada queda anotada para que el profesor vea en el panel si el servicio está funcionando.
async function ejecutar(request: Request) {
  if (!autorizado(request)) {
    await anotarNoAutorizado()
    return NextResponse.json({ error: 'No autorizado: la clave no coincide con RECORDATORIOS_CLAVE de Vercel.' }, { status: 401 })
  }
  const prueba = new URL(request.url).searchParams.get('prueba') === '1'
  const inicio = Date.now()
  try {
    const ahora = Date.now()
    const evaluaciones = await prisma.evaluacion.findMany({
      where: { fecha: { gt: new Date(ahora), lte: new Date(ahora + 168 * HORA) }, estado: { in: ['PROGRAMADA', 'REPROGRAMADA'] } },
      orderBy: { fecha: 'asc' }, // las más cercanas primero
      select: {
        id: true, nombre: true, fecha: true, peso: true, tipoActividad: true, grupoSeccion: true,
        recordatorios: { select: { tipo: true, fechaEvaluacion: true } },
        planificacion: { select: { materia: { select: { nombre: true, usuarioId: true, usuario: { select: { activo: true } } } } } },
      },
    })

    const prefs = new Map<string, PrefRecordatorios>()
    const pref = async (u: string) => { if (!prefs.has(u)) prefs.set(u, await leerPref(u)); return prefs.get(u)! }
    let mensajes = 0
    const resumen: { evaluacion: string; tipo: string; estudiantes: number; error?: string }[] = []
    const errores: string[] = []

    for (const ev of evaluaciones) {
      if (!ev.fecha) continue
      const materia = ev.planificacion.materia
      if (!materia.usuarioId || materia.usuario?.activo === false) continue
      const p = await pref(materia.usuarioId)
      if (p.apagadas.includes(ev.id)) continue
      const tipo = ventanaQueToca(ev.fecha.getTime() - ahora, p.ventanas)
      if (!tipo) continue
      if (tipo !== '2H' && !enHorario(p)) continue // fuera del horario del profesor: espera a la mañana
      if (ev.recordatorios.some(r => r.tipo === tipo && r.fechaEvaluacion.getTime() === ev.fecha!.getTime())) continue
      if (mensajes >= maxPorPasada() || Date.now() - inicio > TIEMPO_MAXIMO) break // lo que falte, en la siguiente pasada

      const datos = { id: ev.id, nombre: ev.nombre, fecha: ev.fecha, peso: ev.peso, tipoActividad: ev.tipoActividad, grupoSeccion: ev.grupoSeccion, materia: materia.nombre, usuarioId: materia.usuarioId }
      if (prueba) {
        const r = await enviarAviso(request, datos, tipo, { probar: true })
        resumen.push({ evaluacion: nombreLimpio(ev.nombre), tipo, estudiantes: r.total }); continue
      }
      // Se registra ANTES de enviar: si dos pasadas coinciden, la segunda choca con el registro único y no repite
      try { await prisma.recordatorioEnviado.create({ data: { evaluacionId: ev.id, tipo, fechaEvaluacion: ev.fecha } }) }
      catch (e: any) { if (e?.code === 'P2002') continue; throw e }
      const r = await enviarAviso(request, datos, tipo, { nota: notaDe(p, ev.id) })
      await prisma.recordatorioEnviado.updateMany({ where: { evaluacionId: ev.id, tipo, fechaEvaluacion: ev.fecha }, data: { enviados: r.total } })
      mensajes += r.total
      if (!r.ok && r.error) errores.push(r.error)
      resumen.push({ evaluacion: nombreLimpio(ev.nombre), tipo, estudiantes: r.total, ...(r.ok ? {} : { error: r.error }) })
    }

    // Mensajes programados por los profesores que ya vencieron
    const programados = await leerProgramados()
    const vencidos = programados.filter(x => new Date(x.enviarEn).getTime() <= Date.now())
    if (vencidos.length && !prueba) {
      const enviados = new Set<string>()
      for (const x of vencidos) {
        if (Date.now() - inicio > TIEMPO_MAXIMO) break
        const r = await enviarProgramado(request, x)
        enviados.add(x.id); mensajes += r.total
        if (!r.ok && r.error) errores.push(r.error)
        resumen.push({ evaluacion: `Mensaje programado (Sección ${x.seccion})`, tipo: 'PROGRAMADO', estudiantes: r.total })
      }
      await guardarProgramados((await leerProgramados()).filter(x => !enviados.has(x.id)))
    } else if (prueba) vencidos.forEach(x => resumen.push({ evaluacion: `Mensaje programado (Sección ${x.seccion})`, tipo: 'PROGRAMADO', estudiantes: 0 }))

    if (!prueba) await anotarEstadoCron({ ultima: new Date().toISOString(), ok: errores.length === 0, error: errores[0] || null, mensajes, revisadas: evaluaciones.length })
    return NextResponse.json({ ok: errores.length === 0, prueba, error: errores[0], revisadas: evaluaciones.length, mensajes, resumen })
  } catch (e: any) {
    console.error(e)
    if (!prueba) await anotarEstadoCron({ ultima: new Date().toISOString(), ok: false, error: String(e?.message || e).slice(0, 200) })
    return NextResponse.json({ error: 'Error al procesar los recordatorios' }, { status: 500 })
  }
}

export const GET = ejecutar
export const POST = ejecutar
