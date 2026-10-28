import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { normalizarRubrica } from '@/lib/rubrica'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarAPapelera } from '@/lib/papelera'
import { recalcularPromedios } from '@/lib/notas'

// Campos de una evaluación tal como se guardan (sin el estado: ese se cambia con /api/evaluaciones/:id/estado)
function datosEvaluacion(ev: any, index: number) {
  return {
    nombre: String(ev.nombre ?? '').slice(0, 300),
    tipoPregunta: ev.tipoPregunta || 'MULTIPLE_CHOICE',
    nivelBloom: ev.nivelBloom || 'APLICAR',
    peso: ev.peso == null || ev.peso === '' ? null : Math.round(Number(ev.peso)),
    cantidadPreguntas: ev.cantidadPreguntas || 0,
    contenidosEvaluados: ev.contenidosEvaluados || [],
    tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos ?? null,
    tipoActividad: ev.tipoActividad || null,
    descripcion: ev.descripcion || null,
    cantidadGrupos: ev.cantidadGrupos ?? null,
    personasPorGrupo: ev.personasPorGrupo ?? null,
    orden: ev.orden ?? index,
    enfoque: ev.enfoque || null,
    fecha: ev.fecha && !isNaN(new Date(ev.fecha).getTime()) ? new Date(ev.fecha) : null,
    grupoSeccion: ev.grupoSeccion || 'A',
    // Si no viene la rúbrica, no se toca la que ya tenía; null la borra
    ...(ev.rubrica !== undefined ? { rubrica: normalizarRubrica(ev.rubrica) ?? Prisma.DbNull } : {}),
  }
}

// Obtiene el dueño de una planificación (el dueño de su materia)
async function duenoDePlanificacion(id: string) {
  const p = await prisma.planificacion.findUnique({
    where: { id },
    select: { materia: { select: { id: true, usuarioId: true, nombre: true } } },
  })
  return p ? { usuarioId: p.materia.usuarioId, materiaNombre: p.materia.nombre, materiaId: p.materia.id } : null
}

