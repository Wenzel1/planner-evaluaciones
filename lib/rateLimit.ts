// lib/rateLimit.ts
// Límite simple de intentos de login en memoria (por instancia del servidor).
const intentos = new Map<string, { n: number; hasta: number }>()
const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000

export function bloqueado(clave: string, max: number = MAX_INTENTOS): boolean {
  const r = intentos.get(clave)
  if (!r) return false
  if (Date.now() > r.hasta) { intentos.delete(clave); return false }
  return r.n >= max
}
/** Minutos que faltan para que se libere una clave bloqueada (mínimo 1). */
export function minutosRestantes(clave: string): number {
  const r = intentos.get(clave)
  return r ? Math.max(1, Math.ceil((r.hasta - Date.now()) / 60000)) : 1
}
export function registrarFallo(clave: string) {
  const r = intentos.get(clave)
  if (!r || Date.now() > r.hasta) intentos.set(clave, { n: 1, hasta: Date.now() + VENTANA_MS })
  else r.n += 1
}
export function limpiar(clave: string) { intentos.delete(clave) }
