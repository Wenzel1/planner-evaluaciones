// La vista del estudiante ya no se abre con un enlace suelto: hace falta iniciar sesión.
// Pueden verla el propio estudiante (su cuenta, rol ESTUDIANTE) y su profesor (o un administrador).
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActor } from '@/lib/authServer'
import { TOKEN_VALIDO } from '@/lib/portal'

export async function accesoPortal(request: Request, token: string): Promise<NextResponse | null> {
  if (!TOKEN_VALIDO.test(String(token || ''))) return NextResponse.json({ error: 'Este enlace no existe.' }, { status: 404 })
  const actor = await getActor(request)
  if (!actor) return NextResponse.json({ error: 'Inicia sesión con tu cuenta de estudiante para ver tu plan.', codigo: 'INICIAR_SESION' }, { status: 401 })
  const est = await prisma.estudiante.findUnique({ where: { enlaceToken: token }, select: { cuentaId: true, usuarioId: true } })
  if (!est) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  const permitido = actor.rol === 'ESTUDIANTE' ? est.cuentaId === actor.id : actor.id === est.usuarioId || actor.rol === 'ADMIN' || actor.rol === 'SUPERADMIN'
  return permitido ? null : NextResponse.json({ error: 'No tienes acceso a esta página.' }, { status: 403 })
}
