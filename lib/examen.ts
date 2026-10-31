// Exámenes en línea: el profesor (o el agente) adjunta un examen a una evaluación y el estudiante lo presenta
// en su página personal, solo dentro de la ventana de tiempo. Aquí están las reglas comunes (cliente y servidor).

export type TipoPregunta = 'seleccion' | 'vf' | 'desarrollo' | 'informe'
export type ModoCorreccion = 'profesor' | 'sugerida' | 'automatica'

export interface Pregunta {
  id: string
  tipo: TipoPregunta
  enunciado: string
  opciones?: string[]   // solo selección
  correcta?: number     // selección: índice de la opción correcta · vf: 1 = verdadero, 0 = falso
  esperado?: string     // desarrollo/informe: lo que debería incluir la respuesta (guía para corregir)
  puntos: number
}

export interface Examen {
  tipo: 'seleccion' | 'desarrollo' | 'informe' | 'mixto'
  instrucciones: string
  duracionMin: number
  modoCorreccion: ModoCorreccion
  preguntas: Pregunta[]
  desde?: string | null // si el profesor lo abrió antes de la fecha (para probarlo): desde cuándo
}

export const TIPOS_PREGUNTA: Record<TipoPregunta, string> = { seleccion: 'Selección simple', vf: 'Verdadero o falso', desarrollo: 'Desarrollo', informe: 'Informe' }
export const MARGEN_CIERRE_MIN = 30 // el examen se puede empezar hasta 30 min después de la hora de la evaluación (más la duración)
export const GRACIA_SEG = 90        // tolerancia por conexión lenta al entregar

const texto = (v: any, max: number) => String(v ?? '').replace(/\*\*/g, '').trim().slice(0, max)
const redondear = (n: number) => Math.round(n * 100) / 100

// Limpia y valida un examen (venga del agente o del editor). Los puntos se ajustan para sumar 20.
export function normalizarExamen(e: any): Examen | null {
  if (!e || typeof e !== 'object') return null
  const preguntas: Pregunta[] = (Array.isArray(e.preguntas) ? e.preguntas : []).slice(0, 40).map((q: any, i: number) => {
    const tipo: TipoPregunta = ['seleccion', 'vf', 'desarrollo', 'informe'].includes(q?.tipo) ? q.tipo : (Array.isArray(q?.opciones) && q.opciones.length >= 2 ? 'seleccion' : 'desarrollo')
    const p: Pregunta = { id: texto(q?.id, 20) || `p${i + 1}`, tipo, enunciado: texto(q?.enunciado, 1500), puntos: Math.max(0, Number(q?.puntos) || 0) }
    if (tipo === 'seleccion') {
      p.opciones = (Array.isArray(q?.opciones) ? q.opciones : []).slice(0, 6).map((o: any) => texto(o, 400).replace(/^[a-fA-F][).]\s+/, '')).filter(Boolean)
      const c = Number(q?.correcta)
      p.correcta = Number.isInteger(c) && c >= 0 && c < p.opciones!.length ? c : 0
      if (p.opciones!.length < 2) return null
    } else if (tipo === 'vf') {
      const c = q?.correcta
      p.correcta = c === true || c === 1 || /^(v|verdadero|true|1)$/i.test(String(c)) ? 1 : 0
    } else {
      p.esperado = texto(q?.esperado, 1500)
    }
    return p.enunciado ? p : null
  }).filter(Boolean) as Pregunta[]
  if (!preguntas.length) return null
  // ids únicos
  const vistos = new Set<string>()
  preguntas.forEach((p, i) => { if (vistos.has(p.id)) p.id = `p${i + 1}-${Math.random().toString(36).slice(2, 6)}`; vistos.add(p.id) })
  // Puntos: si no suman 20, se reparten proporcionalmente (o en partes iguales si nadie tiene puntos)
  const suma = preguntas.reduce((t, p) => t + p.puntos, 0)
  if (Math.abs(suma - 20) > 0.01) {
    if (suma <= 0) preguntas.forEach(p => { p.puntos = 20 / preguntas.length })
    else preguntas.forEach(p => { p.puntos = (p.puntos * 20) / suma })
    preguntas.forEach(p => { p.puntos = Math.round(p.puntos * 4) / 4 }) // de a cuartos de punto
    const dif = redondear(20 - preguntas.reduce((t, p) => t + p.puntos, 0))
    preguntas[preguntas.length - 1].puntos = redondear(preguntas[preguntas.length - 1].puntos + dif)
  }
  const tipos = new Set(preguntas.map(p => (p.tipo === 'vf' ? 'seleccion' : p.tipo)))
  const tipoGeneral = tipos.size > 1 ? 'mixto' : (tipos.values().next().value as Examen['tipo'])
  const modo: ModoCorreccion = ['profesor', 'sugerida', 'automatica'].includes(e.modoCorreccion) ? e.modoCorreccion : 'sugerida'
  return {
    tipo: ['seleccion', 'desarrollo', 'informe', 'mixto'].includes(e.tipo) ? e.tipo : tipoGeneral,
    instrucciones: texto(e.instrucciones, 1500),
    duracionMin: Math.min(300, Math.max(5, Math.round(Number(e.duracionMin) || 60))),
    modoCorreccion: modo,
    preguntas,
    desde: e.desde && !isNaN(new Date(e.desde).getTime()) ? new Date(e.desde).toISOString() : null,
  }
}

