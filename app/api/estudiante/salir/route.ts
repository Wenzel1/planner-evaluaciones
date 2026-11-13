import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirEstudiante } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

// POST /api/estudiante/salir  { claseId } — el estudiante sale de una clase (o cancela su solicitud).
// Si todavía era una solicitud, se borra. Si ya estaba en la lista del profesor, solo se desenlaza su cuenta:
// el profesor conserva sus notas y entregas, y puede volver a unirse con el código.
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirEstudiante(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const clase = await prisma.estudiante.findFirst({ where: { id: String(body.claseId || ''), cuentaId: actor.id }, select: { id: true, estado: true, usuario: { select: { nombre: true } } } })
    if (!clase) return NextResponse.json({ error: 'Clase no encontrada.' }, { status: 404 })
    if (clase.estado === 'PENDIENTE') await prisma.estudiante.delete({ where: { id: clase.id } })
    else await prisma.estudiante.update({ where: { id: clase.id }, data: { cuentaId: null } })
    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Estudiante', detalle: clase.estado === 'PENDIENTE' ? `Canceló su solicitud a la clase de ${clase.usuario?.nombre || 'un profesor'}` : `Salió de la clase de ${clase.usuario?.nombre || 'un profesor'}` })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo completar.' }, { status: 500 })
  }
}
