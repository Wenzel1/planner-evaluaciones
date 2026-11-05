import { NextResponse } from 'next/server'
import zlib from 'zlib'
import { requerirActor } from '@/lib/permisos'

export const maxDuration = 60
const MAX_BYTES = 10 * 1024 * 1024
const MAX_TEXTO = 15000

// Extrae un archivo de un .docx (que es un ZIP) sin librerías: lee el directorio central y descomprime la entrada pedida
function leerDeZip(buf: Buffer, nombre: string): Buffer | null {
  let fin = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break }
  if (fin < 0) return null
  const total = buf.readUInt16LE(fin + 10)
  let p = buf.readUInt32LE(fin + 16)
  for (let n = 0; n < total && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null
    const metodo = buf.readUInt16LE(p + 10), comprimido = buf.readUInt32LE(p + 20)
    const largoNombre = buf.readUInt16LE(p + 28), largoExtra = buf.readUInt16LE(p + 30), largoComent = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const este = buf.toString('utf8', p + 46, p + 46 + largoNombre)
    if (este === nombre) {
      const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const datos = buf.subarray(ini, ini + comprimido)
      return metodo === 0 ? datos : metodo === 8 ? zlib.inflateRawSync(datos) : null
    }
    p += 46 + largoNombre + largoExtra + largoComent
  }
  return null
}

function textoDeDocx(buf: Buffer): string {
  const xml = leerDeZip(buf, 'word/document.xml')
  if (!xml) throw new Error('No parece un archivo de Word (.docx) válido.')
  return xml.toString('utf8')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ---------- PDF ----------
// 1) Si el PDF tiene texto (no es escaneado), se saca directamente: rápido y sin gastar IA.
// 2) Si no se pudo (escaneado o fuentes raras), lo lee Gemini.
// 3) Si Gemini falla, lo lee OpenRouter.
// Si todo falla, el mensaje dice la causa concreta.

// Texto de un string de PDF: ( ... ) con escapes
function textoLiteral(t: string): string {
  return t.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c: string) => {
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8))
    return ({ n: '\n', r: '', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' } as Record<string, string>)[c] ?? c
  })
}
// <48656C6C6F> → "Hello" (fuentes simples; con fuentes especiales sale basura y se descarta con esLegible)
function textoHex(h: string): string { const x = h.replace(/\s+/g, ''); return Buffer.from(x.length % 2 ? x + '0' : x, 'hex').toString('latin1') }
function textoLocalDePdf(buf: Buffer): string {
  const bin = buf.toString('latin1')
  const partes: string[] = []
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(bin)) && n++ < 400) {
    const cabecera = bin.slice(Math.max(0, m.index - 300), m.index)
    let datos = Buffer.from(m[1], 'latin1')
    if (/FlateDecode/.test(cabecera)) { try { datos = zlib.inflateSync(datos) } catch { try { datos = zlib.inflateRawSync(datos) } catch { continue } } }
    else if (/\/Filter/.test(cabecera)) continue // imágenes u otros filtros: no tienen texto
    const c = datos.toString('latin1')
    if (!/\b(Tj|TJ)\b/.test(c)) continue
    for (const b of c.split(/\bBT\b/).slice(1)) {
      const cuerpo = b.split(/\bET\b/)[0]
      let linea = ''
      const ops = /\((?:\\.|[^\\)])*\)\s*Tj|<[0-9a-fA-F\s]*>\s*Tj|\[[^\]]*\]\s*TJ|T\*|-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+T[dD]/g
      let o: RegExpExecArray | null
      while ((o = ops.exec(cuerpo))) {
        const op = o[0]
        if (op.endsWith('Tj')) linea += op.startsWith('<') ? textoHex(op.slice(1, op.indexOf('>'))) : textoLiteral(op.slice(op.indexOf('(') + 1, op.lastIndexOf(')')))
        else if (op.endsWith('TJ')) {
          for (const x of op.matchAll(/\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|-?\d+(?:\.\d+)?/g)) {
            if (x[0].startsWith('(')) linea += textoLiteral(x[0].slice(1, -1))
            else if (x[0].startsWith('<')) linea += textoHex(x[0].slice(1, -1))
            else if (Number(x[0]) < -200) linea += ' '
          }
        } else { if (linea.trim()) partes.push(linea); linea = '' }
      }
      if (linea.trim()) partes.push(linea)
    }
  }
  return partes.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
// ¿El texto sacado se puede leer? (con fuentes especiales sale basura)
function esLegible(t: string): boolean {
  if (t.length < 300) return false
  const buenos = (t.match(/[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s.,;:()¿?¡!%\-]/g) || []).length
  const palabras = (t.match(/\b(de|la|el|los|las|en|y|que|del|para|con)\b/gi) || []).length
  return buenos / t.length > 0.9 && palabras >= 8
}

const PEDIDO_PDF = 'Transcribe el contenido de este documento en texto plano, en español, conservando títulos, unidades, temas, objetivos, competencias, horas y forma de evaluación. Sin comentarios tuyos. Si es muy largo, resume las partes repetitivas pero conserva todos los temas. Máximo 12000 caracteres.'
const fallo = (e: any) => ({ ok: false, status: e?.name === 'TimeoutError' ? 'tiempo' : 'sin conexión', json: async () => ({}) }) as any

