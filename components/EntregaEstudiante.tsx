'use client';
// En la página del estudiante, dentro de cada evaluación: entregar el trabajo (archivo o enlace)
// y la conversación privada con el profesor.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Link2, CheckCircle2, AlertCircle, MessageSquare, Send, FileText, ExternalLink, X, Eye } from 'lucide-react';
import VistaArchivo, { precargarArchivo } from '@/components/entregas/VistaArchivo';
import { BotonAdjuntar, Grabadora, subirAdjunto, type Adjunto } from '@/components/MensajeAdjunto';
import { Burbuja, SeparadorDia, diaChat, useBajarAlFinal } from '@/components/Burbuja';
import CorreccionesEstudiante from '@/components/correcciones/CorreccionesEstudiante';

export interface ArchivoInfo { id: string; nombre: string; tamano: number | null; tipo: string | null }
export interface EntregaInfo { tipo: string; url: string | null; archivoNombre: string | null; comentario: string | null; entregadaEn: string; devuelta: boolean; devolucion: string | null; tarde?: boolean; revisada?: boolean; archivos?: ArchivoInfo[] }
const ZONA = 'America/Caracas';
const fecha = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const MAX_MB = 25;
const MAX_ARCHIVOS = 10;

// Un archivo nuevo que se está subiendo directo al almacenamiento
interface Subida { clave: string; archivo: File; progreso: number; ruta?: string; error?: string }

