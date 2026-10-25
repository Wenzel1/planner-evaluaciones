import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { validarNombre, validarEmail, validarPassword, validarTelefono, validarCedula, normalizarTelefono, normalizarCedula } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { mensajeDuplicado } from '@/lib/duplicados'
import { registrarActividad } from '@/lib/actividad'
import { leerConfig } from '@/lib/configuracion'
import { nuevoCodigoParaGuardar, enviarCodigoWhatsApp } from '@/lib/codigoWhatsapp'

// POST /api/auth/registro  (público)
// Un profesor solicita su cuenta desde la pantalla de login. La cuenta se crea SIEMPRE con rol USUARIO
// y en estado "pendiente": no puede iniciar sesión hasta que un ADMIN o SUPERADMIN la apruebe.
// Se piden teléfono y cédula (registro del profesor) y la aceptación del tratamiento de datos personales.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const telefono = String(body.telefono ?? '')
    const cedula = String(body.cedula ?? '')

    const msg = validarNombre(nombre) || validarEmail(email) || validarTelefono(telefono) || validarCedula(cedula) || validarPassword(password)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })
    if (body.aceptaTratamiento !== true) {
      return NextResponse.json({ error: 'Debes aceptar el tratamiento de tus datos personales para solicitar la cuenta.' }, { status: 400 })
    }

    // Mientras no exista ningún usuario, primero hay que crear al superadmin (pantalla de configuración inicial)
    const total = await prisma.usuario.count()
    if (total === 0) {
      return NextResponse.json({ error: 'El sistema aún no está configurado. Crea primero la cuenta de superadmin.' }, { status: 403 })
    }

    // El superadmin puede cerrar el registro público cuando ya estén todos los profesores
    if (!(await leerConfig()).acceso.registroAbierto) {
      return NextResponse.json({ error: 'El registro de nuevas cuentas está cerrado. Pídele acceso al administrador del sistema.' }, { status: 403 })
    }

    // Límite de solicitudes por conexión para evitar que se llene el sistema de cuentas falsas
    const clave = `registro:${ipDe(request)}`
    if (bloqueado(clave)) {
      return NextResponse.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    }
    registrarFallo(clave)

    // Código de 6 dígitos para confirmar el WhatsApp (se guarda cifrado)
    const { codigo, data: datosCodigo } = nuevoCodigoParaGuardar()
    const telefonoNormalizado = normalizarTelefono(telefono)

    await prisma.usuario.create({
      data: {
        ...datosCodigo,
        nombre,
        email,
        passwordHash: await hashPassword(password),
        rol: 'USUARIO',
        activo: false,
        pendiente: true,
        telefono: telefonoNormalizado,
        cedula: normalizarCedula(cedula),
        consentimientoEn: new Date(),
      },
      select: { id: true },
    })
    await registrarActividad({ usuarioNombre: nombre, accion: 'REGISTRO', entidad: 'Usuario', detalle: `Solicitó una cuenta (${email})` })

    const enviado = await enviarCodigoWhatsApp({ telefono: telefonoNormalizado, nombre, codigo })
    // verificar: true → el login pasa a la pantalla "Escribe el código"
    return NextResponse.json({ ok: true, verificar: true, enviado, telefonoFinal: telefonoNormalizado.slice(-4) }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: mensajeDuplicado(e) }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al crear la solicitud.' }, { status: 500 })
  }
}
