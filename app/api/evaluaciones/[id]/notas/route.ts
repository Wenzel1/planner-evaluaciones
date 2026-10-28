import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { NOTA_MAXIMA, recalcularPromedios, redondearNota } from '@/lib/notas'

async function cargarEvaluacion(id: string) {
  return prisma.evaluacion.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, grupoSeccion: true, estado: true, fecha: true, peso: true, rubrica: true,
      planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } },
    },
  })
}

const NO_GUARDADA = 'Evaluación no encontrada. Si la acabas de crear, espera a que se guarde e intenta de nuevo.'

// GET /api/evaluaciones/:id/notas — estudiantes de la sección de esa evaluación con su nota (si ya tiene)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const ev = await cargarEvaluacion(id)
    if (!ev) return NextResponse.json({ error: NO_GUARDADA }, { status: 404 })
    const dueno = ev.planificacion.materia.usuarioId
    const denegado = verificarAcceso(actor, dueno, 'leer')
    if (denegado) return denegado

    const seccion = ev.grupoSeccion || 'A'
    const [estudiantes, notas] = await Promise.all([
      prisma.estudiante.findMany({
        where: { usuarioId: dueno ?? actor.id, grupo: seccion },
        select: { id: true, nombre: true, telefono: true, estado: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.calificacion.findMany({ where: { evaluacionId: id }, select: { estudianteId: true, puntaje: true, observaciones: true, detalle: true } }),
    ])
    const porEstudiante = new Map(notas.map(n => [n.estudianteId, n]))
    return NextResponse.json({
      evaluacion: { id: ev.id, nombre: ev.nombre, seccion, estado: ev.estado, fecha: ev.fecha, peso: ev.peso, rubrica: ev.rubrica, materia: ev.planificacion.materia.nombre },
      // Los inactivos solo salen si ya tenían nota
      estudiantes: estudiantes
        .filter(e => e.estado === 'ACTIVO' || porEstudiante.has(e.id))
        .map(e => {
          const n = porEstudiante.get(e.id)
          return { id: e.id, nombre: e.nombre, tieneTelefono: (e.telefono || '').replace(/\D/g, '').length >= 7, activo: e.estado === 'ACTIVO', puntaje: n?.puntaje ?? null, observaciones: n?.observaciones ?? '', detalle: n?.detalle ?? null }
        }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las notas.' }, { status: 500 })
  }
}

// PUT /api/evaluaciones/:id/notas  { notas: [{ estudianteId, puntaje: number|null, observaciones?, detalle? }] }
// Guarda las notas (0 a 20). Una nota vacía borra la que había. Recalcula el promedio de cada estudiante.
// Si la evaluación no estaba marcada como realizada, se marca sola.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const ev = await cargarEvaluacion(id)
    if (!ev) return NextResponse.json({ error: NO_GUARDADA }, { status: 404 })
    const dueno = ev.planificacion.materia.usuarioId
    const denegado = verificarAcceso(actor, dueno, 'escribir')
    if (denegado) return denegado

    const body = await request.json().catch(() => ({}))
    const lista: any[] = Array.isArray(body.notas) ? body.notas.slice(0, 500) : []
    if (lista.length === 0) return NextResponse.json({ error: 'No hay notas para guardar.' }, { status: 400 })

    // Solo estudiantes del profesor dueño y de la sección de la evaluación
    const validos = new Set((await prisma.estudiante.findMany({
      where: { id: { in: lista.map(n => String(n?.estudianteId ?? '')) }, usuarioId: dueno ?? actor.id, grupo: ev.grupoSeccion || 'A' },
      select: { id: true },
    })).map(e => e.id))

    const guardar: { estudianteId: string; puntaje: number; observaciones: string | null; detalle: any }[] = []
    const borrar: string[] = []
    for (const n of lista) {
      const estudianteId = String(n?.estudianteId ?? '')
      if (!validos.has(estudianteId)) continue
      const vacio = n?.puntaje === null || n?.puntaje === undefined || n?.puntaje === ''
      if (vacio) { borrar.push(estudianteId); continue }
      const puntaje = Number(n.puntaje)
      if (!Number.isFinite(puntaje) || puntaje < 0 || puntaje > NOTA_MAXIMA) {
        return NextResponse.json({ error: `Nota no válida (${n.puntaje}). Debe estar entre 0 y ${NOTA_MAXIMA}.` }, { status: 400 })
      }
      const detalle = Array.isArray(n?.detalle) ? n.detalle.slice(0, 8).map((x: any) => (Number.isInteger(x) && x >= 0 && x <= 3 ? x : null)) : null
      guardar.push({ estudianteId, puntaje: redondearNota(puntaje), observaciones: String(n?.observaciones ?? '').trim().slice(0, 500) || null, detalle })
    }

    await prisma.$transaction(async (tx) => {
      for (const g of guardar) {
        const datos = { puntaje: g.puntaje, observaciones: g.observaciones, detalle: g.detalle ?? Prisma.DbNull }
        await tx.calificacion.upsert({
          where: { estudianteId_evaluacionId: { estudianteId: g.estudianteId, evaluacionId: id } },
          create: { ...datos, estudianteId: g.estudianteId, evaluacionId: id },
          update: datos,
        })
      }
      if (borrar.length) await tx.calificacion.deleteMany({ where: { evaluacionId: id, estudianteId: { in: borrar } } })
    }, { timeout: 20000 })

    let estado = ev.estado
    if (guardar.length > 0 && ev.estado !== 'REALIZADA' && ev.estado !== 'CANCELADA') {
      estado = 'REALIZADA'
      await prisma.evaluacion.update({ where: { id }, data: { estado, estadoEn: new Date() } })
    }
    await recalcularPromedios([...guardar.map(g => g.estudianteId), ...borrar])
    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Notas', detalle: `Cargó ${guardar.length} nota(s) de "${ev.nombre}" (${ev.planificacion.materia.nombre}, sección ${ev.grupoSeccion || 'A'})`.slice(0, 300) })
    return NextResponse.json({ ok: true, guardadas: guardar.length, borradas: borrar.length, estado })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron guardar las notas.' }, { status: 500 })
  }
}
