// Llamadas al modelo del agente con respuesta en tiempo real (streaming).
// El agente usa SOLO OpenRouter (OPENROUTER_API_KEY): el modelo configurado (con «/», ej. google/gemini-2.5-flash)
// o, si no hay, OPENROUTER_MODELO o google/gemini-2.5-flash.
import { herramientasGroq } from './herramientas'

export interface Turno { rol: 'user' | 'model'; texto: string }
export type Evento = { t: 'texto'; v: string } | { t: 'herramienta'; nombre: string; args: any } | { t: 'aviso'; v: string } | { t: 'malformada' }
export interface Opciones { temperatura: number; maxTokens: number; senal?: AbortSignal; sinHerramientas?: boolean; evitar?: string[] }
interface Candidato { proveedor: 'openrouter'; modelo: string }

class FalloModelo extends Error { constructor(msg: string, public estado = 0) { super(msg) } }

// ---------- utilidades de streaming (Server-Sent Events) ----------
async function* lineasSSE(r: Response): AsyncGenerator<string> {
  const lector = r.body!.getReader()
  const dec = new TextDecoder()
  let resto = ''
  while (true) {
    const { value, done } = await lector.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    let i: number
    while ((i = resto.indexOf('\n')) >= 0) {
      const linea = resto.slice(0, i).replace(/\r$/, '')
      resto = resto.slice(i + 1)
      if (linea.startsWith('data:')) yield linea.slice(5).trim()
    }
  }
  if (resto.startsWith('data:')) yield resto.slice(5).trim()
}

async function errorDe(r: Response): Promise<string> {
  const t = await r.text().catch(() => '')
  try { const d = JSON.parse(t); return String(d?.error?.message || d?.error || t).slice(0, 200) } catch { return t.slice(0, 200) }
}

// ---------- OpenRouter (formato de OpenAI) ----------
async function* openrouter(modelo: string, sistema: string, turnos: Turno[], op: Opciones): AsyncGenerator<Evento> {
  const clave = process.env.OPENROUTER_API_KEY
  if (!clave) throw new FalloModelo('Falta OPENROUTER_API_KEY')
  const url = 'https://openrouter.ai/api/v1/chat/completions'
  const extra: Record<string, string> = { 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}`, ...extra },
    body: JSON.stringify({
      model: modelo, stream: true, temperature: op.temperatura, max_tokens: Math.min(op.maxTokens, 8000),
      messages: [{ role: 'system', content: sistema }, ...turnos.map(t => ({ role: t.rol === 'model' ? 'assistant' : 'user', content: t.texto }))],
      ...(op.sinHerramientas ? {} : { tools: herramientasGroq(), tool_choice: 'auto' }),
      // Gemini Flash por OpenRouter "piensa" antes de responder si no se le dice nada: sin eso responde mucho más rápido
      ...(/flash/i.test(modelo) ? { reasoning: { enabled: false } } : {}),
    }),
    signal: op.senal,
  })
  if (!r.ok) throw new FalloModelo(`${modelo}: ${r.status} ${await errorDe(r)}`, r.status)
  const llamadas = new Map<number, { nombre: string; args: string }>()
  let malformada = false
  for await (const dato of lineasSSE(r)) {
    if (!dato || dato === '[DONE]') continue
    let d: any; try { d = JSON.parse(dato) } catch { continue }
    if (d?.error) throw new FalloModelo(`${modelo}: ${d.error.message || 'error'}`)
    const delta = d?.choices?.[0]?.delta || {}
    if (typeof delta.content === 'string' && delta.content) yield { t: 'texto', v: delta.content }
    for (const tc of delta.tool_calls || []) {
      const i = tc.index ?? 0
      const actual = llamadas.get(i) || { nombre: '', args: '' }
      if (tc.function?.name) actual.nombre = tc.function.name
      if (tc.function?.arguments) actual.args += tc.function.arguments
      llamadas.set(i, actual)
    }
    if (d?.choices?.[0]?.finish_reason === 'length') yield { t: 'aviso', v: 'La respuesta llegó al límite de largo y pudo quedar cortada.' }
    // Gemini por OpenRouter a veces arma mal la llamada a la herramienta (mucho texto): el chat la pide de nuevo
    if (/MALFORMED|UNEXPECTED_TOOL/i.test(String(d?.choices?.[0]?.native_finish_reason || ''))) malformada = true
  }
  for (const { nombre, args } of llamadas.values()) {
    if (!nombre) continue
    let a: any = {}
    try { a = JSON.parse(args || '{}') } catch { malformada = true; continue } // argumentos cortados o inválidos
    yield { t: 'herramienta', nombre, args: a }
  }
  if (malformada) { console.error(`[Chat] ${modelo}: llamada a herramienta mal formada`); yield { t: 'malformada' } }
}

export function candidatos(modeloConfigurado?: string): Candidato[] {
  if (!process.env.OPENROUTER_API_KEY) return []
  // Un modelo configurado con «/» es de OpenRouter; los nombres viejos (gemini-…, llama-…) se ignoran
  const base = String(modeloConfigurado || '').trim()
  const modelo = base.includes('/') ? base : (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim()
  return [{ proveedor: 'openrouter', modelo }]
}

// Responde con el primer modelo que funcione. Emite { t:'modelo' } al empezar con el que respondió.
export async function* responder(sistema: string, turnos: Turno[], op: Opciones, modeloConfigurado?: string): AsyncGenerator<Evento | { t: 'modelo'; v: string; respaldo: boolean }> {
  // evitar: modelos que ya fallaron en esta misma respuesta (ej. armaron mal la herramienta): se prueba con otro
  const todos = candidatos(modeloConfigurado)
  const sinEvitados = todos.filter(c => !op.evitar?.includes(c.modelo))
  const lista = sinEvitados.length ? sinEvitados : todos
  if (lista.length === 0) throw new Error('Falta la clave de OpenRouter: agrega OPENROUTER_API_KEY en Vercel.')
  const fallos: string[] = []
  for (const [i, c] of lista.entries()) {
    const gen = openrouter(c.modelo, sistema, turnos, op)
    let primero: IteratorResult<Evento>
    try {
      primero = await gen.next()
    } catch (e: any) {
      if (op.senal?.aborted) throw e
      fallos.push(e?.message || String(e))
      console.error(`[Chat] ${c.proveedor}/${c.modelo} falló, probando el siguiente: ${e?.message || e}`)
      continue
    }
    if (primero.done) { fallos.push(`${c.modelo}: respuesta vacía`); continue } // no dijo nada: se prueba el siguiente
    yield { t: 'modelo', v: c.modelo, respaldo: i > 0 }
    yield primero.value
    for await (const ev of gen) yield ev // un error aquí (a mitad de respuesta) sí se informa
    return
  }
  const cupo = fallos.every(f => / 429 /.test(f) || /quota|rate/i.test(f))
  throw new Error(cupo ? 'OpenRouter está sin cupo o sin saldo por ahora. Revisa el saldo o intenta en unos minutos.' : `El modelo de IA no respondió. (${fallos.slice(-2).join(' | ')})`)
}
