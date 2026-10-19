// lib/cookies.ts
// Ayudas para la cookie de sesión y para identificar la conexión.

/** IP de quien hace la petición (detrás de un proxy se lee de las cabeceras estándar). */
export function ipDe(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local'
}

/** La cookie solo se marca "secure" si la conexión es HTTPS. Si se marcara siempre en producción,
 *  un sitio servido por http:// (red local, algunos hosting) nunca guardaría la sesión y el login "no funcionaría". */
export function cookieSegura(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto')
  if (proto) return proto.split(',')[0].trim() === 'https'
  try { return new URL(request.url).protocol === 'https:' } catch { return false }
}

export function opcionesCookieSesion(request: Request, maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: cookieSegura(request), path: '/', maxAge }
}
