// Archivos de Excel (.xlsx) con formato: título, encabezados de color, anchos de columna,
// texto ajustado, bordes suaves y filas alternas. Los usan el Acta de notas y la exportación de evaluaciones.
import ExcelJS from 'exceljs'

// Estilo plano: colores sólidos y suaves, sin cuadrícula pesada ni filas rayadas.
// Solo una línea fina bajo cada fila, encabezado de un color y estados con su color de fondo.
export const COLOR = {
  indigo: 'FF4F46E5',
  indigoClaro: 'FFEEF0FF',
  tinta: 'FF1F2937',
  gris: 'FF6B7280',
  linea: 'FFE5E7EB',
  alterna: 'FFFFFFFF',
  verde: 'FF166534', verdeFondo: 'FFDCFCE7',
  rojo: 'FFB91C1C', rojoFondo: 'FFFEE2E2',
  ambar: 'FF92400E', ambarFondo: 'FFFEF3C7',
}

const linea = { style: 'thin' as const, color: { argb: COLOR.linea } }
export const BORDES = { bottom: linea }
const FUENTE = 'Calibri'

export function nuevoLibro() {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Planificador de Evaluaciones'
  libro.created = new Date()
  return libro
}

// Título grande (fila 1), subtítulo gris (fila 2) y una franja fina de color (fila 3)
export function titulo(hoja: ExcelJS.Worksheet, columnas: number, texto: string, subtitulo: string) {
  hoja.properties.defaultRowHeight = 18
  hoja.views = [{ showGridLines: false }]
  hoja.mergeCells(1, 1, 1, columnas)
  const t = hoja.getCell(1, 1)
  t.value = texto
  t.font = { name: FUENTE, bold: true, size: 18, color: { argb: COLOR.tinta } }
  t.alignment = { vertical: 'middle', horizontal: 'left' }
  hoja.getRow(1).height = 32
  hoja.mergeCells(2, 1, 2, columnas)
  const s = hoja.getCell(2, 1)
  s.value = subtitulo
  s.font = { name: FUENTE, size: 10, color: { argb: COLOR.gris } }
  s.alignment = { vertical: 'top', horizontal: 'left' }
  hoja.getRow(2).height = 20
  for (let i = 1; i <= columnas; i++) hoja.getCell(3, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.indigo } }
  hoja.getRow(3).height = 4
}

// Encabezados: fondo índigo sólido y texto blanco
export function encabezados(hoja: ExcelJS.Worksheet, fila: number, nombres: string[]) {
  const r = hoja.getRow(fila)
  nombres.forEach((n, i) => {
    const c = r.getCell(i + 1)
    c.value = n
    c.font = { name: FUENTE, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.indigo } }
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : 'left', wrapText: true, indent: i === 0 ? 0 : 1 }
  })
  r.height = 34
}

// Fila de datos: fondo blanco, línea fina abajo, texto ajustado
export function filaDatos(hoja: ExcelJS.Worksheet, fila: number, columnas: number, _alterna: boolean, centradas: number[] = []) {
  const r = hoja.getRow(fila)
  for (let i = 1; i <= columnas; i++) {
    const c = r.getCell(i)
    c.border = BORDES
    const centro = centradas.includes(i)
    c.alignment = { vertical: 'middle', wrapText: true, horizontal: centro ? 'center' : 'left', indent: centro ? 0 : 1 }
    c.font = { name: FUENTE, size: 10, color: { argb: COLOR.tinta } }
  }
}

// Etiqueta de estado: fondo de color suave y texto del mismo tono, en negrita
export function etiqueta(c: ExcelJS.Cell, texto: string, fondo: string) {
  c.font = { name: FUENTE, size: 10, bold: true, color: { argb: texto } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } }
  c.alignment = { vertical: 'middle', horizontal: 'center' }
}

export async function respuestaExcel(libro: ExcelJS.Workbook, archivo: string) {
  const buffer = await libro.xlsx.writeBuffer()
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// Nombre de archivo seguro (sin tildes ni símbolos)
export const nombreArchivo = (t: string) => String(t || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'archivo'

// En .xlsx un texto se guarda como texto (nunca como fórmula aunque empiece por =), así que basta con convertirlo
export const textoSeguro = (v: unknown) => String(v ?? '')
