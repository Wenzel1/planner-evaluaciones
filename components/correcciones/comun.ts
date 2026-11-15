// Corrección sobre los archivos entregados: tipos y utilidades compartidas por los editores y la vista del estudiante
import { precargarArchivo } from '@/components/entregas/enlaces';
import { subirAdjunto } from '@/components/MensajeAdjunto';

export type TipoCorreccion = 'PDF' | 'IMAGEN' | 'CODIGO' | 'N8N' | 'DRAWIO' | 'WORD' | 'EXCEL';

export interface Correccion {
  id: string; archivoId: string; archivoNombre: string; tipo: TipoCorreccion; datos: any;
  archivo: { nombre: string; tipo: string | null } | null; autorNombre: string | null; actualizada: string;
}

const CODIGO = ['py', 'java', 'kt', 'js', 'jsx', 'ts', 'tsx', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'sql', 'html', 'css', 'scss', 'xml', 'yml', 'yaml', 'sh', 'bat', 'ps1', 'r', 'm', 'dart', 'vue', 'txt', 'md', 'csv'];
export const extension = (nombre: string) => (String(nombre || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();

// Qué corrección admite un archivo (por su nombre). Los .json son flujos de n8n (si no lo son, el editor lo avisa).
export function tipoCorreccion(nombre: string): TipoCorreccion | null {
  const e = extension(nombre);
  if (e === 'pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) return 'IMAGEN';
  if (e === 'json') return 'N8N';
  if (e === 'drawio') return 'DRAWIO';
  if (e === 'docx') return 'WORD';
  if (e === 'xlsx') return 'EXCEL';
  if (CODIGO.includes(e)) return 'CODIGO';
  return null;
}

export const NOMBRE_TIPO: Record<TipoCorreccion, string> = {
  PDF: 'PDF', IMAGEN: 'Imagen', CODIGO: 'Código', N8N: 'Flujo de n8n', DRAWIO: 'Diagrama de draw.io', WORD: 'Word', EXCEL: 'Excel',
};

// Nombre de la copia corregida: "Avance I.pdf" → "Avance I (corregido).pdf"
export function nombreCorregido(nombre: string, ext?: string) {
  const e = ext || extension(nombre);
  const base = String(nombre || 'archivo').replace(/\.[a-z0-9]+$/i, '');
  return `${base} (corregido).${e}`;
}

// Descarga los bytes del archivo original (por el mismo camino que usa el visor)
export async function bajarOriginal(fuente: string): Promise<ArrayBuffer> {
  const { ver } = await precargarArchivo(fuente);
  const r = await fetch(ver);
  if (!r.ok) throw new Error('No se pudo descargar el archivo.');
  return r.arrayBuffer();
}
export async function textoOriginal(fuente: string): Promise<string> {
  return new TextDecoder('utf-8').decode(await bajarOriginal(fuente));
}

// Sube la copia corregida al almacenamiento y devuelve lo que se guarda con la corrección
export async function subirCorregido(entregaId: string, datos: Blob, nombre: string, onProgreso?: (p: number) => void) {
  return subirAdjunto(`/api/entregas/${encodeURIComponent(entregaId)}/correcciones/subida`, {}, datos, nombre, onProgreso);
}

// Guarda la corrección (datos y, si hay, la copia ya subida)
export async function guardarCorreccion(entregaId: string, cuerpo: { archivoId: string; tipo: TipoCorreccion; datos: unknown; archivo?: unknown }): Promise<Correccion> {
  const r = await fetch(`/api/entregas/${encodeURIComponent(entregaId)}/correcciones`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo guardar la corrección.');
  return d;
}
