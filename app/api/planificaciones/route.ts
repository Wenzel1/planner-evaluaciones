import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';

// GET /api/planificaciones?materiaId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const materiaId = searchParams.get('materiaId')

    const where: any = {}
    if (materiaId) where.materiaId = materiaId

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
    const body = await request.json()

    if (!body.materiaId) {
      return NextResponse.json({ error: 'materiaId es obligatorio' }, { status: 400 })
    }

    const planificacion = await prisma.planificacion.create({
      data: {
        version: body.version || 1,
        estado: body.estado || 'BORRADOR',
        fechaExamen: new Date(body.fechaExamen),
        tipoExamen: body.tipoExamen || 'MIXTO',
        duracionMinutos: body.duracionMinutos || 0,
        materiaId: body.materiaId,
        evaluaciones: {
          create: (body.evaluaciones || []).map((ev: any, index: number) => ({
            nombre: ev.nombre,
            tipoPregunta: ev.tipoPregunta || 'MULTIPLE_CHOICE',
            peso: ev.peso ?? null,
            cantidadPreguntas: ev.cantidadPreguntas || 0,
            contenidosEvaluados: ev.contenidosEvaluados || [],
            nivelBloom: ev.nivelBloom || 'APLICAR',
            tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos ?? null,
            tipoActividad: ev.tipoActividad || null,
            descripcion: ev.descripcion || null,
            cantidadGrupos: ev.cantidadGrupos ?? null,
            personasPorGrupo: ev.personasPorGrupo ?? null,
            orden: ev.orden ?? index,
            enfoque: ev.enfoque || null,
            fecha: ev.fecha ? new Date(ev.fecha) : null,
          })),
        },
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
      include: {
        evaluaciones: true,
        rubrica: { include: { niveles: true } },
        materia: true,
      },
    })

    return NextResponse.json(planificacion, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear planificación' }, { status: 500 })
  }
}