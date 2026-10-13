// lib/password.ts
// Hash de contraseñas con scrypt (módulo nativo de Node, sin dependencias).
// Solo se usa en rutas de API (runtime Node), NO en middleware.
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(_scrypt) as (pwd: string, salt: Buffer, keylen: number) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, almacenado: string): Promise<boolean> {
  const [saltHex, hashHex] = almacenado.split(':')
  if (!saltHex || !hashHex) return false
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 64)
  const esperado = Buffer.from(hashHex, 'hex')
  return hash.length === esperado.length && timingSafeEqual(hash, esperado)
}
