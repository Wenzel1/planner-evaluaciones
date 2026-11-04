// Verificación "¿cuánto es 7 + 4?" para el login y el registro (frena a los bots que prueban contraseñas o crean cuentas falsas).
// El servidor genera la suma y entrega un token FIRMADO con AUTH_SECRET que guarda la respuesta cifrada:
// el navegador nunca conoce la respuesta, el token no se puede falsificar, vence en 10 minutos y sirve una sola vez.
import crypto from 'crypto'

const VIGENCIA_MS = 10 * 60 * 1000
const usados = new Map<string, number>() // nonce → cuándo vence (para que un token no se reutilice)

function secreto(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) throw new Error('Falta AUTH_SECRET en .env (mínimo 16 caracteres).')
  return s
}
const firmar = (texto: string) => crypto.createHmac('sha256', secreto()).update(texto).digest('base64url')

export function crearDesafio(): { pregunta: string; token: string } {
  const a = crypto.randomInt(2, 20), b = crypto.randomInt(1, 10)
  const nonce = crypto.randomBytes(12).toString('base64url')
  const exp = Date.now() + VIGENCIA_MS
  const cuerpo = Buffer.from(JSON.stringify({ n: nonce, e: exp, r: firmar(`respuesta:${a + b}:${nonce}`) })).toString('base64url')
  return { pregunta: `${a} + ${b}`, token: `${cuerpo}.${firmar(cuerpo)}` }
}

const iguales = (x: string, y: string) => { const a = Buffer.from(x), b = Buffer.from(y); return a.length === b.length && crypto.timingSafeEqual(a, b) }

/** null si la respuesta es correcta; si no, el mensaje de error. Cada token se puede usar una sola vez. */
export function verificarDesafio(token: unknown, respuesta: unknown): string | null {
  const ahora = Date.now()
  for (const [n, vence] of usados) if (vence < ahora) usados.delete(n) // limpieza
  const [cuerpo, firma] = String(token ?? '').split('.')
  if (!cuerpo || !firma || !iguales(firma, firmar(cuerpo))) return 'Resuelve la suma de verificación.'
  let datos: { n: string; e: number; r: string }
  try { datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) } catch { return 'Resuelve la suma de verificación.' }
  if (!datos?.n || !datos.e || datos.e < ahora) return 'La suma de verificación venció. Resuelve la nueva.'
  if (usados.has(datos.n)) return 'Resuelve la nueva suma de verificación.'
  usados.set(datos.n, datos.e) // se gasta aunque la respuesta esté mal: cada intento pide una suma nueva
  const valor = String(respuesta ?? '').trim()
  if (!/^\d{1,3}$/.test(valor) || !iguales(firmar(`respuesta:${Number(valor)}:${datos.n}`), datos.r)) return 'La suma de verificación no es correcta.'
  return null
}
