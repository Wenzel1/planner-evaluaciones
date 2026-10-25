import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarAPapelera } from '@/lib/papelera'

// DELETE /api/evaluaciones/:id
// El dueño puede eliminar la suya; ADMIN y SUPERADMIN pueden eliminar la de cualquier profesor (moderación).
// Nadie puede EDITAR evaluaciones ajenas.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params

    const evaluacion = await prisma.evaluacion.findUnique({
      where: { id },
      include: {
        planificacion: {
          select: { materia: { select: { nombre: true, usuarioId: true, usuario: { select: { nombre: true } } } } },
        },
      },
    })
    if (!evaluacion) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

    const materia = evaluacion.planificacion.materia
    const denegado = verificarAcceso(actor, materia.usuarioId, 'eliminar')
    if (denegado) return denegado

    // Si la elimina un admin, el profesor dueño la encuentra en SU papelera y puede restaurarla
    if (materia.usuarioId) {
      const { planificacion: _plan, id: _id, ...campos } = evaluacion as any
      await enviarAPapelera([{
        usuarioId: materia.usuarioId,
        tipo: 'EVALUACION',
        nombre: evaluacion.nombre,
        contexto: materia.nombre,
        eliminadoPorId: actor.id,
        eliminadoPorNombre: actor.nombre,
        datos: { ...campos, fecha: evaluacion.fecha ? evaluacion.fecha.toISOString() : null, createdAt: undefined, updatedAt: undefined },
      }])
    }
    await prisma.evaluacion.delete({ where: { id } })

    const esPropia = materia.usuarioId === actor.id
    await registrarActividad({
      actor,
      accion: 'ELIMINAR',
      entidad: 'Evaluación',
      detalle: esPropia
        ? `Eliminó "${evaluacion.nombre}" (materia "${materia.nombre}")`
        : `Moderación: eliminó "${evaluacion.nombre}" de ${materia.usuario?.nombre ?? 'una cuenta sin dueño'} (materia "${materia.nombre}")`,
    })
    return NextResponse.json({ eliminado: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al eliminar la evaluación' }, { status: 500 })
  }
}

// PATCH /api/evaluaciones/:id — SOLO el SUPERADMIN edita evaluaciones de otros profesores (control total).
// Al dueño le llega una observación automática que le cuenta qué se cambió, para que no lo tome por sorpresa.
const ETIQUETAS: Record<string, string> = {
  nombre: 'nombre', peso: 'peso', fecha: 'fecha', tipoActividad: 'tipo de actividad', descripcion: 'descripción', enfoque: 'enfoque',
  tiempoEstimadoMinutos: 'duración', cantidadGrupos: 'grupos', personasPorGrupo: 'personas por grupo', grupoSeccion: 'sección',
}

function leerNumero(v: any, min: number, max: number, entero: boolean, etiqueta: string): { valor?: number | null; error?: string } {
  if (v === null || v === '') return { valor: null }
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) return { error: `El campo "${etiqueta}" debe ser un número ${entero ? 'entero ' : ''}entre ${min} y ${max}.` }
  return { valor: n }
}
const resumen = (v: any) => (v === null || v === undefined || v === '' ? 'vacío' : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v))

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ error: 'Solo el superadmin puede editar evaluaciones de otros profesores.' }, { status: 403 })
    const { id } = await params
    const body = await request.json()

    const actual = await prisma.evaluacion.findUnique({
      where: { id },
      include: { planificacion: { select: { materia: { select: { id: true, nombre: true, usuarioId: true, usuario: { select: { nombre: true } } } } } } },
    })
    if (!actual) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    const materia = actual.planificacion.materia
    const denegado = verificarAcceso(actor, materia.usuarioId, 'escribir')
    if (denegado) return denegado

    const data: Record<string, any> = {}
    if ('nombre' in body) {
      const n = String(body.nombre ?? '').trim()
      if (n.length < 1 || n.length > 200) return NextResponse.json({ error: 'El nombre debe tener entre 1 y 200 caracteres.' }, { status: 400 })
      data.nombre = n
    }
    for (const [campo, min, max, entero] of [['peso', 0, 100, true], ['tiempoEstimadoMinutos', 0, 1000, true], ['cantidadGrupos', 0, 100, true], ['personasPorGrupo', 0, 1000, true]] as const) {
      if (campo in body) {
        const r = leerNumero(body[campo], min, max, entero, ETIQUETAS[campo])
        if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
        data[campo] = r.valor
      }
    }
    if ('fecha' in body) {
      if (body.fecha === null || body.fecha === '') data.fecha = null
      else { const d = new Date(body.fecha); if (isNaN(d.getTime())) return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 }); data.fecha = d }
    }
    for (const [campo, max] of [['tipoActividad', 120], ['descripcion', 4000], ['enfoque', 200]] as const) {
      if (campo in body) { const t = String(body[campo] ?? '').trim(); if (t.length > max) return NextResponse.json({ error: `El campo "${ETIQUETAS[campo]}" no puede superar ${max} caracteres.` }, { status: 400 }); data[campo] = t || null }
    }
    if ('grupoSeccion' in body) {
      const g = String(body.grupoSeccion ?? '').trim().toUpperCase()
      if (!/^[A-Z]$/.test(g)) return NextResponse.json({ error: 'La sección debe ser una letra (A, B, C...).' }, { status: 400 })
      data.grupoSeccion = g
    }

    // Solo cuenta como cambio lo que realmente es distinto
    const cambios: string[] = []
    for (const campo of Object.keys(data)) {
      const antes = (actual as any)[campo], despues = data[campo]
      const a = antes instanceof Date ? antes.getTime() : antes ?? null
      const d = despues instanceof Date ? despues.getTime() : despues ?? null
      if (a !== d) cambios.push(`${ETIQUETAS[campo]}: ${resumen(antes instanceof Date ? antes.toLocaleDateString() : antes)} → ${resumen(despues instanceof Date ? despues.toLocaleDateString() : despues)}`)
      else delete data[campo]
    }
    if (cambios.length === 0) return NextResponse.json({ ok: true, cambios: [] })

    const actualizada = await prisma.evaluacion.update({ where: { id }, data })

    if (materia.usuarioId && materia.usuarioId !== actor.id) {
      await prisma.observacion.create({
        data: {
          materiaId: materia.id, evaluacionNombre: actualizada.nombre, autorId: actor.id, autorNombre: actor.nombre, autorRol: actor.rol,
          mensaje: `Modifiqué esta evaluación (${cambios.join('; ')}). Recarga la página para ver los cambios antes de volver a guardar.`.slice(0, 500),
        },
      })
    }
    await registrarActividad({
      actor, accion: 'EDITAR', entidad: 'Evaluación',
      detalle: `Moderación: editó "${actualizada.nombre}" de ${materia.usuario?.nombre ?? 'una cuenta sin dueño'} (${cambios.join('; ')})`.slice(0, 300),
    })
    return NextResponse.json({ ok: true, cambios })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al editar la evaluación' }, { status: 500 })
  }
}
