// Notas (escala de 1 a 20) y promedio ponderado de cada estudiante.
import prisma from '@/lib/prisma'

export const NOTA_MAXIMA = 20
export const NOTA_APROBATORIA = 10

export function redondearNota(n: number): number {
  return Math.round(n * 100) / 100
}

// Promedio ponderado por el peso (%) de cada evaluación calificada. Si ninguna tiene peso, promedio simple.
export function promedioPonderado(notas: { puntaje: number; peso: number | null }[]): number {
  if (notas.length === 0) return 0
  const conPeso = notas.filter(n => (n.peso ?? 0) > 0)
  if (conPeso.length === 0) return redondearNota(notas.reduce((t, n) => t + n.puntaje, 0) / notas.length)
  const pesoTotal = conPeso.reduce((t, n) => t + (n.peso as number), 0)
  return redondearNota(conPeso.reduce((t, n) => t + n.puntaje * (n.peso as number), 0) / pesoTotal)
}

// Recalcula y guarda Estudiante.promedio (sobre 20) con todas sus notas cargadas.
// Las evaluaciones canceladas no cuentan.
export async function recalcularPromedios(estudianteIds: string[]) {
  const ids = [...new Set(estudianteIds)].filter(Boolean)
  for (const id of ids) {
    const cal = await prisma.calificacion.findMany({
      where: { estudianteId: id, puntaje: { not: null }, evaluacion: { estado: { not: 'CANCELADA' } } },
      select: { puntaje: true, evaluacion: { select: { peso: true } } },
    })
    const promedio = promedioPonderado(cal.map(c => ({ puntaje: c.puntaje as number, peso: c.evaluacion.peso })))
    await prisma.estudiante.update({ where: { id }, data: { promedio } }).catch(() => {})
  }
}

export function textoNota(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',')
}
