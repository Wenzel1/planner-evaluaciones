import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { normalizarRubrica } from '@/lib/rubrica'
import { normalizarRecursos } from '@/lib/portal'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

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

    if (item.tipo === 'ESTUDIANTE') {
      try {
        await prisma.estudiante.create({ data: { ...d, usuarioId: actor.id } })
      } catch (e: any) {
        if (e.code === 'P2002') return NextResponse.json({ error: 'Ya tienes un estudiante con ese correo; no se puede restaurar.' }, { status: 409 })
        throw e
      }
    } else if (item.tipo === 'EVALUACION') {
      // Vuelve al plan donde estaba; si ese plan ya no existe, al plan más reciente del usuario
      const planOriginal = d.planificacionId
        ? await prisma.planificacion.findFirst({ where: { id: String(d.planificacionId), materia: { usuarioId: actor.id } }, select: { id: true } })
        : null
      const plan = planOriginal ?? (await prisma.planificacion.findFirst({ where: { materia: { usuarioId: actor.id } }, orderBy: { createdAt: 'desc' }, select: { id: true } }))
      if (!plan) return NextResponse.json({ error: 'No hay un plan donde restaurar esta evaluación.' }, { status: 409 })

      const maximo = await prisma.evaluacion.aggregate({ where: { planificacionId: plan.id }, _max: { orden: true } })
      await prisma.evaluacion.create({
        data: {
          planificacionId: plan.id,
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
    } else {
      return NextResponse.json({ error: 'Tipo de elemento no reconocido.' }, { status: 400 })
    }

    await prisma.papeleraItem.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'RESTAURAR', entidad: item.tipo === 'ESTUDIANTE' ? 'Estudiante' : 'Evaluación', detalle: `Restauró "${item.nombre}" desde la papelera` })
    return NextResponse.json({ restaurado: true, tipo: item.tipo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al restaurar' }, { status: 500 })
  }
}
