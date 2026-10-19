import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { hashPassword } from '@/lib/password'
import { generarPasswordTemporal } from '@/lib/passwordTemporal'
import { registrarActividad } from '@/lib/actividad'

// POST /api/recuperaciones/:id  { accion: 'restablecer' | 'descartar' } — solo SUPERADMIN
//  - restablecer: genera una clave temporal (se muestra UNA sola vez), cierra las sesiones abiertas de esa cuenta
//    y la obliga a elegir una nueva al entrar.
//  - descartar: cierra la solicitud sin cambiar nada (ej. la persona ya recordó su clave).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })
    const { id } = await params
    const body = await request.json()
    if (body.accion !== 'restablecer' && body.accion !== 'descartar') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })

    const sol = await prisma.solicitudRecuperacion.findUnique({
      where: { id },
      select: { id: true, estado: true, usuarioId: true, usuario: { select: { id: true, nombre: true, email: true, telefono: true } } },
    })
    if (!sol) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    if (sol.estado !== 'PENDIENTE') return NextResponse.json({ error: 'Esta solicitud ya fue atendida.' }, { status: 409 })

    const ahora = new Date()
    if (body.accion === 'descartar') {
      await prisma.solicitudRecuperacion.update({ where: { id }, data: { estado: 'ATENDIDA', atendidaPor: actor.nombre, atendidaEn: ahora } })
      await registrarActividad({ actor, accion: 'RECHAZAR', entidad: 'Recuperación', detalle: `Descartó la solicitud de recuperación de ${sol.usuario.nombre}` })
      return NextResponse.json({ ok: true })
    }

    const passwordTemporal = generarPasswordTemporal()
    await prisma.usuario.update({
      where: { id: sol.usuarioId },
      data: { passwordHash: await hashPassword(passwordTemporal), debeCambiarPassword: true, sesionesDesde: ahora },
    })
    // Todas las solicitudes pendientes de esa persona quedan atendidas
    await prisma.solicitudRecuperacion.updateMany({
      where: { usuarioId: sol.usuarioId, estado: 'PENDIENTE' },
      data: { estado: 'ATENDIDA', atendidaPor: actor.nombre, atendidaEn: ahora },
    })
    await registrarActividad({ actor, accion: 'RESTABLECER', entidad: 'Recuperación', detalle: `Restableció la contraseña de ${sol.usuario.nombre} (${sol.usuario.email})` })
    return NextResponse.json({ ok: true, passwordTemporal, usuario: { nombre: sol.usuario.nombre, email: sol.usuario.email, telefono: sol.usuario.telefono } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
