'use client';
// En la página del estudiante, dentro de cada evaluación: entregar el trabajo (archivo o enlace)
// y la conversación privada con el profesor.
import { useEffect, useRef, useState } from 'react';
import { Upload, Link2, CheckCircle2, AlertCircle, MessageSquare, Send, FileText, ExternalLink } from 'lucide-react';

export interface EntregaInfo { tipo: string; url: string | null; archivoNombre: string | null; comentario: string | null; entregadaEn: string; devuelta: boolean; devolucion: string | null; tarde?: boolean }
const ZONA = 'America/Caracas';
const fecha = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export function BloqueEntrega({ token, evaluacionId, entrega, archivos, fechaEval, onCambio }: { token: string; evaluacionId: string; entrega: EntregaInfo | null; archivos: boolean; fechaEval: string | null; onCambio: (e: EntregaInfo) => void }) {
  const [modo, setModo] = useState<'archivo' | 'enlace'>(archivos ? 'archivo' : 'enlace');
  const [url, setUrl] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(!entrega || entrega.devuelta);
  const vencida = !!fechaEval && Date.now() > new Date(fechaEval).getTime();

  const entregar = async () => {
    setEnviando(true); setError('');
    try {
      let r: Response;
      if (modo === 'archivo') {
        if (!archivo) throw new Error('Elige un archivo.');
        if (archivo.size > 4 * 1024 * 1024) throw new Error('El archivo pesa más de 4 MB. Súbelo a Drive y entrega el enlace.');
        const fd = new FormData(); fd.append('evaluacionId', evaluacionId); fd.append('archivo', archivo, archivo.name); if (comentario.trim()) fd.append('comentario', comentario.trim());
        r = await fetch(`/api/portal/${encodeURIComponent(token)}/entrega`, { method: 'POST', body: fd });
      } else {
        r = await fetch(`/api/portal/${encodeURIComponent(token)}/entrega`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, url, comentario }) });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo entregar.');
      onCambio({ ...d.entrega, tarde: vencida });
      setEditando(false); setArchivo(null); setUrl(''); setComentario('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };

  return (
    <div className="rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1c1d2a)] p-4 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-a5b4fc)] flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Tu entrega</p>
      {entrega && !editando && (
        <div className="space-y-2">
          <div className={`flex items-start gap-2 text-sm ${entrega.devuelta ? 'text-amber-200' : 'text-emerald-200'}`}>
            {entrega.devuelta ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{entrega.devuelta ? 'Tu profesor te la devolvió para corregir.' : `Entregada el ${fecha(entrega.entregadaEn)}${entrega.tarde ? ' (fuera de fecha)' : ''}.`}</span>
          </div>
          {entrega.devuelta && entrega.devolucion && <p className="text-sm text-amber-100/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">{entrega.devolucion}</p>}
          {entrega.tipo === 'ARCHIVO'
            ? <a href={`/api/portal/${encodeURIComponent(token)}/entrega?evaluacionId=${encodeURIComponent(evaluacionId)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--c-c7d2fe)] hover:underline"><FileText className="w-4 h-4" />{entrega.archivoNombre}</a>
            : entrega.url && <a href={entrega.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--c-c7d2fe)] hover:underline break-all"><ExternalLink className="w-4 h-4 flex-shrink-0" />{entrega.url}</a>}
          <button type="button" onClick={() => setEditando(true)} className="block text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] underline">{entrega.devuelta ? 'Entregar la corrección' : 'Cambiar mi entrega'}</button>
        </div>
      )}
      {editando && (
        <div className="space-y-2.5">
          {vencida && <p className="text-xs text-amber-300">La fecha ya pasó: tu entrega quedará marcada como fuera de fecha.</p>}
          {archivos && (
            <div className="flex gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1 w-fit">
              {(['archivo', 'enlace'] as const).map(m => <button key={m} type="button" onClick={() => setModo(m)} className={`h-7 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 ${modo === m ? 'bg-[color:var(--c-818cf8)] text-white' : 'text-[color:var(--c-8a8b9e)]'}`}>{m === 'archivo' ? <><Upload className="w-3.5 h-3.5" />Archivo</> : <><Link2 className="w-3.5 h-3.5" />Enlace</>}</button>)}
            </div>
          )}
          {modo === 'archivo'
            ? <label className="flex items-center gap-3 px-3 py-3 rounded-lg border border-dashed border-[color:var(--c-3a3b52)] cursor-pointer hover:border-[color:var(--c-818cf8)]/60">
                <Upload className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
                <span className="text-sm text-[color:var(--c-c0c0d0)] truncate">{archivo ? archivo.name : 'Elige tu archivo (PDF, Word, ZIP, imagen… hasta 4 MB)'}</span>
                <input type="file" className="hidden" onChange={(ev) => setArchivo(ev.target.files?.[0] || null)} />
              </label>
            : <input value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://github.com/tu-usuario/tu-proyecto (o Drive, Figma…)" className="w-full h-10 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/60" />}
          <input value={comentario} onChange={(ev) => setComentario(ev.target.value)} maxLength={1000} placeholder="Comentario para tu profesor (opcional)" className="w-full h-10 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/60" />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="button" disabled={enviando || (modo === 'archivo' ? !archivo : url.trim().length < 8)} onClick={entregar} className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {enviando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}Entregar
            </button>
            {entrega && <button type="button" onClick={() => setEditando(false)} className="text-xs text-[color:var(--c-8a8b9e)]">Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

interface Mensaje { id: string; autor: string; texto: string; createdAt: string }
export function BloqueMensajes({ token, evaluacionId, nuevos, onLeidos }: { token: string; evaluacionId: string; nuevos: number; onLeidos: () => void }) {
  const [abierto, setAbierto] = useState(nuevos > 0);
  const [lista, setLista] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  const cargar = async () => {
    const r = await fetch(`/api/portal/${encodeURIComponent(token)}/comentarios?evaluacionId=${encodeURIComponent(evaluacionId)}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) { setLista(await r.json()); onLeidos(); }
  };
  useEffect(() => { if (abierto) cargar(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [lista?.length]);
  const enviar = async () => {
    setEnviando(true); setError('');
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, texto }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      setLista(prev => [...(prev || []), d]); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };
  return (
    <div className="rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1c1d2a)]">
      <button type="button" onClick={() => setAbierto(v => !v)} className="w-full px-4 py-3 flex items-center gap-2 text-left">
        <MessageSquare className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
        <span className="text-sm font-medium text-[color:var(--c-d0d0da)] flex-1">Mensajes privados con tu profesor</span>
        {nuevos > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--c-818cf8)] text-white">{nuevos} nuevo{nuevos === 1 ? '' : 's'}</span>}
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-2.5">
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {lista === null && <p className="text-xs text-[color:var(--c-8a8b9e)]">Cargando…</p>}
            {lista?.length === 0 && <p className="text-xs text-[color:var(--c-8a8b9e)]">¿Tienes una duda sobre esta evaluación? Escríbele: solo la ve tu profesor.</p>}
            {lista?.map(m => (
              <div key={m.id} className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${m.autor === 'ESTUDIANTE' ? 'ml-auto bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-e0e0ec)]' : 'bg-[color:var(--c-272839)] text-[color:var(--c-d0d0da)]'}`}>
                <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                <p className="text-[10px] text-[color:var(--c-8a8b9e)] mt-0.5">{m.autor === 'ESTUDIANTE' ? 'Tú' : 'Profesor'} · {fecha(m.createdAt)}</p>
              </div>
            ))}
            <div ref={fin} />
          </div>
          <form onSubmit={(ev) => { ev.preventDefault(); if (texto.trim().length >= 2) enviar(); }} className="flex gap-2">
            <input value={texto} onChange={(ev) => setTexto(ev.target.value)} maxLength={1000} placeholder="Escribe tu mensaje…" className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/60" />
            <button type="submit" disabled={enviando || texto.trim().length < 2} aria-label="Enviar" className="w-10 h-10 rounded-lg bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </form>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
