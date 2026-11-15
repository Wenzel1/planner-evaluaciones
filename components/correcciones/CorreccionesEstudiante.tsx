'use client';
// «Corrección de tu profesor»: lo que el profesor marcó sobre los archivos de la entrega.
// PDF, imágenes, Word y Excel: la copia corregida para abrir o descargar. Código y n8n: el archivo con los comentarios.
// draw.io: el diagrama corregido.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Eye, Loader2, PenLine, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { type Correccion, NOMBRE_TIPO, extension, textoOriginal } from './comun';

const CorrectorCodigo = dynamic(() => import('./CorrectorCodigo'), { ssr: false });
const VisorN8n = dynamic(() => import('./VisorN8n'), { ssr: false });
const VistaDrawio = dynamic(() => import('./Drawio').then(m => m.VistaDrawio), { ssr: false });

export default function CorreccionesEstudiante({ token, evaluacionId, version }: { token: string; evaluacionId: string; version?: string }) {
  const [lista, setLista] = useState<Correccion[]>([]);
  const [viendo, setViendo] = useState<Correccion | null>(null);
  const base = `/api/portal/${encodeURIComponent(token)}/correcciones?evaluacionId=${encodeURIComponent(evaluacionId)}`;
  useEffect(() => {
    let vivo = true;
    fetch(base, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(d => { if (vivo && Array.isArray(d)) setLista(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [base, version]);
  if (!lista.length) return null;

  const resumen = (c: Correccion) => {
    const d = c.datos || {};
    if (c.tipo === 'CODIGO') return `${d.comentarios?.length || 0} comentario(s)${d.corregido != null ? ' · versión corregida' : ''}`;
    if (c.tipo === 'N8N') return `${d.comentarios?.length || 0} comentario(s) en los nodos`;
    if (c.tipo === 'WORD') return `${d.comentarios?.length || 0} comentario(s) de Word`;
    if (c.tipo === 'EXCEL') return `${Object.keys(d.cambios || {}).length} celda(s) corregida(s)`;
    if (c.tipo === 'PDF' || c.tipo === 'IMAGEN') return `${Object.values<any[]>(d.paginas || {}).reduce((t, l) => t + l.length, 0)} marca(s)`;
    return NOMBRE_TIPO[c.tipo];
  };
  const verEnApp = (c: Correccion) => c.tipo === 'CODIGO' || c.tipo === 'N8N' || (c.tipo === 'DRAWIO' && c.datos?.xml);

  return (
    <div className="rounded-xl border border-[#f76b15]/30 bg-[#f76b15]/[0.05] p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5a46b] flex items-center gap-1.5"><PenLine className="w-3.5 h-3.5" />Corrección de tu profesor</p>
      {lista.map(c => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[color:var(--c-e0e0ec)] truncate">{c.archivo?.nombre || c.archivoNombre}</p>
            <p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{NOMBRE_TIPO[c.tipo]} · {resumen(c)}</p>
          </div>
          {verEnApp(c)
            ? <button type="button" onClick={() => setViendo(c)} className="h-8 px-2.5 rounded-lg text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Ver</button>
            : c.archivo && <a href={`${base}&abrir=${encodeURIComponent(c.id)}`} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-lg text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Ver</a>}
          {c.archivo && <a href={`${base}&abrir=${encodeURIComponent(c.id)}&descargar=1`} title="Descargar" aria-label="Descargar la corrección" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10"><Download className="w-4 h-4" /></a>}
        </div>
      ))}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>{viendo && <VentanaCorreccion key={viendo.id} c={viendo} fuente={`/api/portal/${encodeURIComponent(token)}/entrega?evaluacionId=${encodeURIComponent(evaluacionId)}&archivoId=${encodeURIComponent(viendo.archivoId)}`} onCerrar={() => setViendo(null)} />}</AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function VentanaCorreccion({ c, fuente, onCerrar }: { c: Correccion; fuente: string; onCerrar: () => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (c.tipo === 'DRAWIO') return;
    let vivo = true;
    textoOriginal(fuente).then(t => vivo && setTexto(t)).catch(e => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [fuente, c.tipo]);
  useEffect(() => { const t = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); }; window.addEventListener('keydown', t); return () => window.removeEventListener('keydown', t); }, [onCerrar]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-[400] bg-[color:var(--c-12131d)] flex flex-col">
      <div className="flex-shrink-0 h-14 flex items-center gap-3 px-4 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)]">
        <PenLine className="w-4 h-4 text-[#f5a46b]" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">Corrección · {c.archivoNombre}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)]">{c.autorNombre ? `Prof. ${c.autorNombre}` : 'Tu profesor'}</p></div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]"><X className="w-5 h-5" /></button>
      </div>
      <div className="relative flex-1 min-h-0">
        {c.tipo === 'DRAWIO' ? <VistaDrawio xml={c.datos?.xml || ''} />
          : error ? <p className="absolute inset-0 flex items-center justify-center text-sm text-red-300">{error}</p>
          : texto == null ? <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin" />Abriendo…</div>
          : c.tipo === 'N8N' ? <VisorN8n texto={texto} datos={c.datos} soloLectura />
          : <CorrectorCodigo texto={texto} ext={extension(c.archivoNombre)} datos={c.datos} soloLectura />}
      </div>
    </motion.div>
  );
}
