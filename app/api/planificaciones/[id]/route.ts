import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/planificaciones/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params; // AQUÍ ESTÁ EL ARREGLO
    const body = await request.json()

    // Actualizar campos principales
    await prisma.planificacion.update({
      where: { id },
      data: {
        version: body.version ?? undefined,
        estado: body.estado ?? undefined,
        fechaExamen: body.fechaExamen ? new Date(body.fechaExamen) : undefined,
        tipoExamen: body.tipoExamen ?? undefined,
        duracionMinutos: body.duracionMinutos ?? undefined,
      },
    })

    // Sincronizar evaluaciones
    if (body.evaluaciones) {
      await prisma.evaluacion.deleteMany({ where: { planificacionId: id } })
      await prisma.planificacion.update({
        where: { id },
        data: {
          evaluaciones: {
            create: body.evaluaciones.map((ev: any, index: number) => ({
              nombre: ev.nombre,
              tipoPregunta: ev.tipoPregunta || 'MULTIPLE_CHOICE',
              nivelBloom: ev.nivelBloom || 'APLICAR',
              peso: ev.peso,
              cantidadPreguntas: ev.cantidadPreguntas || 0,
              contenidosEvaluados: ev.contenidosEvaluados || [],
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
        },
      })
    }

    // Sincronizar rúbrica
    if (body.rubrica !== undefined) {
      const existingCriterios = await prisma.criterioRubrica.findMany({
        where: { planificacionId: id },
        select: { id: true },
      })
      if (existingCriterios.length > 0) {
        await prisma.nivelDesempeno.deleteMany({
          where: { criterioId: { in: existingCriterios.map(c => c.id) } },
        })
      }
      await prisma.criterioRubrica.deleteMany({ where: { planificacionId: id } })

      if (body.rubrica.length > 0) {
        await prisma.planificacion.update({
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

    return NextResponse.json(actualizada)
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
    const { id } = await params; // AQUÍ ESTÁ EL ARREGLO
    await prisma.planificacion.delete({ where: { id } })
    return NextResponse.json({ eliminado: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}