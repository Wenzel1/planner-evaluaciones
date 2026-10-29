import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { validarTelefono, validarPassword, normalizarTelefono } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, limpiar, minutosRestantes } from '@/lib/rateLimit'
import { ipDe, opcionesCookieSesion } from '@/lib/cookies'
import { registrarActividad } from '@/lib/actividad'
import { nuevoCodigoParaGuardar, enviarCodigoWhatsApp, codigoCoincide, CODIGO_MAX_INTENTOS, REENVIO_SEGUNDOS } from '@/lib/codigoWhatsapp'
import { crearToken, COOKIE_SESION, DURACION_SESION_SEG } from '@/lib/session'

export const maxDuration = 60

// Respuesta igual exista o no el número: así nadie puede averiguar qué teléfonos están registrados
const ENVIADO = 'Si ese número está registrado, te llegó un código por WhatsApp. Escríbelo abajo junto con tu contraseña nueva.'

// POST /api/auth/recuperar  (público) — "Olvidé mi contraseña" con el número de WhatsApp
//  1) { paso: 'pedir', telefono }                      → envía un código de 6 dígitos por WhatsApp
//  2) { paso: 'cambiar', telefono, codigo, password }  → si el código es correcto, cambia la contraseña y entra
// Si WhatsApp no funciona, se deja una solicitud al superadmin (como antes).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const telefonoTexto = String(body.telefono ?? '')
    const msgTel = validarTelefono(telefonoTexto)
    if (msgTel) return NextResponse.json({ error: msgTel }, { status: 400 })
    const telefono = normalizarTelefono(telefonoTexto)
    const claveIp = `recuperar:${ipDe(request)}`

    // Busca la cuenta activa con ese teléfono (si hay varias, la usada más recientemente)
    const usuario = await prisma.usuario.findFirst({
      where: { telefono, activo: true, pendiente: false },
      orderBy: { updatedAt: 'desc' },
    })

    // ---------- Paso 1: pedir el código ----------
    if (body.paso !== 'cambiar') {
      const claveTel = `recuperar-tel:${telefono}`
      const bloqueo = bloqueado(claveIp, 6) ? claveIp : bloqueado(claveTel, 4) ? claveTel : null
      if (bloqueo) return NextResponse.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${minutosRestantes(bloqueo)} minuto(s).` }, { status: 429 })
      registrarFallo(claveIp); registrarFallo(claveTel)

      if (!usuario) return NextResponse.json({ ok: true, enviado: true, mensaje: ENVIADO })
      if (usuario.codigoEnviadoEn && Date.now() - usuario.codigoEnviadoEn.getTime() < REENVIO_SEGUNDOS * 1000) {
        const s = Math.ceil((REENVIO_SEGUNDOS * 1000 - (Date.now() - usuario.codigoEnviadoEn.getTime())) / 1000)
        return NextResponse.json({ error: `Espera ${s} segundos para pedir otro código.` }, { status: 429 })
      }
      const { codigo, data } = nuevoCodigoParaGuardar()
      await prisma.usuario.update({ where: { id: usuario.id }, data })
      const enviado = await enviarCodigoWhatsApp({ telefono, nombre: usuario.nombre, codigo })
      if (!enviado) {
        // Plan B: se avisa al superadmin, que restablece la clave a mano (no se duplica en 24 h)
        const reciente = await prisma.solicitudRecuperacion.findFirst({ where: { usuarioId: usuario.id, estado: 'PENDIENTE', createdAt: { gt: new Date(Date.now() - 86400000) } }, select: { id: true } })
        if (!reciente) await prisma.solicitudRecuperacion.create({ data: { usuarioId: usuario.id } })
        await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'RECUPERAR', entidad: 'Sesión', detalle: 'Pidió recuperar su contraseña; WhatsApp falló y se avisó al superadmin' })
        return NextResponse.json({ ok: true, enviado: false, mensaje: 'No pudimos enviarte el código por WhatsApp en este momento. Ya se avisó al superadmin: te contactará a ese número con una clave temporal.' })
      }
      await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'RECUPERAR', entidad: 'Sesión', detalle: 'Pidió un código por WhatsApp para recuperar su contraseña' })
      return NextResponse.json({ ok: true, enviado: true, mensaje: ENVIADO })
    }

    // ---------- Paso 2: código + contraseña nueva ----------
    const codigo = String(body.codigo ?? '').replace(/\D/g, '')
    const password = String(body.password ?? '')
    if (codigo.length !== 6) return NextResponse.json({ error: 'El código tiene 6 dígitos.' }, { status: 400 })
    const msgPass = validarPassword(password)
    if (msgPass) return NextResponse.json({ error: msgPass }, { status: 400 })
    if (bloqueado(claveIp, 12)) return NextResponse.json({ error: `Demasiados intentos. Intenta de nuevo en ${minutosRestantes(claveIp)} minuto(s).` }, { status: 429 })

    if (!usuario || !usuario.codigoHash || !usuario.codigoExpira) {
      registrarFallo(claveIp)
      return NextResponse.json({ error: 'Código incorrecto o vencido.' }, { status: 400 })
    }
    if (usuario.codigoExpira.getTime() < Date.now()) return NextResponse.json({ error: 'El código venció. Pide uno nuevo.' }, { status: 400 })
    if (usuario.codigoIntentos >= CODIGO_MAX_INTENTOS) return NextResponse.json({ error: 'Demasiados intentos con este código. Pide uno nuevo.' }, { status: 429 })
    if (!codigoCoincide(codigo, usuario.codigoHash)) {
      registrarFallo(claveIp)
      const r = await prisma.usuario.update({ where: { id: usuario.id }, data: { codigoIntentos: { increment: 1 } }, select: { codigoIntentos: true } })
      const quedan = Math.max(0, CODIGO_MAX_INTENTOS - r.codigoIntentos)
      return NextResponse.json({ error: quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intento(s).` : 'Código incorrecto. Pide un código nuevo.' }, { status: 400 })
    }

    limpiar(claveIp)
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: await hashPassword(password), codigoHash: null, codigoExpira: null, codigoIntentos: 0, telefonoVerificado: true, debeCambiarPassword: false },
    })
    // Si había una solicitud al superadmin pendiente, ya no hace falta
    await prisma.solicitudRecuperacion.updateMany({ where: { usuarioId: usuario.id, estado: 'PENDIENTE' }, data: { estado: 'ATENDIDA', atendidaPor: 'La misma persona (código de WhatsApp)', atendidaEn: new Date() } }).catch(() => {})
    await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'RECUPERAR', entidad: 'Sesión', detalle: 'Cambió su contraseña con el código de WhatsApp' })

    // Entra directo (misma sesión que el login)
    const token = await crearToken({ sub: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
    const res = NextResponse.json({ ok: true, entrar: true, mensaje: '¡Listo! Contraseña cambiada. Entrando…' })
    res.cookies.set(COOKIE_SESION, token, opcionesCookieSesion(request, DURACION_SESION_SEG))
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo completar la solicitud. Intenta de nuevo.' }, { status: 500 })
  }
}
