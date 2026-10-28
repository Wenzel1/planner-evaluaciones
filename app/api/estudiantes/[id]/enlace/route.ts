import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { tokenDeEstudiante, urlPortal } from '@/lib/portal'

// POST /api/estudiantes/:id/enlace  { nuevo?: boolean }
// Devuelve el enlace de la página personal del estudiante. Con nuevo=true lo cambia (el anterior deja de funcionar).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const est = await prisma.estudiante.findUnique({ where: { id }, select: { id: true, nombre: true, usuarioId: true } })
    if (!est) return NextResponse.json({ error: 'Estudiante no encontrado.' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const nuevo = body?.nuevo === true
    const denegado = verificarAcceso(actor, est.usuarioId, nuevo ? 'escribir' : 'leer')
    if (denegado) return denegado
    const token = await tokenDeEstudiante(est.id, nuevo)
    if (nuevo) await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Estudiante', detalle: `Generó un enlace nuevo para ${est.nombre}`.slice(0, 300) })
    return NextResponse.json({ url: urlPortal(request, token) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo obtener el enlace.' }, { status: 500 })
  }
}
