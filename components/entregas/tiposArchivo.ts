// Cómo se muestra cada tipo de archivo en la bandeja y en el visor (ícono, color y forma de vista previa)
import { FileText, FileSpreadsheet, Presentation, FileCode2, FileArchive, Image as ImageIcon, Film, Music, File, Link2, type LucideIcon } from 'lucide-react';

export type Categoria = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'imagen' | 'video' | 'audio' | 'codigo' | 'texto' | 'csv' | 'zip' | 'otro';

const EXT: Record<string, Categoria> = {
  pdf: 'pdf',
  doc: 'word', docx: 'word', odt: 'word', rtf: 'word',
  xls: 'excel', xlsx: 'excel', ods: 'excel',
  ppt: 'powerpoint', pptx: 'powerpoint', odp: 'powerpoint',
  png: 'imagen', jpg: 'imagen', jpeg: 'imagen', gif: 'imagen', webp: 'imagen',
  mp4: 'video', webm: 'video', mov: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio',
  csv: 'csv',
  txt: 'texto', md: 'texto',
  zip: 'zip',
  js: 'codigo', jsx: 'codigo', ts: 'codigo', tsx: 'codigo', py: 'codigo', java: 'codigo', kt: 'codigo', c: 'codigo', h: 'codigo', cpp: 'codigo', cs: 'codigo',
  php: 'codigo', rb: 'codigo', go: 'codigo', rs: 'codigo', swift: 'codigo', dart: 'codigo', sh: 'codigo', sql: 'codigo', html: 'codigo', css: 'codigo',
  scss: 'codigo', json: 'codigo', xml: 'codigo', yml: 'codigo', yaml: 'codigo', svg: 'codigo', ipynb: 'codigo', puml: 'codigo', uml: 'codigo', drawio: 'codigo',
};

export const extension = (nombre: string) => (String(nombre || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
export const categoria = (nombre: string): Categoria => EXT[extension(nombre)] || 'otro';

export const ESTILO: Record<Categoria | 'enlace', { icono: LucideIcon; color: string; fondo: string; nombre: string }> = {
  pdf: { icono: FileText, color: 'text-red-400', fondo: 'bg-red-500/10 border-red-500/25', nombre: 'PDF' },
  word: { icono: FileText, color: 'text-sky-400', fondo: 'bg-sky-500/10 border-sky-500/25', nombre: 'Word' },
  excel: { icono: FileSpreadsheet, color: 'text-emerald-400', fondo: 'bg-emerald-500/10 border-emerald-500/25', nombre: 'Excel' },
  powerpoint: { icono: Presentation, color: 'text-orange-400', fondo: 'bg-orange-500/10 border-orange-500/25', nombre: 'PowerPoint' },
  imagen: { icono: ImageIcon, color: 'text-pink-400', fondo: 'bg-pink-500/10 border-pink-500/25', nombre: 'Imagen' },
  video: { icono: Film, color: 'text-fuchsia-400', fondo: 'bg-fuchsia-500/10 border-fuchsia-500/25', nombre: 'Video' },
  audio: { icono: Music, color: 'text-teal-400', fondo: 'bg-teal-500/10 border-teal-500/25', nombre: 'Audio' },
  codigo: { icono: FileCode2, color: 'text-violet-400', fondo: 'bg-violet-500/10 border-violet-500/25', nombre: 'Código' },
  texto: { icono: FileText, color: 'text-slate-300', fondo: 'bg-slate-500/10 border-slate-500/25', nombre: 'Texto' },
  csv: { icono: FileSpreadsheet, color: 'text-lime-400', fondo: 'bg-lime-500/10 border-lime-500/25', nombre: 'CSV' },
  zip: { icono: FileArchive, color: 'text-amber-400', fondo: 'bg-amber-500/10 border-amber-500/25', nombre: 'ZIP' },
  otro: { icono: File, color: 'text-slate-400', fondo: 'bg-slate-500/10 border-slate-500/25', nombre: 'Archivo' },
  enlace: { icono: Link2, color: 'text-indigo-300', fondo: 'bg-indigo-500/10 border-indigo-500/25', nombre: 'Enlace' },
};

export const estiloDe = (nombre: string) => ESTILO[categoria(nombre)];

// Se ven dentro del programa: PDF, imágenes, video y audio directo; Office con el visor de Microsoft; código y texto con colores
export const tieneVistaPrevia = (nombre: string) => categoria(nombre) !== 'otro' && !['rar', '7z', 'fig'].includes(extension(nombre));

export function tamanoLegible(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// Hace cuánto (para las tarjetas de la bandeja)
export function haceTiempo(fecha: string | Date): string {
  const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} día${Math.floor(s / 86400) === 1 ? '' : 's'}`;
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short' }).format(new Date(fecha));
}

export const fechaHora = (d: string | Date) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

// Iniciales y color estable por nombre (avatar de la tarjeta)
export const iniciales = (n: string) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
const AVATARES = ['bg-indigo-500/20 text-indigo-200', 'bg-emerald-500/20 text-emerald-200', 'bg-sky-500/20 text-sky-200', 'bg-amber-500/20 text-amber-200', 'bg-pink-500/20 text-pink-200', 'bg-violet-500/20 text-violet-200', 'bg-teal-500/20 text-teal-200', 'bg-orange-500/20 text-orange-200'];
export const colorAvatar = (n: string) => AVATARES[[...String(n || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % AVATARES.length];