export const esObjetiva = (p: Pregunta) => p.tipo === 'seleccion' || p.tipo === 'vf'

// Lo que ve el estudiante: sin respuestas correctas ni guías de corrección
export function examenParaEstudiante(e: Examen) {
  return {
    tipo: e.tipo, instrucciones: e.instrucciones, duracionMin: e.duracionMin,
    preguntas: e.preguntas.map(p => ({ id: p.id, tipo: p.tipo, enunciado: p.enunciado, opciones: p.tipo === 'seleccion' ? p.opciones : p.tipo === 'vf' ? ['Verdadero', 'Falso'] : undefined, puntos: p.puntos })),
  }
}

// ---------- Ventana de tiempo ----------
// Abre a la hora de la evaluación (o cuando el profesor lo abrió para probar) y se puede empezar durante
// la duración + 30 min. Cada estudiante tiene su propio cronómetro desde que empieza, sin pasar del cierre.
export function ventanaExamen(e: Examen, fechaEval: Date | null): { abre: Date | null; cierra: Date | null } {
  const abre = e.desde ? new Date(e.desde) : fechaEval
  if (!abre) return { abre: null, cierra: null }
  return { abre, cierra: new Date(abre.getTime() + (e.duracionMin + MARGEN_CIERRE_MIN) * 60000) }
}
// Cada estudiante tiene la duración completa desde que empieza (solo se puede EMPEZAR antes del cierre)
export function limiteEstudiante(e: Examen, inicio: Date): Date {
  return new Date(inicio.getTime() + e.duracionMin * 60000)
}

// ---------- Corrección ----------
export interface CorreccionPregunta { puntos: number | null; comentario?: string; fuente: 'auto' | 'ia' | 'profesor' }
export type Correccion = Record<string, CorreccionPregunta>

// Selección y verdadero/falso se corrigen solas
export function corregirObjetivas(e: Examen, respuestas: Record<string, any>, previa: Correccion = {}): Correccion {
  const c: Correccion = { ...previa }
  for (const p of e.preguntas) {
    const r = respuestas?.[p.id]
    if (!esObjetiva(p)) {
      // Abierta sin responder: vale 0 sola (no hace falta que nadie la corrija)
      if (!String(r ?? '').trim() && !c[p.id]) c[p.id] = { puntos: 0, comentario: 'Sin responder', fuente: 'auto' }
      continue
    }
    const marcada = p.tipo === 'vf' ? (r === 1 || r === true || r === 'V' ? 1 : r === 0 || r === false || r === 'F' ? 0 : null) : Number.isInteger(r) ? r : null
    c[p.id] = { puntos: marcada !== null && marcada === p.correcta ? p.puntos : 0, fuente: 'auto' }
  }
  return c
}

// Nota sobre 20 (null si falta corregir alguna pregunta)
export function notaDe(e: Examen, c: Correccion | null | undefined): number | null {
  let total = 0
  for (const p of e.preguntas) {
    const x = c?.[p.id]
    if (!x || x.puntos == null) return null
    total += Math.min(p.puntos, Math.max(0, Number(x.puntos)))
  }
  return redondear(total)
}

export const faltaCorregir = (e: Examen, c: Correccion | null | undefined) => e.preguntas.filter(p => c?.[p.id]?.puntos == null).length

// Tipos de evaluación que se pueden presentar en línea (teóricas). Las prácticas o presenciales no.
export function admiteExamenEnLinea(tipoActividad?: string | null, enfoque?: string | null, descripcion?: string | null): boolean {
  const t = `${tipoActividad || ''} ${enfoque || ''}`.toLowerCase()
  if (/(exposici|laborator|taller|debate|role|dramat|campo|demostraci|presentaci[oó]n|defensa|maqueta|prototipo|proyecto|pr[aá]ctic)/.test(t)) return false
  if (!/(prueba|examen|quiz|test|escrit|selecci|desarrollo|ensayo|informe|cuestionario|te[oó]ric|an[aá]lisis de caso|caso|reporte|investigaci)/.test(t)) return false
  // Si lo que se entrega se hace en otra herramienta (diagramas, código, repositorio…), no es un examen que se responda escribiendo
  const d = String(descripcion || '').toLowerCase()
  const entregables = (d.match(/entregables?:?([\s\S]{0,300})/) || [])[1] || d
  if (/(diagrama|uml|draw\.io|lucidchart|repositorio|github|c[oó]digo fuente|programa|aplicaci[oó]n|prototipo|maqueta|video|presentaci[oó]n|diapositiva|despliegue|docker|base de datos implementada)/.test(entregables)) return false
  return true
}
