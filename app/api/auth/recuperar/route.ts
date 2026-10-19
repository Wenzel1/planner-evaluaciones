import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validarEmail } from '@/lib/validacionesUsuario'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { ipDe } from '@/lib/cookies'
import { registrarActividad } from '@/lib/actividad'

const MENSAJE = 'Si el correo está registrado, ya se avisó al superadmin. Te contactará por teléfono para entregarte una clave temporal.'

// POST /api/auth/recuperar  { email }  (público)
// "Olvidé mi contraseña": NO envía ni muestra ninguna clave. Deja una solicitud para el superadmin, que
// restablece la contraseña y se la hace llegar a la persona por el teléfono registrado.
// La respuesta es siempre la misma exista o no el correo (así nadie puede averiguar qué correos están registrados).
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const msg = validarEmail(email)
    if (msg) return NextResponse.json({ error: msg }, { status: 400 })

    // Límites para que nadie llene de solicitudes al superadmin: por conexión y por correo
    const claveIp = `recuperar:${ipDe(request)}`
    const claveCorreo = `recuperar-correo:${email}`
    const bloqueo = bloqueado(claveIp, 5) ? claveIp : bloqueado(claveCorreo, 3) ? claveCorreo : null
    if (bloqueo) {
      return NextResponse.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${minutosRestantes(bloqueo)} minuto(s).` }, { status: 429 })
    }
    registrarFallo(claveIp); registrarFallo(claveCorreo)

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (usuario && usuario.activo && !usuario.pendiente) {
      // No se duplican solicitudes: si ya hay una pendiente de las últimas 24 horas, se deja esa
      const reciente = await prisma.solicitudRecuperacion.findFirst({
        where: { usuarioId: usuario.id, estado: 'PENDIENTE', createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { id: true },
      })
      if (!reciente) {
        await prisma.solicitudRecuperacion.create({ data: { usuarioId: usuario.id } })
        await registrarActividad({ actor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, accion: 'RECUPERAR', entidad: 'Sesión', detalle: 'Solicitó recuperar su contraseña' })
      }
    }
    return NextResponse.json({ ok: true, mensaje: MENSAJE })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }, { status: 500 })
  }
}
