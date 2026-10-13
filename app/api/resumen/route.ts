import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, esAdminOSuper } from '@/lib/permisos'
import { construirResumen } from '@/lib/resumen'

// GET /api/resumen — Resumen del trabajo de todos los profesores (solo ADMIN y SUPERADMIN, solo lectura)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (!esAdminOSuper(actor)) {
      return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })
    }

    const [usuarios, materias, grupos] = await Promise.all([
      prisma.usuario.findMany({
        select: { id: true, nombre: true, email: true, rol: true, activo: true, pendiente: true, createdAt: true },
        orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      }),
      prisma.materia.findMany({
        select: {
          id: true,
          nombre: true,
          usuarioId: true,
          planificaciones: {
            orderBy: { createdAt: 'desc' },
            select: {
              fechaExamen: true,
              updatedAt: true,
              evaluaciones: {
                orderBy: { orden: 'asc' },
                select: { id: true, nombre: true, peso: true, tipoActividad: true, fecha: true, tiempoEstimadoMinutos: true },
              },
            },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.estudiante.groupBy({ by: ['usuarioId'], _count: { _all: true } }),
    ])

    const resumen = construirResumen(
      usuarios,
      materias,
      grupos.map((g) => ({ usuarioId: g.usuarioId, total: g._count._all }))
    )
    return NextResponse.json({ actor: { id: actor.id, rol: actor.rol }, ...resumen })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener el resumen' }, { status: 500 })
  }
}
