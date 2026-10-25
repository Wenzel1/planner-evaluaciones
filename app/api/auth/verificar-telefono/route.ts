import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validarEmail } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, limpiar, minutosRestantes } from '@/lib/rateLimit'
import { ipDe, opcionesCookieSesion } from '@/lib/cookies'
import { registrarActividad } from '@/lib/actividad'
import { codigoCoincide, CODIGO_MAX_INTENTOS } from '@/lib/codigoWhatsapp'
import { crearToken, COOKIE_SESION, DURACION_SESION_SEG } from '@/lib/session'

const LISTO = '¡Listo! WhatsApp confirmado. Entrando al sistema...'

// Activa la cuenta y abre la sesión (mismo token y cookie que el login)
async function activarYEntrar(request: Request, usuario: { id: string; nombre: string; email: string; rol: any }) {
  await prisma.usuario.update({ where: { id: usuario.id }, data: { pendiente: false, activo: true } })
  const token = await crearToken({ sub: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
  const res = NextResponse.json({ ok: true, entrar: true, mensaje: LISTO })
  res.cookies.set(COOKIE_SESION, token, opcionesCookieSesion(request, DURACION_SESION_SEG))
  return res
}

// POST /api/auth/verificar-telefono  { email, codigo }  (público)
// Confirma el número de WhatsApp de una cuenta recién registrada con el código de 6 dígitos.
// Ya no hace falta la aprobación de un administrador: al confirmar, la cuenta se activa y se inicia la sesión.
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
    if (usuario.telefonoVerificado) return await activarYEntrar(request, usuario)

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
    await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'VERIFICAR', entidad: 'Usuario', detalle: `Confirmó su WhatsApp y activó su cuenta (${usuario.email})` })
    return await activarYEntrar(request, usuario)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo verificar el código. Intenta de nuevo.' }, { status: 500 })
  }
}
