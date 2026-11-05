// Recordatorios a estudiantes: preferencias de cada profesor, estado del servicio automático (cron-job.org),
// mensajes programados y el armado/envío de los mensajes. Todo se guarda en la tabla ConfiguracionSistema
// (filas con id "recordatorios:…"), así no hace falta cambiar la base de datos.
import prisma from '@/lib/prisma'
import { tokensDeEstudiantes, urlPortal } from '@/lib/portal'
import { enviarLoteN8n, fechaBonita, nombreLimpio, nuevoId, primerNombre, destinoDe, tieneDestino, ZONA_HORARIA, type MensajeLote } from '@/lib/whatsappLotes'

export type Ventana = '7D' | '3D' | '1D' | '2H'
export const VENTANAS: Ventana[] = ['7D', '3D', '1D', '2H']
const HORA = 3600_000
export const LIMITE: Record<Ventana, number> = { '7D': 168 * HORA, '3D': 72 * HORA, '1D': 24 * HORA, '2H': 2 * HORA }
export const NOMBRE_VENTANA: Record<Ventana, string> = { '7D': '1 semana antes', '3D': '3 días antes', '1D': '1 día antes', '2H': '2 horas antes' }

export interface PrefRecordatorios {
  ventanas: Ventana[]
  horaDesde: number          // 0-23: no se envía antes de esta hora (salvo el de 2 horas antes)
  horaHasta: number          // 1-24: ni desde esta hora
  nota: string               // se agrega a todos los recordatorios
  apagadas: string[]         // evaluaciones sin recordatorios
  notas: Record<string, string> // nota para una evaluación en particular
  avisarCambios: boolean     // avisar a los estudiantes si se reprograma o cancela
}
export const PREF_POR_DEFECTO: PrefRecordatorios = { ventanas: ['3D', '1D', '2H'], horaDesde: 7, horaHasta: 21, nota: '', apagadas: [], notas: {}, avisarCambios: true }

export interface Programado { id: string; usuarioId: string; seccion: string; materiaId: string | null; texto: string; enviarEn: string; incluirEnlace: boolean; creado: string }
export interface EstadoCron { ultima?: string; ok?: boolean; error?: string | null; mensajes?: number; revisadas?: number; noAutorizado?: { ultima: string; veces: number } }

const ID_PREF = (u: string) => `recordatorios:pref:${u}`
const ID_ESTADO = 'recordatorios:estado'
const ID_PROGRAMADOS = 'recordatorios:programados'

async function leer<T>(id: string, defecto: T): Promise<T> {
  const r = await prisma.configuracionSistema.findUnique({ where: { id } }).catch(() => null)
  return (r?.datos as T) ?? defecto
}
async function escribir(id: string, datos: unknown, por?: string) {
  await prisma.configuracionSistema.upsert({ where: { id }, create: { id, datos: datos as any, actualizadoPor: por ?? null }, update: { datos: datos as any, actualizadoPor: por ?? null } })
}

