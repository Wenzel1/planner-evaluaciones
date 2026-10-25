import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { fechaLimitePapelera } from '@/lib/papelera'
import { leerConfig } from '@/lib/configuracion'

// GET /api/papelera — lo que el usuario eliminó en los últimos 30 días (lo más viejo se borra solo)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error

    // Limpieza automática: lo que lleva más de 30 días en la papelera se elimina definitivamente
    const dias = (await leerConfig()).acceso.diasPapelera // configurable por el superadmin
    await prisma.papeleraItem.deleteMany({ where: { createdAt: { lt: fechaLimitePapelera(new Date(), dias) } } })

    const items = await prisma.papeleraItem.findMany({
      where: { usuarioId: actor.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tipo: true, nombre: true, contexto: true, eliminadoPorNombre: true, eliminadoPorId: true, createdAt: true },
    })
    return NextResponse.json({ diasRetencion: dias, items })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener la papelera' }, { status: 500 })
  }
}
