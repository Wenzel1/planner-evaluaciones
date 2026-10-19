// lib/authServer.ts
// Helpers de autenticación para rutas de API (runtime Node).
import prisma from '@/lib/prisma'
import { COOKIE_SESION, DURACION_SESION_SEG, verificarToken, type Rol } from '@/lib/session'

export interface Actor {
  id: string
  nombre: string
  email: string
  rol: Rol
  debeCambiarPassword: boolean
}

function leerCookie(request: Request, nombre: string): string | undefined {
  const header = request.headers.get('cookie') || ''
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nombre) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/** Devuelve el usuario autenticado verificando token Y base de datos (activo / rol vigente). */
export async function getActor(request: Request): Promise<Actor | null> {
  const payload = await verificarToken(leerCookie(request, COOKIE_SESION))
  if (!payload) return null
  const u = await prisma.usuario.findUnique({ where: { id: payload.sub } })
  if (!u || !u.activo) return null
  // Si la clave se restableció o cambió después de iniciar esta sesión, la sesión ya no vale
  const inicio = payload.ini ?? payload.exp - DURACION_SESION_SEG
  if (u.sesionesDesde && inicio < Math.floor(u.sesionesDesde.getTime() / 1000)) return null
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol as Rol, debeCambiarPassword: u.debeCambiarPassword }
}