export function limpiarPref(p: any): PrefRecordatorios {
  const b = PREF_POR_DEFECTO
  const ventanas = Array.isArray(p?.ventanas) ? VENTANAS.filter(v => p.ventanas.includes(v)) : b.ventanas
  const hd = Number.isInteger(p?.horaDesde) ? Math.min(23, Math.max(0, p.horaDesde)) : b.horaDesde
  const hh = Number.isInteger(p?.horaHasta) ? Math.min(24, Math.max(hd + 1, p.horaHasta)) : b.horaHasta
  const notas: Record<string, string> = {}
  if (p?.notas && typeof p.notas === 'object') for (const [k, v] of Object.entries(p.notas).slice(0, 200)) { const t = String(v || '').trim().slice(0, 300); if (t) notas[String(k).slice(0, 40)] = t }
  return {
    ventanas, horaDesde: hd, horaHasta: hh,
    nota: String(p?.nota ?? b.nota).trim().slice(0, 300),
    apagadas: Array.isArray(p?.apagadas) ? [...new Set(p.apagadas.map((x: any) => String(x).slice(0, 40)))].slice(0, 300) as string[] : [],
    notas, avisarCambios: p?.avisarCambios !== false,
  }
}
export const leerPref = async (usuarioId: string) => limpiarPref(await leer(ID_PREF(usuarioId), PREF_POR_DEFECTO))
export const guardarPref = (usuarioId: string, p: PrefRecordatorios) => escribir(ID_PREF(usuarioId), p, usuarioId)
export const leerEstadoCron = () => leer<EstadoCron>(ID_ESTADO, {})
export async function anotarEstadoCron(cambio: Partial<EstadoCron>) { const e = await leerEstadoCron(); await escribir(ID_ESTADO, { ...e, ...cambio }).catch(() => {}) }
export async function anotarNoAutorizado() {
  const e = await leerEstadoCron()
  await escribir(ID_ESTADO, { ...e, noAutorizado: { ultima: new Date().toISOString(), veces: (e.noAutorizado?.veces || 0) + 1 } }).catch(() => {})
}
export const leerProgramados = () => leer<Programado[]>(ID_PROGRAMADOS, [])
export const guardarProgramados = (l: Programado[]) => escribir(ID_PROGRAMADOS, l.slice(-500))

// Hora actual en Venezuela (0-23)
export const horaLocal = (d = new Date()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA, hour: 'numeric', hourCycle: 'h23' }).format(d))
export const enHorario = (p: PrefRecordatorios, d = new Date()) => { const h = horaLocal(d); return h >= p.horaDesde && h < p.horaHasta }

// Qué recordatorio toca según el tiempo que falta: el de la ventana activa más pequeña que ya empezó
export function ventanaQueToca(msFaltan: number, ventanas: Ventana[]): Ventana | null {
  if (msFaltan <= 0) return null
  const activas = VENTANAS.filter(v => ventanas.includes(v)).sort((a, b) => LIMITE[a] - LIMITE[b])
  return activas.find(v => msFaltan <= LIMITE[v]) ?? null
}

// Cuándo sale el próximo recordatorio de una evaluación (para mostrarlo en el panel)
export function proximoEnvio(fecha: Date, p: PrefRecordatorios, enviados: string[], apagada: boolean): { ventana: Ventana; cuando: Date } | null {
  if (apagada || fecha.getTime() <= Date.now()) return null
  const activas = VENTANAS.filter(v => p.ventanas.includes(v) && !enviados.includes(v)).sort((a, b) => LIMITE[b] - LIMITE[a])
  for (const v of activas) {
    const inicio = fecha.getTime() - LIMITE[v]
    // Si ya está dentro de una ventana más pequeña, esta grande ya no se enviará
    const toca = ventanaQueToca(fecha.getTime() - Date.now(), p.ventanas)
    if (inicio <= Date.now() && toca !== v) continue
    let cuando = new Date(Math.max(inicio, Date.now() + 60_000))
    if (v !== '2H' && !enHorario(p, cuando)) {
      // se corre a la hora de inicio permitida
      const h = horaLocal(cuando)
      const sumar = h < p.horaDesde ? p.horaDesde - h : 24 - h + p.horaDesde
      cuando = new Date(cuando.getTime() + sumar * HORA - (cuando.getMinutes() * 60_000))
      if (cuando.getTime() >= fecha.getTime() - 2 * HORA) continue
    }
    return { ventana: v, cuando }
  }
  return null
}

export function diasDeCalendario(desde: Date, hasta: Date): number {
  const dia = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(d)
  return Math.round((Date.parse(dia(hasta)) - Date.parse(dia(desde))) / 86400000)
}

export type TipoAviso = Ventana | 'AHORA' | 'REPROGRAMADA' | 'CANCELADA'
export interface DatosAviso { nombre: string; evaluacion: string; materia: string; seccion: string; fecha: Date; peso: number | null; actividad: string | null; enlace: string; nota?: string; fechaAnterior?: Date | null }

