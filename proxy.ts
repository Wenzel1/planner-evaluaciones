// proxy.ts (Next.js 16+). Va en la raíz del proyecto, junto a package.json; si usas carpeta src/, va en src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { opcionesCookieSesion } from '@/lib/cookies'
import { COOKIE_SESION, DURACION_SESION_SEG, verificarToken, esAdminOSuperadmin, debeRenovar, renovarToken } from '@/lib/session'

const RUTAS_PUBLICAS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/setup', '/api/auth/registro', '/api/auth/recuperar', '/api/auth/verificar-telefono', '/api/auth/reenviar-codigo',]

// Cabeceras de seguridad para todas las respuestas.
// (La protección contra que otra web incruste la tuya en un iframe solo se activa en producción,
//  para no romper el navegador integrado de VS Code mientras desarrollas.)
function conCabeceras(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()') // el micrófono lo usa el chat por voz
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('X-Frame-Options', 'DENY')
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return res
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const esApi = pathname.startsWith('/api/')
  const sesion = await verificarToken(request.cookies.get(COOKIE_SESION)?.value)

  // Rutas públicas
  if (RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    if (pathname === '/login' && sesion) return conCabeceras(NextResponse.redirect(new URL('/', request.url)))
    return conCabeceras(NextResponse.next())
  }

  // Sin sesión válida
  if (!sesion) {
    if (esApi) return conCabeceras(NextResponse.json({ error: 'No autenticado' }, { status: 401 }))
    return conCabeceras(NextResponse.redirect(new URL('/login', request.url)))
  }

  // Reglas por rol
  if (esApi) {
    // Solo /api/usuarios es exclusivo de ADMIN/SUPERADMIN. Los datos (materias, estudiantes, etc.)
    // los protege cada ruta según su dueño (ver lib/permisos.ts).
    const soloAdmin = pathname.startsWith('/api/usuarios') || pathname.startsWith('/api/resumen')
    if (soloAdmin && !esAdminOSuperadmin(sesion.rol)) {
      return conCabeceras(NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 }))
    }
  }

  const respuesta = conCabeceras(NextResponse.next())

  // Sesión deslizante: si la persona sigue trabajando, se le entrega una cookie nueva (con tope de 24 h desde el login)
  if (debeRenovar(sesion)) {
    respuesta.cookies.set(COOKIE_SESION, await renovarToken(sesion), opcionesCookieSesion(request, DURACION_SESION_SEG))
  }
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
