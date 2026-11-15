// Archivos de las entregas en Supabase Storage (bucket privado).
// Variables (solo servidor): SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY y opcional SUPABASE_BUCKET_ENTREGAS (por defecto "entregas").
// Sin esas variables las entregas son solo por enlace (GitHub, Drive, Figma…).

// La dirección del proyecto puede estar como SUPABASE_URL o como NEXT_PUBLIC_SUPABASE_URL (la que crea la integración con Vercel)
// Solo el origen (https://xxxx.supabase.co): si la variable trae una ruta como /rest/v1, las peticiones de archivos
// irían a la base de datos y fallarían con "Invalid path specified in request URL".
const base = () => {
  const crudo = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  try { return new URL(crudo).origin } catch { return crudo.replace(/\/+$/, '') }
}
const clave = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const bucket = () => String(process.env.SUPABASE_BUCKET_ENTREGAS || 'entregas')

export const archivosConfigurados = () => !!(base() && clave())
// Los archivos van directo del navegador a Supabase (no pasan por Vercel, que solo acepta ~4,5 MB por petición).
// El bucket "entregas" debe permitir este tamaño (Supabase → Storage → entregas → Edit → File size limit).
export const MAX_ARCHIVO = 25 * 1024 * 1024
export const MAX_ARCHIVOS_POR_ENTREGA = 10
export const EXTENSIONES = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods', 'txt', 'md', 'csv', 'zip', 'rar', '7z', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'ogg', 'oga', 'opus', 'drawio', 'fig', 'sql', 'json', 'xml', 'yml', 'yaml', 'html', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'kt', 'c', 'h', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'dart', 'sh', 'ipynb', 'puml', 'uml', 'pkt', 'pka']

// Tipo de contenido por extensión. Lo que un navegador podría ejecutar (html, svg, js…) se guarda como texto plano.
const TIPOS: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf', zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', pkt: 'application/octet-stream', pka: 'application/octet-stream', csv: 'text/csv; charset=utf-8',
}
export const extensionDe = (nombre: string) => (String(nombre || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
export const tipoDeArchivo = (nombre: string) => TIPOS[extensionDe(nombre)] || (EXTENSIONES.includes(extensionDe(nombre)) ? 'text/plain; charset=utf-8' : 'application/octet-stream')

// Nombre seguro para la ruta (sin acentos ni símbolos)
export const nombreSeguro = (nombre: string) => String(nombre || 'archivo').replace(/[\\/]/g, '_').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-120)

const cabeceras = () => ({ Authorization: `Bearer ${clave()}`, apikey: clave() })
const rutaUrl = (ruta: string) => ruta.split('/').map(encodeURIComponent).join('/')

export async function subirArchivo(ruta: string, datos: Buffer, tipo: string): Promise<void> {
  const r = await fetch(`${base()}/storage/v1/object/${bucket()}/${rutaUrl(ruta)}`, {
    method: 'POST', headers: { ...cabeceras(), 'Content-Type': tipo || 'application/octet-stream', 'x-upsert': 'true' }, body: new Uint8Array(datos),
  })
  if (!r.ok) {
    const d: any = await r.json().catch(() => ({}))
    throw new Error(`No se pudo guardar el archivo (${r.status}${d?.message ? `: ${d.message}` : ''}). Revisa que exista el bucket «${bucket()}» en Supabase.`)
  }
}

// Enlace firmado para que el NAVEGADOR suba el archivo directo a Supabase (vale 2 horas, solo para esa ruta)
export async function enlaceDeSubida(ruta: string): Promise<string> {
  const r = await fetch(`${base()}/storage/v1/object/upload/sign/${bucket()}/${rutaUrl(ruta)}`, {
    method: 'POST', headers: { ...cabeceras(), 'Content-Type': 'application/json' }, body: '{}',
  })
  const d: any = await r.json().catch(() => ({}))
  const url = d?.url || d?.signedURL || d?.signedUrl
  if (!r.ok || !url) throw new Error(`No se pudo preparar la subida (${r.status}${d?.message ? `: ${d.message}` : ''}).`)
  return `${base()}/storage/v1${url.startsWith('/') ? '' : '/'}${url}`
}

// Enlace temporal (10 minutos) para ver o descargar un archivo privado
export async function enlaceArchivo(ruta: string, nombre?: string): Promise<string> {
  const r = await fetch(`${base()}/storage/v1/object/sign/${bucket()}/${rutaUrl(ruta)}`, {
    method: 'POST', headers: { ...cabeceras(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }),
  })
  const d: any = await r.json().catch(() => ({}))
  const firmado = d?.signedURL || d?.signedUrl
  if (!r.ok || !firmado) throw new Error('No se pudo abrir el archivo.')
  return `${base()}/storage/v1${firmado}${nombre ? `&download=${encodeURIComponent(nombre)}` : ''}`
}

// Contenido del archivo (para mostrar código o abrir un .zip en el visor). Límite para no cargar archivos enormes en memoria.
export async function leerArchivo(ruta: string, limite = 26 * 1024 * 1024): Promise<Buffer> {
  const r = await fetch(`${base()}/storage/v1/object/${bucket()}/${rutaUrl(ruta)}`, { headers: cabeceras() })
  if (!r.ok) throw new Error('No se encontró el archivo.')
  const largo = Number(r.headers.get('content-length') || 0)
  if (largo > limite) throw new Error('El archivo es demasiado grande para la vista previa.')
  return Buffer.from(await r.arrayBuffer())
}

// ¿Existe y cuánto pesa? (para comprobar que el navegador terminó de subirlo)
export async function infoArchivo(ruta: string): Promise<{ tamano: number } | null> {
  const r = await fetch(`${base()}/storage/v1/object/info/${bucket()}/${rutaUrl(ruta)}`, { headers: cabeceras() }).catch(() => null)
  if (!r?.ok) return null
  const d: any = await r.json().catch(() => ({}))
  return { tamano: Number(d?.size ?? d?.metadata?.size ?? 0) }
}

export async function borrarArchivo(ruta: string): Promise<void> {
  await fetch(`${base()}/storage/v1/object/${bucket()}`, { method: 'DELETE', headers: { ...cabeceras(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [ruta] }) }).catch(() => {})
}
