// lib/papelera.ts
// Papelera de reciclaje: lo eliminado se conserva 30 días y el dueño puede restaurarlo.
import prisma from '@/lib/prisma'

export const DIAS_PAPELERA = 30
export const fechaLimitePapelera = (ahora: Date = new Date()) => new Date(ahora.getTime() - DIAS_PAPELERA * 24 * 60 * 60 * 1000)

export interface EntradaPapelera {
  usuarioId: string
  tipo: 'EVALUACION' | 'ESTUDIANTE'
  nombre: string
  contexto?: string | null
  datos: Record<string, any>
  eliminadoPorId?: string | null
  eliminadoPorNombre: string
}

// Nunca rompe la operación principal: si falla, solo avisa en la consola del servidor.
export async function enviarAPapelera(items: EntradaPapelera[]): Promise<void> {
  if (items.length === 0) return
  try {
    await prisma.papeleraItem.createMany({
      data: items.map((i) => ({
        usuarioId: i.usuarioId,
        tipo: i.tipo,
        nombre: i.nombre,
        contexto: i.contexto ?? null,
        datos: i.datos as any,
        eliminadoPorId: i.eliminadoPorId ?? null,
        eliminadoPorNombre: i.eliminadoPorNombre,
      })),
    })
  } catch (e) {
    console.error('No se pudo enviar a la papelera:', e)
  }
}

/**
 * Al guardar un plan, el frontend envía TODAS las evaluaciones (no avisa cuáles borró).
 * Aquí se deduce cuáles de las que ya existían ya no vienen:
 *  1) se emparejan por sección + nombre;
 *  2) las que quedan sin pareja se emparejan por sección + posición (así un cambio de nombre NO cuenta como borrado);
 *  3) las que siguen sin pareja se consideran eliminadas.
 */
export function detectarEliminadas<T extends { grupoSeccion: string; nombre: string; orden: number | null }>(
  existentes: T[],
  entrantes: { grupoSeccion?: string | null; nombre: string; orden?: number | null }[]
): T[] {
  const usados = new Set<number>()
  const sec = (g?: string | null) => g || 'A'
  const sinPareja: T[] = []

  for (const ex of existentes) {
    const i = entrantes.findIndex((en, idx) => !usados.has(idx) && sec(en.grupoSeccion) === sec(ex.grupoSeccion) && en.nombre === ex.nombre)
    if (i >= 0) usados.add(i)
    else sinPareja.push(ex)
  }

  const eliminadas: T[] = []
  for (const ex of sinPareja) {
    const i = entrantes.findIndex(
      (en, idx) => !usados.has(idx) && sec(en.grupoSeccion) === sec(ex.grupoSeccion) && ex.orden != null && en.orden != null && en.orden === ex.orden
    )
    if (i >= 0) usados.add(i)
    else eliminadas.push(ex)
  }
  return eliminadas
}
