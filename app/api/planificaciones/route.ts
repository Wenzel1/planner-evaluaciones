import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { normalizarRubrica } from '@/lib/rubrica'
import { normalizarRecursos } from '@/lib/portal'
import prisma from '@/lib/prisma';
import { requerirActor, quiereTodos, verificarAcceso } from '@/lib/permisos';
import { registrarActividad } from '@/lib/actividad';

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
    // Portal del estudiante: recursos de estudio y apertura manual
    ...(ev.recursos !== undefined ? { recursos: normalizarRecursos(ev.recursos) ?? Prisma.DbNull } : {}),
    ...(typeof ev.abiertaManual === 'boolean' ? { abiertaManual: ev.abiertaManual } : {}),
  }
}

// GET /api/planificaciones?materiaId=xxx  (solo las del usuario; ADMIN/SUPERADMIN pueden pedir ?todos=1)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { searchParams } = new URL(request.url)
    const materiaId = searchParams.get('materiaId')
    const todos = quiereTodos(request, actor)

    const where: any = {}
    if (materiaId) where.materiaId = materiaId
    if (!todos) where.materia = { usuarioId: actor.id }

    const planificaciones = await prisma.planificacion.findMany({
      where,
      include: {
        materia: true,
        evaluaciones: { orderBy: { orden: 'asc' } },
        rubrica: { include: { niveles: true }, orderBy: { createdAt: 'asc' } },
        comentarios: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(planificaciones)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener planificaciones' }, { status: 500 })
  }
}

// POST /api/planificaciones
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()

    if (!body.materiaId) {
      return NextResponse.json({ error: 'materiaId es obligatorio' }, { status: 400 })
    }
    if (!body.fechaExamen || isNaN(new Date(body.fechaExamen).getTime())) {
      return NextResponse.json({ error: 'La fecha del examen no es válida.' }, { status: 400 })
    }

    // La materia debe pertenecer al usuario (o ser SUPERADMIN)
    const materia = await prisma.materia.findUnique({ where: { id: body.materiaId }, select: { usuarioId: true } })
    if (!materia) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    const denegado = verificarAcceso(actor, materia.usuarioId, 'escribir')
    if (denegado) return denegado

    const idsNuevos: Record<string, string> = {} // id que usaba la pantalla → id real en la base de datos
    const creado = await prisma.$transaction(async (tx) => {
    const plan = await tx.planificacion.create({
      data: {
        version: body.version || 1,
        estado: body.estado || 'BORRADOR',
        fechaExamen: new Date(body.fechaExamen),
        tipoExamen: body.tipoExamen || 'MIXTO',
        duracionMinutos: body.duracionMinutos || 0,
        materiaId: body.materiaId,
        rubrica: {
          create: (body.rubrica || []).map((crit: any) => ({
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
      select: { id: true },
    })
    for (const [index, ev] of ((body.evaluaciones || []) as any[]).entries()) {
      const c = await tx.evaluacion.create({ data: { ...datosEvaluacion(ev, index), planificacionId: plan.id } })
      if (ev?.id) idsNuevos[String(ev.id)] = c.id
    }
    return plan
    }, { timeout: 20000 })

    const planificacion = await prisma.planificacion.findUniqueOrThrow({
      where: { id: creado.id },
      include: {
        evaluaciones: { orderBy: { orden: 'asc' } },
        rubrica: { include: { niveles: true } },
        materia: true,
      },
    })

    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Plan', detalle: `Plan de "${planificacion.materia.nombre}" (${planificacion.evaluaciones.length} evaluaciones)` })
    return NextResponse.json({ ...planificacion, idsNuevos }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear planificación' }, { status: 500 })
  }
}