async function textoDePdf(buf: Buffer, nombre: string): Promise<string> {
  if (!buf.subarray(0, 1024).toString('latin1').includes('%PDF')) throw new Error('El archivo no es un PDF válido (puede estar dañado o tener otra extensión).')
  // Algunos PDF protegidos solo bloquean la edición: se intenta igual y, si falla, el mensaje lo dice
  const protegido = /\/Encrypt\b/.test(buf.toString('latin1'))

  // 1) Texto directo
  try { const t = textoLocalDePdf(buf); if (esLegible(t)) return t } catch { /* se sigue con la IA */ }

  const fallos: string[] = []
  // 2) Gemini
  const clave = process.env.GEMINI_API_KEY
  if (clave) {
    for (const modelo of ['gemini-2.5-flash-lite', 'gemini-2.5-flash']) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } }, { text: PEDIDO_PDF }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 6000, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(40000),
      }).catch(fallo)
      const d: any = await r.json().catch(() => ({}))
      const texto = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim()
      if (r.ok && texto) return texto
      fallos.push(`Gemini ${r.status}: ${String(d?.error?.message || (r.ok ? 'no devolvió texto' : '')).slice(0, 120)}`)
      console.error(`[Archivo] ${modelo} no pudo leer el PDF: ${fallos[fallos.length - 1]}`)
      if (r.status === 400 || r.status === 429) break
    }
  }
  // 3) OpenRouter (el modelo recibe el PDF como archivo adjunto)
  if (process.env.OPENROUTER_API_KEY) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
      body: JSON.stringify({
        model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(),
        temperature: 0, max_tokens: 6000,
        messages: [{ role: 'user', content: [{ type: 'text', text: PEDIDO_PDF }, { type: 'file', file: { filename: /\.pdf$/i.test(nombre) ? nombre : 'documento.pdf', file_data: `data:application/pdf;base64,${buf.toString('base64')}` } }] }],
      }),
      signal: AbortSignal.timeout(45000),
    }).catch(fallo)
    const d: any = await r.json().catch(() => ({}))
    const texto = String(d?.choices?.[0]?.message?.content || '').trim()
    if (r.ok && texto) return texto
    fallos.push(`OpenRouter ${r.status}: ${String(d?.error?.message || (r.ok ? 'no devolvió texto' : '')).slice(0, 120)}`)
    console.error(`[Archivo] OpenRouter no pudo leer el PDF: ${fallos[fallos.length - 1]}`)
  }

  // Mensaje con la causa más probable
  const todo = fallos.join(' | ')
  if (!clave && !process.env.OPENROUTER_API_KEY) throw new Error('Este PDF no tiene texto seleccionable (parece escaneado) y para leerlo hace falta GEMINI_API_KEY u OPENROUTER_API_KEY en Vercel.')
  if (protegido) throw new Error('El PDF está protegido con contraseña o tiene restricciones. Quítale la protección (o guárdalo como PDF nuevo) e intenta de nuevo.')
  if (/402|credit|saldo|insufficient/i.test(todo)) throw new Error('Se acabó el saldo de OpenRouter y Gemini tampoco pudo leer el PDF. Recarga saldo o copia el texto en el chat.')
  if (/429|quota|exhausted/i.test(todo)) throw new Error('Se alcanzó el límite de uso de Gemini por hoy. Intenta más tarde o copia el texto en el chat.')
  if (/tiempo/i.test(todo)) throw new Error('El PDF tardó demasiado en leerse (es muy largo o pesado). Prueba con menos páginas o copia el texto.')
  throw new Error(`No se pudo leer el PDF (${todo.slice(0, 200) || 'motivo desconocido'}). Prueba con otro PDF o copia el texto.`)
}

// POST /api/chat/archivo (multipart, campo "file") — devuelve el texto de un PDF, Word, .txt, .md o .csv para dárselo al agente
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const form = await request.formData().catch(() => null)
    const archivo = form?.get('file')
    if (!archivo || typeof archivo === 'string') return NextResponse.json({ error: 'No llegó el archivo.' }, { status: 400 })
    if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo pesa más de 10 MB.' }, { status: 400 })
    const nombre = String(archivo.name || 'documento').slice(0, 120)
    const ext = (nombre.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
    const buf = Buffer.from(await archivo.arrayBuffer())
    let texto = ''
    if (['txt', 'md', 'csv'].includes(ext)) texto = buf.toString('utf8')
    else if (ext === 'docx') texto = textoDeDocx(buf)
    else if (ext === 'pdf') texto = await textoDePdf(buf, nombre)
    else return NextResponse.json({ error: 'Formato no soportado. Usa PDF, Word (.docx), .txt, .md o .csv.' }, { status: 400 })
    texto = texto.replace(/\r/g, '').trim()
    if (!texto) return NextResponse.json({ error: 'El archivo no tiene texto que se pueda leer.' }, { status: 400 })
    const recortado = texto.length > MAX_TEXTO
    return NextResponse.json({ nombre, texto: texto.slice(0, MAX_TEXTO), caracteres: texto.length, recortado })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || 'No se pudo leer el archivo.' }, { status: 422 })
  }
}
