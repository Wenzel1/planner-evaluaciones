import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validarEmail } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { nuevoCodigoParaGuardar, enviarCodigo, REENVIO_SEGUNDOS } from '@/lib/codigoWhatsapp'
import { correoConfigurado, nombreCanal, ocultarCorreo } from '@/lib/correo'

// Render (plan gratis) puede tardar en despertar a n8n: se da margen a la función en Vercel
export const maxDuration = 60

// POST /api/auth/reenviar-codigo  { email }  (público)
// Genera un código nuevo (el anterior deja de servir) y lo envía otra vez (por correo o WhatsApp, según el canal activo).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const msg = validarEmail(email)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    const claveIp = `reenviar:${ipDe(request)}`
    if (bloqueado(claveIp, 5)) {
      return NextResponse.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${minutosRestantes(claveIp)} minuto(s).` }, { status: 429 })
    }
    registrarFallo(claveIp)

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (!usuario || !usuario.pendiente || usuario.telefonoVerificado || (!correoConfigurado() && !usuario.telefono)) {
      return NextResponse.json({ error: 'No hay ninguna cuenta pendiente de confirmar con ese correo.' }, { status: 400 })
    }

    const desdeUltimo = usuario.codigoEnviadoEn ? (Date.now() - usuario.codigoEnviadoEn.getTime()) / 1000 : Infinity
    if (desdeUltimo < REENVIO_SEGUNDOS) {
      const espera = Math.ceil(REENVIO_SEGUNDOS - desdeUltimo)
      return NextResponse.json({ error: `Espera ${espera} segundo(s) antes de pedir otro código.`, esperar: espera }, { status: 429 })
    }

    const { codigo, data } = nuevoCodigoParaGuardar()
    await prisma.usuario.update({ where: { id: usuario.id }, data })
    const enviado = await enviarCodigo({ email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, codigo, motivo: 'registro' })
    if (!enviado) {
      return NextResponse.json({ error: `No pudimos enviar el ${nombreCanal()} en este momento. Intenta en unos minutos o avisa al administrador.` }, { status: 502 })
    }
    const telefonoFinal = (usuario.telefono || '').slice(-4)
    return NextResponse.json({ ok: true, esperar: REENVIO_SEGUNDOS, telefonoFinal, destino: correoConfigurado() ? ocultarCorreo(usuario.email) : `número terminado en ${telefonoFinal}` })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo reenviar el código.' }, { status: 500 })
  }
}
