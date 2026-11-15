// Cambios del plan que todavía no se avisaron a los estudiantes. Se anotan al guardar el plan y el profesor
// los envía juntos con «Avisar cambios». Se consolidan: si una evaluación nueva cambia de fecha antes de avisar,
// sigue siendo solo «nueva»; si se elimina sin haberse avisado, no queda nada que avisar.
import prisma from '@/lib/prisma'

export type TipoCambio = 'NUEVA' | 'FECHA' | 'PESO' | 'ELIMINADA'
export interface Cambio { seccion: string; evaluacionId: string; tipo: TipoCambio; nombre: string; antes?: string | null; despues?: string | null }

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '').slice(0, 200)

export async function anotarCambios(materiaId: string, cambios: Cambio[]) {
  for (const c of cambios) {
    const seccion = (c.seccion || 'A').toUpperCase()
    const pendientes = await prisma.cambioPlan.findMany({ where: { materiaId, evaluacionId: c.evaluacionId, avisadoEn: null } })
    const esNueva = pendientes.some(p => p.tipo === 'NUEVA')
    if (c.tipo === 'ELIMINADA') {
      if (pendientes.length) await prisma.cambioPlan.deleteMany({ where: { id: { in: pendientes.map(p => p.id) } } })
      if (!esNueva) await prisma.cambioPlan.create({ data: { materiaId, seccion, evaluacionId: c.evaluacionId, tipo: 'ELIMINADA', nombre: limpiar(c.nombre) } })
      continue
    }
    if (c.tipo === 'NUEVA') {
      if (!esNueva) await prisma.cambioPlan.create({ data: { materiaId, seccion, evaluacionId: c.evaluacionId, tipo: 'NUEVA', nombre: limpiar(c.nombre), despues: c.despues ?? null } })
      continue
    }
    if (esNueva) continue // se avisará como nueva, con sus datos actuales
    const mismo = pendientes.find(p => p.tipo === c.tipo)
    if (mismo) {
      // Volvió al valor que ya conocían los estudiantes: no hay nada que avisar
      if ((mismo.antes ?? '') === (c.despues ?? '')) await prisma.cambioPlan.delete({ where: { id: mismo.id } })
      else await prisma.cambioPlan.update({ where: { id: mismo.id }, data: { despues: c.despues ?? null, nombre: limpiar(c.nombre) } })
    } else {
      await prisma.cambioPlan.create({ data: { materiaId, seccion, evaluacionId: c.evaluacionId, tipo: c.tipo, nombre: limpiar(c.nombre), antes: c.antes ?? null, despues: c.despues ?? null } })
    }
  }
}

// Texto de un cambio para el correo y para la pantalla del estudiante
const ZONA = 'America/Caracas'
export const fechaCorta = (iso: string | null | undefined) => {
  if (!iso) return 'sin fecha'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? 'sin fecha' : new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}
export function textoCambio(c: { tipo: string; nombre: string; antes: string | null; despues: string | null }, datos?: { fecha?: string | null; peso?: number | null }) {
  if (c.tipo === 'NUEVA') return `Nueva: «${c.nombre}»${datos?.fecha ? ` · ${fechaCorta(datos.fecha)}` : ''}${datos?.peso != null ? ` · ${datos.peso}%` : ''}`
  if (c.tipo === 'FECHA') return `Cambió de fecha: «${c.nombre}» · del ${fechaCorta(c.antes)} al ${fechaCorta(c.despues)}`
  if (c.tipo === 'PESO') return `Cambió el peso: «${c.nombre}» · de ${c.antes ?? '—'}% a ${c.despues ?? '—'}%`
  if (c.tipo === 'ELIMINADA') return `Se quitó del plan: «${c.nombre}»`
  return `«${c.nombre}»`
}
