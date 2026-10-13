// lib/validacionesUsuario.ts
// Validación de campos (alfabético, alfanumérico, formato) compartida entre cliente y servidor.

export const ROLES_VALIDOS = ['SUPERADMIN', 'ADMIN', 'USUARIO'] as const

export function validarNombre(nombre: string): string | null {
  const n = (nombre || '').trim()
  if (n.length < 3) return 'El nombre debe tener al menos 3 caracteres.'
  if (n.length > 60) return 'El nombre no puede superar 60 caracteres.'
  // Alfabético: letras (con tildes/ñ) y espacios
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(n)) return 'El nombre solo puede contener letras y espacios.'
  return null
}

export function validarEmail(email: string): string | null {
  const e = (email || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'El correo electrónico no es válido.'
  if (e.length > 100) return 'El correo es demasiado largo.'
  return null
}

export function validarPassword(password: string): string | null {
  const p = password || ''
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (p.length > 72) return 'La contraseña es demasiado larga.'
  // Alfanumérica: al menos una letra y un número
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'La contraseña debe combinar letras y números.'
  return null
}
