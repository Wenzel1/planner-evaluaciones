import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

const ESTADOS = ['PROGRAMADA', 'REALIZADA', 'REPROGRAMADA', 'CANCELADA'] as const
const ETIQUETA: Record<string, string> = { PROGRAMADA: 'programada', REALIZADA: 'realizada', REPROGRAMADA: 'reprogramada', CANCELADA: 'cancelada' }

// POST /api/evaluaciones/:id/estado  { estado, fecha? }
// El dueño (o el superadmin) marca si la evaluación se realizó, se reprogramó (con fecha nueva) o se canceló.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const estado = String(body.estado ?? '').toUpperCase()
    if (!ESTADOS.includes(estado as any)) return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 })

    const ev = await prisma.evaluacion.findUnique({
      where: { id },
      select: { id: true, nombre: true, planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } } },
    })
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada. Si la acabas de crear, espera a que se guarde e intenta de nuevo.' }, { status: 404 })
    const denegado = verificarAcceso(actor, ev.planificacion.materia.usuarioId, 'escribir')
    if (denegado) return denegado

    const data: any = { estado, estadoEn: new Date() }
    if (estado === 'REPROGRAMADA') {
      const f = new Date(body.fecha)
      if (!body.fecha || isNaN(f.getTime())) return NextResponse.json({ error: 'Indica la nueva fecha de la evaluación.' }, { status: 400 })
      if (f.getTime() < Date.now() - 60_000) return NextResponse.json({ error: 'La nueva fecha debe ser futura.' }, { status: 400 })
      data.fecha = f
    }
    const actualizada = await prisma.evaluacion.update({ where: { id }, data, select: { id: true, estado: true, estadoEn: true, fecha: true } })
    await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Evaluación', detalle: `Marcó "${ev.nombre}" como ${ETIQUETA[estado]} (${ev.planificacion.materia.nombre})`.slice(0, 300) })
    return NextResponse.json(actualizada)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cambiar el estado.' }, { status: 500 })
  }
}
