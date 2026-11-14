'use client';
// Adjuntos en los mensajes privados: subir un archivo, grabar una nota de voz y mostrarlos en la conversación.
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Mic, Square, X, Download } from 'lucide-react';
import { estiloDe, tamanoLegible } from '@/components/entregas/tiposArchivo';

export interface Adjunto { nombre: string; tipo: string | null; tamano: number | null; duracion: number | null }
export interface AdjuntoSubido { ruta: string; nombre: string; tamano: number; tipo: string; duracion?: number }

const MAX_MB = 25;
const MAX_SEG = 300; // notas de voz de hasta 5 minutos

// 1) pide el enlace firmado, 2) sube el archivo directo al almacenamiento (con progreso)
export async function subirAdjunto(prepararUrl: string, cuerpo: Record<string, unknown>, archivo: File | Blob, nombre: string, onProgreso?: (p: number) => void, duracion?: number): Promise<AdjuntoSubido> {
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB.`);
  const r = await fetch(prepararUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo, nombre, tamano: archivo.size, tipo: archivo.type }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudo preparar el archivo.');
  await new Promise<void>((ok, falla) => {
    const x = new XMLHttpRequest();
    x.open('PUT', d.subida);
    x.setRequestHeader('Content-Type', d.tipo || archivo.type || 'application/octet-stream');
    x.setRequestHeader('x-upsert', 'true');
    x.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgreso?.(Math.round((ev.loaded / ev.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falla(new Error(x.status === 413 ? 'El archivo supera el tamaño permitido.' : `No se pudo subir (${x.status}).`)));
    x.onerror = () => falla(new Error('Se cortó la conexión mientras subía.'));
    x.send(archivo);
  });
  return { ruta: d.ruta, nombre, tamano: archivo.size, tipo: d.tipo, ...(duracion ? { duracion } : {}) };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Cómo se ve un adjunto dentro de la burbuja del mensaje
export function VerAdjunto({ adjunto, url, mio }: { adjunto: Adjunto; url: string; mio: boolean }) {
  const tipo = adjunto.tipo || '';
  if (tipo.startsWith('audio/') || (tipo === 'video/webm' && /nota-de-voz/i.test(adjunto.nombre))) {
    return (
      <div className="flex items-center gap-2 min-w-[220px]">
        <Mic className={`w-4 h-4 flex-shrink-0 ${mio ? 'text-white/80' : 'text-[color:var(--c-a5b4fc)]'}`} />
        <audio src={url} controls preload="none" className="h-9 w-full max-w-[260px]" />
        {adjunto.duracion ? <span className={`text-[10px] tabular-nums ${mio ? 'text-white/70' : 'text-[color:var(--c-8a8b9e)]'}`}>{mmss(adjunto.duracion)}</span> : null}
      </div>
    );
  }
  if (tipo.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={adjunto.nombre} loading="lazy" className="max-w-[240px] max-h-[200px] rounded-lg object-cover" />
      </a>
    );
  }
  const est = estiloDe(adjunto.nombre); const Icono = est.icono;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-w-[200px] max-w-[280px] ${mio ? 'bg-white/15 hover:bg-white/25' : 'bg-[color:var(--c-1d1e2e)] hover:bg-[color:var(--c-232430)]'}`} title={`Abrir ${adjunto.nombre}`}>
      <span className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${est.fondo}`}><Icono className={`w-4 h-4 ${est.color}`} /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-medium truncate">{adjunto.nombre}</span><span className={`block text-[10px] ${mio ? 'text-white/70' : 'text-[color:var(--c-8a8b9e)]'}`}>{est.nombre}{adjunto.tamano ? ` · ${tamanoLegible(adjunto.tamano)}` : ''}</span></span>
      <Download className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
    </a>
  );
}

// Botón del clip: elegir un archivo para enviar
export function BotonAdjuntar({ onArchivo, deshabilitado }: { onArchivo: (f: File) => void; deshabilitado?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={deshabilitado} onClick={() => ref.current?.click()} title="Adjuntar un archivo" aria-label="Adjuntar un archivo" className="w-10 h-10 rounded-xl flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-40 flex-shrink-0"><Paperclip className="w-4 h-4" /></button>
      <input ref={ref} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
    </>
  );
}

// Grabadora de notas de voz: un toque empieza; ✓ envía, ✕ descarta
export function Grabadora({ onListo, deshabilitado, onGrabando }: { onListo: (audio: Blob, nombre: string, segundos: number) => void; deshabilitado?: boolean; onGrabando?: (v: boolean) => void }) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const descartar = useRef(false);
  const inicio = useRef(0);
  useEffect(() => { onGrabando?.(grabando); }, [grabando]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!grabando) return;
    const t = setInterval(() => { const s = (Date.now() - inicio.current) / 1000; setSeg(s); if (s >= MAX_SEG) detener(false); }, 250);
    return () => clearInterval(t);
  }, [grabando]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rec.current?.stream.getTracks().forEach(t => t.stop()); }, []);

  const empezar = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      trozos.current = []; descartar.current = false;
      r.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const segundos = Math.max(1, Math.round((Date.now() - inicio.current) / 1000));
        if (descartar.current || !trozos.current.length) return;
        const blob = new Blob(trozos.current, { type: r.mimeType || tipo || 'audio/webm' });
        const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
        const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        onListo(blob, `nota-de-voz-${fecha}.${ext}`, segundos);
      };
      rec.current = r; inicio.current = Date.now(); setSeg(0);
      r.start(250); setGrabando(true);
    } catch { setError('No se pudo usar el micrófono. Revisa el permiso del navegador.'); }
  };
  const detener = (cancelar: boolean) => { descartar.current = cancelar; rec.current?.state !== 'inactive' && rec.current?.stop(); setGrabando(false); };

  if (grabando) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-red-500/10 border border-red-500/30 flex-1 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <span className="text-sm tabular-nums text-red-200">{mmss(seg)}</span>
        <span className="text-xs text-[color:var(--c-8a8b9e)] truncate flex-1">Grabando nota de voz…</span>
        <button type="button" onClick={() => detener(true)} title="Descartar" aria-label="Descartar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-red-300"><X className="w-4 h-4" /></button>
        <button type="button" onClick={() => detener(false)} title="Enviar nota de voz" aria-label="Enviar nota de voz" className="w-8 h-8 rounded-lg flex items-center justify-center bg-[color:var(--c-818cf8)] text-white"><Square className="w-3.5 h-3.5 fill-current" /></button>
      </div>
    );
  }
  return (
    <>
      <button type="button" disabled={deshabilitado} onClick={empezar} title="Grabar una nota de voz" aria-label="Grabar una nota de voz" className="w-10 h-10 rounded-xl flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-40 flex-shrink-0"><Mic className="w-4 h-4" /></button>
      {error && <p className="basis-full text-[11px] text-red-300">{error}</p>}
    </>
  );
}
