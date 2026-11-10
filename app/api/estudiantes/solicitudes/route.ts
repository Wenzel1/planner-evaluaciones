import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

// PATCH /api/estudiantes/solicitudes  { id, accion: 'aceptar' | 'rechazar' } | { todas: true, accion: 'aceptar', grupo? }
// Solicitudes de estudiantes que se unieron con el código de clase de una sección que pide aprobación.
export async function PATCH(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const accion = body.accion === 'rechazar' ? 'rechazar' : body.accion === 'aceptar' ? 'aceptar' : null
    if (!accion) return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
    const where: any = { usuarioId: actor.id, estado: 'PENDIENTE' }
    if (body.todas === true) { if (body.grupo) where.grupo = String(body.grupo).toUpperCase() }
    else if (body.id) where.id = String(body.id)
    else return NextResponse.json({ error: 'Falta la solicitud.' }, { status: 400 })
    const r = accion === 'aceptar'
      ? await prisma.estudiante.updateMany({ where, data: { estado: 'ACTIVO' } })
      : await prisma.estudiante.deleteMany({ where })
    await registrarActividad({ actor, accion: accion === 'aceptar' ? 'APROBAR' : 'ELIMINAR', entidad: 'Estudiante', detalle: `${accion === 'aceptar' ? 'Aceptó' : 'Rechazó'} ${r.count} solicitud(es) para unirse a su clase` })
    return NextResponse.json({ procesadas: r.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo procesar la solicitud.' }, { status: 500 })
  }
}