// Sube un archivo con el enlace firmado (directo del navegador a Supabase), informando el progreso
function subirConProgreso(url: string, archivo: File, tipo: string, onProgreso: (p: number) => void): Promise<void> {
  return new Promise((ok, falla) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', tipo || archivo.type || 'application/octet-stream');
    x.setRequestHeader('x-upsert', 'true');
    x.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgreso(Math.round((ev.loaded / ev.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falla(new Error(x.status === 413 ? `Supera el tamaño que acepta el almacenamiento.` : `No se pudo subir (${x.status}).`)));
    x.onerror = () => falla(new Error('Se cortó la conexión mientras subía.'));
    x.send(archivo);
  });
}

export function BloqueEntrega({ token, evaluacionId, entrega, archivos, fechaEval, onCambio, sinMarco = false }: { token: string; evaluacionId: string; entrega: EntregaInfo | null; archivos: boolean; fechaEval: string | null; onCambio: (e: EntregaInfo) => void ; sinMarco?: boolean }) {
  const [editando, setEditando] = useState(!entrega || entrega.devuelta);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [quitar, setQuitar] = useState<string[]>([]);
  const [url, setUrl] = useState(entrega?.url || '');
  const [comentario, setComentario] = useState(entrega?.comentario || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [viendo, setViendo] = useState<ArchivoInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const vencida = !!fechaEval && Date.now() > new Date(fechaEval).getTime();
  const base = `/api/portal/${encodeURIComponent(token)}/entrega`;
  const actuales = (entrega?.archivos || []).filter(a => !quitar.includes(a.id));

  const agregar = (lista: FileList | File[]) => {
    setError('');
    const nuevos: Subida[] = [];
    for (const f of Array.from(lista)) {
      if (actuales.length + subidas.length + nuevos.length >= MAX_ARCHIVOS) { setError(`Máximo ${MAX_ARCHIVOS} archivos. Comprime algunos en un .zip.`); break; }
      if (f.size > MAX_MB * 1024 * 1024) { setError(`«${f.name}» pesa más de ${MAX_MB} MB. Súbelo a Drive y pega el enlace.`); continue; }
      if (f.size === 0) continue;
      nuevos.push({ clave: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, archivo: f, progreso: 0 });
    }
    if (nuevos.length) setSubidas(s => [...s, ...nuevos]);
  };

  const entregar = async () => {
    setEnviando(true); setError('');
    try {
      // 1) Subir los archivos nuevos (directo al almacenamiento)
      const listos: { ruta: string; nombre: string; tamano: number }[] = [];
      for (const s of subidas) {
        if (s.ruta) { listos.push({ ruta: s.ruta, nombre: s.archivo.name, tamano: s.archivo.size }); continue; }
        const r = await fetch(`${base}/subida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, nombre: s.archivo.name, tamano: s.archivo.size }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `No se pudo preparar «${s.archivo.name}».`);
        try {
          await subirConProgreso(d.subida, s.archivo, d.tipo, (p) => setSubidas(l => l.map(x => (x.clave === s.clave ? { ...x, progreso: p } : x))));
        } catch (e: any) {
          setSubidas(l => l.map(x => (x.clave === s.clave ? { ...x, error: e.message } : x)));
          throw new Error(`«${s.archivo.name}»: ${e.message}`);
        }
        setSubidas(l => l.map(x => (x.clave === s.clave ? { ...x, ruta: d.ruta, progreso: 100 } : x)));
        listos.push({ ruta: d.ruta, nombre: s.archivo.name, tamano: s.archivo.size });
      }
      // 2) Registrar la entrega
      const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, archivos: listos, quitar, url: url.trim(), comentario }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo entregar.');
      onCambio({ ...d.entrega, tarde: vencida });
      setEditando(false); setSubidas([]); setQuitar([]);
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };

  const hayAlgo = actuales.length + subidas.length > 0 || url.trim().length >= 8;
  return (
    <div className={sinMarco ? 'space-y-3' : 'rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1c1d2a)] p-4 space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-a5b4fc)] flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Tu entrega</p>
        {entrega && !editando && (
          entrega.devuelta ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">Por corregir</span>
          : entrega.revisada ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">✓ Revisada por tu profesor</span>
          : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)] border-[color:var(--c-818cf8)]/30">Entregada · por revisar</span>
        )}
      </div>

      {entrega && !editando && (
        <div className="space-y-2.5">
          <div className={`flex items-start gap-2 text-sm ${entrega.devuelta ? 'text-amber-200' : 'text-emerald-200'}`}>
            {entrega.devuelta ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{entrega.devuelta ? 'Tu profesor te la devolvió para corregir.' : `Entregada el ${fecha(entrega.entregadaEn)}${entrega.tarde ? ' (fuera de fecha)' : ''}.`}</span>
          </div>
          {entrega.devuelta && entrega.devolucion && <p className="text-sm text-amber-100/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">{entrega.devolucion}</p>}
          <ListaArchivos archivos={entrega.archivos || []} onVer={setViendo} fuente={(a) => `${base}?evaluacionId=${encodeURIComponent(evaluacionId)}&archivoId=${encodeURIComponent(a.id)}`} />
          {entrega.url && <a href={entrega.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[color:var(--c-c7d2fe)] hover:underline break-all"><Link2 className="w-4 h-4 flex-shrink-0" />{entrega.url}</a>}
          {entrega.comentario && <p className="text-xs text-[color:var(--c-8a8b9e)]">Tu comentario: {entrega.comentario}</p>}
          <button type="button" onClick={() => setEditando(true)} className="block text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] underline">{entrega.devuelta ? 'Entregar la corrección' : 'Cambiar mi entrega'}</button>
        </div>
      )}
      {/* Lo que el profesor marcó sobre los archivos (se ve también mientras corrige su entrega devuelta) */}
      {entrega && <CorreccionesEstudiante token={token} evaluacionId={evaluacionId} version={entrega.entregadaEn} />}

      {editando && (
        <div className="space-y-3">
          {vencida && <p className="text-xs text-amber-300">La fecha ya pasó: tu entrega quedará marcada como fuera de fecha.</p>}
          {archivos ? (
            <>
              {/* Zona para arrastrar o elegir archivos */}
              <div
                onDragOver={(ev) => { ev.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
                onDrop={(ev) => { ev.preventDefault(); setArrastrando(false); if (ev.dataTransfer.files?.length) agregar(ev.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') inputRef.current?.click(); }}
                className={`rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${arrastrando ? 'border-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/10' : 'border-[color:var(--c-3a3b52)] hover:border-[color:var(--c-818cf8)]/60'}`}>
                <Upload className="w-6 h-6 mx-auto text-[color:var(--c-a5b4fc)]" />
                <p className="text-sm text-[color:var(--c-d0d0da)] mt-2"><b>Arrastra tus archivos aquí</b> o toca para elegirlos</p>
                <p className="text-[11px] text-[color:var(--c-6a6b7e)] mt-1">PDF, Word, Excel, PowerPoint, imágenes, código, flujos de n8n (.json), diagramas (.drawio), Packet Tracer (.pkt), .zip… · hasta {MAX_ARCHIVOS} archivos de {MAX_MB} MB</p>
                <input ref={inputRef} type="file" multiple className="hidden" onChange={(ev) => { if (ev.target.files) agregar(ev.target.files); ev.target.value = ''; }} />
              </div>
              {(actuales.length > 0 || subidas.length > 0) && (
                <ul className="space-y-1.5">
                  {actuales.map(a => (
                    <li key={a.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--c-313248)] px-3 py-2">
                      <FileText className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
                      <span className="text-sm text-[color:var(--c-d0d0da)] truncate flex-1">{a.nombre}</span>
                      <span className="text-[10px] text-[color:var(--c-6a6b7e)]">ya entregado</span>
                      <button type="button" onClick={() => setQuitar(q => [...q, a.id])} className="text-[color:var(--c-8a8b9e)] hover:text-red-300" title="Quitar"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                  {subidas.map(s => (
                    <li key={s.clave} className="rounded-lg border border-[color:var(--c-313248)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
                        <span className="text-sm text-[color:var(--c-d0d0da)] truncate flex-1">{s.archivo.name}</span>
                        <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{(s.archivo.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB</span>
                        {!enviando && <button type="button" onClick={() => setSubidas(l => l.filter(x => x.clave !== s.clave))} className="text-[color:var(--c-8a8b9e)] hover:text-red-300" title="Quitar"><X className="w-4 h-4" /></button>}
                      </div>
                      {(enviando || s.progreso > 0) && <div className="mt-1.5 h-1.5 rounded-full bg-[color:var(--c-282a3f)] overflow-hidden"><div className={`h-full rounded-full transition-all ${s.error ? 'bg-red-500' : s.progreso === 100 ? 'bg-emerald-500' : 'bg-[color:var(--c-818cf8)]'}`} style={{ width: `${s.error ? 100 : s.progreso}%` }} /></div>}
                      {s.error && <p className="text-[11px] text-red-300 mt-1">{s.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {(() => {
                // Packet Tracer no se puede ver en la web: se sugiere adjuntar también la topología y la configuración
                const nombres = [...actuales.map(a => a.nombre), ...subidas.map(s => s.archivo.name)].map(n => n.toLowerCase());
                if (!nombres.some(n => /\.(pkt|pka)$/.test(n))) return null;
                const conVista = nombres.some(n => /\.(png|jpe?g|webp|gif|pdf)$/.test(n));
                const conConfig = nombres.some(n => /\.txt$/.test(n));
                if (conVista && conConfig) return null;
                return (
                  <p className="text-xs text-sky-200 bg-sky-500/10 border border-sky-500/25 rounded-lg px-3 py-2 leading-relaxed">
                    <b>Consejo para Packet Tracer:</b> tu profesor no puede ver el .pkt dentro de la app. Agrega también {!conVista ? 'una captura o un PDF de tu topología' : ''}{!conVista && !conConfig ? ' y ' : ''}{!conConfig ? 'un .txt con la configuración (lo que muestra show running-config)' : ''}, para que pueda corregirla aquí mismo.
                  </p>
                );
              })()}
            </>
          ) : <p className="text-xs text-[color:var(--c-8a8b9e)]">Tu profesor recibe esta entrega como enlace (Drive, GitHub, Figma…).</p>}
          <div className="relative"><Link2 className="w-4 h-4 text-[color:var(--c-5f6074)] absolute left-3 top-1/2 -translate-y-1/2" /><input value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder={archivos ? 'Enlace (opcional): GitHub, Drive, Figma…' : 'https://github.com/tu-usuario/tu-proyecto'} className="w-full h-10 pl-9 pr-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" /></div>
          <input value={comentario} onChange={(ev) => setComentario(ev.target.value)} maxLength={1000} placeholder="Comentario para tu profesor (opcional)" className="w-full h-10 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="button" disabled={enviando || !hayAlgo} onClick={entregar} className="h-10 px-5 rounded-lg bg-[color:var(--c-818cf8)] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {enviando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}{enviando ? 'Entregando…' : entrega ? 'Entregar de nuevo' : 'Entregar'}
            </button>
            {entrega && !enviando && <button type="button" onClick={() => { setEditando(false); setSubidas([]); setQuitar([]); setError(''); }} className="text-xs text-[color:var(--c-8a8b9e)]">Cancelar</button>}
          </div>
        </div>
      )}

      {/* Vista previa de sus propios archivos, dentro de la página */}
      {viendo && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[300] bg-[color:var(--c-12131d)] flex items-stretch justify-center" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setViendo(null); }}>
          <div className="w-full h-full bg-[color:var(--c-1d1e2e)] overflow-hidden flex flex-col">
            <div className="flex justify-end px-2 py-1.5 border-b border-[color:var(--c-282a3f)]"><button type="button" onClick={() => setViendo(null)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)]"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 min-h-0 relative"><VistaArchivo fuente={`${base}?evaluacionId=${encodeURIComponent(evaluacionId)}&archivoId=${encodeURIComponent(viendo.id)}`} nombre={viendo.nombre} tamano={viendo.tamano} /></div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ListaArchivos({ archivos, onVer, fuente }: { archivos: ArchivoInfo[]; onVer: (a: ArchivoInfo) => void; fuente: (a: ArchivoInfo) => string }) {
  const adelantar = (a: ArchivoInfo) => { precargarArchivo(fuente(a)).catch(() => {}); };
  if (!archivos.length) return null;
  return (
    <ul className="space-y-1.5">
      {archivos.map(a => (
        <li key={a.id}>
          <button type="button" onClick={() => { adelantar(a); onVer(a); }} onMouseEnter={() => adelantar(a)} onTouchStart={() => adelantar(a)} className="w-full flex items-center gap-2 rounded-lg border border-[color:var(--c-313248)] px-3 py-2 text-left hover:border-[color:var(--c-818cf8)]/50">
            <FileText className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
            <span className="text-sm text-[color:var(--c-d0d0da)] truncate flex-1">{a.nombre}</span>
            <span className="text-[11px] text-[color:var(--c-c7d2fe)] flex items-center gap-1"><Eye className="w-3.5 h-3.5" />Ver</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface Mensaje { id: string; autor: string; texto: string; createdAt: string; adjunto?: Adjunto | null }
// panel = la conversación ocupa todo el alto de su contenedor (pestaña Mensajes, estilo WhatsApp de escritorio)
export function BloqueMensajes({ token, evaluacionId, nuevos, onLeidos, siempreAbierto = false, panel = false }: { token: string; evaluacionId: string; nuevos: number; onLeidos: () => void; siempreAbierto?: boolean; panel?: boolean }) {
  const [abierto, setAbierto] = useState(nuevos > 0 || siempreAbierto || panel);
  const [lista, setLista] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState<{ nombre: string; p: number } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const baseMsj = `/api/portal/${encodeURIComponent(token)}/comentarios`;
  // Archivo o nota de voz: se sube directo al almacenamiento y se envía como mensaje
  const enviarAdjunto = async (archivo: File | Blob, nombre: string, duracion?: number) => {
    setEnviando(true); setError(''); setProgreso({ nombre, p: 0 });
    try {
      const adjunto = await subirAdjunto(`${baseMsj}/subida`, { evaluacionId }, archivo, nombre, (p) => setProgreso({ nombre, p }), duracion);
      const r = await fetch(baseMsj, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, texto: texto.trim(), adjunto }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      desplazar.forzar(); setLista(prev => [...(prev || []), d]); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); setProgreso(null); }
  };
  const cargar = async () => {
    const r = await fetch(`/api/portal/${encodeURIComponent(token)}/comentarios?evaluacionId=${encodeURIComponent(evaluacionId)}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) { setLista(await r.json()); onLeidos(); }
  };
  useEffect(() => { if (abierto) cargar(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const desplazar = useBajarAlFinal([lista?.length, progreso?.nombre, abierto]);
  const enviar = async () => {
    setEnviando(true); setError('');
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, texto }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      desplazar.forzar(); setLista(prev => [...(prev || []), d]); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };
  return (
    <div className={panel ? 'h-full flex flex-col' : 'rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1c1d2a)]'}>
      {!panel && <button type="button" onClick={() => { if (!siempreAbierto) setAbierto(v => !v); }} className="w-full px-4 py-3 flex items-center gap-2 text-left">
        <MessageSquare className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
        <span className="text-sm font-medium text-[color:var(--c-d0d0da)] flex-1">Mensajes privados con tu profesor</span>
        {nuevos > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--c-818cf8)] text-white">{nuevos} nuevo{nuevos === 1 ? '' : 's'}</span>}
      </button>}
      {abierto && (
        <div className={panel ? 'flex-1 min-h-0 flex flex-col' : 'px-4 pb-4 space-y-2.5'}>
          {/* Alto fijo: los mensajes se desplazan por dentro (estilo WhatsApp) */}
          <div ref={desplazar.caja} onScroll={desplazar.onScroll} className={panel ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar bg-[color:var(--c-161722)] px-4 sm:px-8 py-3' : `${siempreAbierto ? 'h-[50vh]' : 'h-72'} overflow-y-auto overscroll-contain custom-scrollbar rounded-xl bg-[color:var(--c-161722)] px-2.5 py-2`}>
            {lista === null && <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-3">Cargando…</p>}
            {lista?.length === 0 && <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-6">¿Tienes una duda sobre esta evaluación? Escríbele: solo la ve tu profesor.</p>}
            {lista?.map((m, k) => {
              const prev = lista[k - 1];
              const nuevoDia = !prev || diaChat(prev.createdAt) !== diaChat(m.createdAt);
              const seguido = !!prev && !nuevoDia && prev.autor === m.autor && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
              return (
                <div key={m.id}>
                  {nuevoDia && <SeparadorDia fecha={m.createdAt} />}
                  <Burbuja mio={m.autor === 'ESTUDIANTE'} seguido={seguido} nombre={panel ? undefined : 'Profesor(a)'} colorNombre="#8fb8e8" texto={m.texto} createdAt={m.createdAt}
                    adjunto={m.adjunto} urlAdjunto={`${baseMsj}?evaluacionId=${encodeURIComponent(evaluacionId)}&adjunto=${encodeURIComponent(m.id)}`} />
                </div>
              );
            })}
            {progreso && <div className="flex justify-end mt-2"><div className="w-48 rounded-xl rounded-tr-sm bg-[#22406a] px-3 py-2"><p className="text-[11px] text-[#e9edf5]/80 truncate">Enviando {progreso.nombre}…</p><div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-white/70 transition-all" style={{ width: `${progreso.p}%` }} /></div></div></div>}
          </div>
          {/* Escribir (una sola grabadora, que no se reemplaza al grabar) */}
          <form onSubmit={(ev) => { ev.preventDefault(); if (texto.trim().length >= 2) enviar(); }} className={`flex gap-1.5 items-center ${panel ? 'px-3 py-2.5 border-t border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]' : ''}`}>
            {!grabando && (
              <div className="flex-1 min-w-0 flex items-center gap-1 h-11 pl-1 pr-3 rounded-full bg-[color:var(--c-232430)] border border-transparent focus-within:border-[color:var(--c-818cf8)]/50">
                <BotonAdjuntar deshabilitado={enviando} onArchivo={(f) => enviarAdjunto(f, f.name)} />
                <input value={texto} onChange={(ev) => setTexto(ev.target.value)} maxLength={1000} placeholder="Escribe un mensaje" className="flex-1 min-w-0 h-full bg-transparent text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
              </div>
            )}
            {texto.trim().length >= 2 && !grabando
              ? <button type="submit" disabled={enviando} aria-label="Enviar" className="w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0"><Send className="w-4 h-4" /></button>
              : (
                <div className={grabando ? 'flex-1 min-w-0 flex items-center' : 'w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] flex items-center justify-center flex-shrink-0 [&_button]:!text-white [&_button:hover]:!bg-transparent'}>
                  <Grabadora deshabilitado={enviando} onGrabando={setGrabando} onListo={(audio, nombre, seg) => enviarAdjunto(audio, nombre, seg)} />
                </div>
              )}
          </form>
          {error && <p className={`text-xs text-red-300 ${panel ? 'px-4 pb-2' : ''}`}>{error}</p>}
        </div>
      )}
    </div>
  );
}
