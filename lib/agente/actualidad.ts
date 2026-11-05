// Búsqueda de ACTUALIDAD para que las evaluaciones que propone el agente traten temas de hoy.
// Se hace con la búsqueda de Google integrada en Gemini ("Grounding with Google Search", usa GEMINI_API_KEY).
// Si Gemini no responde (sin clave o sin cupo), se intenta con la búsqueda web de OpenRouter (OPENROUTER_API_KEY).
// Los contenidos clásicos de ingeniería de software (UML, diagramas de flujo…) no necesitan actualidad: se devuelve clasico = true.

export interface Fuente { titulo: string; url: string }
export interface Actualidad { texto: string; fuentes: Fuente[]; clasico: boolean; via: 'google' | 'openrouter' }

const TIEMPO_MAX = 15000

// ¿El profesor pide evaluaciones nuevas o un plan? (ahí la búsqueda es obligatoria)
export function pideEvaluacionesNuevas(mensaje: string): boolean {
  const m = String(mensaje || '')
  if (/(\bnotas?\b|calificaci|\bpesos?\b|porcentaje|reprogram|asistencia|\bpromedio|\belimin|\bborr[ae])/i.test(m)) return false
  const ideas = /(recomi[eé]nd|prop[oó]n|sugi[eé]r|\bideas?\b|\bopciones\b|\bdame (otr|m[aá]s)|\botr[oa]s? (plan|evaluaci)|plan (completo|nuevo)|nuev[oa]s? evaluaci|\bdistint|\bdiferent|creativ)/i.test(m)
  const crear = /\b(crea|cr[eé]ame|haz|hazme|genera|gen[eé]rame|arma|[aá]rmame|dise[nñ]a|planifica|dame|quiero|necesito|agrega|a[nñ]ade|cambia)\b/i.test(m)
    && /(\bplan\b|evaluaci|actividad|taller|proyecto|examen|laboratorio|exposici|\btemas?\b)/i.test(m)
  return ideas || crear
}

function pedidoDeBusqueda(materia: string, pedido: string, existentes: string[]): string {
  const hoy = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Hoy es ${hoy}. Un profesor universitario de ${materia ? `la materia «${materia}»` : 'ingeniería de software'} pidió a su asistente: «${pedido.slice(0, 400)}».
${existentes.length ? `Evaluaciones que ya tiene: ${existentes.slice(0, 8).join('; ')}.\n` : ''}
Si el pedido trata SOLO de contenidos clásicos y atemporales de ingeniería de software (UML, diagramas de flujo, diagramas entidad-relación, casos de uso, pseudocódigo, algoritmos y estructuras de datos, normalización de bases de datos, patrones de diseño, modelos de ciclo de vida), responde únicamente la palabra: CLASICO

Si no, busca en Google novedades REALES y recientes (últimos 12 a 18 meses) de la industria del software que encajen con esa materia y ese pedido: tecnologías y versiones nuevas, herramientas, prácticas, estándares, incidentes de seguridad conocidos o tendencias que sirvan como tema de una evaluación universitaria.
Responde en español con 6 a 8 viñetas cortas, cada una así: «- Tema: por qué es actual (mes y año)». Sin introducción ni cierre.`
}

function conLimite(senal?: AbortSignal): AbortSignal {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIEMPO_MAX)
  senal?.addEventListener('abort', () => ctl.abort(), { once: true })
  ctl.signal.addEventListener('abort', () => clearTimeout(t), { once: true })
  return ctl.signal
}

function limpiarFuentes(lista: Fuente[]): Fuente[] {
  const vistos = new Set<string>()
  return lista
    .filter(f => /^https?:\/\//.test(f.url))
    .map(f => ({ titulo: String(f.titulo || '').trim().slice(0, 80) || new URL(f.url).hostname, url: f.url }))
    .filter(f => { const k = f.titulo.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true })
    .slice(0, 5)
}

async function conGoogle(pregunta: string, senal: AbortSignal): Promise<Actualidad> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('sin GEMINI_API_KEY')
  const modelo = (process.env.GEMINI_BUSQUEDA_MODELO || 'gemini-2.5-flash').trim()
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: pregunta }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: senal,
  })
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  const d: any = await r.json()
  const cand = d?.candidates?.[0]
  const texto = (cand?.content?.parts || []).map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('').trim()
  if (!texto) throw new Error('Google no devolvió texto')
  const fuentes = (cand?.groundingMetadata?.groundingChunks || []).map((c: any) => ({ titulo: c?.web?.title, url: c?.web?.uri })).filter((f: any) => f.url)
  return { texto, fuentes: limpiarFuentes(fuentes), clasico: /^\s*CLASICO\b/i.test(texto), via: 'google' }
}

async function conOpenRouter(pregunta: string, senal: AbortSignal): Promise<Actualidad> {
  const clave = process.env.OPENROUTER_API_KEY
  if (!clave) throw new Error('sin OPENROUTER_API_KEY')
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
    body: JSON.stringify({
      model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(),
      messages: [{ role: 'user', content: pregunta }],
      plugins: [{ id: 'web', max_results: 4 }],
      temperature: 0.3, max_tokens: 1200,
    }),
    signal: senal,
  })
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  const d: any = await r.json()
  const msg = d?.choices?.[0]?.message || {}
  const texto = String(msg.content || '').trim()
  if (!texto) throw new Error('OpenRouter no devolvió texto')
  const fuentes = (msg.annotations || []).map((a: any) => ({ titulo: a?.url_citation?.title, url: a?.url_citation?.url })).filter((f: any) => f.url)
  return { texto, fuentes: limpiarFuentes(fuentes), clasico: /^\s*CLASICO\b/i.test(texto), via: 'openrouter' }
}

// Devuelve null si no se pudo buscar (el agente sigue igual, con lo que sabe)
export async function buscarActualidad(o: { materia: string; pedido: string; existentes: string[]; senal?: AbortSignal }): Promise<Actualidad | null> {
  const pregunta = pedidoDeBusqueda(o.materia, o.pedido, o.existentes)
  for (const buscar of [conGoogle, conOpenRouter]) {
    try {
      return await buscar(pregunta, conLimite(o.senal))
    } catch (e: any) {
      if (o.senal?.aborted) return null
      console.error('[Actualidad]', e?.message || e)
    }
  }
  return null
}
