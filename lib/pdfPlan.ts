// Genera el PDF del Plan de Acción dentro de la app (sin html2pdf ni n8n).
// Usa pdf-lib (instalar con: npm install pdf-lib). Funciona en Vercel sin navegador.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { NIVELES_RUBRICA, normalizarRubrica, puntosNivel, textoPuntos, totalRubrica } from './rubrica'

export interface SeccionPdf {
  nombre?: string | null
  tipoActividad?: string | null
  peso?: number | string | null
  fecha?: string | Date | null
  descripcion?: string | null
  rubrica?: unknown
}
export interface DatosPlanPdf {
  materia?: string | null
  profesor?: string | null
  fechaExamen?: string | Date | null
  seccion?: string | null
  secciones?: SeccionPdf[]
}

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const A4 = { ancho: 595.28, alto: 841.89 }
const MARGEN = 50
const AZUL = rgb(0.118, 0.227, 0.541)      // #1e3a8a
const AZUL_CLARO = rgb(0.376, 0.647, 0.98) // #60a5fa
const GRIS = rgb(0.278, 0.333, 0.412)      // #475569
const GRIS_CLARO = rgb(0.886, 0.91, 0.941) // #e2e8f0
const FONDO = rgb(0.973, 0.98, 0.988)      // #f8fafc
const TEXTO = rgb(0.118, 0.161, 0.231)     // #1e293b

// Las fuentes estándar del PDF solo admiten caracteres latinos (tildes y ñ sí; emojis no)
function limpiar(t: unknown): string {
  return String(t ?? '')
    .replace(/\r/g, '')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/[\u2022\u25CF]/g, '-')
    .replace(/\t/g, '  ')
    .replace(/\*\*/g, '')
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '')
}

function nombreLimpio(n: unknown): string {
  return limpiar(n).replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim() || 'Sin nombre'
}

function fechaCorta(f: unknown): string {
  if (!f) return 'Por definir'
  const d = new Date(f as any)
  if (isNaN(d.getTime())) return 'Por definir'
  return new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

// Parte un texto en líneas que caben en el ancho indicado (respeta los saltos de línea)
function partir(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = []
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean)
    if (palabras.length === 0) { lineas.push(''); continue }
    let actual = ''
    for (let palabra of palabras) {
      // Palabras más largas que la columna (URLs, etc.) se cortan
      while (fuente.widthOfTextAtSize(palabra, tam) > ancho) {
        let i = palabra.length
        while (i > 1 && fuente.widthOfTextAtSize(palabra.slice(0, i), tam) > ancho) i--
        if (actual) { lineas.push(actual); actual = '' }
        lineas.push(palabra.slice(0, i))
        palabra = palabra.slice(i)
      }
      const prueba = actual ? `${actual} ${palabra}` : palabra
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba
      else { if (actual) lineas.push(actual); actual = palabra }
    }
    lineas.push(actual)
  }
  return lineas
}

