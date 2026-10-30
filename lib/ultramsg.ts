// WhatsApp directo con UltraMsg (sin n8n). Se usa si están ULTRAMSG_INSTANCE y ULTRAMSG_TOKEN en las variables de entorno;
// si no, la app sigue usando n8n como antes. UltraMsg pone los mensajes en cola y los envía de a uno.

export function ultramsgConfigurado(): boolean {
  return !!(process.env.ULTRAMSG_INSTANCE && process.env.ULTRAMSG_TOKEN)
}

function instancia(): string {
  const i = String(process.env.ULTRAMSG_INSTANCE || '').trim()
  return /^\d+$/.test(i) ? `instance${i}` : i // acepta "123456" o "instance123456"
}

// 0412-123.4567 → +584121234567 (mismo criterio que usaba n8n). Devuelve '' si no parece un número válido.
export function telefonoInternacional(t: string, pais = process.env.WHATSAPP_CODIGO_PAIS || '58'): string {
  let tel = String(t || '').replace(/\D/g, '')
  if (tel.startsWith('00')) tel = tel.slice(2)
  if (!tel.startsWith(pais)) {
    if (tel.startsWith('0')) tel = pais + tel.slice(1)
    else if (tel.length === 10) tel = pais + tel
  }
  return tel.length >= 11 && tel.length <= 15 ? `+${tel}` : ''
}

export async function enviarUltraMsg(m: { telefono: string; texto: string; documentoUrl?: string; archivo?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  const to = telefonoInternacional(m.telefono)
  if (!to) return { ok: false, error: 'Teléfono no válido' }
  const conDocumento = !!m.documentoUrl
  const datos = new URLSearchParams({ token: String(process.env.ULTRAMSG_TOKEN || ''), to })
  if (conDocumento) { datos.set('filename', m.archivo || 'Plan.pdf'); datos.set('document', m.documentoUrl!); datos.set('caption', m.texto.slice(0, 1000)) }
  else datos.set('body', m.texto.slice(0, 4000))
  try {
    const r = await fetch(`https://api.ultramsg.com/${instancia()}/messages/${conDocumento ? 'document' : 'chat'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: datos, signal: AbortSignal.timeout(20000),
    })
    const t = await r.text()
    let d: any = {}; try { d = JSON.parse(t) } catch { /* respuesta que no es JSON */ }
    // UltraMsg responde 200 aunque falle: lo que vale es "sent"
    if (r.ok && (d.sent === 'true' || d.sent === true)) return { ok: true, id: d.id ? String(d.id) : undefined }
    const motivo = d.error ? (typeof d.error === 'string' ? d.error : JSON.stringify(d.error)) : d.message || `HTTP ${r.status}`
    return { ok: false, error: String(motivo).slice(0, 250) }
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'UltraMsg no respondió a tiempo' : String(e?.message || e).slice(0, 200) }
  }
}

// Envía varios a la vez (de a `simultaneos`). UltraMsg igual los entrega en orden y con pausas.
export async function enviarVariosUltraMsg<T extends { telefono: string; texto: string; documentoUrl?: string; archivo?: string }>(
  mensajes: T[], alTerminar: (m: T, r: { ok: boolean; error?: string }) => Promise<void> | void, simultaneos = 4,
): Promise<{ enviados: number; fallidos: number; primerError?: string }> {
  let i = 0, enviados = 0, fallidos = 0
  let primerError: string | undefined
  const trabajador = async () => {
    while (i < mensajes.length) {
      const m = mensajes[i++]
      const r = await enviarUltraMsg(m)
      if (r.ok) enviados++; else { fallidos++; primerError ??= r.error }
      await alTerminar(m, r)
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultaneos, mensajes.length) }, trabajador))
  return { enviados, fallidos, primerError }
}
