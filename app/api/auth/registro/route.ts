import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { validarNombre, validarEmail, validarPassword } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo } from '@/lib/rateLimit'
import { registrarActividad } from '@/lib/actividad'

// POST /api/auth/registro  (público)
// Un profesor solicita su cuenta desde la pantalla de login. La cuenta se crea SIEMPRE con rol USUARIO
// y en estado "pendiente": no puede iniciar sesión hasta que un ADMIN o SUPERADMIN la apruebe.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    const msg = validarNombre(nombre) || validarEmail(email) || validarPassword(password)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    // Mientras no exista ningún usuario, primero hay que crear al superadmin (pantalla de configuración inicial)
    const total = await prisma.usuario.count()
    if (total === 0) {
      return NextResponse.json({ error: 'El sistema aún no está configurado. Crea primero la cuenta de superadmin.' }, { status: 403 })
    }

    // Límite de solicitudes por conexión para evitar que se llene el sistema de cuentas falsas
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local'
    const clave = `registro:${ip}`
    if (bloqueado(clave)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' }, { status: 429 })
    }
    registrarFallo(clave)

    await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash: await hashPassword(password),
        rol: 'USUARIO',
        activo: false,
        pendiente: true,
      },
      select: { id: true },
    })
    await registrarActividad({ usuarioNombre: nombre, accion: 'REGISTRO', entidad: 'Usuario', detalle: `Solicitó una cuenta (${email})` })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Ese correo ya está registrado.' }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al crear la solicitud.' }, { status: 500 })
  }
}
