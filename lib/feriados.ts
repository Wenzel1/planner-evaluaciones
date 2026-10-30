// Feriados nacionales de Venezuela (fijos + Carnaval y Semana Santa, que se calculan a partir de la Pascua).
// El agente los usa para no proponer evaluaciones en esos días.

const FIJOS: [string, string][] = [
  ['01-01', 'Año Nuevo'], ['04-19', 'Declaración de la Independencia'], ['05-01', 'Día del Trabajador'],
  ['06-24', 'Batalla de Carabobo'], ['07-05', 'Día de la Independencia'], ['07-24', 'Natalicio de Simón Bolívar'],
  ['10-12', 'Día de la Resistencia Indígena'], ['12-24', 'Nochebuena'], ['12-25', 'Navidad'], ['12-31', 'Fin de año'],
]

// Domingo de Pascua (algoritmo de Meeus/Butcher, calendario gregoriano)
function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const mas = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

export function feriadosDelAnio(anio: number): { fecha: string; nombre: string }[] {
  const p = pascua(anio)
  const lista = [
    ...FIJOS.map(([md, nombre]) => ({ fecha: `${anio}-${md}`, nombre })),
    { fecha: ymd(mas(p, -48)), nombre: 'Lunes de Carnaval' }, { fecha: ymd(mas(p, -47)), nombre: 'Martes de Carnaval' },
    { fecha: ymd(mas(p, -3)), nombre: 'Jueves Santo' }, { fecha: ymd(mas(p, -2)), nombre: 'Viernes Santo' },
  ]
  return lista.sort((x, y) => x.fecha.localeCompare(y.fecha))
}

// Feriados entre dos fechas (YYYY-MM-DD, inclusive)
export function feriadosEntre(desde: string, hasta: string): { fecha: string; nombre: string }[] {
  const a1 = Number(desde.slice(0, 4)), a2 = Number(hasta.slice(0, 4))
  const todos: { fecha: string; nombre: string }[] = []
  for (let a = a1; a <= a2; a++) todos.push(...feriadosDelAnio(a))
  return todos.filter(f => f.fecha >= desde && f.fecha <= hasta)
}

export function esFeriado(fechaYmd: string): string | null {
  return feriadosDelAnio(Number(fechaYmd.slice(0, 4))).find(f => f.fecha === fechaYmd)?.nombre ?? null
}