export function textoAviso(tipo: TipoAviso, d: DatosAviso): string {
  const extra = [d.actividad ? `Estrategia: ${d.actividad}` : '', d.peso != null ? `Peso: ${d.peso}%` : ''].filter(Boolean).join(' · ')
  const nota = d.nota ? `\n\n📝 *Nota del profesor:* ${d.nota}` : ''
  const pie = `\n\n📚 Repasa los recursos y la rúbrica aquí:\n${d.enlace}`
  if (tipo === 'CANCELADA') return `Hola ${d.nombre} 👋\n⛔ *Aviso:* la evaluación *${d.evaluacion}* (${d.materia} · Sección ${d.seccion}) prevista para el ${fechaBonita(d.fecha)} fue *cancelada*.${nota}\n\nCualquier cambio lo verás en tu página:\n${d.enlace}`
  if (tipo === 'REPROGRAMADA') return `Hola ${d.nombre} 👋\n🔁 *Cambio de fecha:* la evaluación *${d.evaluacion}* (${d.materia} · Sección ${d.seccion}) ahora es el *${fechaBonita(d.fecha)}*${d.fechaAnterior ? ` (antes: ${fechaBonita(d.fechaAnterior)})` : ''}.${extra ? `\n${extra}` : ''}${nota}${pie}`
  const dias = diasDeCalendario(new Date(), d.fecha)
  const minutos = Math.max(1, Math.round((d.fecha.getTime() - Date.now()) / 60000))
  const encabezado = tipo === '2H' || (tipo === 'AHORA' && minutos <= 180)
    ? `🔔 *Recordatorio:* en ${minutos >= 90 ? `${Math.round(minutos / 60)} horas` : minutos >= 50 ? '1 hora' : `${minutos} minutos`} comienza tu evaluación`
    : dias <= 0 ? '⏰ *Recordatorio:* hoy tienes una evaluación'
    : dias === 1 ? '⏰ *Recordatorio:* mañana tienes una evaluación'
    : `📅 *Recordatorio:* en ${dias} días tienes una evaluación`
  return `Hola ${d.nombre} 👋\n${encabezado}.\n\n*${d.evaluacion}*\n${d.materia} · Sección ${d.seccion}\n🗓️ ${fechaBonita(d.fecha)}${extra ? `\n${extra}` : ''}${nota}${pie}\n\n¡Mucho éxito! 💪`
}

export interface EvalAviso { id: string; nombre: string; fecha: Date; peso: number | null; tipoActividad: string | null; grupoSeccion: string | null; materia: string; usuarioId: string }

