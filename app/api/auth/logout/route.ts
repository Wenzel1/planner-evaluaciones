import { NextResponse } from 'next/server'
import { COOKIE_SESION } from '@/lib/session'
import { getActor } from '@/lib/authServer'
import { registrarActividad } from '@/lib/actividad'

export async function POST(request: Request) {
  const actor = await getActor(request)
  if (actor) await registrarActividad({ actor, accion: 'LOGOUT', entidad: 'Sesión', detalle: 'Cerró sesión' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SESION, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
