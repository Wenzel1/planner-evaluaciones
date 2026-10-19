// lib/passwordTemporal.ts
// Genera una clave temporal legible (sin caracteres confusos como 0/O o 1/l/I) que cumple las reglas de contraseña.
import { randomInt } from 'crypto'

const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITOS = '23456789'

export function generarPasswordTemporal(largo = 10): string {
  const pick = (alfabeto: string) => alfabeto[randomInt(alfabeto.length)]
  const chars = [pick(LETRAS), pick(LETRAS), pick(DIGITOS), pick(DIGITOS)]
  while (chars.length < largo) chars.push(pick(LETRAS + DIGITOS))
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] } // mezcla
  return chars.join('')
}
