import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validarEmail } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { nuevoCodigoParaGuardar, enviarCodigoWhatsApp, REENVIO_SEGUNDOS } from '@/lib/codigoWhatsapp'

// POST /api/auth/reenviar-codigo  { email }  (público)
// Genera un código nuevo (el anterior deja de servir) y lo envía otra vez por WhatsApp.
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
    if (!usuario || !usuario.pendiente || usuario.telefonoVerificado || !usuario.telefono) {
      return NextResponse.json({ error: 'No hay ninguna cuenta pendiente de confirmar con ese correo.' }, { status: 400 })
    }

    const desdeUltimo = usuario.codigoEnviadoEn ? (Date.now() - usuario.codigoEnviadoEn.getTime()) / 1000 : Infinity
    if (desdeUltimo < REENVIO_SEGUNDOS) {
      const espera = Math.ceil(REENVIO_SEGUNDOS - desdeUltimo)
      return NextResponse.json({ error: `Espera ${espera} segundo(s) antes de pedir otro código.`, esperar: espera }, { status: 429 })
    }

    const { codigo, data } = nuevoCodigoParaGuardar()
    await prisma.usuario.update({ where: { id: usuario.id }, data })
    const enviado = await enviarCodigoWhatsApp({ telefono: usuario.telefono, nombre: usuario.nombre, codigo })
    if (!enviado) {
      return NextResponse.json({ error: 'No pudimos enviar el WhatsApp en este momento. Intenta en unos minutos o avisa al administrador.' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, esperar: REENVIO_SEGUNDOS, telefonoFinal: usuario.telefono.slice(-4) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo reenviar el código.' }, { status: 500 })
  }
}
