// Calendario .ics (RFC 5545) para que el estudiante agregue sus evaluaciones a su celular o a Google Calendar.
export interface EventoIcs { id: string; titulo: string; inicio: Date; duracionMin?: number | null; descripcion?: string; url?: string }

const fechaIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // 20261105T140000Z
const texto = (t: string) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// Líneas de máximo 75 bytes (las siguientes empiezan con espacio)
function plegar(linea: string): string {
  const partes: string[] = []
  let actual = ''
  for (const ch of linea) {
    if (Buffer.byteLength(actual + ch, 'utf8') > (partes.length ? 74 : 75)) { partes.push(actual); actual = ch } else actual += ch
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

export function generarIcs(nombreCalendario: string, eventos: EventoIcs[]): string {
  const ahora = fechaIcs(new Date())
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planificador de Evaluaciones//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${texto(nombreCalendario)}`]
  for (const e of eventos) {
    const fin = new Date(e.inicio.getTime() + Math.max(15, e.duracionMin || 60) * 60000)
    lineas.push(
      'BEGIN:VEVENT', `UID:${e.id}@planificador-evaluaciones`, `DTSTAMP:${ahora}`,
      `DTSTART:${fechaIcs(e.inicio)}`, `DTEND:${fechaIcs(fin)}`,
      `SUMMARY:${texto(e.titulo)}`,
      ...(e.descripcion ? [`DESCRIPTION:${texto(e.descripcion)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${texto(e.titulo)}`, 'TRIGGER:-P1D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${texto(e.titulo)}`, 'TRIGGER:-PT2H', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(plegar).join('\r\n') + '\r\n'
}
