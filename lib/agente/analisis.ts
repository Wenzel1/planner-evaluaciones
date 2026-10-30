// Análisis de una sección para el agente: cómo les fue por criterio de rúbrica, quiénes están en riesgo
// y carga de evaluaciones por semana. Todo se calcula con datos de la base (no con lo que manda el navegador).
import { normalizarRubrica, NIVELES_RUBRICA } from '@/lib/rubrica'

export interface EvalAnalisis {
  id: string; nombre: string; peso: number | null; estado: string; fecha: Date | null; rubrica: unknown
  calificaciones: { estudianteId: string; puntaje: number | null; detalle: unknown }[]
}
export interface EstudianteAnalisis { id: string; nombre: string }
export interface Riesgo { id: string; nombre: string; acumulado: number; maximo: number; necesita: number | null; final: number | null; evaluadas: number }

const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').trim()
const r1 = (n: number) => Math.round(n * 10) / 10

// Por cada evaluación con rúbrica y notas: % de estudiantes en cada nivel por criterio y el criterio más flojo
export function analisisPorCriterio(evs: EvalAnalisis[], numeroDe: (id: string) => number | undefined): string[] {
  const lineas: string[] = []
  for (const ev of evs) {
    const rub = normalizarRubrica(ev.rubrica)
    const conDetalle = ev.calificaciones.filter(c => Array.isArray(c.detalle) && (c.detalle as any[]).some(x => Number.isInteger(x)))
    if (!rub || conDetalle.length < 3) continue
    const partes: string[] = []
    let peor: { nombre: string; flojos: number } | null = null
    rub.criterios.forEach((c, i) => {
      const niveles = conDetalle.map(x => (x.detalle as any[])[i]).filter((x: any) => Number.isInteger(x)) as number[]
      if (!niveles.length) return
      const pct = (k: number) => Math.round((niveles.filter(n => n === k).length / niveles.length) * 100)
      const flojos = pct(2) + pct(3) // Regular + Deficiente
      partes.push(`${c.nombre}: ${pct(0)}% ${NIVELES_RUBRICA[0]}, ${pct(1)}% ${NIVELES_RUBRICA[1]}, ${flojos}% Regular o menos`)
      if (!peor || flojos > peor.flojos) peor = { nombre: c.nombre, flojos }
    })
    if (!partes.length) continue
    const n = numeroDe(ev.id)
    const p = peor as { nombre: string; flojos: number } | null
    lineas.push(`#${n ?? '?'} ${limpio(ev.nombre)} (${conDetalle.length} con rúbrica) → ${partes.join('; ')}.${p && p.flojos >= 40 ? ` Criterio más flojo: ${p.nombre} (${p.flojos}% Regular o menos).` : ''}`)
  }
  return lineas
}

// Para cada estudiante con al menos una nota: puntos acumulados (sobre 20), máximo posible y lo que necesita en lo que falta
export function estudiantesEnRiesgo(evs: EvalAnalisis[], estudiantes: EstudianteAnalisis[]): Riesgo[] {
  const vigentes = evs.filter(e => e.estado !== 'CANCELADA')
  const conPeso = vigentes.some(e => (e.peso ?? 0) > 0)
  const peso = (e: EvalAnalisis) => (conPeso ? Math.max(0, e.peso ?? 0) : 1)
  const total = vigentes.reduce((t, e) => t + peso(e), 0) || 1
  const lista: Riesgo[] = []
  for (const est of estudiantes) {
    let suma = 0, pesoHecho = 0, pesoFalta = 0, evaluadas = 0
    for (const e of vigentes) {
      const nota = e.calificaciones.find(c => c.estudianteId === est.id && c.puntaje != null)
      if (nota) { suma += (nota.puntaje as number) * peso(e); pesoHecho += peso(e); evaluadas++ } else pesoFalta += peso(e)
    }
    if (evaluadas === 0) continue
    const acumulado = suma / total
    const maximo = acumulado + (20 * pesoFalta) / total
    const necesita = pesoFalta > 0 ? Math.ceil(((10 * total - suma) / pesoFalta) * 10) / 10 : null
    const final = pesoFalta === 0 ? suma / (pesoHecho || 1) : null
    lista.push({ id: est.id, nombre: est.nombre, acumulado: r1(acumulado), maximo: r1(maximo), necesita, final: final == null ? null : r1(final), evaluadas })
  }
  return lista
}

// Quiénes preocupan: ya no alcanzan, terminaron reprobados, o necesitan 13 o más en lo que falta
export function filtrarRiesgo(lista: Riesgo[]): Riesgo[] {
  return lista
    .filter(r => (r.final != null && r.final < 10) || (r.necesita != null && r.necesita >= 13))
    .sort((a, b) => (b.necesita ?? 99) - (a.necesita ?? 99))
}

export function textoRiesgo(r: Riesgo): string {
  if (r.final != null) return `${r.nombre} (terminó con ${r.final})`
  if ((r.necesita ?? 0) > 20) return `${r.nombre} (ya no alcanza el 10: máximo posible ${r.maximo})`
  return `${r.nombre} (necesita ${r.necesita} de promedio en lo que falta)`
}

// Cuántas evaluaciones caen en cada semana (lunes a domingo)
export function cargaPorSemana(fechas: Date[], zona = process.env.ZONA_HORARIA || 'America/Caracas'): string[] {
  const porSemana = new Map<string, number>()
  const diaLocal = (f: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(f) // AAAA-MM-DD en la hora del profesor
  for (const f of fechas) {
    const d = new Date(diaLocal(f) + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    const k = d.toISOString().slice(0, 10)
    porSemana.set(k, (porSemana.get(k) || 0) + 1)
  }
  return [...porSemana.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `semana del ${k}: ${n}`)
}
