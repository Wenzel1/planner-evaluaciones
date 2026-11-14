// Materiales de clase por unidades: acceso del profesor y forma en que se devuelven
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso, type ModoAcceso } from '@/lib/permisos'

export const carpetaMateriales = (materiaId: string) => `materiales/${materiaId}/`

// La materia, solo si el profesor puede leerla o modificarla
export async function materiaDelProfesor(request: Request, materiaId: unknown, modo: ModoAcceso) {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const materia = await prisma.materia.findUnique({ where: { id: String(materiaId || '') }, select: { id: true, usuarioId: true } })
  if (!materia) return { error: NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, materia.usuarioId, modo)
  if (denegado) return { error: denegado }
  return { materia }
}

export const SELECT_UNIDAD = {
  id: true, nombre: true, descripcion: true, orden: true, visibleDesde: true,
  materiales: { orderBy: [{ orden: 'asc' as const }, { createdAt: 'asc' as const }], select: { id: true, tipo: true, titulo: true, url: true, archivoTipo: true, archivoTamano: true, evaluacionId: true } },
}

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '')

// Unidades de una materia con sus materiales. Las evaluaciones vinculadas se completan con su nombre y fecha
// (si se indica una sección, solo las de esa sección; las que ya no existen no se muestran).
export async function unidadesDeMateria(materiaId: string, opciones: { soloVisibles?: boolean; seccion?: string } = {}) {
  const unidades = await prisma.unidad.findMany({
    where: { materiaId, ...(opciones.soloVisibles ? { OR: [{ visibleDesde: null }, { visibleDesde: { lte: new Date() } }] } : {}) },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }], select: SELECT_UNIDAD,
  })
  const ids = unidades.flatMap(u => u.materiales.filter(m => m.tipo === 'EVALUACION' && m.evaluacionId).map(m => m.evaluacionId!))
  const evs = ids.length ? await prisma.evaluacion.findMany({ where: { id: { in: ids }, planificacion: { materiaId } }, select: { id: true, nombre: true, fecha: true, grupoSeccion: true } }) : []
  const porId = new Map(evs.map(e => [e.id, e]))
  return unidades.map(u => ({
    id: u.id, nombre: u.nombre, descripcion: u.descripcion, orden: u.orden, visibleDesde: u.visibleDesde,
    materiales: u.materiales.flatMap((m): Record<string, unknown>[] => {
      if (m.tipo !== 'EVALUACION') return [{ id: m.id, tipo: m.tipo, titulo: m.titulo, url: m.tipo === 'ENLACE' ? m.url : null, archivoTipo: m.archivoTipo, archivoTamano: m.archivoTamano }]
      const ev = m.evaluacionId ? porId.get(m.evaluacionId) : null
      if (!ev) return []
      const seccion = (ev.grupoSeccion || 'A').toUpperCase()
      if (opciones.seccion && seccion !== opciones.seccion.toUpperCase()) return []
      return [{ id: m.id, tipo: m.tipo, titulo: limpiar(ev.nombre), evaluacionId: ev.id, fecha: ev.fecha, seccion }]
    }),
  }))
}
