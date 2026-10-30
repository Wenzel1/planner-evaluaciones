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

// Los PDF los lee Gemini directamente (también los escaneados)
async function textoDePdf(buf: Buffer): Promise<string> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('Para leer PDF hace falta GEMINI_API_KEY.')
  for (const modelo of ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash']) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } },
          { text: 'Transcribe el contenido de este documento en texto plano, en español, conservando títulos, unidades, temas, objetivos, competencias, horas y forma de evaluación. Sin comentarios tuyos. Si es muy largo, resume las partes repetitivas pero conserva todos los temas. Máximo 12000 caracteres.' },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 6000, ...(/2\.5/.test(modelo) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => null)
    if (!r) continue
    const d: any = await r.json().catch(() => ({}))
    const texto = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim()
    if (r.ok && texto) return texto
    console.error(`[Archivo] ${modelo} no pudo leer el PDF: ${r.status} ${d?.error?.message || ''}`)
    if (r.status === 400) break // el PDF en sí tiene problemas: no vale la pena probar otro modelo
  }
  throw new Error('No se pudo leer el PDF. Prueba con un PDF más liviano o copia el texto.')
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
    else if (ext === 'pdf') texto = await textoDePdf(buf)
    else return NextResponse.json({ error: 'Formato no soportado. Usa PDF, Word (.docx), .txt, .md o .csv.' }, { status: 400 })
    texto = texto.replace(/\r/g, '').trim()
    if (!texto) return NextResponse.json({ error: 'El archivo no tiene texto que se pueda leer.' }, { status: 400 })
    const recortado = texto.length > MAX_TEXTO
    return NextResponse.json({ nombre, texto: texto.slice(0, MAX_TEXTO), caracteres: texto.length, recortado })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || 'No se pudo leer el archivo.' }, { status: 500 })
  }
}