// Arma un aviso para cada estudiante activo de la sección (con correo o teléfono, según el canal) y lo envía.
// Queda registrado en EnvioWhatsApp (lote "R_<evaluación>_<tipo>_…") para el historial del panel.
export async function enviarAviso(request: Request, ev: EvalAviso, tipo: TipoAviso, opciones: { nota?: string; fechaAnterior?: Date | null; probar?: boolean } = {}) {
  const seccion = ev.grupoSeccion || 'A'
  const todos = await prisma.estudiante.findMany({ where: { usuarioId: ev.usuarioId, grupo: seccion, estado: 'ACTIVO' }, select: { id: true, nombre: true, telefono: true, email: true } })
  const estudiantes = todos.filter(tieneDestino)
  const sinDestino = todos.length - estudiantes.length
  if (opciones.probar || !estudiantes.length) return { total: estudiantes.length, sinDestino, ok: true as boolean, error: undefined as string | undefined, loteId: '' }
  const loteId = `R_${ev.id}_${tipo}_${nuevoId()}`
  const tokens = await tokensDeEstudiantes(estudiantes.map(e => e.id))
  const mensajes: MensajeLote[] = []
  const filas: any[] = []
  const asunto = tipo === 'CANCELADA' ? `Cancelada: ${nombreLimpio(ev.nombre)}` : tipo === 'REPROGRAMADA' ? `Cambio de fecha: ${nombreLimpio(ev.nombre)} · ${fechaBonita(ev.fecha)}` : `Recordatorio: ${nombreLimpio(ev.nombre)} · ${fechaBonita(ev.fecha)}`
  for (const est of estudiantes) {
    const id = nuevoId()
    const destino = destinoDe(est)
    mensajes.push({ id, telefono: destino, asunto, texto: textoAviso(tipo, { nombre: primerNombre(est.nombre), evaluacion: nombreLimpio(ev.nombre), materia: ev.materia, seccion, fecha: ev.fecha, peso: ev.peso, actividad: ev.tipoActividad, enlace: urlPortal(request, tokens.get(est.id) as string), nota: opciones.nota, fechaAnterior: opciones.fechaAnterior }) })
    filas.push({ id, loteId, usuarioId: ev.usuarioId, tipo: 'RECORDATORIO', estudianteId: est.id, nombre: est.nombre, telefono: destino })
  }
  await prisma.envioWhatsApp.createMany({ data: filas })
  const r = await enviarLoteN8n(request, mensajes)
  return { total: estudiantes.length, sinDestino, ok: r.ok, error: r.error, loteId }
}

// Mensaje libre programado por el profesor (ej. "Traigan laptop") para una sección
export async function enviarProgramado(request: Request, p: Programado) {
  const todos = await prisma.estudiante.findMany({ where: { usuarioId: p.usuarioId, grupo: p.seccion, estado: 'ACTIVO' }, select: { id: true, nombre: true, telefono: true, email: true } })
  const estudiantes = todos.filter(tieneDestino)
  if (!estudiantes.length) return { total: 0, ok: true }
  const loteId = `P_${p.id}_${nuevoId()}`
  const tokens = p.incluirEnlace ? await tokensDeEstudiantes(estudiantes.map(e => e.id)) : new Map()
  const mensajes: MensajeLote[] = []
  const filas: any[] = []
  for (const est of estudiantes) {
    const id = nuevoId()
    const destino = destinoDe(est)
    const cuerpo = p.texto.replace(/\{nombre\}/gi, primerNombre(est.nombre))
    mensajes.push({ id, telefono: destino, asunto: 'Mensaje de tu profesor', texto: `Hola ${primerNombre(est.nombre)} 👋\n${cuerpo}${p.incluirEnlace ? `\n\nTu página: ${urlPortal(request, tokens.get(est.id) as string)}` : ''}` })
    filas.push({ id, loteId, usuarioId: p.usuarioId, tipo: 'RECORDATORIO', estudianteId: est.id, nombre: est.nombre, telefono: destino })
  }
  await prisma.envioWhatsApp.createMany({ data: filas })
  const r = await enviarLoteN8n(request, mensajes)
  return { total: estudiantes.length, ok: r.ok, error: r.error }
}

// Datos de una evaluación para avisar (con su materia y dueño)
export async function evalParaAviso(id: string): Promise<EvalAviso | null> {
  const e = await prisma.evaluacion.findUnique({ where: { id }, select: { id: true, nombre: true, fecha: true, peso: true, tipoActividad: true, grupoSeccion: true, planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } } } })
  if (!e || !e.fecha || !e.planificacion.materia.usuarioId) return null
  return { id: e.id, nombre: e.nombre, fecha: e.fecha, peso: e.peso, tipoActividad: e.tipoActividad, grupoSeccion: e.grupoSeccion, materia: e.planificacion.materia.nombre, usuarioId: e.planificacion.materia.usuarioId }
}

// Nota que acompaña el recordatorio de una evaluación: la suya o la general
export const notaDe = (p: PrefRecordatorios, evaluacionId: string) => [p.notas[evaluacionId], p.nota].filter(Boolean).join(' · ')
