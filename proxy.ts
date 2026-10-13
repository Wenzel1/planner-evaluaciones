// proxy.ts (Next.js 16+). Va en la raíz del proyecto, junto a package.json; si usas carpeta src/, va en src/proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESION, verificarToken, esAdminOSuperadmin } from '@/lib/session'

const RUTAS_PUBLICAS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/setup', '/api/auth/registro']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const esApi = pathname.startsWith('/api/')
  const sesion = await verificarToken(request.cookies.get(COOKIE_SESION)?.value)

  // Rutas públicas
  if (RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
    if (pathname === '/login' && sesion) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  // Sin sesión válida
  if (!sesion) {
    if (esApi) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Reglas por rol
  if (esApi) {
    // Solo /api/usuarios es exclusivo de ADMIN/SUPERADMIN. Los datos (materias, estudiantes, etc.)
    // los protege cada ruta según su dueño (ver lib/permisos.ts).
    const soloAdmin = pathname.startsWith('/api/usuarios') || pathname.startsWith('/api/resumen')
    if (soloAdmin && !esAdminOSuperadmin(sesion.rol)) {
      return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
