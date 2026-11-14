// El estudiante y la materia del chat: solo su sección y una materia de su profesor (la suya, si se unió a una)
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken } from '@/lib/entregas'
import { letraSeccion } from '@/lib/chatSeccion'

export async function accesoChatEstudiante(request: Request, token: string, materiaId: unknown) {
  const sinAcceso = await accesoPortal(request, token)
  if (sinAcceso) return { error: sinAcceso }
  const est = await estudianteDeToken(token)
  if (!est) return { error: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }) }
  const materia = await prisma.materia.findUnique({ where: { id: String(materiaId || '') }, select: { id: true, nombre: true, usuarioId: true } })
  if (!materia || materia.usuarioId !== est.usuarioId || (est.materiaId && est.materiaId !== materia.id)) return { error: NextResponse.json({ error: 'Chat no encontrado.' }, { status: 404 }) }
  return { est, materia, seccion: letraSeccion(est.grupo) }
}
