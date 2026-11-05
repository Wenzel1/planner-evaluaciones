import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'
import { partesDescripcion } from '@/lib/descripcion'
import { nuevoLibro, titulo, encabezados, filaDatos, respuestaExcel, nombreArchivo, textoSeguro, COLOR, BORDES } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim() || 'Evaluación'
const txt = (v: unknown, max = 4000) => textoSeguro(String(v ?? '').slice(0, max))
const ESTADO: Record<string, string> = { PROGRAMADA: 'Programada', REPROGRAMADA: 'Reprogramada', REALIZADA: 'Realizada', CANCELADA: 'Cancelada', PENDIENTE: 'Programada' }

// POST /api/exportar/evaluaciones  { materia, profesor?, evaluaciones: [...] }
// Devuelve un Excel con dos hojas: "Plan" (resumen) y "Detalle" (objetivo, actividad, entregables, criterios…).
// Recibe lo que el profesor ve en pantalla (incluye lo que aún no se guarda), por eso no consulta la base de datos.
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => null)
    const evs: any[] = Array.isArray(body?.evaluaciones) ? body.evaluaciones.slice(0, 60) : []
    if (!evs.length) return NextResponse.json({ error: 'No hay evaluaciones para exportar.' }, { status: 400 })
    const materia = String(body?.materia || 'Asignatura').slice(0, 120)
    const profesor = String(body?.profesor || '').slice(0, 120)
    const hoy = new Date().toLocaleDateString('es-VE', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' })
    const fecha = (f: any) => { const d = f ? new Date(f) : null; return d && !isNaN(d.getTime()) ? d : null }

    // Orden: por sección y luego por fecha (las que no tienen fecha, al final)
    const lista = evs.map(e => ({ ...e, _f: fecha(e.fecha), _s: String(e.seccion || 'A').toUpperCase() }))
      .sort((a, b) => a._s.localeCompare(b._s) || (a._f ? a._f.getTime() : Infinity) - (b._f ? b._f.getTime() : Infinity))

    const libro = nuevoLibro()

    // ---------- Hoja 1: Plan ----------
    const plan = libro.addWorksheet('Plan', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
    const cols = ['N°', 'Sección', 'Evaluación', 'Estrategia', 'Enfoque', 'Fecha', 'Hora', 'Duración (min)', 'Peso (%)', 'Grupos', 'Pers. por grupo', 'Estado']
    plan.columns = [6, 9, 42, 22, 18, 14, 10, 11, 10, 9, 10, 14].map(width => ({ width }))
    titulo(plan, cols.length, `Plan de evaluación · ${materia}`, `${profesor ? `Prof. ${profesor}  ·  ` : ''}Generado el ${hoy}  ·  ${lista.length} evaluaci${lista.length === 1 ? 'ón' : 'ones'}`)
    encabezados(plan, 4, cols)
    const pesoPorSeccion = new Map<string, number>()
    lista.forEach((e, i) => {
      const f = 5 + i
      const r = plan.getRow(f)
      r.values = [
        i + 1, e._s, txt(limpio(e.nombre), 200), txt(e.tipoActividad, 120), txt(e.enfoque, 120),
        e._f ? new Date(`${e._f.toLocaleDateString('en-CA', { timeZone: ZONA })}T00:00:00Z`) : 'Sin fecha',
        e._f ? e._f.toLocaleTimeString('es-VE', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }) : '',
        Number(e.minutos) || null, Number(e.peso) || 0, Number(e.grupos) || null, Number(e.personas) || null,
        ESTADO[String(e.estado || '').toUpperCase()] || 'Programada',
      ]
      filaDatos(plan, f, cols.length, i % 2 === 1, [1, 2, 6, 7, 8, 9, 10, 11, 12])
      r.getCell(3).font = { size: 10, bold: true }
      if (e._f) r.getCell(6).numFmt = 'dd/mm/yyyy'
      const estado = r.getCell(12)
      const est = String(e.estado || '').toUpperCase()
      if (est === 'REALIZADA') estado.font = { size: 10, color: { argb: COLOR.verde }, bold: true }
      else if (est === 'CANCELADA') estado.font = { size: 10, color: { argb: COLOR.rojo }, bold: true }
      else if (est === 'REPROGRAMADA') estado.font = { size: 10, color: { argb: COLOR.ambar }, bold: true }
      pesoPorSeccion.set(e._s, (pesoPorSeccion.get(e._s) || 0) + (Number(e.peso) || 0))
    })
    // Total de pesos por sección (debe dar 100%)
    let fr = 5 + lista.length + 1
    for (const [sec, total] of pesoPorSeccion) {
      const r = plan.getRow(fr++)
      r.getCell(8).value = `Total Sec. ${sec}`
      r.getCell(9).value = total / 100
      r.getCell(9).numFmt = '0%'
      const ok = Math.round(total) === 100
      ;[8, 9].forEach(c => {
        const cel = r.getCell(c)
        cel.font = { bold: true, size: 10, color: { argb: ok ? COLOR.verde : COLOR.rojo } }
        cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ok ? COLOR.verdeFondo : COLOR.rojoFondo } }
        cel.alignment = { horizontal: 'center' }
        cel.border = BORDES
      })
    }
    plan.views = [{ state: 'frozen', ySplit: 4 }]
    plan.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + lista.length, column: cols.length } }

    // ---------- Hoja 2: Detalle ----------
    const det = libro.addWorksheet('Detalle', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
    const colsD = ['N°', 'Evaluación', 'Objetivo', 'Actividad', 'Herramientas', 'Entregables', 'Criterios de evaluación', 'Casos / temas']
    det.columns = [6, 28, 38, 60, 26, 34, 40, 50].map(width => ({ width }))
    titulo(det, colsD.length, `Detalle de las evaluaciones · ${materia}`, 'Cada fila es una evaluación. El texto se ajusta dentro de la celda.')
    encabezados(det, 4, colsD)
    lista.forEach((e, i) => {
      const partes = partesDescripcion(String(e.descripcion || ''))
      const de = (...t: string[]) => partes.filter(p => t.some(x => p.titulo.startsWith(x))).map(p => p.cuerpo).join('\n\n')
      const sinTitulo = partes.filter(p => !p.titulo).map(p => p.cuerpo).join('\n')
      const casos = de('CASOS POR ESTUDIANTE', 'CASOS POR GRUPO', 'TEMAS POR GRUPO')
        .split(/\n+|\s*;\s*/).map(x => x.trim()).filter(Boolean).map(x => `• ${x}`).join('\n')
      const f = 5 + i
      const r = det.getRow(f)
      r.values = [i + 1, txt(`${limpio(e.nombre)}\nSec. ${e._s} · ${Number(e.peso) || 0}%`), txt(de('OBJETIVO') || sinTitulo), txt(de('ACTIVIDAD')), txt(de('HERRAMIENTAS')), txt(de('ENTREGABLES')), txt(de('CRITERIOS')), txt(casos)]
      filaDatos(det, f, colsD.length, i % 2 === 1, [1])
      r.getCell(2).font = { size: 10, bold: true }
      // Altura aproximada según el texto más largo (Excel no la calcula sola en celdas combinadas con ajuste)
      const largo = Math.max(...[3, 4, 5, 6, 7, 8].map(c => { const v = String(r.getCell(c).value || ''); const ancho = (det.getColumn(c).width || 30) * 1.1; return v.split('\n').reduce((t, l) => t + Math.max(1, Math.ceil(l.length / ancho)), 0) }))
      r.height = Math.min(400, Math.max(30, largo * 13.5))
    })
    det.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }]

    return respuestaExcel(libro, `Evaluaciones_${nombreArchivo(materia)}.xlsx`)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el Excel.' }, { status: 500 })
  }
}
