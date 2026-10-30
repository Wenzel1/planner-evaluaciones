// lib/csvEstudiantes.ts
// Lectura de archivos CSV de estudiantes (el que guarda Excel con "Guardar como → CSV"). Sin librerías.
// Acepta separador coma, punto y coma o tabulador (se detecta solo), comillas, BOM y la línea "sep=;" de Excel.

export interface FilaEstudiante { nombre: string; email: string; telefono: string; grupo: string }

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function parsearCSV(texto: string): string[][] {
  let t = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

  // Excel puede indicar el separador en una primera línea: sep=;
  let sep: string | null = null
  const pista = t.match(/^sep=(.)\n/i)
  if (pista) { sep = pista[1]; t = t.slice(pista[0].length) }
  if (!sep) {
    const primera = t.split('\n')[0] || ''
    const cuentas: [string, number][] = [[';', (primera.match(/;/g) || []).length], [',', (primera.match(/,/g) || []).length], ['\t', (primera.match(/\t/g) || []).length]]
    cuentas.sort((a, b) => b[1] - a[1])
    sep = cuentas[0][1] > 0 ? cuentas[0][0] : ','
  }

  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (entreComillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else entreComillas = false }
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === sep) { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}

// "Grupo B", "sección b" o "b" → "B"
function normalizarGrupo(v: string): string {
  const m = v.match(/^(?:grupo|seccion|sección|paralelo)?\s*([a-zA-Z])$/i)
  return m ? m[1].toUpperCase() : v
}

export function csvAEstudiantes(texto: string): { estudiantes: FilaEstudiante[]; tieneEncabezado: boolean } {
  const filas = parsearCSV(texto)
  if (filas.length === 0) return { estudiantes: [], tieneEncabezado: false }

  const alias: Record<keyof FilaEstudiante, string[]> = {
    nombre: ['nombre', 'nombres', 'nombre completo', 'name', 'estudiante'],
    email: ['email', 'correo', 'correo electronico', 'e-mail', 'mail'],
    telefono: ['telefono', 'celular', 'movil', 'tel', 'phone'],
    grupo: ['grupo', 'seccion', 'paralelo'],
  }
  const cab = filas[0].map(sinTildes)
  const idx = (k: keyof FilaEstudiante) => cab.findIndex((c) => alias[k].includes(c))
  const tieneEncabezado = idx('nombre') >= 0 || idx('email') >= 0

  const col = tieneEncabezado
    ? { nombre: idx('nombre'), email: idx('email'), telefono: idx('telefono'), grupo: idx('grupo') }
    : { nombre: 0, email: 1, telefono: 2, grupo: 3 }
  const datos = tieneEncabezado ? filas.slice(1) : filas
  const get = (f: string[], i: number) => (i >= 0 && i < f.length ? f[i].trim() : '')

  return {
    tieneEncabezado,
    estudiantes: datos.map((f) => ({
      nombre: get(f, col.nombre),
      email: get(f, col.email),
      telefono: get(f, col.telefono),
      grupo: normalizarGrupo(get(f, col.grupo)),
    })),
  }
}

// Plantilla que se descarga: abre bien en Excel de cualquier idioma gracias a la línea "sep=;"
export function plantillaCSV(): string {
  return '\uFEFFsep=;\nnombre;email;telefono;grupo\nAna Perez;ana@correo.com;3001234567;A\nLuis Gomez;luis@correo.com;3007654321;B\n'
}
