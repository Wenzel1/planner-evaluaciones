// Comprobación compartida: la materia es del profesor (o el actor es administrador)
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { letraSeccion } from '@/lib/chatSeccion'

export async function accesoChat(request: Request, materiaId: unknown, seccion: unknown, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const materia = await prisma.materia.findUnique({ where: { id: String(materiaId || '') }, select: { id: true, nombre: true, usuarioId: true } })
  if (!materia) return { error: NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, materia.usuarioId, modo)
  if (denegado) return { error: denegado }
  return { actor: actor!, materia, seccion: letraSeccion(seccion) }
}
