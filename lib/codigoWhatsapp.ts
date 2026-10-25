// Código de verificación por WhatsApp para las cuentas nuevas.
// - El código (6 dígitos) se guarda cifrado con HMAC-SHA256 usando AUTH_SECRET: si alguien lee la base de datos no lo ve.
// - El envío lo hace n8n (webhook "codigo-whatsapp"), protegido con una clave compartida en el encabezado x-clave-app.
import crypto from 'crypto'
import { leerConfig } from '@/lib/configuracion'

export const CODIGO_MINUTOS = 10       // tiempo de validez del código
export const CODIGO_MAX_INTENTOS = 5   // intentos fallidos antes de tener que pedir uno nuevo
export const REENVIO_SEGUNDOS = 60     // espera mínima entre dos envíos a la misma cuenta

export function generarCodigo(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashCodigo(codigo: string): string {
  const secreto = process.env.AUTH_SECRET
  if (!secreto) throw new Error('Falta AUTH_SECRET en las variables de entorno')
  return crypto.createHmac('sha256', secreto).update(String(codigo)).digest('hex')
}

export function codigoCoincide(codigo: string, hashGuardado: string | null | undefined): boolean {
  if (!hashGuardado || !/^\d{6}$/.test(String(codigo))) return false
  const a = Buffer.from(hashCodigo(codigo), 'hex')
  const b = Buffer.from(hashGuardado, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Datos para guardar en el usuario cada vez que se genera un código nuevo
export function nuevoCodigoParaGuardar() {
  const codigo = generarCodigo()
  return {
    codigo,
    data: {
      codigoHash: hashCodigo(codigo),
      codigoExpira: new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000),
      codigoIntentos: 0,
      codigoEnviadoEn: new Date(),
    },
  }
}

// Pide a n8n que envíe el código por WhatsApp. Devuelve true solo si n8n confirma el envío.
// Nunca lanza error: si falla, la cuenta queda creada y la persona puede pedir "Reenviar código".
export async function enviarCodigoWhatsApp(datos: { telefono: string; nombre: string; codigo: string }): Promise<boolean> {
  try {
    let base = process.env.N8N_URL || ''
    if (!base) {
      const cfg: any = await leerConfig()
      base = cfg?.chat?.webhookUrl || ''
    }
    base = base.replace(/\/+$/, '')
    const clave = process.env.N8N_CLAVE_WHATSAPP
    if (!base || !clave) {
      console.error('[WhatsApp] Falta N8N_URL (o la dirección de n8n en Configuración) o N8N_CLAVE_WHATSAPP: no se envió el código.')
      return false
    }
    const r = await fetch(`${base}/webhook/codigo-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clave-app': clave },
      body: JSON.stringify({ telefono: datos.telefono, nombre: datos.nombre, codigo: datos.codigo, minutos: CODIGO_MINUTOS }),
      signal: AbortSignal.timeout(15000),
    })
    const d: any = await r.json().catch(() => ({}))
    if (!r.ok || d?.ok !== true) {
      console.error('[WhatsApp] n8n no pudo enviar el código:', r.status, d?.error || '')
      return false
    }
    return true
  } catch (e) {
    console.error('[WhatsApp] Error al contactar a n8n:', e)
    return false
  }
}
