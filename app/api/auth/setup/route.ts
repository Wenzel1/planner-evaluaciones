import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { validarNombre, validarEmail, validarPassword } from '@/lib/validacionesUsuario'
import { registrarActividad } from '@/lib/actividad'

// GET: ¿hay que crear el primer superadmin?
export async function GET() {
  const total = await prisma.usuario.count()
  return NextResponse.json({ necesitaSetup: total === 0 })
}

// POST: crea el primer SUPERADMIN. Solo funciona si NO existe ningún usuario.
export async function POST(request: Request) {
  try {
    const total = await prisma.usuario.count()
    if (total > 0) return NextResponse.json({ error: 'La configuración inicial ya fue realizada.' }, { status: 403 })

    const body = await request.json()
    const error = validarNombre(body.nombre) || validarEmail(body.email) || validarPassword(body.password)
    if (error) return NextResponse.json({ error }, { status: 400 })

    const creado = await prisma.usuario.create({
      data: {
        nombre: String(body.nombre).trim(),
        email: String(body.email).trim().toLowerCase(),
        passwordHash: await hashPassword(String(body.password)),
        rol: 'SUPERADMIN',
      },
      select: { id: true, nombre: true, email: true, rol: true },
    })
    await registrarActividad({ actor: creado, accion: 'CREAR', entidad: 'Usuario', detalle: 'Cuenta inicial de superadmin' })
    return NextResponse.json(creado, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error en la configuración inicial.' }, { status: 500 })
  }
}
