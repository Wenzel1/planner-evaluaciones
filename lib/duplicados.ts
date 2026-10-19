// lib/duplicados.ts
// Prisma devuelve el error P2002 cuando se repite un valor único; esto dice cuál fue (correo o cédula).
export function mensajeDuplicado(e: any): string {
  const t = e?.meta?.target
  const campos = Array.isArray(t) ? t.join(',') : String(t ?? '')
  return campos.includes('cedula') ? 'Esa cédula ya está registrada.' : 'Ese correo ya está registrado.'
}
