// Archivos de Excel (.xlsx) con formato: título, encabezados de color, anchos de columna,
// texto ajustado, bordes suaves y filas alternas. Los usan el Acta de notas y la exportación de evaluaciones.
import ExcelJS from 'exceljs'

export const COLOR = {
  indigo: 'FF4F46E5',
  indigoClaro: 'FFEEF2FF',
  gris: 'FF6B7280',
  borde: 'FFD9DCE8',
  alterna: 'FFF7F8FC',
  verde: 'FF047857', verdeFondo: 'FFD1FAE5',
  rojo: 'FFB91C1C', rojoFondo: 'FFFEE2E2',
  ambar: 'FFB45309', ambarFondo: 'FFFEF3C7',
}

const bordeFino = { style: 'thin' as const, color: { argb: COLOR.borde } }
export const BORDES = { top: bordeFino, left: bordeFino, bottom: bordeFino, right: bordeFino }

export function nuevoLibro() {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Planificador de Evaluaciones'
  libro.created = new Date()
  return libro
}

// Título grande (fila 1) y subtítulo gris (fila 2), ocupando todas las columnas
export function titulo(hoja: ExcelJS.Worksheet, columnas: number, texto: string, subtitulo: string) {
  hoja.mergeCells(1, 1, 1, columnas)
  const t = hoja.getCell(1, 1)
  t.value = texto
  t.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.indigo } }
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  hoja.getRow(1).height = 30
  hoja.mergeCells(2, 1, 2, columnas)
  const s = hoja.getCell(2, 1)
  s.value = subtitulo
  s.font = { size: 10, italic: true, color: { argb: COLOR.gris } }
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  hoja.getRow(2).height = 20
}

// Fila de encabezados con fondo de color, texto blanco y ajuste de línea
export function encabezados(hoja: ExcelJS.Worksheet, fila: number, nombres: string[]) {
  const r = hoja.getRow(fila)
  nombres.forEach((n, i) => {
    const c = r.getCell(i + 1)
    c.value = n
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = BORDES
  })
  r.height = 32
}

// Da formato a una fila de datos: bordes, alineación arriba, ajuste de texto y fondo alterno
export function filaDatos(hoja: ExcelJS.Worksheet, fila: number, columnas: number, alterna: boolean, centradas: number[] = []) {
  const r = hoja.getRow(fila)
  for (let i = 1; i <= columnas; i++) {
    const c = r.getCell(i)
    c.border = BORDES
    c.alignment = { vertical: 'top', wrapText: true, horizontal: centradas.includes(i) ? 'center' : 'left' }
    if (alterna) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.alterna } }
    if (!c.font) c.font = { size: 10 }
  }
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
