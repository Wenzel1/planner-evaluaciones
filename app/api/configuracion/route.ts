import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { leerConfigCompleta, guardarConfig, sanitizarConfig, parteDeUsuario, validarUrl, camposCambiados } from '@/lib/configuracion'
import { canalMensajes } from '@/lib/correo'

// GET /api/configuracion — cualquier usuario con sesión recibe la parte que el chat y el planificador necesitan;
// el SUPERADMIN recibe además el apartado de acceso y quién la modificó por última vez.
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { config, actualizadoPor, actualizadoEn } = await leerConfigCompleta()
    // canal: por dónde se avisa a los estudiantes ('correo' si GMAIL_USER y GMAIL_APP_PASSWORD están configurados; si no, 'whatsapp')
    if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ config: parteDeUsuario(config), canal: canalMensajes() })
    return NextResponse.json({ config, actualizadoPor, actualizadoEn, canal: canalMensajes() })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al leer la configuración' }, { status: 500 })
  }
}

// PUT /api/configuracion  { config: { chat?, planificador?, acceso? } } — solo SUPERADMIN. Acepta cambios parciales.
export async function PUT(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (actor.rol !== 'SUPERADMIN') return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })

    const body = await request.json()
    const urlPedida = body?.config?.chat?.webhookUrl
    if (typeof urlPedida === 'string') {
      const msg = validarUrl(urlPedida)
      if (msg) return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { config: antes } = await leerConfigCompleta()
    const despues = sanitizarConfig(body?.config, antes)
    await guardarConfig(despues, actor.nombre)

    const cambios = camposCambiados(antes, despues)
    if (cambios.length > 0) {
      await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Configuración', detalle: `Cambió: ${cambios.join(', ')}` })
    }
    return NextResponse.json({ config: despues, cambios })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 })
  }
}
