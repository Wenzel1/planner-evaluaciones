import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { normalizarRubrica } from '@/lib/rubrica'
import { normalizarRecursos } from '@/lib/portal'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { recalcularPromedios } from '@/lib/notas'

// Notas guardadas en la papelera → filas válidas para volver a crear
const notasValidas = (lista: any): { estudianteId?: string; evaluacionId?: string; puntaje: number | null; observaciones: string | null; detalle: any }[] =>
  (Array.isArray(lista) ? lista : []).filter((n: any) => n && (n.puntaje === null || Number.isFinite(Number(n.puntaje))))
    .map((n: any) => ({ ...n, puntaje: n.puntaje === null ? null : Number(n.puntaje), observaciones: n.observaciones ?? null, detalle: n.detalle ?? undefined }))

// POST /api/papelera/:id/restaurar — devuelve el elemento a su lugar (solo el dueño)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params

    const item = await prisma.papeleraItem.findUnique({ where: { id } })
    if (!item || item.usuarioId !== actor.id) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const d: any = item.datos ?? {}

    let notasDevueltas = 0
    let idRestaurado: string | null = null
    if (item.tipo === 'ESTUDIANTE') {
      const { calificaciones, ...campos } = d
      let creado: { id: string }
      try {
        creado = await prisma.estudiante.create({ data: { ...campos, usuarioId: actor.id }, select: { id: true } })
      } catch (e: any) {
        if (e.code === 'P2002') return NextResponse.json({ error: 'Ya tienes un estudiante con ese correo (o su enlace ya está en uso); no se puede restaurar.' }, { status: 409 })
        throw e
      }
      // Sus notas vuelven solo en las evaluaciones que todavía existen y son del mismo profesor
      const notas = notasValidas(calificaciones).filter(n => n.evaluacionId)
      if (notas.length) {
        const vigentes = new Set((await prisma.evaluacion.findMany({ where: { id: { in: notas.map(n => String(n.evaluacionId)) }, planificacion: { materia: { usuarioId: actor.id } } }, select: { id: true } })).map(e => e.id))
        const r = await prisma.calificacion.createMany({ data: notas.filter(n => vigentes.has(String(n.evaluacionId))).map(n => ({ estudianteId: creado.id, evaluacionId: String(n.evaluacionId), puntaje: n.puntaje, observaciones: n.observaciones, detalle: n.detalle })), skipDuplicates: true })
        notasDevueltas = r.count
      }
      idRestaurado = creado.id
      await recalcularPromedios([creado.id])
    } else if (item.tipo === 'EVALUACION') {
      // Vuelve al plan donde estaba; si ese plan ya no existe, al plan más reciente del usuario
      const planOriginal = d.planificacionId
        ? await prisma.planificacion.findFirst({ where: { id: String(d.planificacionId), materia: { usuarioId: actor.id } }, select: { id: true } })
        : null
      const plan = planOriginal ?? (await prisma.planificacion.findFirst({ where: { materia: { usuarioId: actor.id } }, orderBy: { createdAt: 'desc' }, select: { id: true } }))
      if (!plan) return NextResponse.json({ error: 'No hay un plan donde restaurar esta evaluación.' }, { status: 409 })

      const maximo = await prisma.evaluacion.aggregate({ where: { planificacionId: plan.id }, _max: { orden: true } })
      const nueva = await prisma.evaluacion.create({
        select: { id: true },
        data: {
          planificacionId: plan.id,
          ...(['PROGRAMADA', 'REALIZADA', 'REPROGRAMADA', 'CANCELADA'].includes(d.estado) ? { estado: d.estado } : {}),
          nombre: String(d.nombre),
          tipoPregunta: d.tipoPregunta,
          nivelBloom: d.nivelBloom,
          peso: d.peso ?? null,
          cantidadPreguntas: d.cantidadPreguntas ?? 0,
          contenidosEvaluados: Array.isArray(d.contenidosEvaluados) ? d.contenidosEvaluados : [],
          tiempoEstimadoMinutos: d.tiempoEstimadoMinutos ?? null,
          tipoActividad: d.tipoActividad ?? null,
          descripcion: d.descripcion ?? null,
          cantidadGrupos: d.cantidadGrupos ?? null,
          personasPorGrupo: d.personasPorGrupo ?? null,
          orden: (maximo._max.orden ?? -1) + 1,
          enfoque: d.enfoque ?? null,
          fecha: d.fecha ? new Date(d.fecha) : null,
          grupoSeccion: d.grupoSeccion || 'A',
          ...(normalizarRubrica(d.rubrica) ? { rubrica: normalizarRubrica(d.rubrica) as any } : {}),
          ...(normalizarRecursos(d.recursos) ? { recursos: normalizarRecursos(d.recursos) as any } : {}),
        },
      })
      idRestaurado = nueva.id
      // Las notas vuelven para los estudiantes que siguen existiendo
      const notas = notasValidas(d.calificaciones).filter(n => n.estudianteId)
      if (notas.length) {
        const vigentes = new Set((await prisma.estudiante.findMany({ where: { id: { in: notas.map(n => String(n.estudianteId)) }, usuarioId: actor.id }, select: { id: true } })).map(e => e.id))
        const validas = notas.filter(n => vigentes.has(String(n.estudianteId)))
        const r = await prisma.calificacion.createMany({ data: validas.map(n => ({ estudianteId: String(n.estudianteId), evaluacionId: nueva.id, puntaje: n.puntaje, observaciones: n.observaciones, detalle: n.detalle })), skipDuplicates: true })
        notasDevueltas = r.count
        await recalcularPromedios(validas.map(n => String(n.estudianteId)))
      }
    } else {
      return NextResponse.json({ error: 'Tipo de elemento no reconocido.' }, { status: 400 })
    }

    await prisma.papeleraItem.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'RESTAURAR', entidad: item.tipo === 'ESTUDIANTE' ? 'Estudiante' : 'Evaluación', detalle: `Restauró "${item.nombre}" desde la papelera${notasDevueltas ? ` (con ${notasDevueltas} nota(s))` : ''}` })
    return NextResponse.json({ restaurado: true, tipo: item.tipo, notas: notasDevueltas, id: idRestaurado })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al restaurar' }, { status: 500 })
  }
}
