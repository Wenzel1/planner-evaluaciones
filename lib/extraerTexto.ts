// Lee el contenido de un archivo entregado para que la IA lo corrija.
// Word, PowerPoint, Excel y OpenDocument son .zip por dentro: se extrae su texto con jszip (sin librerías extra).
// PDF e imágenes no se convierten: se mandan tal cual a la IA (Gemini los lee de forma nativa).
import JSZip from 'jszip'
import { extensionDe } from '@/lib/almacenamiento'

export type Contenido =
  | { tipo: 'texto'; nombre: string; texto: string }
  | { tipo: 'pdf'; nombre: string; base64: string }
  | { tipo: 'imagen'; nombre: string; dataUrl: string }
  | { tipo: 'ninguno'; nombre: string; motivo: string }

const TEXTO = ['txt', 'md', 'csv', 'json', 'xml', 'yml', 'yaml', 'html', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'kt', 'c', 'h', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'dart', 'sh', 'sql', 'puml', 'uml', 'drawio', 'ipynb', 'svg']
const IMAGEN: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
const MAX_TEXTO = 60_000

const entidades = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&')
const sinEtiquetas = (xml: string) => entidades(xml.replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const recortar = (t: string, max = MAX_TEXTO) => (t.length > max ? `${t.slice(0, max)}\n[… el archivo sigue; se recortó para la corrección]` : t)

async function deDocx(zip: JSZip) {
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) return ''
  return sinEtiquetas(xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n'))
}
async function dePptx(zip: JSZip) {
  const diapos = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0])
  const partes: string[] = []
  for (const [i, n] of diapos.entries()) {
    const xml = await zip.file(n)!.async('string')
    const t = sinEtiquetas(xml.replace(/<\/a:p>/g, '\n'))
    if (t) partes.push(`--- Diapositiva ${i + 1} ---\n${t}`)
  }
  return partes.join('\n\n')
}
async function deXlsx(datos: Buffer) {
  const ExcelJS: any = await import('exceljs')
  const libro = new (ExcelJS.default?.Workbook || ExcelJS.Workbook)()
  await libro.xlsx.load(datos)
  const partes: string[] = []
  libro.eachSheet((ws: any) => {
    const filas: string[] = []
    ws.eachRow({ includeEmpty: false }, (row: any, r: number) => {
      if (r > 200) return
      const celdas: string[] = []
      row.eachCell({ includeEmpty: true }, (c: any) => { const v = c.value; celdas.push(v && typeof v === 'object' && 'result' in v ? String(v.result ?? '') : v instanceof Date ? v.toISOString().slice(0, 10) : String(c.text ?? v ?? '')) })
      filas.push(celdas.join(' | '))
    })
    partes.push(`--- Hoja «${ws.name}» ---\n${filas.join('\n')}`)
  })
  return partes.join('\n\n')
}
async function deOpenDocument(zip: JSZip) {
  const xml = await zip.file('content.xml')?.async('string')
  return xml ? sinEtiquetas(xml.replace(/<\/text:p>/g, '\n').replace(/<\/text:h>/g, '\n')) : ''
}
async function deZip(zip: JSZip) {
  const nombres = Object.keys(zip.files).filter(n => !zip.files[n].dir && !n.startsWith('__MACOSX/'))
  const partes = [`Contenido del .zip (${nombres.length} archivos):\n${nombres.slice(0, 200).map(n => `- ${n}`).join('\n')}`]
  let usado = 0
  for (const n of nombres.filter(n => TEXTO.includes(extensionDe(n))).slice(0, 12)) {
    const t = await zip.file(n)!.async('string')
    if (t.includes('\u0000')) continue
    const trozo = t.slice(0, 8000)
    partes.push(`--- ${n} ---\n${trozo}`)
    usado += trozo.length
    if (usado > 45_000) break
  }
  return partes.join('\n\n')
}

export async function extraerContenido(nombre: string, datos: Buffer): Promise<Contenido> {
  const ext = extensionDe(nombre)
  try {
    if (ext === 'pdf') return datos.length <= 15 * 1024 * 1024 ? { tipo: 'pdf', nombre, base64: datos.toString('base64') } : { tipo: 'ninguno', nombre, motivo: 'el PDF pesa más de 15 MB' }
    if (IMAGEN[ext]) return datos.length <= 6 * 1024 * 1024 ? { tipo: 'imagen', nombre, dataUrl: `data:${IMAGEN[ext]};base64,${datos.toString('base64')}` } : { tipo: 'ninguno', nombre, motivo: 'la imagen pesa más de 6 MB' }
    if (TEXTO.includes(ext)) {
      if (datos.subarray(0, 4000).includes(0)) return { tipo: 'ninguno', nombre, motivo: 'no es un archivo de texto' }
      return { tipo: 'texto', nombre, texto: recortar(datos.toString('utf8')) }
    }
    if (ext === 'xlsx') return { tipo: 'texto', nombre, texto: recortar(await deXlsx(datos)) }
    if (['docx', 'pptx', 'odt', 'ods', 'odp', 'zip'].includes(ext)) {
      const zip = await JSZip.loadAsync(datos)
      const t = ext === 'docx' ? await deDocx(zip) : ext === 'pptx' ? await dePptx(zip) : ext === 'zip' ? await deZip(zip) : await deOpenDocument(zip)
      return t ? { tipo: 'texto', nombre, texto: recortar(t) } : { tipo: 'ninguno', nombre, motivo: 'no se encontró texto dentro' }
    }
    return { tipo: 'ninguno', nombre, motivo: `la IA no puede leer archivos .${ext || '?'} (pide el trabajo en PDF o Word)` }
  } catch {
    return { tipo: 'ninguno', nombre, motivo: 'el archivo está dañado o protegido' }
  }
}
