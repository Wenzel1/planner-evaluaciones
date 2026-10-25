// lib/permisos.ts
// Reglas de propiedad de los datos. Cada materia, estudiante y conversación tiene un dueño (usuarioId).
//  - LEER:     el dueño, o cualquier ADMIN / SUPERADMIN.
//  - ESCRIBIR: el dueño, o el SUPERADMIN (control total). Un ADMIN no edita el trabajo de otros.
//  - ELIMINAR: el dueño, o cualquier ADMIN / SUPERADMIN (moderación).
//  - Si el recurso es de otro y quien pregunta no puede ni leerlo, se responde 404 (no se revela que existe).
import { NextResponse } from 'next/server'
import { getActor, type Actor } from '@/lib/authServer'

export type ResultadoActor =
  | { actor: Actor; error?: undefined }
  | { actor?: undefined; error: NextResponse }

export async function requerirActor(request: Request): Promise<ResultadoActor> {
  const actor = await getActor(request)
  if (!actor) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  // Entró con una clave temporal: primero debe elegir una nueva (solo /api/perfil y /api/auth/* quedan disponibles)
  if (actor.debeCambiarPassword) {
    return { error: NextResponse.json({ error: 'Debes cambiar tu contraseña temporal antes de continuar.', codigo: 'CAMBIO_OBLIGATORIO' }, { status: 403 }) }
  }
  return { actor }
}

export const esAdminOSuper = (actor: Actor) => actor.rol === 'ADMIN' || actor.rol === 'SUPERADMIN'

export const puedeLeer = (actor: Actor, duenoId: string | null | undefined) =>
  actor.id === duenoId || esAdminOSuper(actor)

export const puedeEscribir = (actor: Actor, duenoId: string | null | undefined) =>
  actor.id === duenoId || actor.rol === 'SUPERADMIN'

export const puedeEliminar = (actor: Actor, duenoId: string | null | undefined) =>
  actor.id === duenoId || esAdminOSuper(actor)

export type ModoAcceso = 'leer' | 'escribir' | 'eliminar'

/** Devuelve null si tiene acceso, o la respuesta de error que hay que retornar. */
export function verificarAcceso(
  actor: Actor,
  duenoId: string | null | undefined,
  modo: ModoAcceso
): NextResponse | null {
  const permitido =
    modo === 'leer' ? puedeLeer(actor, duenoId) : modo === 'eliminar' ? puedeEliminar(actor, duenoId) : puedeEscribir(actor, duenoId)
  if (permitido) return null
  if (!puedeLeer(actor, duenoId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ error: 'Solo puedes modificar tus propios datos.' }, { status: 403 })
}

/** ¿Pidió la vista global (?todos=1) y tiene rol para verla? */
export function quiereTodos(request: Request, actor: Actor): boolean {
  return new URL(request.url).searchParams.get('todos') === '1' && esAdminOSuper(actor)
}
