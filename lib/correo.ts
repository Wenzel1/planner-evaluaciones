// Envío de correos con Gmail (SMTP + "contraseña de aplicación"). Gratis, ~500 correos al día.
// Los correos salen DESDE una cuenta real de Gmail (firmados por Google), por eso llegan a la bandeja de entrada.
//
// Variables de entorno (solo servidor):
//   GMAIL_USER          la cuenta que envía, ej. planificador.evaluaciones@gmail.com
//   GMAIL_APP_PASSWORD  contraseña de aplicación de 16 letras (Cuenta de Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones)
//   CORREO_NOMBRE       (opcional) nombre del remitente; por defecto "Planificador de Evaluaciones"
//
// Si estas variables existen, la app usa el CORREO para todos los avisos (códigos, plan, notas, recordatorios).
// Si no existen, sigue usando WhatsApp (UltraMsg o n8n) como antes.
import nodemailer, { type Transporter } from 'nodemailer'
import dns from 'node:dns/promises'

export type Canal = 'correo' | 'whatsapp'

export function correoConfigurado(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

/** Canal que usa la app para avisar a profesores y estudiantes. */
export function canalMensajes(): Canal {
  return correoConfigurado() ? 'correo' : 'whatsapp'
}

/** "correo" o "WhatsApp", para los textos y el registro de actividad. */
export const nombreCanal = () => (correoConfigurado() ? 'correo' : 'WhatsApp')

const EMAIL =/^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const correoValido = (e: string | null | undefined) => EMAIL.test(String(e || '').trim())

/** "adrian.lara@gmail.com" → "ad•••@gmail.com" (para mostrar a dónde se envió un código sin revelar el correo completo). */
export function ocultarCorreo(e: string): string {
  const [u, d] = String(e || '').split('@')
  return d ? `${u.slice(0, 2)}•••@${d}` : ''
}

const SMTP_GMAIL = 'smtp.gmail.com'
let transporte: Promise<Transporter> | null = null

// nodemailer resuelve el nombre del servidor con su propio DNS (pregunta directo a los servidores DNS configurados).
// En algunas computadoras (VPN, antivirus o bloqueadores con un DNS local en 127.0.0.1) esa consulta se queda sin respuesta
// y el correo falla con "DNS lookup for smtp.gmail.com timed out", aunque el navegador funcione.
// Por eso aquí se resuelve con el DNS del sistema (el mismo que usa el navegador) y se le pasa la IP a nodemailer.
// "servername" mantiene la verificación del certificado TLS de Gmail.
async function direccionGmail(): Promise<string> {
  try { return (await dns.lookup(SMTP_GMAIL, { family: 4 })).address } catch { return SMTP_GMAIL }
}

function obtenerTransporte(): Promise<Transporter> {
  if (!transporte) {
    transporte = direccionGmail().then(host => nodemailer.createTransport({
      host,
      port: 465,
      secure: true,
      tls: { servername: SMTP_GMAIL },
      pool: true,          // reutiliza la conexión cuando se envían varios seguidos
      maxConnections: 3,
      auth: { user: String(process.env.GMAIL_USER || '').trim(), pass: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') },
    }))
  }
  return transporte
}

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Convierte el texto de los avisos (con *negritas* estilo WhatsApp, saltos de línea y enlaces) en un HTML sencillo. */
export function htmlDesdeTexto(texto: string, titulo?: string): string {
  const cuerpo = escapar(texto)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#4f46e5">$1</a>')
    .replace(/\n/g, '<br>')
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
${titulo ? `<p style="margin:0 0 16px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6366f1;font-weight:bold">${escapar(titulo)}</p>` : ''}
<div style="font-size:15px;line-height:1.6;color:#1f2937">${cuerpo}</div>
</div>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#9ca3af;text-align:center">Mensaje enviado por el Planificador de Evaluaciones. Si no esperabas este correo, puedes ignorarlo.</p>
</body></html>`
}

/** Texto plano sin la marca de negritas. */
const textoPlano = (t: string) => t.replace(/\*([^*\n]+)\*/g, '$1')

export interface Correo { para: string; asunto: string; texto: string; responderA?: string | null }

export async function enviarCorreo(c: Correo): Promise<{ ok: boolean; error?: string }> {
  if (!correoConfigurado()) return { ok: false, error: 'Faltan GMAIL_USER y GMAIL_APP_PASSWORD en las variables de entorno.' }
  const para = String(c.para || '').trim()
  if (!correoValido(para)) return { ok: false, error: 'Correo no válido' }
  try {
    await (await obtenerTransporte()).sendMail({
      from: { name: process.env.CORREO_NOMBRE || 'Planificador de Evaluaciones', address: String(process.env.GMAIL_USER) },
      to: para,
      ...(c.responderA && correoValido(c.responderA) ? { replyTo: c.responderA } : {}), // si el estudiante responde, le llega al profesor
      subject: c.asunto.slice(0, 150),
      text: textoPlano(c.texto),
      html: htmlDesdeTexto(c.texto, c.asunto),
    })
    return { ok: true }
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|EDNS|ENOTFOUND|ESOCKET/i.test(`${e?.code} ${msg}`)) transporte = null // la próxima vez se vuelve a conectar desde cero
    const pista = /Invalid login|Username and Password not accepted|EAUTH/i.test(msg)
      ? 'Gmail rechazó el usuario o la contraseña de aplicación (revisa GMAIL_USER y GMAIL_APP_PASSWORD).'
      : /limit|quota|rate/i.test(msg) ? 'Gmail alcanzó su límite diario de envíos. Se renueva en 24 horas.' : msg
    console.error(`[Correo] no se pudo enviar a ${para}: ${msg}`)
    return { ok: false, error: pista.slice(0, 250) }
  }
}

/** Envía varios correos (de a `simultaneos`) y avisa el resultado de cada uno. */
export async function enviarVariosCorreos<T extends Correo>(
  correos: T[], alTerminar: (c: T, r: { ok: boolean; error?: string }) => Promise<void> | void, simultaneos = 3,
): Promise<{ enviados: number; fallidos: number; primerError?: string }> {
  let i = 0, enviados = 0, fallidos = 0
  let primerError: string | undefined
  const trabajador = async () => {
    while (i < correos.length) {
      const c = correos[i++]
      const r = await enviarCorreo(c)
      if (r.ok) enviados++; else { fallidos++; primerError ??= r.error }
      await alTerminar(c, r)
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultaneos, correos.length) }, trabajador))
  return { enviados, fallidos, primerError }
}
