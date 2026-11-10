// Archivos de las entregas en Supabase Storage (bucket privado).
// Variables (solo servidor): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y opcional SUPABASE_BUCKET_ENTREGAS (por defecto "entregas").
// Sin esas variables las entregas son solo por enlace (GitHub, Drive, Figma…).

const base = () => String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const clave = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
const bucket = () => String(process.env.SUPABASE_BUCKET_ENTREGAS || 'entregas')

export const archivosConfigurados = () => !!(base() && clave())
// Vercel no acepta cuerpos de más de ~4,5 MB por petición
export const MAX_ARCHIVO = 4 * 1024 * 1024
export const EXTENSIONES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'zip', 'rar', '7z', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'drawio', 'fig', 'sql', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'cs', 'php']

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

// Enlace temporal (10 minutos) para descargar un archivo privado
export async function enlaceArchivo(ruta: string, nombre?: string): Promise<string> {
  const r = await fetch(`${base()}/storage/v1/object/sign/${bucket()}/${rutaUrl(ruta)}`, {
    method: 'POST', headers: { ...cabeceras(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }),
  })
  const d: any = await r.json().catch(() => ({}))
  const firmado = d?.signedURL || d?.signedUrl
  if (!r.ok || !firmado) throw new Error('No se pudo abrir el archivo.')
  return `${base()}/storage/v1${firmado}${nombre ? `&download=${encodeURIComponent(nombre)}` : ''}`
}

export async function borrarArchivo(ruta: string): Promise<void> {
  await fetch(`${base()}/storage/v1/object/${bucket()}`, { method: 'DELETE', headers: { ...cabeceras(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [ruta] }) }).catch(() => {})
}
