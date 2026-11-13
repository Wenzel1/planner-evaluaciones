// Responde a lo que necesita el visor de entregas (del profesor y del estudiante):
//   modo=url        → enlaces temporales para verlo dentro del programa y para descargarlo
//   modo=texto      → el contenido (código, txt, csv…) para mostrarlo con colores
//   modo=zip        → la lista de archivos que trae un .zip
//   modo=zipentrada → el contenido de un archivo de texto dentro del .zip (&entrada=ruta/dentro.js)
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { enlaceArchivo, leerArchivo, extensionDe } from '@/lib/almacenamiento'

const MAX_TEXTO = 400 * 1024 // lo que se muestra de un archivo de texto (lo demás se descarga)

// ¿Parece texto? (sin bytes nulos en el comienzo)
const esTexto = (b: Buffer) => !b.subarray(0, 4000).includes(0)

export async function responderArchivo(request: Request, archivo: { ruta: string; nombre: string; tipo?: string | null; tamano?: number | null }) {
  const q = new URL(request.url).searchParams
  const modo = q.get('modo') || 'redirigir'
  if (modo === 'url') {
    const [ver, descargar] = await Promise.all([enlaceArchivo(archivo.ruta), enlaceArchivo(archivo.ruta, archivo.nombre)])
    return NextResponse.json({ ver, descargar, nombre: archivo.nombre, tipo: archivo.tipo || null, tamano: archivo.tamano ?? null, extension: extensionDe(archivo.nombre) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (modo === 'texto') {
    const b = await leerArchivo(archivo.ruta, 5 * 1024 * 1024)
    if (!esTexto(b)) return NextResponse.json({ error: 'Este archivo no es de texto.' }, { status: 415 })
    return NextResponse.json({ texto: b.subarray(0, MAX_TEXTO).toString('utf8'), cortado: b.length > MAX_TEXTO, tamano: b.length })
  }
  if (modo === 'zip' || modo === 'zipentrada') {
    if (extensionDe(archivo.nombre) !== 'zip') return NextResponse.json({ error: 'No es un .zip.' }, { status: 400 })
    const zip = await JSZip.loadAsync(await leerArchivo(archivo.ruta))
    if (modo === 'zip') {
      const entradas: { ruta: string; carpeta: boolean; tamano: number | null }[] = []
      zip.forEach((ruta, f) => { if (entradas.length < 800 && !ruta.startsWith('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(ruta)) entradas.push({ ruta, carpeta: f.dir, tamano: (f as any)._data?.uncompressedSize ?? null }) })
      return NextResponse.json({ entradas, total: Object.keys(zip.files).length })
    }
    const entrada = String(q.get('entrada') || '')
    const f = zip.file(entrada)
    if (!f) return NextResponse.json({ error: 'No está en el .zip.' }, { status: 404 })
    const b = Buffer.from(await f.async('uint8array'))
    if (!esTexto(b)) return NextResponse.json({ error: 'Ese archivo no se puede mostrar como texto. Descarga el .zip para abrirlo.' }, { status: 415 })
    return NextResponse.json({ texto: b.subarray(0, MAX_TEXTO).toString('utf8'), cortado: b.length > MAX_TEXTO, tamano: b.length })
  }
  // Por defecto: abrirlo (o descargarlo con &descargar=1) en otra pestaña
  return NextResponse.redirect(await enlaceArchivo(archivo.ruta, q.get('descargar') ? archivo.nombre : undefined))
}
