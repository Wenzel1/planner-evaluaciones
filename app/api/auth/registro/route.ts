import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { validarNombre, validarEmail, validarPassword, validarTelefono, normalizarTelefono } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { mensajeDuplicado } from '@/lib/duplicados'
import { registrarActividad } from '@/lib/actividad'
import { leerConfig } from '@/lib/configuracion'
import { nuevoCodigoParaGuardar, enviarCodigo } from '@/lib/codigoWhatsapp'
import { canalMensajes, ocultarCorreo } from '@/lib/correo'
import { verificarDesafio } from '@/lib/captcha'

// Render (plan gratis) puede tardar en despertar a n8n: se da margen a la función en Vercel
export const maxDuration = 60

// POST /api/auth/registro  (público)
// Un profesor crea su cuenta desde la pantalla de login con nombre, correo y contraseña. La cuenta se crea con rol USUARIO,
// en estado "pendiente", y se activa cuando la persona escribe el código de 6 dígitos que le llega (por correo o WhatsApp).
// Solo se pide el teléfono si los avisos van por WhatsApp (sin correo configurado). Ya no se pide la cédula.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nombre = String(body.nombre ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const canal = canalMensajes()
    const telefono = canal === 'whatsapp' ? String(body.telefono ?? '') : ''

    const msg = validarNombre(nombre) || validarEmail(email) || (canal === 'whatsapp' ? validarTelefono(telefono) : null) || validarPassword(password)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })
    if (body.aceptaTratamiento !== true) {
      return NextResponse.json({ error: 'Debes aceptar el tratamiento de tus datos personales para crear la cuenta.' }, { status: 400 })
    }
    // Suma de verificación (frena la creación de cuentas falsas por programas automáticos)
    const errorCaptcha = verificarDesafio(body.captchaToken, body.captchaRespuesta)
    if (errorCaptcha) return NextResponse.json({ error: errorCaptcha, codigo: 'CAPTCHA' }, { status: 400 })

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

    // Código de 6 dígitos para confirmar la cuenta, por correo o WhatsApp según el canal activo (se guarda cifrado)
    const { codigo, data: datosCodigo } = nuevoCodigoParaGuardar()
    const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : null

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
        consentimientoEn: new Date(),
      },
      select: { id: true },
    })
    await registrarActividad({ usuarioNombre: nombre, accion: 'REGISTRO', entidad: 'Usuario', detalle: `Solicitó una cuenta (${email})` })

    const enviado = await enviarCodigo({ email, telefono: telefonoNormalizado, nombre, codigo, motivo: 'registro' })
    // verificar: true → el login pasa a la pantalla "Escribe el código"
    const final = (telefonoNormalizado || '').slice(-4)
    return NextResponse.json({ ok: true, verificar: true, enviado, canal, telefonoFinal: final, destino: canal === 'correo' ? ocultarCorreo(email) : `número terminado en ${final}` }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: mensajeDuplicado(e) }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Error al crear la solicitud.' }, { status: 500 })
  }
}
