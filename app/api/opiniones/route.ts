import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/opiniones — opiniones de los estudiantes sobre los planes del profesor (las más recientes primero)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const items = await prisma.opinionPlan.findMany({
      where: { materia: { usuarioId: actor.id } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
      select: { id: true, deAcuerdo: true, comentario: true, leida: true, updatedAt: true, estudiante: { select: { nombre: true, grupo: true } }, materia: { select: { nombre: true } } },
    })
    return NextResponse.json(items.map(o => ({ id: o.id, deAcuerdo: o.deAcuerdo, comentario: o.comentario, leida: o.leida, fecha: o.updatedAt, estudiante: o.estudiante.nombre, seccion: o.estudiante.grupo, materia: o.materia.nombre })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener las opiniones' }, { status: 500 })
  }
}

// PATCH /api/opiniones  { id } | { todas: true } — marca como vistas
export async function PATCH(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    if (!body.id && !body.todas) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    const r = await prisma.opinionPlan.updateMany({ where: { leida: false, materia: { usuarioId: actor.id }, ...(body.id ? { id: String(body.id) } : {}) }, data: { leida: true } })
    return NextResponse.json({ actualizadas: r.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}
