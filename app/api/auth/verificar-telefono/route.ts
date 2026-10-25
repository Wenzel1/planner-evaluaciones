import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validarEmail } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, limpiar, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { registrarActividad } from '@/lib/actividad'
import { codigoCoincide, CODIGO_MAX_INTENTOS } from '@/lib/codigoWhatsapp'

const LISTO = 'WhatsApp confirmado. Un administrador debe aprobar tu cuenta; te avisaremos cuando puedas entrar.'

// POST /api/auth/verificar-telefono  { email, codigo }  (público)
// Confirma el número de WhatsApp de una cuenta recién registrada con el código de 6 dígitos.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const codigo = String(body.codigo ?? '').replace(/\D/g, '')

    const msg = validarEmail(email)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })
    if (codigo.length !== 6) return NextResponse.json({ error: 'El código tiene 6 dígitos.' }, { status: 400 })

    // Límite por conexión (además del límite de intentos por cuenta)
    const claveIp = `verificar:${ipDe(request)}`
    if (bloqueado(claveIp, 10)) {
      return NextResponse.json({ error: `Demasiados intentos. Intenta de nuevo en ${minutosRestantes(claveIp)} minuto(s).` }, { status: 429 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (!usuario || !usuario.pendiente) {
      registrarFallo(claveIp)
      return NextResponse.json({ error: 'Código incorrecto o vencido.' }, { status: 400 })
    }
    if (usuario.telefonoVerificado) return NextResponse.json({ ok: true, mensaje: LISTO })

    if (!usuario.codigoHash || !usuario.codigoExpira || usuario.codigoExpira.getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código venció. Pulsa «Reenviar código» para recibir uno nuevo.' }, { status: 400 })
    }
    if (usuario.codigoIntentos >= CODIGO_MAX_INTENTOS) {
      return NextResponse.json({ error: 'Demasiados intentos con este código. Pulsa «Reenviar código» para recibir uno nuevo.' }, { status: 429 })
    }

    if (!codigoCoincide(codigo, usuario.codigoHash)) {
      registrarFallo(claveIp)
      const r = await prisma.usuario.update({ where: { id: usuario.id }, data: { codigoIntentos: { increment: 1 } }, select: { codigoIntentos: true } })
      const quedan = Math.max(0, CODIGO_MAX_INTENTOS - r.codigoIntentos)
      return NextResponse.json({ error: quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intento(s).` : 'Código incorrecto. Pide un código nuevo.' }, { status: 400 })
    }

    limpiar(claveIp)
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { telefonoVerificado: true, codigoHash: null, codigoExpira: null, codigoIntentos: 0 },
    })
    await registrarActividad({ usuarioNombre: usuario.nombre, accion: 'VERIFICAR', entidad: 'Usuario', detalle: `Confirmó su WhatsApp (${usuario.email})` })
    return NextResponse.json({ ok: true, mensaje: LISTO })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo verificar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
