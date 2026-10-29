// Búsqueda automática de recursos para una evaluación:
//  - Videos: API oficial de YouTube (videos reales, en español, que se pueden incrustar, de 3 a 30 minutos).
//  - Páginas y herramientas: Gemini las propone y el servidor comprueba que cada enlace abre de verdad.
// Variables de entorno (solo servidor): YOUTUBE_API_KEY, GEMINI_API_KEY y opcional GEMINI_MODELO.

export interface VideoSugerido { titulo: string; url: string; canal: string; duracionSeg: number; miniatura: string; vistas: number }
export interface PaginaSugerida { titulo: string; url: string; descripcion: string }
export interface TemaRecursos { nombre: string; tipoActividad?: string | null; enfoque?: string | null; materia?: string | null }

const TIEMPO = 8000

// Palabras que describen la actividad, no el tema ("Laboratorio práctico de…", "Taller de…"): no ayudan a buscar
const GENERICAS = /^(laboratorio|taller|pr[aá]ctica|pr[aá]ctico|guiad[oa]|exposici[oó]n|proyecto|examen|prueba|parcial|quiz|evaluaci[oó]n|actividad|trabajo|final|grupal|individual|escrit[oa]|oral|de|del|la|el|los|las|sobre|y|en|con)$/i
export function temaParaBuscar(nombre: string): string {
  const palabras = temaLimpio(nombre).split(' ')
  let i = 0
  while (i < palabras.length - 1 && GENERICAS.test(palabras[i])) i++ // quita las del principio
  if (palabras.slice(i).every(w => GENERICAS.test(w))) return temaLimpio(nombre) // ej. "Proyecto final": se busca tal cual
  const resto = palabras.slice(i).join(' ').trim()
  return resto.length >= 3 ? resto : temaLimpio(nombre)
}

export function temaLimpio(nombre: string): string {
  return String(nombre || '')
    .replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '')
    .replace(/[*_#`"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

// "PT1H2M10S" → 3730
export function segundosISO(d: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || '')
  if (!m) return 0
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0))
}

const decodificar = (t: string) => String(t || '')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function conTiempo(url: string, init: RequestInit = {}, ms = TIEMPO): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) } finally { clearTimeout(t) }
}

// ---------------- YouTube ----------------
export async function buscarVideos(tema: TemaRecursos, cuantos = 5): Promise<VideoSugerido[]> {
  const clave = process.env.YOUTUBE_API_KEY
  if (!clave) throw new Error('Falta YOUTUBE_API_KEY en las variables de entorno.')
  const base = temaParaBuscar(tema.nombre)
  const palabras = base.split(' ').filter(Boolean).length
  // Si el tema es muy corto (ej. "UML"), se agrega la materia para dar contexto; "en español" ayuda mucho a YouTube
  const q = `${palabras <= 2 && tema.materia ? `${base} ${temaLimpio(tema.materia)}` : base} en español`
  const p = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '20', q, key: clave,
    relevanceLanguage: 'es', safeSearch: 'strict', videoEmbeddable: 'true', videoSyndicated: 'true',
  })
  const r = await conTiempo(`https://www.googleapis.com/youtube/v3/search?${p}`)
  const d: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    const motivo = d?.error?.errors?.[0]?.reason || ''
    if (motivo === 'quotaExceeded' || motivo === 'dailyLimitExceeded') throw new Error('Se acabó el cupo diario de YouTube. Se renueva mañana.')
    if (r.status === 400 || r.status === 403) throw new Error('YouTube rechazó la clave (revisa YOUTUBE_API_KEY y que la "YouTube Data API v3" esté habilitada).')
    throw new Error('YouTube no respondió.')
  }
  const ids: string[] = (d.items || []).map((i: any) => i?.id?.videoId).filter(Boolean)
  if (ids.length === 0) return []

  // Duración y vistas (1 unidad de cupo)
  const p2 = new URLSearchParams({ part: 'contentDetails,snippet,statistics', id: ids.join(','), key: clave })
  const r2 = await conTiempo(`https://www.googleapis.com/youtube/v3/videos?${p2}`)
  const d2: any = await r2.json().catch(() => ({}))
  const porId = new Map<string, any>((d2.items || []).map((v: any) => [v.id, v]))

  const candidatos: (VideoSugerido & { puntaje: number })[] = []
  ids.forEach((id, pos) => {
    const v = porId.get(id)
    if (!v) return
    const seg = segundosISO(v.contentDetails?.duration)
    if (seg < 180 || seg > 1800) return // ni shorts ni clases de horas
    const idioma = String(v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage || '').toLowerCase()
    const titulo = decodificar(v.snippet?.title)
    const pareceEspanol = idioma.startsWith('es') || /[áéíóúñ¿¡]|\b(qu[eé]|c[oó]mo|para|desde|explicaci[oó]n|tutorial en espa[nñ]ol|curso)\b/i.test(titulo)
    const vistas = Number(v.statistics?.viewCount) || 0
    // Puntaje: español primero, luego popularidad, y un poco el orden de relevancia de YouTube
    const puntaje = (pareceEspanol ? 100 : 0) + Math.log10(vistas + 1) * 8 - pos * 1.5
    candidatos.push({
      puntaje,
      titulo: decodificar(v.snippet?.title).slice(0, 120),
      url: `https://www.youtube.com/watch?v=${id}`,
      canal: decodificar(v.snippet?.channelTitle).slice(0, 80),
      duracionSeg: seg,
      miniatura: v.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      vistas,
    })
  })
  return candidatos.sort((a, b) => b.puntaje - a.puntaje).slice(0, cuantos).map(({ puntaje, ...v }) => v)
}

