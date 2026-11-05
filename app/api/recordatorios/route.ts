import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { nombreLimpio, nuevoId } from '@/lib/whatsappLotes'
import {
  leerPref, guardarPref, limpiarPref, leerEstadoCron, leerProgramados, guardarProgramados, proximoEnvio, enviarAviso, evalParaAviso, notaDe,
  NOMBRE_VENTANA, type Ventana,
} from '@/lib/recordatorios'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const DIA = 86400000

// GET /api/recordatorios[?solo=alertas] — panel de recordatorios del profesor:
// estado del servicio automático, próximas evaluaciones (cuándo sale cada aviso), historial, programados y alertas para el profesor.
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const soloAlertas = new URL(request.url).searchParams.get('solo') === 'alertas'
    const ahora = Date.now()

    // Evaluaciones del profesor de los últimos 30 días a los próximos 30
    const evs = await prisma.evaluacion.findMany({
      where: { planificacion: { materia: { usuarioId: actor.id } }, fecha: { gte: new Date(ahora - 30 * DIA), lte: new Date(ahora + 30 * DIA) } },
      orderBy: { fecha: 'asc' },
      select: {
        id: true, nombre: true, fecha: true, estado: true, grupoSeccion: true, rubrica: true, recursos: true, planificacionId: true,
        recordatorios: { select: { tipo: true, fechaEvaluacion: true, enviados: true, createdAt: true } },
        calificaciones: { where: { puntaje: { not: null } }, select: { id: true }, take: 1 },
        planificacion: { select: { materia: { select: { id: true, nombre: true } } } },
      },
    })

    // ---------- Alertas para el profesor ----------
    const alertas: { tipo: string; texto: string; evaluacionId?: string }[] = []
    const activa = (e: typeof evs[number]) => !['CANCELADA', 'REALIZADA'].includes(String(e.estado))
    for (const e of evs) {
      if (!e.fecha) continue
      const falta = e.fecha.getTime() - ahora
      const nombre = `«${nombreLimpio(e.nombre)}» (${e.planificacion.materia.nombre}, Sec. ${e.grupoSeccion || 'A'})`
      if (activa(e) && falta > 0 && falta <= 3 * DIA) {
        const rub: any = e.rubrica
        if (!rub?.criterios?.length) alertas.push({ tipo: 'rubrica', texto: `${nombre} es en ${Math.max(1, Math.round(falta / DIA))} día(s) y no tiene rúbrica.`, evaluacionId: e.id })
        if (!Array.isArray(e.recursos) || !(e.recursos as any[]).length) alertas.push({ tipo: 'recursos', texto: `${nombre} es pronto y no tiene recursos de estudio.`, evaluacionId: e.id })
      }
      if (String(e.estado) !== 'CANCELADA' && falta < -2 * DIA && !e.calificaciones.length) alertas.push({ tipo: 'notas', texto: `${nombre} ya pasó y todavía no tiene notas cargadas.`, evaluacionId: e.id })
    }
    // Pesos por sección (de todos los planes del profesor)
    const planes = await prisma.evaluacion.groupBy({ by: ['planificacionId', 'grupoSeccion'], where: { planificacion: { materia: { usuarioId: actor.id } }, estado: { not: 'CANCELADA' } }, _sum: { peso: true }, _count: true })
    const nombresPlan = new Map((await prisma.planificacion.findMany({ where: { id: { in: [...new Set(planes.map(p => p.planificacionId))] } }, select: { id: true, materia: { select: { nombre: true } } } })).map(p => [p.id, p.materia.nombre]))
    for (const p of planes) {
      const suma = Math.round(p._sum.peso || 0)
      if (p._count >= 2 && suma !== 100) alertas.push({ tipo: 'pesos', texto: `Los pesos de ${nombresPlan.get(p.planificacionId) || 'una materia'}, Sección ${p.grupoSeccion || 'A'}, suman ${suma}% (deberían sumar 100%).` })
    }
    // Estudiantes que nunca abrieron su página, con una evaluación en los próximos 3 días
    const secciones = [...new Set(evs.filter(e => activa(e) && e.fecha && e.fecha.getTime() > ahora && e.fecha.getTime() - ahora <= 3 * DIA).map(e => e.grupoSeccion || 'A'))]
    if (secciones.length) {
      const sinAbrir = await prisma.estudiante.groupBy({ by: ['grupo'], where: { usuarioId: actor.id, estado: 'ACTIVO', grupo: { in: secciones }, portalVisitas: 0 }, _count: true })
      for (const s of sinAbrir) if (s._count > 0) alertas.push({ tipo: 'portal', texto: `${s._count} estudiante(s) de la Sección ${s.grupo} nunca abrieron su página y tienen evaluación en los próximos días.` })
    }
    if (soloAlertas) return NextResponse.json({ alertas })

    // ---------- Panel ----------
    const pref = await leerPref(actor.id)
    const estado = await leerEstadoCron()
    const futuras = evs.filter(e => activa(e) && e.fecha && e.fecha.getTime() > ahora && e.fecha.getTime() - ahora <= 30 * DIA)
    const conteo = new Map((await prisma.estudiante.groupBy({ by: ['grupo'], where: { usuarioId: actor.id, estado: 'ACTIVO' }, _count: true })).map(g => [g.grupo, g._count]))
    const proximas = futuras.map(e => {
      const enviados = e.recordatorios.filter(r => r.fechaEvaluacion.getTime() === e.fecha!.getTime()).map(r => r.tipo)
      const apagada = pref.apagadas.includes(e.id)
      const prox = proximoEnvio(e.fecha!, pref, enviados, apagada)
      return {
        id: e.id, nombre: nombreLimpio(e.nombre), materia: e.planificacion.materia.nombre, materiaId: e.planificacion.materia.id, seccion: e.grupoSeccion || 'A', fecha: e.fecha,
        estudiantes: conteo.get(e.grupoSeccion || 'A') || 0, apagada, nota: pref.notas[e.id] || '',
        enviados: enviados.map(t => NOMBRE_VENTANA[t as Ventana] || t),
        proximo: prox ? { cuando: prox.cuando, cual: NOMBRE_VENTANA[prox.ventana] } : null,
      }
    })

    // Historial: envíos de recordatorios de los últimos 30 días, agrupados por envío
    const envios = await prisma.envioWhatsApp.findMany({
      where: { usuarioId: actor.id, tipo: 'RECORDATORIO', createdAt: { gte: new Date(ahora - 30 * DIA) } },
      orderBy: { createdAt: 'desc' }, take: 1500,
      select: { loteId: true, nombre: true, estado: true, error: true, createdAt: true },
    })
    const nombreEv = new Map(evs.map(e => [e.id, nombreLimpio(e.nombre)]))
    const lotes = new Map<string, { loteId: string; fecha: Date; titulo: string; total: number; enviados: number; fallidos: number; pendientes: number; fallas: { nombre: string; error: string }[] }>()
    const TIPO: Record<string, string> = { '7D': '1 semana antes', '3D': '3 días antes', '1D': '1 día antes', '2H': '2 horas antes', AHORA: 'enviado a mano', REPROGRAMADA: 'aviso de cambio de fecha', CANCELADA: 'aviso de cancelación' }
    for (const x of envios) {
      let l = lotes.get(x.loteId)
      if (!l) {
        const m = /^R_(.+?)_(7D|3D|1D|2H|AHORA|REPROGRAMADA|CANCELADA)_/.exec(x.loteId)
        const titulo = m ? `${nombreEv.get(m[1]) || 'Evaluación'} · ${TIPO[m[2]]}` : x.loteId.startsWith('P_') ? 'Mensaje programado' : 'Recordatorio'
        l = { loteId: x.loteId, fecha: x.createdAt, titulo, total: 0, enviados: 0, fallidos: 0, pendientes: 0, fallas: [] }
        lotes.set(x.loteId, l)
      }
      l.total++
      if (x.estado === 'ENVIADO') l.enviados++; else if (x.estado === 'FALLIDO') { l.fallidos++; if (l.fallas.length < 30) l.fallas.push({ nombre: x.nombre, error: x.error || 'No se pudo enviar' }) } else l.pendientes++
    }
    const programados = (await leerProgramados()).filter(p => p.usuarioId === actor.id).sort((a, b) => a.enviarEn.localeCompare(b.enviarEn))

    return NextResponse.json({ pref, estado, proximas, historial: [...lotes.values()].slice(0, 40), programados, alertas })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los recordatorios.' }, { status: 500 })
  }
}