// GET /api/planificaciones/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params; // AQUÍ ESTÁ EL ARREGLO
    
    const planificacion = await prisma.planificacion.findUnique({
      where: { id },
      include: {
        materia: true,
        evaluaciones: { orderBy: { orden: 'asc' } },
        rubrica: { include: { niveles: true }, orderBy: { createdAt: 'asc' } },
        comentarios: { orderBy: { createdAt: 'desc' } },
        conversaciones: {
          include: { mensajes: { orderBy: { createdAt: 'asc' } } },
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!planificacion) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    }
    const denegado = verificarAcceso(actor, planificacion.materia.usuarioId, 'leer')
    if (denegado) return denegado

    return NextResponse.json(planificacion)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// PUT /api/planificaciones/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params; // AQUÍ ESTÁ EL ARREGLO

    const dueno = await duenoDePlanificacion(id)
    if (!dueno) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    const denegado = verificarAcceso(actor, dueno.usuarioId, 'escribir')
    if (denegado) return denegado

    const body = await request.json()

    // Si la persona cambió el nombre de la materia en Configuración, se guarda también en la materia
    const nombreNuevo = typeof body.materiaNombre === 'string' ? body.materiaNombre.trim().slice(0, 120) : ''
    if (nombreNuevo && nombreNuevo !== dueno.materiaNombre) {
      await prisma.materia.update({ where: { id: dueno.materiaId }, data: { nombre: nombreNuevo } })
      dueno.materiaNombre = nombreNuevo
    }

    // Todo el guardado va en una sola transacción: o se guarda completo, o no se toca nada
    let eliminadas: any[] = []
    let conNotas: string[] = [] // estudiantes que tenían nota en evaluaciones borradas
    const idsNuevos: Record<string, string> = {} // id que usaba la pantalla → id real en la base de datos
    await prisma.$transaction(async (tx) => {
    // Actualizar campos principales
    await tx.planificacion.update({
      where: { id },
      data: {
        version: body.version ?? undefined,
        estado: body.estado ?? undefined,
        fechaExamen: body.fechaExamen && !isNaN(new Date(body.fechaExamen).getTime()) ? new Date(body.fechaExamen) : undefined,
        tipoExamen: body.tipoExamen ?? undefined,
        duracionMinutos: body.duracionMinutos ?? undefined,
      },
    })

    // Sincronizar evaluaciones: las que ya existen se ACTUALIZAN (conservan su id, su estado, sus calificaciones
    // y sus recordatorios); las nuevas se crean; las que ya no vienen van a la papelera.
    if (Array.isArray(body.evaluaciones)) {
      const existentes = await tx.evaluacion.findMany({ where: { planificacionId: id } })
      const porId = new Map<string, (typeof existentes)[number]>(existentes.map(e => [e.id, e]))
      const conservar = new Set<string>()
      for (const [index, ev] of (body.evaluaciones as any[]).entries()) {
        const datos = datosEvaluacion(ev, index)
        const previa = ev?.id ? porId.get(String(ev.id)) : undefined
        if (previa && !conservar.has(previa.id)) {
          await tx.evaluacion.update({ where: { id: previa.id }, data: datos })
          conservar.add(previa.id)
        } else {
          const creada = await tx.evaluacion.create({ data: { ...datos, planificacionId: id } })
          conservar.add(creada.id)
          if (ev?.id) idsNuevos[String(ev.id)] = creada.id
        }
      }
      eliminadas = existentes.filter(e => !conservar.has(e.id))
      if (eliminadas.length > 0) conNotas = (await tx.calificacion.findMany({ where: { evaluacionId: { in: eliminadas.map(e => e.id) } }, select: { estudianteId: true } })).map(c => c.estudianteId)
      if (eliminadas.length > 0) await tx.evaluacion.deleteMany({ where: { id: { in: eliminadas.map(e => e.id) } } })
    }

    // Sincronizar rúbrica
    if (Array.isArray(body.rubrica)) {
      const existingCriterios = await tx.criterioRubrica.findMany({
        where: { planificacionId: id },
        select: { id: true },
      })
      if (existingCriterios.length > 0) {
        await tx.nivelDesempeno.deleteMany({
          where: { criterioId: { in: existingCriterios.map(c => c.id) } },
        })
      }
      await tx.criterioRubrica.deleteMany({ where: { planificacionId: id } })

      if (body.rubrica.length > 0) {
        await tx.planificacion.update({
          where: { id },
          data: {
            rubrica: {
              create: body.rubrica.map((crit: any) => ({
                nombre: crit.nombre,
                peso: crit.peso,
                descripcion: crit.descripcion || '',
                niveles: {
                  create: (crit.niveles || []).map((niv: any) => ({
                    nombre: niv.nombre,
                    puntaje: niv.puntaje,
                    descripcion: niv.descripcion || '',
                  })),
                },
              })),
            },
          },
        })
      }
    }
    }, { timeout: 20000 })

    if (conNotas.length > 0) await recalcularPromedios(conNotas)
    if (eliminadas.length > 0) {
      await enviarAPapelera(eliminadas.map((ev) => ({
        usuarioId: dueno.usuarioId ?? actor.id, // la papelera es del dueño del plan, aunque lo guarde el superadmin
        tipo: 'EVALUACION' as const,
        nombre: ev.nombre,
        contexto: dueno.materiaNombre,
        eliminadoPorId: actor.id,
        eliminadoPorNombre: actor.nombre,
        datos: {
          planificacionId: id, grupoSeccion: ev.grupoSeccion, nombre: ev.nombre, tipoPregunta: ev.tipoPregunta, nivelBloom: ev.nivelBloom,
          peso: ev.peso, cantidadPreguntas: ev.cantidadPreguntas, contenidosEvaluados: ev.contenidosEvaluados,
          tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos, tipoActividad: ev.tipoActividad, descripcion: ev.descripcion,
          cantidadGrupos: ev.cantidadGrupos, personasPorGrupo: ev.personasPorGrupo, orden: ev.orden, enfoque: ev.enfoque,
          fecha: ev.fecha ? ev.fecha.toISOString() : null, rubrica: ev.rubrica ?? null,
        },
      })))
    }

    // Retornar actualizada
    const actualizada = await prisma.planificacion.findUnique({
      where: { id },
      include: {
        materia: true,
        evaluaciones: { orderBy: { orden: 'asc' } },
        rubrica: { include: { niveles: true }, orderBy: { createdAt: 'asc' } },
        comentarios: true,
      },
    })

    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Plan', detalle: `Actualizó el plan de "${dueno.materiaNombre}"${body.evaluaciones ? ` (${body.evaluaciones.length} evaluaciones)` : ''}` })
    return NextResponse.json({ ...actualizada, idsNuevos })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE /api/planificaciones/:id
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params; // AQUÍ ESTÁ EL ARREGLO

    const dueno = await duenoDePlanificacion(id)
    if (!dueno) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    const denegado = verificarAcceso(actor, dueno.usuarioId, 'escribir')
    if (denegado) return denegado

    await prisma.planificacion.delete({ where: { id } })
    await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Plan', detalle: `Eliminó el plan de "${dueno.materiaNombre}"` })
    return NextResponse.json({ eliminado: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
