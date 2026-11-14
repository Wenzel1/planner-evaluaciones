// Chat de la sección (materia + sección): lo comparten el profesor y sus estudiantes.
// El profesor además ve ahí las observaciones de los administradores y las opiniones de los estudiantes sobre el plan.
import prisma from '@/lib/prisma'
import { borrarArchivo } from '@/lib/almacenamiento'

export interface ItemChat {
  id: string
  tipo: 'MENSAJE' | 'OBSERVACION' | 'OPINION'
  autorTipo: 'PROFESOR' | 'ESTUDIANTE' | 'ADMIN' | 'SUPERADMIN'
  autorNombre: string
  avatar: { id: string; v: string } | null
  mio: boolean
  texto: string
  createdAt: Date
  adjunto: { nombre: string; tipo: string | null; tamano: number | null; duracion: number | null } | null
  deAcuerdo?: boolean
  referencia?: string | null // la evaluación de la que habla una observación
}

export const letraSeccion = (s: unknown) => String(s || 'A').trim().toUpperCase().slice(0, 1) || 'A'

// Mensajes del chat (los últimos 300), con la foto de cada autor
export async function mensajesChat(materiaId: string, seccion: string, quien: { usuarioId?: string; estudianteId?: string }): Promise<ItemChat[]> {
  const filas = await prisma.mensajeSeccion.findMany({ where: { materiaId, seccion }, orderBy: { createdAt: 'desc' }, take: 300 })
  const ids = [...new Set(filas.map(f => f.usuarioId).filter(Boolean) as string[])]
  const fotos = new Map((await prisma.usuario.findMany({ where: { id: { in: ids }, avatarEn: { not: null } }, select: { id: true, avatarEn: true } })).map(u => [u.id, u.avatarEn!.toISOString()]))
  return filas.reverse().map(f => ({
    id: f.id, tipo: 'MENSAJE' as const, autorTipo: f.autorTipo === 'PROFESOR' ? 'PROFESOR' as const : 'ESTUDIANTE' as const, autorNombre: f.autorNombre,
    avatar: f.usuarioId && fotos.has(f.usuarioId) ? { id: f.usuarioId, v: fotos.get(f.usuarioId)! } : null,
    mio: f.autorTipo === 'PROFESOR' ? !!quien.usuarioId && f.usuarioId === quien.usuarioId && !quien.estudianteId : !!quien.estudianteId && f.estudianteId === quien.estudianteId,
    texto: f.texto, createdAt: f.createdAt,
    adjunto: f.adjuntoNombre ? { nombre: f.adjuntoNombre, tipo: f.adjuntoTipo, tamano: f.adjuntoTamano, duracion: f.adjuntoDuracion } : null,
  }))
}

// Lo que solo ve el profesor: observaciones de los administradores (de la materia) y opiniones del plan (de la sección)
export async function extrasProfesor(materiaId: string, seccion: string): Promise<ItemChat[]> {
  const [obs, ops] = await Promise.all([
    prisma.observacion.findMany({ where: { materiaId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.opinionPlan.findMany({ where: { materiaId, estudiante: { grupo: seccion } }, orderBy: { updatedAt: 'desc' }, take: 100, include: { estudiante: { select: { nombre: true, cuentaId: true, cuenta: { select: { avatarEn: true } } } } } }),
  ])
  return [
    ...obs.map(o => ({
      id: `obs:${o.id}`, tipo: 'OBSERVACION' as const, autorTipo: (o.autorRol === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN') as 'SUPERADMIN' | 'ADMIN', autorNombre: o.autorNombre,
      avatar: null, mio: false, texto: o.mensaje, createdAt: o.createdAt, adjunto: null, referencia: o.evaluacionNombre,
    })),
    ...ops.map(o => ({
      id: `op:${o.id}`, tipo: 'OPINION' as const, autorTipo: 'ESTUDIANTE' as const, autorNombre: o.estudiante.nombre,
      avatar: o.estudiante.cuentaId && o.estudiante.cuenta?.avatarEn ? { id: o.estudiante.cuentaId, v: o.estudiante.cuenta.avatarEn.toISOString() } : null,
      mio: false, texto: o.comentario || (o.deAcuerdo ? 'Estoy de acuerdo con el plan de evaluación.' : 'No estoy de acuerdo con el plan de evaluación.'),
      createdAt: o.updatedAt, adjunto: null, deAcuerdo: o.deAcuerdo,
    })),
  ]
}

export async function borrarMensaje(id: string) {
  const m = await prisma.mensajeSeccion.delete({ where: { id } })
  if (m.adjuntoRuta) borrarArchivo(m.adjuntoRuta)
}