async function evaluacionPropia(actorId: string, id: string) {
  const e = await prisma.evaluacion.findUnique({ where: { id }, select: { id: true, planificacion: { select: { materia: { select: { usuarioId: true } } } } } })
  return e && e.planificacion.materia.usuarioId === actorId ? e : null
}

// PUT /api/recordatorios — guarda preferencias. Acepta { pref } (generales) y/o { evaluacion: { id, apagada?, nota? } }
export async function PUT(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    let pref = await leerPref(actor.id)
    if (body.pref) pref = limpiarPref({ ...pref, ...body.pref, apagadas: pref.apagadas, notas: pref.notas })
    if (body.evaluacion?.id) {
      const id = String(body.evaluacion.id)
      if (!(await evaluacionPropia(actor.id, id))) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
      if (typeof body.evaluacion.apagada === 'boolean') pref.apagadas = body.evaluacion.apagada ? [...new Set([...pref.apagadas, id])] : pref.apagadas.filter(x => x !== id)
      if (typeof body.evaluacion.nota === 'string') { const t = body.evaluacion.nota.trim().slice(0, 300); if (t) pref.notas[id] = t; else delete pref.notas[id] }
      pref = limpiarPref(pref)
    }
    await guardarPref(actor.id, pref)
    return NextResponse.json({ pref })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron guardar las preferencias.' }, { status: 500 })
  }
}