// ---------------- Gemini + verificación ----------------
// Solo https, con dominio de verdad (nada de IPs ni direcciones internas)
export function urlSegura(u: string): URL | null {
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:') return null
    const h = url.hostname.toLowerCase()
    if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null
    return url
  } catch { return null }
}

// ¿La página abre? 2xx/3xx sí; 403/405/429 también (el sitio existe pero no deja pasar robots). 404 y errores de red: no.
export async function enlaceAbre(u: string): Promise<boolean> {
  const url = urlSegura(u)
  if (!url) return false
  try {
    const r = await conTiempo(url.toString(), { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PlanificadorEvaluaciones/1.0)', Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5' } }, 6000)
    try { await r.body?.cancel() } catch {}
    return r.ok || [403, 405, 429].includes(r.status)
  } catch { return false }
}

// Prueba varios modelos: si uno está saturado (503), no existe para esa clave (404) o se quedó sin cupo (429), pasa al siguiente.
const MODELOS_RESPALDO = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash']
async function preguntarGemini(clave: string, prompt: string): Promise<string> {
  const modelos = [...new Set([process.env.GEMINI_MODELO, ...MODELOS_RESPALDO].filter(Boolean) as string[])]
  let ultimo = ''
  let soloCupo = true
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      let r: Response
      try {
        r = await conTiempo(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } }),
        }, 25000)
      } catch (e: any) {
        ultimo = e?.name === 'AbortError' ? `${modelo}: tardó demasiado` : `${modelo}: sin conexión (${e?.message || e})`
        soloCupo = false
        break
      }
      const d: any = await r.json().catch(() => ({}))
      if (r.ok) {
        const texto = d?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || ''
        if (texto.trim()) return texto
        ultimo = `${modelo}: respuesta vacía (${d?.candidates?.[0]?.finishReason || d?.promptFeedback?.blockReason || 'sin motivo'})`
        soloCupo = false
        break
      }
      const msg = String(d?.error?.message || '').slice(0, 160)
      console.error(`[Gemini] ${modelo} → ${r.status} ${msg}`)
      if (r.status === 400 && /api key|API_KEY/i.test(msg) || r.status === 401 || (r.status === 403 && /key|permission|denied/i.test(msg))) {
        throw new Error(`Gemini rechazó la clave (revisa GEMINI_API_KEY en Vercel). Detalle: ${msg || r.status}`)
      }
      if (r.status !== 429) soloCupo = false
      ultimo = `${modelo}: error ${r.status}${msg ? ` (${msg})` : ''}`
      if ((r.status === 503 || r.status === 500) && intento === 0) { await new Promise(res => setTimeout(res, 1500)); continue } // saturado: reintenta una vez
      break // 404 / 429 / otros: siguiente modelo
    }
  }
  if (soloCupo) throw new Error('Se acabó el cupo de Gemini por ahora (se renueva en unas horas).')
  throw new Error(`Gemini no respondió. Último intento: ${ultimo}`)
}

export async function sugerirPaginas(tema: TemaRecursos, cuantas = 4): Promise<PaginaSugerida[]> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('Falta GEMINI_API_KEY en las variables de entorno.')
  const prompt = `Eres un docente universitario de computación. Para preparar esta evaluación, sugiere 7 páginas web REALES y conocidas que ayuden a un estudiante a estudiar o practicar:
- Tema: ${temaLimpio(tema.nombre)}
- Materia: ${tema.materia || 'Ingeniería de Software'}
- Tipo de actividad: ${tema.tipoActividad || 'no indicado'}
- Enfoque: ${tema.enfoque || 'no indicado'}

Prioriza: documentación oficial, herramientas gratuitas para practicar (editores, simuladores, playgrounds), y guías reconocidas (MDN, Microsoft Learn, documentación oficial del producto, freeCodeCamp, Wikipedia en español si aplica). Prefiere contenido en español cuando exista.
Usa SOLO direcciones https que estés seguro de que existen; mejor la página principal de una sección que una ruta muy específica. No incluyas YouTube.
Responde SOLO con JSON: [{"titulo": "...", "url": "https://...", "descripcion": "para qué le sirve al estudiante, máximo 15 palabras"}]`

  const texto = await preguntarGemini(clave, prompt)
  let crudo: any[] = []
  try { crudo = JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { crudo = [] }
  if (!Array.isArray(crudo)) crudo = []

  const vistos = new Set<string>()
  const candidatas = crudo.map((x: any) => ({
    titulo: String(x?.titulo ?? '').trim().slice(0, 120),
    url: String(x?.url ?? '').trim(),
    descripcion: String(x?.descripcion ?? '').trim().slice(0, 160),
  })).filter(x => {
    const u = urlSegura(x.url)
    if (!u || /youtube\.com|youtu\.be/i.test(u.hostname)) return false
    const k = u.hostname + u.pathname.replace(/\/$/, '')
    if (vistos.has(k)) return false
    vistos.add(k); return true
  }).slice(0, 8)

  // Se comprueban todas a la vez; solo quedan las que abren
  const abren = await Promise.all(candidatas.map(c => enlaceAbre(c.url)))
  return candidatas.filter((_, i) => abren[i]).slice(0, cuantas).map(c => ({ ...c, titulo: c.titulo || new URL(c.url).hostname }))
}
