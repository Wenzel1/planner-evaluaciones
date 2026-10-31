// Llamadas a los modelos con respuesta en tiempo real (streaming) y respaldo automático:
// Gemini (el modelo configurado) → Gemini 2.5 Flash-Lite → Gemini 2.0 Flash → Groq (Llama 3.3 70B).
// Solo se pasa al siguiente si el modelo falla ANTES de empezar a responder (así nunca se mezclan respuestas).
import { herramientasGemini, herramientasGroq } from './herramientas'

export interface Turno { rol: 'user' | 'model'; texto: string }
export type Evento = { t: 'texto'; v: string } | { t: 'herramienta'; nombre: string; args: any } | { t: 'aviso'; v: string } | { t: 'malformada' }
export interface Opciones { temperatura: number; maxTokens: number; senal?: AbortSignal; sinHerramientas?: boolean }
interface Candidato { proveedor: 'gemini' | 'groq' | 'openrouter'; modelo: string }

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

// ---------- Gemini ----------
async function* gemini(modelo: string, sistema: string, turnos: Turno[], op: Opciones): AsyncGenerator<Evento> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new FalloModelo('Falta GEMINI_API_KEY')
  const generationConfig: any = { temperature: op.temperatura, maxOutputTokens: op.maxTokens }
  // Los 2.5 "piensan" antes de responder: se apaga (o se limita en Pro) para que la respuesta empiece al instante
  if (/2\.5/.test(modelo)) generationConfig.thinkingConfig = { thinkingBudget: /pro/.test(modelo) ? 128 : 0 }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: turnos.map(t => ({ role: t.rol, parts: [{ text: t.texto }] })),
      ...(op.sinHerramientas ? {} : { tools: herramientasGemini(), toolConfig: { functionCallingConfig: { mode: 'AUTO' } } }),
      generationConfig,
    }),
    signal: op.senal,
  })
  if (!r.ok) throw new FalloModelo(`${modelo}: ${r.status} ${await errorDe(r)}`, r.status)
  for await (const dato of lineasSSE(r)) {
    if (!dato || dato === '[DONE]') continue
    let d: any; try { d = JSON.parse(dato) } catch { continue }
    if (d?.promptFeedback?.blockReason) throw new FalloModelo(`${modelo}: bloqueado (${d.promptFeedback.blockReason})`)
    const cand = d?.candidates?.[0]
    for (const p of cand?.content?.parts || []) {
      if (p.thought) continue
      if (typeof p.text === 'string' && p.text) yield { t: 'texto', v: p.text }
      if (p.functionCall?.name) yield { t: 'herramienta', nombre: p.functionCall.name, args: p.functionCall.args || {} }
    }
    if (cand?.finishReason === 'MAX_TOKENS') yield { t: 'aviso', v: 'La respuesta llegó al límite de largo y pudo quedar cortada.' }
    // Gemini a veces arma mal la llamada a una herramienta cuando lleva mucho texto (ej. 4 evaluaciones con descripción):
    // se avisa para que el chat la pida de nuevo en vez de quedarse en "Aquí tienes la propuesta:"
    if (cand?.finishReason === 'MALFORMED_FUNCTION_CALL' || cand?.finishReason === 'UNEXPECTED_TOOL_CALL') {
      console.error(`[Chat] ${modelo}: llamada a herramienta mal formada (${cand.finishReason})`)
      yield { t: 'malformada' }
    }
  }
}

// ---------- Groq y OpenRouter (mismo formato, el de OpenAI) ----------
async function* groq(modelo: string, sistema: string, turnos: Turno[], op: Opciones, proveedor: 'groq' | 'openrouter' = 'groq'): AsyncGenerator<Evento> {
  const clave = proveedor === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GROQ_API_KEY
  if (!clave) throw new FalloModelo(proveedor === 'openrouter' ? 'Falta OPENROUTER_API_KEY' : 'Falta GROQ_API_KEY')
  const url = proveedor === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions'
  const extra = proveedor === 'openrouter' ? { 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' } : {}
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}`, ...extra },
    body: JSON.stringify({
      model: modelo, stream: true, temperature: op.temperatura, max_tokens: Math.min(op.maxTokens, 8000),
      messages: [{ role: 'system', content: sistema }, ...turnos.map(t => ({ role: t.rol === 'model' ? 'assistant' : 'user', content: t.texto }))],
      ...(op.sinHerramientas ? {} : { tools: herramientasGroq(), tool_choice: 'auto' }),
    }),
    signal: op.senal,
  })
  if (!r.ok) throw new FalloModelo(`${modelo}: ${r.status} ${await errorDe(r)}`, r.status)
  const llamadas = new Map<number, { nombre: string; args: string }>()
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
  }
  for (const { nombre, args } of llamadas.values()) {
    if (!nombre) continue
    let a: any = {}; try { a = JSON.parse(args || '{}') } catch { /* argumentos incompletos: se ignoran */ }
    yield { t: 'herramienta', nombre, args: a }
  }
}

export function candidatos(modeloConfigurado?: string): Candidato[] {
  const lista: Candidato[] = []
  const base = String(modeloConfigurado || '').trim().replace(/^models\//, '')
  if (process.env.GEMINI_API_KEY) {
    if (base && /gemini/i.test(base) && !base.includes('/')) lista.push({ proveedor: 'gemini', modelo: base })
    for (const m of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']) lista.push({ proveedor: 'gemini', modelo: m })
  }
  // OpenRouter (de pago, con saldo): después de Gemini gratis y antes de Groq. Modelo con "/" en la configuración → OpenRouter.
  if (process.env.OPENROUTER_API_KEY) {
    if (base && base.includes('/')) lista.push({ proveedor: 'openrouter', modelo: base })
    lista.push({ proveedor: 'openrouter', modelo: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim() })
  }
  if (process.env.GROQ_API_KEY) {
    if (base && !base.includes('/') && /llama|qwen|gpt-oss|mixtral|gemma/i.test(base)) lista.push({ proveedor: 'groq', modelo: base })
    lista.push({ proveedor: 'groq', modelo: 'llama-3.3-70b-versatile' })
  }
  // Si el administrador eligió un modelo de OpenRouter (con "/"), ese va primero
  const elegido = lista.findIndex(c => c.proveedor === 'openrouter' && c.modelo === base)
  if (elegido > 0) lista.unshift(...lista.splice(elegido, 1))
  const vistos = new Set<string>()
  return lista.filter(c => { const k = `${c.proveedor}:${c.modelo}`; if (vistos.has(k)) return false; vistos.add(k); return true })
}

// Responde con el primer modelo que funcione. Emite { t:'modelo' } al empezar con el que respondió.
export async function* responder(sistema: string, turnos: Turno[], op: Opciones, modeloConfigurado?: string): AsyncGenerator<Evento | { t: 'modelo'; v: string; respaldo: boolean }> {
  const lista = candidatos(modeloConfigurado)
  if (lista.length === 0) throw new Error('No hay claves de IA: agrega GEMINI_API_KEY, OPENROUTER_API_KEY o GROQ_API_KEY en Vercel.')
  const fallos: string[] = []
  for (const [i, c] of lista.entries()) {
    const gen = c.proveedor === 'gemini' ? gemini(c.modelo, sistema, turnos, op) : groq(c.modelo, sistema, turnos, op, c.proveedor)
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
  throw new Error(cupo ? 'Todos los modelos de IA están sin cupo por ahora. Intenta en unos minutos.' : `Ningún modelo de IA respondió. (${fallos.slice(-2).join(' | ')})`)
}