// POST /api/recordatorios
//   { accion: 'enviar', evaluacionId }                          → recordatorio a la sección ahora mismo
//   { accion: 'programar', seccion, texto, enviarEn, incluirEnlace? } → mensaje que sale solo en esa fecha y hora
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    if (body.accion === 'enviar') {
      const ev = await evalParaAviso(String(body.evaluacionId || ''))
      if (!ev || ev.usuarioId !== actor.id) return NextResponse.json({ error: 'Evaluación no encontrada. Si la acabas de crear, espera a que se guarde.' }, { status: 404 })
      if (ev.fecha.getTime() < Date.now()) return NextResponse.json({ error: 'Esa evaluación ya pasó.' }, { status: 400 })
      const pref = await leerPref(actor.id)
      const r = await enviarAviso(request, ev, 'AHORA', { nota: notaDe(pref, ev.id) })
      if (!r.total) return NextResponse.json({ error: `Ningún estudiante activo de la Sección ${ev.grupoSeccion || 'A'} tiene a dónde enviarle el mensaje.` }, { status: 400 })
      await registrarActividad({ actor, accion: 'ENVIAR', entidad: 'Recordatorio', detalle: `Envió el recordatorio de "${ev.nombre}" a ${r.total} estudiante(s)`.slice(0, 300) })
      return NextResponse.json({ total: r.total, sinDestino: r.sinDestino, ok: r.ok, error: r.error, loteId: r.loteId })
    }
    if (body.accion === 'programar') {
      const seccion = String(body.seccion || 'A').toUpperCase().slice(0, 2)
      const texto = String(body.texto || '').trim().slice(0, 1000)
      const cuando = new Date(body.enviarEn)
      if (texto.length < 3) return NextResponse.json({ error: 'Escribe el mensaje.' }, { status: 400 })
      if (isNaN(cuando.getTime()) || cuando.getTime() < Date.now() - 60_000) return NextResponse.json({ error: 'La fecha y hora deben ser futuras.' }, { status: 400 })
      if (cuando.getTime() > Date.now() + 120 * DIA) return NextResponse.json({ error: 'Se puede programar hasta 4 meses adelante.' }, { status: 400 })
      const lista = await leerProgramados()
      if (lista.filter(p => p.usuarioId === actor.id).length >= 30) return NextResponse.json({ error: 'Tienes 30 mensajes programados; elimina alguno primero.' }, { status: 400 })
      const nuevo = { id: nuevoId(), usuarioId: actor.id, seccion, materiaId: body.materiaId ? String(body.materiaId) : null, texto, enviarEn: cuando.toISOString(), incluirEnlace: body.incluirEnlace !== false, creado: new Date().toISOString() }
      await guardarProgramados([...lista, nuevo])
      return NextResponse.json({ programado: nuevo })
    }
    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo completar.' }, { status: 500 })
  }
}

// DELETE /api/recordatorios?programado=ID — cancela un mensaje programado
export async function DELETE(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const id = new URL(request.url).searchParams.get('programado') || ''
    const lista = await leerProgramados()
    const queda = lista.filter(p => !(p.id === id && p.usuarioId === actor.id))
    if (queda.length === lista.length) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
    await guardarProgramados(queda)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cancelar.' }, { status: 500 })
  }
}
