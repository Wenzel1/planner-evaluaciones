import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'

// GET /api/recuperaciones — solicitudes de "olvidé mi contraseña" pendientes. Solo SUPERADMIN.
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })

    const items = await prisma.solicitudRecuperacion.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, usuario: { select: { id: true, nombre: true, email: true, telefono: true, cedula: true, rol: true } } },
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener las solicitudes' }, { status: 500 })
  }
}
