import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { NOTA_APROBATORIA, promedioPonderado, textoNota } from '@/lib/notas'

export const dynamic = 'force-dynamic'

const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim() || 'Evaluación'
// Celda para Excel: entre comillas si hace falta; se neutralizan fórmulas (=, +, -, @) para que nadie inyecte una fórmula con su nombre
function celda(v: unknown): string {
  let t = String(v ?? '').replace(/\r?\n/g, ' ')
  if (/^[=+\-@]/.test(t)) t = `'${t}`
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

// GET /api/acta?ids=ID1,ID2,…  — Acta de notas de una sección en CSV para Excel (separador ";" y decimales con coma).
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

    const filas: string[] = []
    // Sin la línea "sep=;": con ella Excel ignora la marca UTF-8 y las tildes salen dañadas. En Excel en español el separador ya es ";".
    filas.push([celda(`Acta de notas · ${materia}`), celda(`Sección ${seccion}`), celda(`Generada el ${new Date().toLocaleDateString('es-VE', { timeZone: process.env.ZONA_HORARIA || 'America/Caracas' })}`)].join(';'))
    filas.push('')
    filas.push(['N°', 'Estudiante', 'Correo', ...evs.map(e => celda(`${limpio(e.nombre)} (${e.peso ?? 0}%)`)), 'Calificadas', 'Promedio (sobre 20)', 'Condición'].join(';'))
    let aprobados = 0, reprobados = 0
    estudiantes.forEach((est, i) => {
      const notas = evs.map(e => e.calificaciones.find(c => c.estudianteId === est.id)?.puntaje ?? null)
      const calificadas = notas.map((n, k) => (n == null ? null : { puntaje: n, peso: evs[k].peso })).filter(Boolean) as { puntaje: number; peso: number | null }[]
      const promedio = calificadas.length ? promedioPonderado(calificadas) : null
      const condicion = promedio == null ? 'Sin notas' : promedio >= NOTA_APROBATORIA ? 'Aprobado' : 'Reprobado'
      if (condicion === 'Aprobado') aprobados++; else if (condicion === 'Reprobado') reprobados++
      filas.push([
        i + 1, celda(est.nombre + (est.estado !== 'ACTIVO' ? ' (retirado)' : '')), celda(est.email),
        ...notas.map(n => (n == null ? '' : textoNota(n))),
        `${calificadas.length}/${evs.length}`, promedio == null ? '' : textoNota(promedio), condicion,
      ].join(';'))
    })
    filas.push('')
    filas.push(`Estudiantes: ${estudiantes.length};Aprobados: ${aprobados};Reprobados: ${reprobados};Nota mínima aprobatoria: ${NOTA_APROBATORIA}/20`)

    await registrarActividad({ actor, accion: 'EXPORTAR', entidad: 'Notas', detalle: `Descargó el acta de notas de ${materia}, sección ${seccion}`.slice(0, 300) })
    const archivo = `Acta_${materia.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40)}_Seccion_${seccion}.csv`
    return new NextResponse('﻿' + filas.join('\r\n') + '\r\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${archivo}"`, 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el acta.' }, { status: 500 })
  }
}
