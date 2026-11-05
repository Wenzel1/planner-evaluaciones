import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { NOTA_APROBATORIA, promedioPonderado } from '@/lib/notas'
import { nuevoLibro, titulo, encabezados, filaDatos, respuestaExcel, nombreArchivo, textoSeguro, etiqueta, COLOR, BORDES } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim() || 'Evaluación'
// GET /api/acta?ids=ID1,ID2,…  — Acta de notas de una sección en Excel (.xlsx) con formato.
// Los ids son las evaluaciones de la sección (en el orden que ve el profesor). Una fila por estudiante:
// nota de cada evaluación, cuántas tiene calificadas, promedio ponderado (sobre 20) y condición.
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)
    if (ids.length === 0) return NextResponse.json({ error: 'No hay evaluaciones guardadas en esta sección.' }, { status: 400 })

    const encontradas = await prisma.evaluacion.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, nombre: true, peso: true, estado: true, grupoSeccion: true, fecha: true,
        planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } },
        calificaciones: { select: { estudianteId: true, puntaje: true } },
      },
    })
    if (encontradas.length === 0) return NextResponse.json({ error: 'Evaluaciones no encontradas. Si las acabas de crear, espera a que se guarden.' }, { status: 404 })
    const dueno = encontradas[0].planificacion.materia.usuarioId
    const seccion = encontradas[0].grupoSeccion || 'A'
    // Todas deben ser del mismo profesor y de la misma sección
    if (encontradas.some(e => e.planificacion.materia.usuarioId !== dueno || (e.grupoSeccion || 'A') !== seccion)) {
      return NextResponse.json({ error: 'Las evaluaciones no son de la misma sección.' }, { status: 400 })
    }
    const denegado = verificarAcceso(actor, dueno, 'leer')
    if (denegado) return denegado

    const evs = ids.map(id => encontradas.find(e => e.id === id)).filter(Boolean).filter(e => e!.estado !== 'CANCELADA') as typeof encontradas
    const materia = encontradas[0].planificacion.materia.nombre
    const conNota = new Set(evs.flatMap(e => e.calificaciones.filter(c => c.puntaje != null).map(c => c.estudianteId)))
    const estudiantes = (await prisma.estudiante.findMany({
      where: { usuarioId: dueno ?? actor.id, grupo: seccion },
      select: { id: true, nombre: true, email: true, estado: true },
      orderBy: { nombre: 'asc' },
    })).filter(e => e.estado === 'ACTIVO' || conNota.has(e.id)) // los retirados solo salen si tienen alguna nota

    const fechaHoy = new Date().toLocaleDateString('es-VE', { timeZone: process.env.ZONA_HORARIA || 'America/Caracas', day: 'numeric', month: 'long', year: 'numeric' })
    const libro = nuevoLibro()
    const hoja = libro.addWorksheet(`Sección ${seccion}`, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
    const cols = ['N°', 'Estudiante', 'Correo', ...evs.map(e => `${limpio(e.nombre)}\n(${e.peso ?? 0}%)`), 'Calificadas', 'Promedio\n(sobre 20)', 'Condición']
    const nEv = evs.length
    titulo(hoja, cols.length, `Acta de notas · ${materia}`, `Sección ${seccion}  ·  Generada el ${fechaHoy}  ·  Nota mínima aprobatoria: ${NOTA_APROBATORIA}/20`)
    encabezados(hoja, 4, cols)
    hoja.columns = cols.map((_, i) => ({ width: i === 0 ? 6 : i === 1 ? 30 : i === 2 ? 30 : i < 3 + nEv ? 16 : i === 3 + nEv ? 12 : i === 4 + nEv ? 13 : 14 }))

    let aprobados = 0, reprobados = 0, sumaProm = 0, conProm = 0
    estudiantes.forEach((est, i) => {
      const notas = evs.map(e => e.calificaciones.find(c => c.estudianteId === est.id)?.puntaje ?? null)
      const calificadas = notas.map((n, k) => (n == null ? null : { puntaje: n, peso: evs[k].peso })).filter(Boolean) as { puntaje: number; peso: number | null }[]
      const promedio = calificadas.length ? promedioPonderado(calificadas) : null
      const condicion = promedio == null ? 'Sin notas' : promedio >= NOTA_APROBATORIA ? 'Aprobado' : 'Reprobado'
      if (condicion === 'Aprobado') aprobados++; else if (condicion === 'Reprobado') reprobados++
      if (promedio != null) { sumaProm += promedio; conProm++ }
      const f = 5 + i
      const fila = hoja.getRow(f)
      fila.values = [i + 1, textoSeguro(est.nombre + (est.estado !== 'ACTIVO' ? ' (retirado)' : '')), textoSeguro(est.email), ...notas.map(n => (n == null ? null : n)), `${calificadas.length}/${nEv}`, promedio, condicion]
      filaDatos(hoja, f, cols.length, i % 2 === 1, [1, ...evs.map((_, k) => 4 + k), 4 + nEv, 5 + nEv, 6 + nEv])
      fila.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      for (let k = 0; k < nEv + 1; k++) fila.getCell(4 + k + (k === nEv ? 1 : 0)).numFmt = '0.00'
      // Notas en rojo si están por debajo de la mínima
      notas.forEach((n, k) => { if (n != null && n < NOTA_APROBATORIA) fila.getCell(4 + k).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.rojo } } })
      fila.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.tinta } }
      fila.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: COLOR.gris } }
      const prom = fila.getCell(5 + nEv)
      prom.font = { name: 'Calibri', size: 11, bold: true, color: { argb: promedio == null ? COLOR.gris : promedio >= NOTA_APROBATORIA ? COLOR.verde : COLOR.rojo } }
      const cond = fila.getCell(6 + nEv)
      if (condicion === 'Aprobado') etiqueta(cond, COLOR.verde, COLOR.verdeFondo)
      else if (condicion === 'Reprobado') etiqueta(cond, COLOR.rojo, COLOR.rojoFondo)
      else etiqueta(cond, COLOR.gris, 'FFF3F4F6')
      fila.height = 22
    })
    if (estudiantes.length === 0) {
      hoja.mergeCells(5, 1, 5, cols.length)
      hoja.getCell(5, 1).value = 'No hay estudiantes activos en esta sección.'
      hoja.getCell(5, 1).font = { italic: true, color: { argb: COLOR.gris } }
    }

    // Resumen al final
    const r0 = 5 + Math.max(1, estudiantes.length) + 1
    const resumen: [string, string | number][] = [
      ['Estudiantes', estudiantes.length],
      ['Aprobados', aprobados],
      ['Reprobados', reprobados],
      ['Sin notas', estudiantes.length - aprobados - reprobados],
      ['Promedio de la sección', conProm ? Math.round((sumaProm / conProm) * 100) / 100 : '—'],
    ]
    resumen.forEach(([k, v], i) => {
      const r = hoja.getRow(r0 + i)
      r.getCell(2).value = k; r.getCell(3).value = v
      r.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: COLOR.gris } }
      r.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: i === 1 ? COLOR.verde : i === 2 ? COLOR.rojo : COLOR.tinta } }
      r.getCell(3).alignment = { horizontal: 'left' }
      ;[2, 3].forEach(c => { r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.indigoClaro } }; r.getCell(c).border = BORDES })
      if (typeof v === 'number' && i === 4) r.getCell(3).numFmt = '0.00'
      r.height = 20
    })
    // Firma
    const rf = r0 + resumen.length + 2
    hoja.getCell(rf, 2).value = '______________________________'
    hoja.getCell(rf + 1, 2).value = 'Firma del profesor'
    hoja.getCell(rf + 1, 2).font = { size: 9, color: { argb: COLOR.gris } }

    hoja.views = [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }]
    if (estudiantes.length) hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + estudiantes.length, column: cols.length } }

    await registrarActividad({ actor, accion: 'EXPORTAR', entidad: 'Notas', detalle: `Descargó el acta de notas de ${materia}, sección ${seccion}`.slice(0, 300) })
    return respuestaExcel(libro, `Acta_${nombreArchivo(materia)}_Seccion_${seccion}.xlsx`)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el acta.' }, { status: 500 })
  }
}
