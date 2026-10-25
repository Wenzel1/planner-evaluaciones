import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { crearToken, COOKIE_SESION, DURACION_SESION_SEG } from '@/lib/session'
import { verifyPassword, hashPassword } from '@/lib/password'
import { bloqueado, registrarFallo, limpiar, minutosRestantes } from '@/lib/rateLimit'
import { ipDe, opcionesCookieSesion } from '@/lib/cookies'
import { registrarActividad } from '@/lib/actividad'

// Hash de relleno para que el tiempo de respuesta sea similar exista o no el usuario
let hashRelleno: string | null = null

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Ingresa tu correo y contraseña.' }, { status: 400 })
    }

    // Dos límites: por conexión+correo (5 intentos) y por correo (20). Así alguien que adivine claves
    // desde su propia conexión no puede dejar bloqueada a la persona real, que entra desde otra.
    const claveIp = `${ipDe(request)}|${email}`
    const claveCorreo = `correo:${email}`
    const bloqueo = bloqueado(claveIp, 5) ? claveIp : bloqueado(claveCorreo, 20) ? claveCorreo : null
    if (bloqueo) {
      return NextResponse.json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes(bloqueo)} minuto(s).` }, { status: 429 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (!hashRelleno) hashRelleno = await hashPassword('relleno-no-valido-123')
    const ok = await verifyPassword(password, usuario?.passwordHash ?? hashRelleno)

    if (!usuario || !ok) {
      registrarFallo(claveIp); registrarFallo(claveCorreo)
      // Solo se registra si la cuenta existe (así el historial no se puede inundar con correos inventados)
      if (usuario) await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'LOGIN_FALLIDO', entidad: 'Sesión', detalle: 'Contraseña incorrecta' })
      return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 })
    }
    if (usuario.pendiente && !usuario.telefonoVerificado) {
      return NextResponse.json({ error: 'Primero confirma tu WhatsApp con el código de 6 dígitos que te enviamos.', codigo: 'VERIFICAR_TELEFONO' }, { status: 403 })
    }
    if (usuario.pendiente) {
      return NextResponse.json({ error: 'Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas entrar.' }, { status: 403 })
    }
    if (!usuario.activo) {
      return NextResponse.json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' }, { status: 403 })
    }

    limpiar(claveIp); limpiar(claveCorreo)
    await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'LOGIN', entidad: 'Sesión', detalle: 'Inició sesión' })
    const token = await crearToken({ sub: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
    const res = NextResponse.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, debeCambiarPassword: usuario.debeCambiarPassword })
    res.cookies.set(COOKIE_SESION, token, opcionesCookieSesion(request, DURACION_SESION_SEG))
    return res
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message?.includes('AUTH_SECRET') ? error.message : 'Error al iniciar sesión.' }, { status: 500 })
  }
}
