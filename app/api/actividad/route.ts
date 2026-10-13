import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

const POR_PAGINA = 25

// GET /api/actividad?pagina=1&accion=CREAR&buscar=texto  — solo SUPERADMIN, solo lectura
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (actor.rol !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })
    }

    const sp = new URL(request.url).searchParams
    const pagina = Math.max(1, parseInt(sp.get('pagina') || '1', 10) || 1)
    const accion = (sp.get('accion') || '').trim()
    const buscar = (sp.get('buscar') || '').trim()

    const where: any = {}
    if (accion) where.accion = accion
    if (buscar) {
      where.OR = [
        { usuarioNombre: { contains: buscar, mode: 'insensitive' } },
        { detalle: { contains: buscar, mode: 'insensitive' } },
        { entidad: { contains: buscar, mode: 'insensitive' } },
      ]
    }

    const [total, items] = await Promise.all([
      prisma.actividad.count({ where }),
      prisma.actividad.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
      }),
    ])

    return NextResponse.json({
      total,
      pagina,
      porPagina: POR_PAGINA,
      totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      items,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener la actividad' }, { status: 500 })
  }
}
