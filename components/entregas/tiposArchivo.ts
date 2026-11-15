// Cómo se muestra cada tipo de archivo en la bandeja y en el visor (ícono, color pastel sobrio y forma de vista previa)
import { FileText, FileSpreadsheet, Presentation, FileCode2, FileArchive, Image as ImageIcon, Film, Music, File, Link2, Network, type LucideIcon } from 'lucide-react';

export type Categoria = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'imagen' | 'video' | 'audio' | 'codigo' | 'texto' | 'csv' | 'zip' | 'red' | 'otro';

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
  pkt: 'red', pka: 'red',
  js: 'codigo', jsx: 'codigo', ts: 'codigo', tsx: 'codigo', py: 'codigo', java: 'codigo', kt: 'codigo', c: 'codigo', h: 'codigo', cpp: 'codigo', cs: 'codigo',
  php: 'codigo', rb: 'codigo', go: 'codigo', rs: 'codigo', swift: 'codigo', dart: 'codigo', sh: 'codigo', sql: 'codigo', html: 'codigo', css: 'codigo',
  scss: 'codigo', json: 'codigo', xml: 'codigo', yml: 'codigo', yaml: 'codigo', svg: 'codigo', ipynb: 'codigo', puml: 'codigo', uml: 'codigo', drawio: 'codigo',
};

export const extension = (nombre: string) => (String(nombre || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
export const categoria = (nombre: string): Categoria => EXT[extension(nombre)] || 'otro';

export const ESTILO: Record<Categoria | 'enlace', { icono: LucideIcon; color: string; fondo: string; nombre: string }> = {
  pdf: { icono: FileText, color: 'text-[#e3a3a3]', fondo: 'bg-[#e3a3a3]/[0.07] border-[#e3a3a3]/20', nombre: 'PDF' },
  word: { icono: FileText, color: 'text-[#9dbbe3]', fondo: 'bg-[#9dbbe3]/[0.07] border-[#9dbbe3]/20', nombre: 'Word' },
  excel: { icono: FileSpreadsheet, color: 'text-[#9fd0b0]', fondo: 'bg-[#9fd0b0]/[0.07] border-[#9fd0b0]/20', nombre: 'Excel' },
  powerpoint: { icono: Presentation, color: 'text-[#e6b48e]', fondo: 'bg-[#e6b48e]/[0.07] border-[#e6b48e]/20', nombre: 'PowerPoint' },
  imagen: { icono: ImageIcon, color: 'text-[#d6a8c4]', fondo: 'bg-[#d6a8c4]/[0.07] border-[#d6a8c4]/20', nombre: 'Imagen' },
  video: { icono: Film, color: 'text-[#b9b2df]', fondo: 'bg-[#b9b2df]/[0.07] border-[#b9b2df]/20', nombre: 'Video' },
  audio: { icono: Music, color: 'text-[#9cd3cb]', fondo: 'bg-[#9cd3cb]/[0.07] border-[#9cd3cb]/20', nombre: 'Audio' },
  codigo: { icono: FileCode2, color: 'text-[#b3b6e3]', fondo: 'bg-[#b3b6e3]/[0.07] border-[#b3b6e3]/20', nombre: 'Código' },
  texto: { icono: FileText, color: 'text-[#c2c6cd]', fondo: 'bg-[#c2c6cd]/[0.07] border-[#c2c6cd]/20', nombre: 'Texto' },
  csv: { icono: FileSpreadsheet, color: 'text-[#bcd59c]', fondo: 'bg-[#bcd59c]/[0.07] border-[#bcd59c]/20', nombre: 'CSV' },
  zip: { icono: FileArchive, color: 'text-[#dfcb8f]', fondo: 'bg-[#dfcb8f]/[0.07] border-[#dfcb8f]/20', nombre: 'ZIP' },
  red: { icono: Network, color: 'text-[#8fc7e3]', fondo: 'bg-[#8fc7e3]/[0.07] border-[#8fc7e3]/20', nombre: 'Packet Tracer' },
  otro: { icono: File, color: 'text-[#b6bac2]', fondo: 'bg-[#b6bac2]/[0.07] border-[#b6bac2]/20', nombre: 'Archivo' },
  enlace: { icono: Link2, color: 'text-[#a7bfe6]', fondo: 'bg-[#a7bfe6]/[0.07] border-[#a7bfe6]/20', nombre: 'Enlace' },
};

export const estiloDe = (nombre: string) => ESTILO[categoria(nombre)];

// Se ven dentro del programa: PDF, imágenes, video y audio directo; Office con el visor de Microsoft; código y texto con colores
export const tieneVistaPrevia = (nombre: string) => !['otro', 'red'].includes(categoria(nombre)) && !['rar', '7z', 'fig'].includes(extension(nombre));

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
