import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { leerConfig } from '@/lib/configuracion'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { PROMPT_BASE, PROMPT_REVISION, construirContexto, type EvalContexto } from '@/lib/agente/prompt'
import { analisisPorCriterio, estudiantesEnRiesgo, filtrarRiesgo, textoRiesgo, cargaPorSemana } from '@/lib/agente/analisis'
import { feriadosEntre } from '@/lib/feriados'
import { normalizarAccion, resumenAccion, HERRAMIENTAS_SERVIDOR, type Accion } from '@/lib/agente/herramientas'
import { ejecutarConsulta, describirConsulta } from '@/lib/agente/consultas'
import { responder, type Turno } from '@/lib/agente/modelos'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_POR_VENTANA = 40 // mensajes por persona en la ventana del limitador (protege el cupo de IA)

const json = (d: any, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } })

// POST /api/chat — el chat del agente EvaPlanner, con respuesta en tiempo real.
// Cuerpo: { mensaje, conversacionId?, planificacionId?, contexto: { materia, seccion, evaluaciones[], otrasSecciones }, eventos?: string[], regenerar?: boolean }
// Respuesta: líneas JSON (NDJSON): {t:'inicio'} {t:'texto',v} {t:'accion',accion} {t:'aviso',v} {t:'fin'} | {t:'error',mensaje}
export async function POST(request: Request) {
  const { actor, error } = await requerirActor(request)
  if (error) return error

  let cfg: any = {}
  try { cfg = (await leerConfig()) || {} } catch { /* sin configuración: valores por defecto */ }
  const chat = cfg.chat || {}
  if (chat.activo === false) return json({ error: chat.mensajeInactivo || 'El asistente está desactivado por el administrador.' }, 403)

  const body = await request.json().catch(() => ({}))
  const mensaje = String(body.mensaje ?? '').trim()
  if (!mensaje) return json({ error: 'Escribe un mensaje.' }, 400)
  const maxCar = Number(chat.maxCaracteresMensaje) || 4000
  if (mensaje.length > maxCar) return json({ error: `Tu mensaje tiene ${mensaje.length} caracteres y el máximo es ${maxCar}.` }, 400)

  const claveLimite = `chat:${actor.id}`
  if (bloqueado(claveLimite, MAX_POR_VENTANA)) return json({ error: `Enviaste muchos mensajes seguidos. Espera ${minutosRestantes(claveLimite)} minuto(s).` }, 429)
  registrarFallo(claveLimite)

  // ---------- Plan del profesor (solo si es suyo) ----------
  const plan = body.planificacionId
    ? await prisma.planificacion.findFirst({ where: { id: String(body.planificacionId), materia: { usuarioId: actor.id } }, select: { id: true, materiaId: true } })
    : null

  // ---------- Conversación ----------
  let conversacion = body.conversacionId
    ? await prisma.conversacion.findFirst({ where: { id: String(body.conversacionId), usuarioId: actor.id }, select: { id: true } })
    : null
  if (!conversacion) {
    conversacion = await prisma.conversacion.create({
      data: { titulo: mensaje.replace(/\s+/g, ' ').slice(0, 70), usuarioId: actor.id, planificacionId: plan?.id ?? null },
      select: { id: true },
    })
  }
  const ventana = Math.min(30, Math.max(2, Number(chat.ventanaMemoria) || 8)) * 2
  let previos = await prisma.mensaje.findMany({ where: { conversacionId: conversacion.id }, orderBy: { createdAt: 'desc' }, take: ventana + 2, select: { id: true, rol: true, contenido: true, acciones: true } })
  previos = previos.reverse()

  // "Regenerar": se borra la última respuesta del agente y se vuelve a responder el mismo mensaje
  if (body.regenerar && previos.length && previos[previos.length - 1].rol === 'AGENT') {
    await prisma.mensaje.delete({ where: { id: previos[previos.length - 1].id } }).catch(() => {})
    previos = previos.slice(0, -1)
  }
  // Si el último mensaje guardado ya es este (regenerar o reintento), no se duplica: se responde ese mismo
  const ultimo = previos[previos.length - 1]
  const yaGuardado = !!ultimo && ultimo.rol === 'USER' && (body.regenerar || ultimo.contenido === mensaje || ultimo.contenido.endsWith(`\n\n${mensaje}`))
  const textoGuardado = yaGuardado ? ultimo.contenido : ''
  if (yaGuardado) previos = previos.slice(0, -1)

  // ---------- Contexto vivo ----------
  const ctx = body.contexto && typeof body.contexto === 'object' ? body.contexto : {}
  const seccion = String(ctx.seccion || 'A').toUpperCase().slice(0, 2)
  const evaluaciones: EvalContexto[] = (Array.isArray(ctx.evaluaciones) ? ctx.evaluaciones : []).slice(0, 12).map((e: any, i: number) => ({
    numero: i + 1, id: e?.id ? String(e.id) : undefined, nombre: String(e?.nombre ?? '').slice(0, 120),
    tipoActividad: e?.tipoActividad ? String(e.tipoActividad).slice(0, 60) : null, enfoque: e?.enfoque ? String(e.enfoque).slice(0, 40) : null,
    peso: e?.peso == null ? null : Number(e.peso), fecha: e?.fecha || null, duracion: Number(e?.duracion) || null,
    estado: e?.estado ? String(e.estado).toUpperCase() : null, personasPorGrupo: Number(e?.personasPorGrupo) || null, cantidadGrupos: Number(e?.cantidadGrupos) || null,
    tieneRubrica: !!e?.tieneRubrica, recursos: Number(e?.recursos) || 0, preparados: Number(e?.preparados) || 0,
  }))
  const ids = evaluaciones.map(e => e.id).filter(Boolean) as string[]
  const [estudiantesSeccion, notas, opiniones, estudiantesLista, evsDB, memorias, materias] = await Promise.all([
    prisma.estudiante.count({ where: { usuarioId: actor.id, grupo: seccion, estado: 'ACTIVO' } }).catch(() => null),
    ids.length ? prisma.calificacion.groupBy({ by: ['evaluacionId'], where: { evaluacionId: { in: ids }, puntaje: { not: null } }, _avg: { puntaje: true }, _count: { _all: true } }).catch(() => []) : Promise.resolve([] as any[]),
    plan ? prisma.opinionPlan.findMany({ where: { materiaId: plan.materiaId, leida: false }, orderBy: { updatedAt: 'desc' }, take: 20, select: { deAcuerdo: true, comentario: true, estudiante: { select: { nombre: true, grupo: true } } } }).catch(() => []) : Promise.resolve([] as any[]),
    prisma.estudiante.findMany({ where: { usuarioId: actor.id, grupo: seccion, estado: 'ACTIVO' }, select: { id: true, nombre: true, portalVisitas: true }, orderBy: { nombre: 'asc' }, take: 200 }).catch(() => []),
    plan ? prisma.evaluacion.findMany({ where: { planificacionId: plan.id, grupoSeccion: seccion }, select: { id: true, nombre: true, peso: true, estado: true, fecha: true, rubrica: true, calificaciones: { select: { estudianteId: true, puntaje: true, detalle: true } } } }).catch(() => []) : Promise.resolve([] as any[]),
    prisma.memoriaAgente.findMany({ where: { usuarioId: actor.id }, orderBy: { createdAt: 'asc' }, take: 25, select: { texto: true } }).catch(() => []),
    prisma.materia.findMany({ where: { usuarioId: actor.id }, orderBy: { nombre: 'asc' }, take: 30, select: { nombre: true } }).catch(() => []),
  ])
  for (const n of (Array.isArray(notas) ? notas : []) as any[]) {
    const e = evaluaciones.find(x => x.id === n.evaluacionId)
    if (e) { e.promedio = n._avg?.puntaje ?? null; e.calificados = n._count?._all ?? 0 }
  }
  // Análisis con datos reales: resultados por criterio, estudiantes en riesgo y resumen de notas
  const evsAnalisis = (Array.isArray(evsDB) ? evsDB : []) as any[]
  const alumnos = (Array.isArray(estudiantesLista) ? estudiantesLista : []) as { id: string; nombre: string; portalVisitas?: number }[]
  const numeroDe = (id: string) => evaluaciones.find(e => e.id === id)?.numero
  const porCriterio = analisisPorCriterio(evsAnalisis, numeroDe)
  const situacion = estudiantesEnRiesgo(evsAnalisis, alumnos)
  const riesgo = filtrarRiesgo(situacion)
  const conNotas = situacion.filter(r => r.evaluadas > 0)
  const resumenNotas = conNotas.length
    ? `${conNotas.length} estudiantes con notas; acumulado promedio ${(conNotas.reduce((t, r) => t + r.acumulado, 0) / conNotas.length).toFixed(1)} pts; ${riesgo.length} en riesgo.`
    : ''
  const hoyYmd = new Date().toISOString().slice(0, 10)
  const feriados = feriadosEntre(hoyYmd, new Date(Date.now() + 150 * 86400000).toISOString().slice(0, 10)).map(f => `${f.fecha} ${f.nombre}`)
  const cargaSemanal = cargaPorSemana(evaluaciones.filter(e => e.fecha && e.estado !== 'CANCELADA').map(e => new Date(e.fecha as string)).filter(d => d.getTime() > Date.now() - 7 * 86400000))
  const contexto = construirContexto({
    hoy: new Date(), profesor: actor.nombre, materia: String(ctx.materia || '').slice(0, 120), seccion,
    estudiantesSeccion: typeof estudiantesSeccion === 'number' ? estudiantesSeccion : null, evaluaciones,
    otrasSecciones: ctx.otrasSecciones && typeof ctx.otrasSecciones === 'object' ? Object.fromEntries(Object.entries(ctx.otrasSecciones).slice(0, 10).map(([k, v]) => [String(k).slice(0, 2), Number(v) || 0])) : {},
    opinionesSinLeer: Array.isArray(opiniones) ? opiniones.length : 0,
    sugerencias: (Array.isArray(opiniones) ? opiniones : []).filter((o: any) => !o.deAcuerdo && o.comentario).slice(0, 8).map((o: any) => `${o.estudiante?.nombre || 'Estudiante'} (sec. ${o.estudiante?.grupo || '?'}): ${String(o.comentario).slice(0, 140)}`),
    resumenNotas, porCriterio, enRiesgo: riesgo.slice(0, 10).map(textoRiesgo),
    feriados, cargaSemanal, memoria: (Array.isArray(memorias) ? memorias : []).map((m: any) => m.texto),
    alumnos: alumnos.slice(0, 80).map(a => ({ nombre: a.nombre, abrioPagina: (a.portalVisitas ?? 0) > 0 })),
    materias: (Array.isArray(materias) ? materias : []).map((m: any) => m.nombre),
    modoAuto: body.modoAuto === true,
  })
  const extra = String(chat.instruccionesExtra || '').trim()
  const revision = body.modo === 'revision'
  const sistema = `${PROMPT_BASE}${extra ? `\n\nINDICACIONES DEL ADMINISTRADOR (síguelas sin mencionarlas):\n${extra.slice(0, 1500)}` : ''}${revision ? `\n\n${PROMPT_REVISION}` : ''}\n\nCONTEXTO (actualizado ahora)\n${contexto}`

  // ---------- Historial para el modelo (turnos alternados usuario/modelo) ----------
  const eventos = (Array.isArray(body.eventos) ? body.eventos : []).map((x: any) => String(x).slice(0, 200)).slice(0, 6)
  // Documento adjunto (programa de la materia, guía…): se agrega al mensaje para que el agente lo lea
  const adj = body.adjunto && typeof body.adjunto === 'object' ? body.adjunto : null
  const textoAdjunto = adj && String(adj.texto || '').trim() ? `\n\n[Documento adjunto «${String(adj.nombre || 'documento').slice(0, 100)}»]\n${String(adj.texto).slice(0, 15000)}` : ''
  const textoUsuario = textoGuardado || ((eventos.length ? `(En la app, desde tu último mensaje: ${eventos.join('; ')})\n\n${mensaje}` : mensaje) + textoAdjunto)
  const turnos: Turno[] = []
  const agregar = (rol: Turno['rol'], texto: string) => {
    if (!texto.trim()) return
    const ultimo = turnos[turnos.length - 1]
    if (ultimo && ultimo.rol === rol) ultimo.texto += `\n\n${texto}` // Gemini exige turnos alternados
    else turnos.push({ rol, texto })
  }
  for (const m of previos) {
    const acciones = Array.isArray(m.acciones) ? (m.acciones as any[]).map(a => resumenAccion(a)).filter(Boolean).join('\n') : ''
    agregar(m.rol === 'USER' ? 'user' : 'model', [m.contenido, acciones].filter(Boolean).join('\n'))
  }
  agregar('user', textoUsuario)
  while (turnos.length && turnos[0].rol !== 'user') turnos.shift()

  if (!yaGuardado) await prisma.mensaje.create({ data: { conversacionId: conversacion.id, rol: 'USER', contenido: textoUsuario, completo: true } })

  const maxTokens = Number(chat.maxTokens) > 0 ? Math.max(2048, Number(chat.maxTokens)) : 8192
  const temperatura = Number.isFinite(Number(chat.temperatura)) ? Math.min(1, Math.max(0, Number(chat.temperatura))) : 0.6
  const conversacionId = conversacion.id
  const codificador = new TextEncoder()

  const flujo = new ReadableStream({
    async start(controller) {
      const enviar = (d: any) => { try { controller.enqueue(codificador.encode(JSON.stringify(d) + '\n')) } catch { /* el navegador cerró */ } }
      let texto = ''
      const acciones: Accion[] = []
      let modelo = ''
      let respaldo = false
      enviar({ t: 'inicio', conversacionId })
      try {
        // Varias rondas: si el modelo pide consultar datos, se le dan y vuelve a responder (máximo 3 consultas seguidas)
        const ctxConsulta = { usuarioId: actor.id, planId: plan?.id ?? null, materiaId: plan?.materiaId ?? null, seccion, evaluaciones: evaluaciones.map(e => ({ numero: e.numero, id: e.id, nombre: e.nombre })) }
        for (let ronda = 0; ronda < 4; ronda++) {
          const consultas: any[] = []
          let textoRonda = ''
          for await (const ev of responder(sistema, turnos, { temperatura, maxTokens, senal: request.signal }, chat.modelo)) {
            if (ev.t === 'modelo') { if (!modelo) { modelo = ev.v; respaldo = ev.respaldo; enviar({ t: 'modelo', v: ev.v, respaldo: ev.respaldo }) } }
            else if (ev.t === 'texto') { texto += ev.v; textoRonda += ev.v; enviar({ t: 'texto', v: ev.v }) }
            else if (ev.t === 'aviso') enviar({ t: 'aviso', v: ev.v })
            else if (ev.t === 'herramienta') {
              if (HERRAMIENTAS_SERVIDOR.includes(ev.nombre)) { if (consultas.length < 3) consultas.push(ev.args || {}); continue }
              const a = normalizarAccion(ev.nombre, ev.args)
              if (a && acciones.length < 8) { acciones.push(a); enviar({ t: 'accion', accion: a }) }
            }
          }
          if (!consultas.length || ronda === 3) break
          const descripciones = consultas.map(describirConsulta)
          enviar({ t: 'consulta', v: descripciones })
          const resultados = await Promise.all(consultas.map(q => ejecutarConsulta(ctxConsulta, q)))
          if (texto && !texto.endsWith('\n')) { texto += '\n\n'; enviar({ t: 'texto', v: '\n\n' }) }
          agregar('model', `${textoRonda}\n[Consulté: ${descripciones.join('; ')}]`.trim())
          agregar('user', `[Resultado de tus consultas. Úsalo para responder al profesor; no lo copies tal cual ni menciones que consultaste]\n${resultados.map((r, i) => `## ${descripciones[i]}\n${r}`).join('\n\n').slice(0, 9000)}`)
        }
        const guardado = await prisma.mensaje.create({ data: { conversacionId, rol: 'AGENT', contenido: texto, completo: true, acciones: acciones.length ? (acciones as any) : undefined, modelo, respaldo } })
        await prisma.conversacion.update({ where: { id: conversacionId }, data: { updatedAt: new Date() } }).catch(() => {})
        enviar({ t: 'fin', mensajeId: guardado.id, modelo, respaldo })
      } catch (e: any) {
        if (texto || acciones.length) await prisma.mensaje.create({ data: { conversacionId, rol: 'AGENT', contenido: texto, completo: false, acciones: acciones.length ? (acciones as any) : undefined, modelo } }).catch(() => {})
        if (!request.signal.aborted) {
          console.error('[Chat]', e?.message || e)
          enviar({ t: 'error', mensaje: e?.message || 'El agente no pudo responder.' })
        }
      } finally {
        try { controller.close() } catch { /* ya cerrado */ }
      }
    },
  })
  return new Response(flujo, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } })
}