export async function generarPdfPlan(datos: DatosPlanPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const materia = limpiar(datos.materia || 'Asignatura')
  pdf.setTitle(`Plan de Acción - ${materia}`)
  pdf.setCreator('Planificador de Evaluaciones')

  const anchoUtil = A4.ancho - MARGEN * 2
  let pagina: PDFPage = pdf.addPage([A4.ancho, A4.alto])
  let y = A4.alto - MARGEN

  const nuevaPagina = () => { pagina = pdf.addPage([A4.ancho, A4.alto]); y = A4.alto - MARGEN }
  const asegurar = (alto: number) => { if (y - alto < MARGEN + 20) nuevaPagina() }
  const escribir = (texto: string, x: number, tam: number, fuente: PDFFont, color = TEXTO) => {
    pagina.drawText(texto, { x, y, size: tam, font: fuente, color })
  }

  // ---------- Encabezado ----------
  escribir('PLAN DE ACCIÓN', MARGEN, 9, negrita, AZUL_CLARO)
  if (datos.seccion) {
    const etiqueta = `SECCIÓN ${limpiar(datos.seccion)}`
    const w = negrita.widthOfTextAtSize(etiqueta, 9)
    pagina.drawRectangle({ x: A4.ancho - MARGEN - w - 16, y: y - 5, width: w + 16, height: 18, color: rgb(0.933, 0.949, 1), borderColor: rgb(0.78, 0.82, 0.996), borderWidth: 1 })
    pagina.drawText(etiqueta, { x: A4.ancho - MARGEN - w - 8, y, size: 9, font: negrita, color: rgb(0.388, 0.4, 0.945) })
  }
  y -= 26
  for (const linea of partir(materia, negrita, 22, anchoUtil)) { escribir(linea, MARGEN, 22, negrita, AZUL); y -= 26 }
  const subtitulo = [datos.profesor ? `Prof. ${limpiar(datos.profesor)}` : '', `Fecha: ${fechaCorta(datos.fechaExamen || new Date())}`].filter(Boolean).join('     ')
  escribir(subtitulo, MARGEN, 10, normal, GRIS)
  y -= 14
  pagina.drawLine({ start: { x: MARGEN, y }, end: { x: A4.ancho - MARGEN, y }, thickness: 1.5, color: AZUL })
  y -= 24

  // ---------- Tabla ----------
  const columnas = [
    { titulo: 'CONTENIDO', ancho: 205, alinear: 'izq' as const },
    { titulo: 'ESTRATEGIA', ancho: 150, alinear: 'izq' as const },
    { titulo: 'PESO', ancho: 55, alinear: 'centro' as const },
    { titulo: 'FECHA', ancho: anchoUtil - 205 - 150 - 55, alinear: 'centro' as const },
  ]
  const PAD = 8
  const dibujarCabecera = () => {
    pagina.drawRectangle({ x: MARGEN, y: y - 8, width: anchoUtil, height: 24, color: FONDO, borderColor: GRIS_CLARO, borderWidth: 1 })
    let x = MARGEN
    for (const c of columnas) {
      const w = negrita.widthOfTextAtSize(c.titulo, 8)
      pagina.drawText(c.titulo, { x: c.alinear === 'centro' ? x + (c.ancho - w) / 2 : x + PAD, y, size: 8, font: negrita, color: GRIS })
      x += c.ancho
    }
    y -= 24
  }
  dibujarCabecera()

  const secciones = Array.isArray(datos.secciones) ? datos.secciones : []
  if (secciones.length === 0) {
    escribir('No hay evaluaciones en este plan.', MARGEN + PAD, 10, normal, GRIS)
    y -= 24
  }
  for (const sec of secciones) {
    const celdas = [
      { lineas: partir(nombreLimpio(sec.nombre), negrita, 10, columnas[0].ancho - PAD * 2), fuente: negrita },
      { lineas: partir(limpiar(sec.tipoActividad || 'Desarrollo'), normal, 10, columnas[1].ancho - PAD * 2), fuente: normal },
      { lineas: [`${Number(sec.peso) || 0}%`], fuente: negrita },
      { lineas: [fechaCorta(sec.fecha || datos.fechaExamen)], fuente: normal },
    ]
    const altoFila = Math.max(...celdas.map(c => c.lineas.length)) * 13 + 14
    if (y - altoFila < MARGEN + 20) { nuevaPagina(); dibujarCabecera() }
    pagina.drawRectangle({ x: MARGEN, y: y - altoFila + 12, width: anchoUtil, height: altoFila, borderColor: GRIS_CLARO, borderWidth: 0.8 })
    let x = MARGEN
    celdas.forEach((celda, i) => {
      const col = columnas[i]
      let yy = y - 4
      for (const linea of celda.lineas) {
        const w = celda.fuente.widthOfTextAtSize(linea, 10)
        pagina.drawText(linea, { x: col.alinear === 'centro' ? x + (col.ancho - w) / 2 : x + PAD, y: yy, size: 10, font: celda.fuente, color: i === 2 ? AZUL : TEXTO })
        yy -= 13
      }
      x += col.ancho
    })
    y -= altoFila
  }

  // ---------- Especificaciones ----------
  const conDescripcion = secciones.filter(s => limpiar(s.descripcion).trim())
  if (conDescripcion.length > 0) {
    y -= 18
    asegurar(40)
    escribir('ESPECIFICACIONES DE LAS ACTIVIDADES', MARGEN, 12, negrita, TEXTO)
    y -= 22
    secciones.forEach((sec, i) => {
      const desc = limpiar(sec.descripcion).trim()
      if (!desc) return
      asegurar(50)
      const titulo = partir(`${i + 1}. ${nombreLimpio(sec.nombre)}`, negrita, 11, anchoUtil - 16)
      pagina.drawRectangle({ x: MARGEN, y: y - 4 - (titulo.length - 1) * 14, width: 3, height: 14 * titulo.length + 2, color: AZUL })
      for (const l of titulo) { escribir(l, MARGEN + 12, 11, negrita, AZUL); y -= 14 }
      y -= 4
      for (const l of partir(desc, normal, 9.5, anchoUtil - 12)) {
        asegurar(13)
        if (l) escribir(l, MARGEN + 12, 9.5, normal, GRIS)
        y -= 12.5
      }
      y -= 12
    })
  }

  // ---------- Rúbricas ----------
  const conRubrica = secciones.map((sec, i) => ({ sec, i, r: normalizarRubrica(sec.rubrica) })).filter(x => x.r)
  if (conRubrica.length > 0) {
    y -= 10
    asegurar(60)
    escribir('RÚBRICAS DE EVALUACIÓN', MARGEN, 12, negrita, TEXTO)
    y -= 22
    const anchoCrit = 112
    const anchoNivel = (anchoUtil - anchoCrit) / NIVELES_RUBRICA.length
    const T = 7.5, INTER = 9.5
    for (const { sec, i, r } of conRubrica) {
      const rub = r!
      const titulo = partir(`${i + 1}. ${nombreLimpio(sec.nombre)}  -  Total: ${textoPuntos(totalRubrica(rub))} pts`, negrita, 10.5, anchoUtil)
      asegurar(titulo.length * 14 + 60)
      for (const l of titulo) { escribir(l, MARGEN, 10.5, negrita, AZUL); y -= 14 }
      y -= 2
      const cabecera = () => {
        pagina.drawRectangle({ x: MARGEN, y: y - 7, width: anchoUtil, height: 20, color: FONDO, borderColor: GRIS_CLARO, borderWidth: 0.8 })
        pagina.drawText('CRITERIO', { x: MARGEN + 6, y, size: 7.5, font: negrita, color: GRIS })
        NIVELES_RUBRICA.forEach((n, k) => {
          const t = n.toUpperCase(); const w = negrita.widthOfTextAtSize(t, 7.5)
          pagina.drawText(t, { x: MARGEN + anchoCrit + k * anchoNivel + (anchoNivel - w) / 2, y, size: 7.5, font: negrita, color: GRIS })
        })
        y -= 17
      }
      cabecera()
      for (const c of rub.criterios) {
        const colCrit = [...partir(limpiar(c.nombre), negrita, 8, anchoCrit - 10), `${textoPuntos(c.puntos)} pts`]
        const colNiv = c.descripciones.map(d => partir(limpiar(d) || '-', normal, T, anchoNivel - 10))
        const filas = Math.max(colCrit.length, ...colNiv.map(l => l.length + 1))
        const alto = filas * INTER + 10
        if (y - alto < MARGEN + 20) { nuevaPagina(); cabecera() }
        pagina.drawRectangle({ x: MARGEN, y: y - alto + 10, width: anchoUtil, height: alto, borderColor: GRIS_CLARO, borderWidth: 0.6 })
        for (let k = 1; k <= NIVELES_RUBRICA.length; k++) {
          const x = MARGEN + anchoCrit + (k - 1) * anchoNivel
          pagina.drawLine({ start: { x, y: y + 10 }, end: { x, y: y - alto + 10 }, thickness: 0.6, color: GRIS_CLARO })
        }
        let yy = y - 2
        colCrit.forEach((l, k) => { pagina.drawText(l, { x: MARGEN + 6, y: yy, size: 8, font: negrita, color: k === colCrit.length - 1 ? AZUL : TEXTO }); yy -= INTER })
        colNiv.forEach((lineas, k) => {
          const x = MARGEN + anchoCrit + k * anchoNivel + 5
          let y2 = y - 2
          pagina.drawText(`${textoPuntos(puntosNivel(c.puntos, k))} pts`, { x, y: y2, size: T, font: negrita, color: AZUL }); y2 -= INTER
          for (const l of lineas) { pagina.drawText(l, { x, y: y2, size: T, font: normal, color: GRIS }); y2 -= INTER }
        })
        y -= alto
      }
      y -= 16
    }
  }

  // ---------- Firmas ----------
  asegurar(70)
  y -= 30
  const anchoFirma = (anchoUtil - 40) / 2
  const firmas = [datos.profesor ? `Prof. ${limpiar(datos.profesor)}` : 'Docente', 'Coordinación Académica']
  firmas.forEach((texto, i) => {
    const x = MARGEN + i * (anchoFirma + 40)
    pagina.drawLine({ start: { x, y }, end: { x: x + anchoFirma, y }, thickness: 0.8, color: GRIS })
    pagina.drawText(texto, { x, y: y - 14, size: 9, font: normal, color: GRIS })
  })

  // ---------- Pie de página ----------
  const paginas = pdf.getPages()
  paginas.forEach((p, i) => {
    const texto = `${materia}  ·  Página ${i + 1} de ${paginas.length}`
    const w = normal.widthOfTextAtSize(texto, 8)
    p.drawText(texto, { x: (A4.ancho - w) / 2, y: 25, size: 8, font: normal, color: rgb(0.58, 0.64, 0.72) })
  })

  return pdf.save()
}

export function nombreArchivoPdf(materia: string, seccion?: string | null): string {
  const base = String(materia || 'Plan').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40) || 'Plan'
  return `Plan_${base}${seccion ? `_Seccion_${seccion}` : ''}.pdf`
}
