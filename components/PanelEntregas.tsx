'use client';
// Entregas de una evaluación (profesor): quién entregó, quién no y quién tarde; abrir lo entregado,
// devolverlo para corregir y conversar en privado con cada estudiante.
import { useEffect, useRef, useState } from 'react';
import { Inbox, X, FileText, ExternalLink, MessageSquare, Send, RotateCcw, ChevronDown } from 'lucide-react';

interface Fila { id: string; nombre: string; conCuenta: boolean; estado: 'PENDIENTE' | 'ENTREGADA' | 'TARDE' | 'DEVUELTA'; entrega: { id: string; archivos?: { id: string; nombre: string; tamano: number | null }[]; tipo: string; url: string | null; archivoNombre: string | null; comentario: string | null; entregadaEn: string; devolucion: string | null } | null; mensajes: number; sinLeer: number }
interface Datos { evaluacion: { id: string; nombre: string; fecha: string | null; aceptaEntregas: boolean }; filas: Fila[] }
const ZONA = 'America/Caracas';
const fecha = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const ESTADO: Record<Fila['estado'], { texto: string; clase: string }> = {
  ENTREGADA: { texto: 'Entregada', clase: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  TARDE: { texto: 'Tarde', clase: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  DEVUELTA: { texto: 'Devuelta', clase: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  PENDIENTE: { texto: 'Pendiente', clase: 'bg-[color:var(--c-272839)] text-[color:var(--c-8a8b9e)] border-[color:var(--c-313248)]' },
};

export default function PanelEntregas({ evaluacionId, nombre, onCerrar, notificar }: { evaluacionId: string; nombre: string; onCerrar: () => void; notificar: (m: string) => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'entregaron' | 'faltan'>('todos');
  const [abierta, setAbierta] = useState<string | null>(null);
  const cargar = async () => {
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(evaluacionId)}/entregas`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar las entregas.');
      setDatos(d);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { cargar(); }, [evaluacionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternarRecibir = async (v: boolean) => {
    const r = await fetch(`/api/evaluaciones/${encodeURIComponent(evaluacionId)}/entregas`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aceptaEntregas: v }) });
    if (!r.ok) { notificar('⚠️ No se pudo cambiar.'); return; }
    setDatos(prev => (prev ? { ...prev, evaluacion: { ...prev.evaluacion, aceptaEntregas: v } } : prev));
  };
  const filas = datos?.filas || [];
  const entregaron = filas.filter(f => f.estado !== 'PENDIENTE').length;
  const visibles = filas.filter(f => filtro === 'todos' || (filtro === 'entregaron' ? f.estado !== 'PENDIENTE' : f.estado === 'PENDIENTE'));

  return (
    <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[color:var(--c-313248)]">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center"><Inbox className="w-[18px] h-[18px] text-[color:var(--c-a5b4fc)]" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)] truncate">Entregas · {nombre}</h3>
          <p className="text-xs text-[color:var(--c-8a8b9e)]">{datos ? `${entregaron} de ${filas.length} entregaron${datos.evaluacion.fecha ? ` · fecha: ${fecha(datos.evaluacion.fecha)}` : ''}` : 'Cargando…'}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 sm:p-5 space-y-3">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {datos && (<>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1">
              {([['todos', `Todos (${filas.length})`], ['entregaron', `Entregaron (${entregaron})`], ['faltan', `Faltan (${filas.length - entregaron})`]] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => setFiltro(v)} className={`h-7 px-2.5 rounded-md text-xs font-semibold ${filtro === v ? 'bg-[color:var(--c-818cf8)] text-white' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>{t}</button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--c-b0b0c4)] cursor-pointer"><input type="checkbox" checked={datos.evaluacion.aceptaEntregas} onChange={(e) => alternarRecibir(e.target.checked)} className="accent-[color:var(--c-818cf8)]" />Recibir entregas</label>
          </div>
          {!filas.length && <p className="text-sm text-[color:var(--c-8a8b9e)] py-6 text-center">No hay estudiantes activos en esta sección.</p>}
          <div className="rounded-xl border border-[color:var(--c-2a2b3d)] divide-y divide-[color:var(--c-2a2b3d)] overflow-hidden">
            {visibles.map(f => (
              <div key={f.id}>
                <button type="button" onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[color:var(--c-232438)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[color:var(--c-e0e0ec)] truncate">{f.nombre}{!f.conCuenta && <span className="ml-1.5 text-[10px] text-[color:var(--c-6a6b7e)]">(sin cuenta)</span>}</p>
                    <p className="text-[11px] text-[color:var(--c-8a8b9e)]">{f.entrega ? `${f.entrega.archivos?.length ? `📎 ${f.entrega.archivos.length} archivo${f.entrega.archivos.length === 1 ? '' : 's'}` : ''}${f.entrega.archivos?.length && f.entrega.url ? ' + ' : ''}${f.entrega.url ? '🔗 Enlace' : ''} · ${fecha(f.entrega.entregadaEn)}` : 'Sin entrega'}</p>
                  </div>
                  {f.sinLeer > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--c-818cf8)] text-white">💬 {f.sinLeer}</span>}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ESTADO[f.estado].clase}`}>{ESTADO[f.estado].texto}</span>
                  <ChevronDown className={`w-4 h-4 text-[color:var(--c-6a6b7e)] transition-transform ${abierta === f.id ? 'rotate-180' : ''}`} />
                </button>
                {abierta === f.id && <DetalleEstudiante evaluacionId={evaluacionId} fila={f} onCambio={cargar} notificar={notificar} />}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[color:var(--c-6a6b7e)]">Los estudiantes entregan desde su cuenta. Califica como siempre con «Notas».</p>
        </>)}
      </div>
    </div>
  );
}

interface Mensaje { id: string; autor: string; texto: string; createdAt: string }
function DetalleEstudiante({ evaluacionId, fila, onCambio, notificar }: { evaluacionId: string; fila: Fila; onCambio: () => void; notificar: (m: string) => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [devolver, setDevolver] = useState(false);
  const [nota, setNota] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  const base = `/api/evaluaciones/${encodeURIComponent(evaluacionId)}`;
  useEffect(() => { fetch(`${base}/comentarios?estudianteId=${encodeURIComponent(fila.id)}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(setMensajes).catch(() => setMensajes([])); }, [fila.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [mensajes?.length]);
  const enviar = async () => {
    const r = await fetch(`${base}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId: fila.id, texto }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notificar(`⚠️ ${d.error || 'No se pudo enviar.'}`); return; }
    setMensajes(prev => [...(prev || []), d]); setTexto('');
  };
  const confirmarDevolucion = async () => {
    const r = await fetch(`${base}/entregas`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId: fila.id, devolver: true, devolucion: nota }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notificar(`⚠️ ${d.error || 'No se pudo devolver.'}`); return; }
    notificar(`↩️ Entrega devuelta a ${fila.nombre} para corregir.`); setDevolver(false); setNota(''); onCambio();
  };
  return (
    <div className="px-4 pb-4 pt-1 space-y-3 bg-[color:var(--c-191a26)]">
      {fila.entrega && (
        <div className="space-y-2">
          {(fila.entrega.archivos || []).map(a => (
            <a key={a.id} href={`/api/entregas/${encodeURIComponent(fila.entrega!.id)}?archivoId=${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[color:var(--c-c7d2fe)] hover:underline"><FileText className="w-4 h-4 flex-shrink-0" /><span className="truncate">{a.nombre}</span></a>
          ))}
          {fila.entrega.url && <a href={fila.entrega.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--c-c7d2fe)] hover:underline break-all"><ExternalLink className="w-4 h-4 flex-shrink-0" />{fila.entrega.url}</a>}
          <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Para verla en grande, calificarla y pasar al siguiente estudiante, usa la pestaña <b className="text-[color:var(--c-c7d2fe)]">Entregas</b>.</p>
          {fila.entrega.comentario && <p className="text-xs text-[color:var(--c-b0b0c4)]">Comentario: «{fila.entrega.comentario}»</p>}
          {fila.estado !== 'DEVUELTA' && (devolver ? (
            <div className="flex gap-2">
              <input autoFocus value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} placeholder="¿Qué debe corregir?" className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none" />
              <button type="button" disabled={nota.trim().length < 3} onClick={confirmarDevolucion} className="h-9 px-3 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200 text-xs font-semibold disabled:opacity-50">Devolver</button>
              <button type="button" onClick={() => setDevolver(false)} className="text-xs text-[color:var(--c-8a8b9e)]">Cancelar</button>
            </div>
          ) : <button type="button" onClick={() => setDevolver(true)} className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200"><RotateCcw className="w-3.5 h-3.5" />Devolver para corregir</button>)}
        </div>
      )}
      <div className="rounded-lg border border-[color:var(--c-2a2b3d)] p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Mensajes privados</p>
        <div className="max-h-52 overflow-y-auto space-y-1.5">
          {mensajes === null && <p className="text-xs text-[color:var(--c-8a8b9e)]">Cargando…</p>}
          {mensajes?.length === 0 && <p className="text-xs text-[color:var(--c-8a8b9e)]">Sin mensajes todavía.</p>}
          {mensajes?.map(m => (
            <div key={m.id} className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm ${m.autor === 'PROFESOR' ? 'ml-auto bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-e0e0ec)]' : 'bg-[color:var(--c-272839)] text-[color:var(--c-d0d0da)]'}`}>
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              <p className="text-[10px] text-[color:var(--c-8a8b9e)]">{m.autor === 'PROFESOR' ? 'Tú' : fila.nombre.split(' ')[0]} · {fecha(m.createdAt)}</p>
            </div>
          ))}
          <div ref={fin} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (texto.trim().length >= 2) enviar(); }} className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} placeholder={`Escríbele a ${fila.nombre.split(' ')[0]}…`} className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none" />
          <button type="submit" disabled={texto.trim().length < 2} aria-label="Enviar" className="w-9 h-9 rounded-lg bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}
