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

// Dirección base de n8n, buscada en el mismo orden que usa el chat (+ N8N_URL, solo del servidor).
// Acepta tanto "https://mi-n8n.onrender.com" como "https://mi-n8n.onrender.com/webhook/chat".
export async function direccionN8n(): Promise<string> {
  const candidatas: string[] = [process.env.N8N_URL || '']
  try {
    const cfg: any = await leerConfig()
    candidatas.push(cfg?.chat?.webhookUrl || '')
  } catch { /* si la configuración no se puede leer, se siguen probando las variables */ }
  candidatas.push(process.env.NEXT_PUBLIC_N8N_URL || '')

  const enProduccion = !!process.env.VERCEL || process.env.NODE_ENV === 'production'
  for (const c of candidatas) {
    const limpia = c.trim().replace(/\/+$/, '').replace(/\/webhook(-test)?\/[^/]*$/, '')
    if (!limpia) continue
    // En Vercel, "localhost" nunca llega a n8n: se salta y se prueba la siguiente
    if (enProduccion && /\/\/(localhost|127\.0\.0\.1)/.test(limpia)) continue
    return limpia
  }
  return ''
}

// Pide a n8n que envíe el código por WhatsApp. Devuelve true solo si n8n confirma el envío.
// Nunca lanza error: si falla, la cuenta queda creada y la persona puede pedir "Reenviar código".
// Los motivos de fallo se ven en Vercel → tu proyecto → Logs (buscar "[WhatsApp]").
export async function enviarCodigoWhatsApp(datos: { telefono: string; nombre: string; codigo: string }): Promise<boolean> {
  const base = await direccionN8n()
  const clave = process.env.N8N_CLAVE_WHATSAPP
  if (!base) { console.error('[WhatsApp] No hay dirección de n8n: define N8N_URL o NEXT_PUBLIC_N8N_URL en Vercel y vuelve a desplegar.'); return false }
  if (!clave) { console.error('[WhatsApp] Falta N8N_CLAVE_WHATSAPP en las variables de Vercel (y luego hay que volver a desplegar).'); return false }

  const url = `${base}/webhook/codigo-whatsapp`
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-clave-app': clave },
      body: JSON.stringify({ telefono: datos.telefono, nombre: datos.nombre, codigo: datos.codigo, minutos: CODIGO_MINUTOS }),
      // Render (plan gratis) puede tardar ~50 s en despertar si n8n estaba dormido
      signal: AbortSignal.timeout(55000),
    })
    const texto = await r.text()
    let d: any = {}
    try { d = JSON.parse(texto) } catch { /* respuesta que no es JSON */ }
    if (r.ok && d?.ok === true) return true

    const pista =
      r.status === 404 ? 'n8n no tiene ese webhook activo: publica/activa el workflow con el nodo "Código WhatsApp" (y que la ruta sea codigo-whatsapp).' :
      r.status === 401 || r.status === 403 ? 'la clave no coincide: la credencial Header Auth del webhook debe llamarse x-clave-app y tener el mismo valor que N8N_CLAVE_WHATSAPP.' :
      r.status === 502 ? 'n8n recibió la petición pero UltraMsg no envió el mensaje (revisa instancia, token y que el QR siga conectado).' :
      r.status >= 500 ? 'el workflow falló dentro de n8n (mira la ejecución en n8n).' : ''
    console.error(`[WhatsApp] ${url} respondió ${r.status}. ${pista} Respuesta: ${texto.slice(0, 300)}`)
    return false
  } catch (e: any) {
    console.error(`[WhatsApp] No se pudo conectar con ${url}: ${e?.name === 'TimeoutError' ? 'tiempo agotado (¿n8n dormido en Render?)' : e?.message || e}`)
    return false
  }
}
