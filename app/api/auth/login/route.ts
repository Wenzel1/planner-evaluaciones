import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { crearToken, COOKIE_SESION, DURACION_SESION_SEG } from '@/lib/session'
import { verifyPassword, hashPassword } from '@/lib/password'
import { bloqueado, registrarFallo, limpiar } from '@/lib/rateLimit'
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

    const clave = email
    if (bloqueado(clave)) {
      return NextResponse.json({ error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' }, { status: 429 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (!hashRelleno) hashRelleno = await hashPassword('relleno-no-valido-123')
    const ok = await verifyPassword(password, usuario?.passwordHash ?? hashRelleno)

    if (!usuario || !ok) {
      registrarFallo(clave)
      // Solo se registra si la cuenta existe (así el historial no se puede inundar con correos inventados)
      if (usuario) await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'LOGIN_FALLIDO', entidad: 'Sesión', detalle: 'Contraseña incorrecta' })
      return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 })
    }
    if (usuario.pendiente) {
      return NextResponse.json({ error: 'Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas entrar.' }, { status: 403 })
    }
    if (!usuario.activo) {
      return NextResponse.json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' }, { status: 403 })
    }

    limpiar(clave)
    await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'LOGIN', entidad: 'Sesión', detalle: 'Inició sesión' })
    const token = await crearToken({ sub: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
    const res = NextResponse.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
    res.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DURACION_SESION_SEG,
    })
    return res
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error?.message?.includes('AUTH_SECRET') ? error.message : 'Error al iniciar sesión.' }, { status: 500 })
  }
}
