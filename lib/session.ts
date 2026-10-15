// lib/session.ts
// Sesión firmada con HMAC-SHA256 usando Web Crypto (funciona en middleware/Edge y en rutas Node).
// No requiere instalar librerías.

export type Rol = 'SUPERADMIN' | 'ADMIN' | 'USUARIO'

export interface SesionPayload {
  sub: string
  nombre: string
  email: string
  rol: Rol
  exp: number // segundos desde epoch
  ini?: number // cuándo se inició la sesión (login); se conserva al renovar para respetar el tope absoluto
}

export const COOKIE_SESION = 'session'
export const DURACION_SESION_SEG = 60 * 60 * 8 // 8 horas
export const LIMITE_ABSOLUTO_SEG = 60 * 60 * 24 // una sesión nunca dura más de 24 h desde el login, aunque se renueve

const encoder = new TextEncoder()

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('Falta AUTH_SECRET en .env (mínimo 16 caracteres).')
  }
  return secret
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function crearToken(data: Omit<SesionPayload, 'exp' | 'ini'>, ini?: number): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000)
  const inicio = ini ?? ahora
  const payload: SesionPayload = { ...data, ini: inicio, exp: Math.min(ahora + DURACION_SESION_SEG, inicio + LIMITE_ABSOLUTO_SEG) }
  const cuerpo = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const firma = await crypto.subtle.sign('HMAC', await getKey(), encoder.encode(cuerpo))
  return `${cuerpo}.${b64urlEncode(new Uint8Array(firma))}`
}

export async function verificarToken(token: string | undefined | null): Promise<SesionPayload | null> {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const [cuerpo, firma] = partes
  try {
    const valido = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      b64urlDecode(firma),
      encoder.encode(cuerpo)
    )
    if (!valido) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(cuerpo))) as SesionPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export const esAdminOSuperadmin = (rol?: string) => rol === 'ADMIN' || rol === 'SUPERADMIN'

// ----- Sesión deslizante: mientras la persona siga usando la app, la sesión se renueva sola -----
const inicioDe = (p: SesionPayload) => p.ini ?? p.exp - DURACION_SESION_SEG

/** Se renueva cuando ya pasó más de la mitad de la duración y todavía no se llegó al tope absoluto. */
export function debeRenovar(p: SesionPayload, ahora: number = Math.floor(Date.now() / 1000)): boolean {
  return p.exp - ahora < DURACION_SESION_SEG / 2 && p.exp < inicioDe(p) + LIMITE_ABSOLUTO_SEG
}

export async function renovarToken(p: SesionPayload): Promise<string> {
  return crearToken({ sub: p.sub, nombre: p.nombre, email: p.email, rol: p.rol }, inicioDe(p))
}
