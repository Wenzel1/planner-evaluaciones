// lib/configuracion.ts
// Configuración del sistema que administra el SUPERADMIN (chat y modelo de lenguaje, límites del planificador, acceso).
// Se guarda como un solo registro en la base de datos; lo que no esté guardado usa los valores por defecto.
import prisma from '@/lib/prisma'

export interface ConfigSistema {
  chat: {
    activo: boolean               // interruptor general del asistente
    mensajeInactivo: string       // lo que ven los usuarios si está apagado
    webhookUrl: string            // dirección base de n8n ('' = usar la variable NEXT_PUBLIC_N8N_URL)
    modelo: string                // modelo de lenguaje ('' = el que tenga configurado el flujo de n8n)
    temperatura: number           // 0 a 1 (más alto = respuestas más creativas)
    maxTokens: number             // largo máximo de la respuesta (0 = el valor por defecto del modelo)
    ventanaMemoria: number        // cuántos mensajes recuerda el agente
    maxCaracteresMensaje: number  // largo máximo del mensaje de un usuario
    timeoutSegundos: number       // tiempo máximo de espera de una respuesta
    instruccionesExtra: string    // indicaciones adicionales que se le dan al agente en cada mensaje
  }
  planificador: { maxGrupos: number; maxPersonasPorGrupo: number }
  acceso: { registroAbierto: boolean; diasPapelera: number }
}

export const CONFIG_POR_DEFECTO: ConfigSistema = {
  chat: {
    activo: true,
    mensajeInactivo: 'El asistente está desactivado temporalmente. Inténtalo de nuevo más tarde.',
    webhookUrl: '',
    modelo: '',
    temperatura: 0.4,
    maxTokens: 0,
    ventanaMemoria: 9,
    maxCaracteresMensaje: 2000,
    timeoutSegundos: 60,
    instruccionesExtra: '',
  },
  planificador: { maxGrupos: 20, maxPersonasPorGrupo: 300 },
  acceso: { registroAbierto: true, diasPapelera: 30 },
}

const numero = (v: any, min: number, max: number, def: number, entero = true) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isFinite(n)) return def
  const c = Math.min(max, Math.max(min, n))
  return entero ? Math.round(c) : Math.round(c * 100) / 100
}
const texto = (v: any, max: number, def: string) => (typeof v === 'string' ? v.trim().slice(0, max) : def)
const booleano = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def)

/** Quita espacios, la barra final y un "/webhook/chat" pegado por error. '' si queda vacía. */
export function normalizarUrl(u: string): string {
  return u.trim().replace(/\/+$/, '').replace(/\/webhook\/chat$/i, '').replace(/\/+$/, '')
}
/** null si la dirección es válida (o está vacía); si no, el mensaje de error. */
export function validarUrl(u: string): string | null {
  const limpia = normalizarUrl(u)
  if (!limpia) return null
  try {
    const url = new URL(limpia)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'La dirección de n8n debe empezar con http:// o https://.'
    return null
  } catch { return 'La dirección de n8n no es válida. Ejemplo: http://localhost:5678' }
}

/** Mezcla lo recibido con la configuración base, corrigiendo valores fuera de rango o de tipo incorrecto. */
export function sanitizarConfig(entrada: any, base: ConfigSistema = CONFIG_POR_DEFECTO): ConfigSistema {
  const c = entrada?.chat ?? {}, p = entrada?.planificador ?? {}, a = entrada?.acceso ?? {}
  return {
    chat: {
      activo: booleano(c.activo, base.chat.activo),
      mensajeInactivo: texto(c.mensajeInactivo, 300, base.chat.mensajeInactivo) || CONFIG_POR_DEFECTO.chat.mensajeInactivo,
      webhookUrl: typeof c.webhookUrl === 'string' ? normalizarUrl(c.webhookUrl).slice(0, 300) : base.chat.webhookUrl,
      modelo: texto(c.modelo, 120, base.chat.modelo),
      temperatura: numero(c.temperatura, 0, 1, base.chat.temperatura, false),
      maxTokens: numero(c.maxTokens, 0, 32000, base.chat.maxTokens),
      ventanaMemoria: numero(c.ventanaMemoria, 1, 30, base.chat.ventanaMemoria),
      maxCaracteresMensaje: numero(c.maxCaracteresMensaje, 100, 5000, base.chat.maxCaracteresMensaje),
      timeoutSegundos: numero(c.timeoutSegundos, 10, 180, base.chat.timeoutSegundos),
      instruccionesExtra: texto(c.instruccionesExtra, 1500, base.chat.instruccionesExtra),
    },
    planificador: {
      maxGrupos: numero(p.maxGrupos, 1, 100, base.planificador.maxGrupos),
      maxPersonasPorGrupo: numero(p.maxPersonasPorGrupo, 1, 1000, base.planificador.maxPersonasPorGrupo),
    },
    acceso: {
      registroAbierto: booleano(a.registroAbierto, base.acceso.registroAbierto),
      diasPapelera: numero(a.diasPapelera, 7, 90, base.acceso.diasPapelera),
    },
  }
}

/** Lo que puede ver cualquier usuario con sesión (sin la parte de acceso). */
export const parteDeUsuario = (c: ConfigSistema) => ({ chat: c.chat, planificador: c.planificador })

/** Lee la configuración guardada. Si la tabla aún no existe (falta `prisma db push`) devuelve los valores por defecto. */
export async function leerConfigCompleta(): Promise<{ config: ConfigSistema; actualizadoPor: string | null; actualizadoEn: Date | null }> {
  try {
    const fila = await prisma.configuracionSistema.findUnique({ where: { id: 'principal' } })
    return { config: sanitizarConfig(fila?.datos, CONFIG_POR_DEFECTO), actualizadoPor: fila?.actualizadoPor ?? null, actualizadoEn: fila?.updatedAt ?? null }
  } catch (e) {
    console.error('No se pudo leer la configuración (¿falta ejecutar prisma db push?):', e)
    return { config: CONFIG_POR_DEFECTO, actualizadoPor: null, actualizadoEn: null }
  }
}
export async function leerConfig(): Promise<ConfigSistema> {
  return (await leerConfigCompleta()).config
}

export async function guardarConfig(config: ConfigSistema, actualizadoPor: string): Promise<void> {
  await prisma.configuracionSistema.upsert({
    where: { id: 'principal' },
    create: { id: 'principal', datos: config as any, actualizadoPor },
    update: { datos: config as any, actualizadoPor },
  })
}

/** Lista legible de lo que cambió entre dos configuraciones (para el registro de actividad). */
export function camposCambiados(antes: ConfigSistema, despues: ConfigSistema): string[] {
  const cambios: string[] = []
  for (const grupo of ['chat', 'planificador', 'acceso'] as const) {
    for (const clave of Object.keys(despues[grupo]) as string[]) {
      if ((antes as any)[grupo][clave] !== (despues as any)[grupo][clave]) cambios.push(`${grupo}.${clave}`)
    }
  }
  return cambios
}
