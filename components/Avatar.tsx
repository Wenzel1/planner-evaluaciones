'use client';
// Foto de perfil redonda; sin foto (o si no carga) muestra las iniciales con un color fijo por nombre.
import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';

const COLORES = ['bg-sky-500/15 text-sky-300', 'bg-blue-500/15 text-blue-300', 'bg-teal-500/15 text-teal-300', 'bg-slate-500/25 text-slate-300', 'bg-cyan-500/15 text-cyan-300', 'bg-indigo-500/15 text-indigo-300'];
export const iniciales = (n: string) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
export const colorDe = (n: string) => COLORES[[...String(n || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % COLORES.length];
export const urlAvatar = (id?: string | null, version?: string | null) => (id && version ? `/api/avatar/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}` : null);

export default function Avatar({ id, version, nombre, tamano = 36, className = '' }: { id?: string | null; version?: string | null; nombre: string; tamano?: number; className?: string }) {
  const url = urlAvatar(id, version);
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [url]);
  const estilo = { width: tamano, height: tamano, fontSize: Math.max(10, Math.round(tamano * 0.36)) };
  if (url && !fallo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} width={tamano} height={tamano} loading="lazy" onError={() => setFallo(true)} style={estilo} className={`rounded-full object-cover flex-shrink-0 bg-[color:var(--c-272839)] ${className}`} />;
  }
  return <span style={estilo} className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none ${colorDe(nombre)} ${className}`}>{iniciales(nombre)}</span>;
}

// Recorta al centro en cuadrado y la reduce a 256 px (WebP; JPEG si el navegador no sabe crear WebP)
async function prepararImagen(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falla) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falla(new Error('No se pudo leer la imagen.')); i.src = url; });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
    const webp = c.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

// Foto grande con botones para cambiarla o quitarla (perfil del profesor y panel del estudiante)
export function EditorAvatar({ id, version, nombre, onCambio }: { id: string; version?: string | null; nombre: string; onCambio: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const subir = async (archivo?: File) => {
    if (!archivo) return;
    setError('');
    if (!archivo.type.startsWith('image/')) { setError('Elige una imagen (JPG, PNG…).'); return; }
    if (archivo.size > 15 * 1024 * 1024) { setError('La imagen pesa demasiado (máximo 15 MB).'); return; }
    setOcupado(true);
    try {
      const imagen = await prepararImagen(archivo);
      const r = await fetch('/api/perfil/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagen }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar tu foto.');
      onCambio(d.avatarEn);
    } catch (e: any) { setError(e.message); } finally { setOcupado(false); }
  };
  const quitar = async () => {
    setOcupado(true); setError('');
    const r = await fetch('/api/perfil/avatar', { method: 'DELETE' }).catch(() => null);
    setOcupado(false);
    if (r?.ok) onCambio(null); else setError('No se pudo quitar tu foto.');
  };
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="relative group rounded-full" title="Cambiar foto" disabled={ocupado}>
        <Avatar id={id} version={version} nombre={nombre} tamano={72} />
        <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {ocupado ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
        </span>
      </button>
      <div className="space-y-1.5">
        <div className="flex gap-2 flex-wrap">
          <button type="button" disabled={ocupado} onClick={() => input.current?.click()} className="h-8 px-3 rounded-lg text-xs font-semibold text-white bg-[color:var(--c-818cf8)] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" />{version ? 'Cambiar foto' : 'Subir foto'}</button>
          {version && <button type="button" disabled={ocupado} onClick={quitar} className="h-8 px-3 rounded-lg text-xs font-medium text-[color:var(--c-8a8b9e)] hover:text-red-300 border border-[color:var(--c-313248)] flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Quitar</button>}
        </div>
        <p className="text-[11px] text-[color:var(--c-6a6b7e)]">Se recorta en círculo automáticamente. La ven tus {/* profesor o estudiantes */}contactos dentro de la app.</p>
        {error && <p className="text-[11px] text-red-300">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
