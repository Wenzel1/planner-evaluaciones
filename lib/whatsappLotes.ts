// Envíos de WhatsApp en lote (plan de acción y recordatorios).
// La app crea un registro por mensaje (EnvioWhatsApp) y le pasa la lista a n8n (webhook "whatsapp-lote").
// n8n responde enseguida y envía los mensajes de a uno, con unos segundos de espera entre cada uno
// (para no parecer spam), y avisa el resultado de cada mensaje a /api/whatsapp/estado.
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { direccionN8n } from '@/lib/codigoWhatsapp'
import { ultramsgConfigurado, enviarVariosUltraMsg } from '@/lib/ultramsg'

export const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Caracas'

export interface MensajeLote {
  id: string
  telefono: string
  texto: string
  documentoUrl?: string
  archivo?: string
}

export function nuevoId(): string {
  return crypto.randomUUID()
}

export function primerNombre(nombre: string): string {
  return String(nombre || '').trim().split(/\s+/)[0] || ''
}

// Clave compartida con n8n (la misma del código de verificación)
export function claveN8n(): string {
  return process.env.N8N_CLAVE_WHATSAPP || ''
}

// Dirección pública de esta app (para que n8n y UltraMsg puedan llamarla)
export function origenApp(request: Request): string {
  const env = (process.env.APP_URL || '').trim().replace(/\/+$/, '')
  if (env) return env
  return new URL(request.url).origin
}

// Quita el prefijo "Evaluación 1:" del nombre guardado
export function nombreLimpio(nombre: string): string {
  return String(nombre || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').trim() || 'Evaluación'
}

export function fechaBonita(fecha: Date): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: ZONA_HORARIA, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  }).format(fecha)
}

// Envía el lote a n8n. Si n8n no lo acepta, marca todos los mensajes como FALLIDO y devuelve el motivo.
export async function enviarLoteN8n(request: Request, mensajes: MensajeLote[]): Promise<{ ok: boolean; error?: string }> {
  if (mensajes.length === 0) return { ok: true }
  // Vía directa (sin n8n): si están las variables de UltraMsg, se envía desde aquí y se registra el resultado de cada mensaje
  if (ultramsgConfigurado()) {
    const r = await enviarVariosUltraMsg(mensajes, async (m, res) => {
      await prisma.envioWhatsApp.updateMany({
        where: { id: m.id, estado: 'PENDIENTE' },
        data: res.ok ? { estado: 'ENVIADO', enviadoEn: new Date(), error: null } : { estado: 'FALLIDO', error: String(res.error || 'No se pudo enviar').slice(0, 300) },
      }).catch(() => {})
    })
    if (r.enviados === 0) {
      const error = `UltraMsg no envió ningún mensaje: ${r.primerError || 'motivo desconocido'} (revisa ULTRAMSG_INSTANCE, ULTRAMSG_TOKEN y que el QR siga conectado).`
      console.error('[WhatsApp lote]', error)
      return { ok: false, error }
    }
    if (r.fallidos) console.error(`[WhatsApp lote] ${r.fallidos} de ${mensajes.length} fallaron. Primer motivo: ${r.primerError}`)
    return { ok: true }
  }
  const base = await direccionN8n()
  const clave = claveN8n()
  let error = ''
  if (!base) error = 'No hay dirección de n8n (N8N_URL o NEXT_PUBLIC_N8N_URL).'
  else if (!clave) error = 'Falta N8N_CLAVE_WHATSAPP en las variables de entorno.'
  else {
    try {
      const r = await fetch(`${base}/webhook/whatsapp-lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clave-app': clave },
        body: JSON.stringify({ callbackUrl: `${origenApp(request)}/api/whatsapp/estado`, mensajes }),
        signal: AbortSignal.timeout(55000), // Render gratis puede tardar en despertar
      })
      const texto = await r.text()
      if (!r.ok) {
        error = r.status === 404
          ? 'n8n no tiene activo el webhook "whatsapp-lote" (importa y publica el workflow de envíos).'
          : r.status === 401 || r.status === 403
            ? 'La clave x-clave-app del webhook "whatsapp-lote" no coincide con N8N_CLAVE_WHATSAPP.'
            : `n8n respondió ${r.status}: ${texto.slice(0, 200)}`
      }
    } catch (e: any) {
      error = e?.name === 'TimeoutError' ? 'n8n no respondió a tiempo (¿dormido en Render?). Intenta de nuevo en un minuto.' : `No se pudo contactar a n8n: ${e?.message || e}`
    }
  }
  if (error) {
    console.error('[WhatsApp lote]', error)
    await prisma.envioWhatsApp.updateMany({
      where: { id: { in: mensajes.map(m => m.id) }, estado: 'PENDIENTE' },
      data: { estado: 'FALLIDO', error: error.slice(0, 300) },
    })
    return { ok: false, error }
  }
  return { ok: true }
}
