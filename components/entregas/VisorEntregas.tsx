'use client';
// Visor de revisión del profesor (como "Trabajo de los estudiantes" de Classroom):
// el documento a la izquierda y, a la derecha, la nota (directa o con la rúbrica), "Revisada", "Devolver para corregir"
// y los mensajes privados. Con ← → se pasa al siguiente estudiante sin cerrar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw, Send, ExternalLink, MessageSquare, ClipboardCheck, Clock, Link2, Save, Circle } from 'lucide-react';
import VistaArchivo from './VistaArchivo';
import Avatar from '@/components/Avatar';
import { precargarArchivo } from './enlaces';
import { estiloDe, ESTILO, fechaHora, tamanoLegible } from './tiposArchivo';
import { NIVELES_RUBRICA, type RubricaEval } from '@/lib/rubrica';
import { notaDesdeRubrica, NIVEL_CORTO, COLOR_BOTON_NIVEL, textoNota } from '@/components/planificador/ModalNotas';

export interface ArchivoBandeja { id: string; nombre: string; tamano: number | null; tipo: string | null }
export interface EntregaBandeja {
  id: string;
  estudiante: { id: string; nombre: string; grupo: string; cuentaId?: string | null; avatarEn?: string | null };
  evaluacion: { id: string; nombre: string; fecha: string | null; seccion: string };
  entregadaEn: string; tarde: boolean; revisada: boolean; devuelta: boolean; devolucion: string | null;
  comentario: string | null; url: string | null; archivos: ArchivoBandeja[];
  nota: { puntaje: number | null; observaciones: string | null; detalle: (number | null)[] | null } | null;
  sinLeer: number;
}

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '');

export default function VisorEntregas({ entregas, inicio, rubricas, onCerrar, onActualizar }: {
  entregas: EntregaBandeja[]; inicio: number; rubricas: Record<string, RubricaEval | null>;
  onCerrar: () => void; onActualizar: (id: string, cambios: Partial<EntregaBandeja>) => void;
}) {
  const [i, setI] = useState(Math.min(Math.max(0, inicio), entregas.length - 1));
  const e = entregas[i];
  const [archivoSel, setArchivoSel] = useState(0);
  useEffect(() => { setArchivoSel(0); }, [e?.id]);
  // Mientras revisa esta entrega, se adelantan sus otros archivos y el primero de la siguiente y la anterior
  useEffect(() => {
    const fuente = (x: EntregaBandeja | undefined, k = 0) => x?.archivos[k] ? `/api/entregas/${encodeURIComponent(x.id)}?archivoId=${encodeURIComponent(x.archivos[k].id)}` : null;
    const t = setTimeout(() => {
      const lista = [...(e?.archivos.map((_, k) => fuente(e, k)) || []), fuente(entregas[i + 1]), fuente(entregas[i - 1])];
      for (const f of lista) if (f) precargarArchivo(f).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [i, e?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teclado: ← → cambian de estudiante, Esc cierra (no mientras se escribe)
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ev.key === 'Escape') onCerrar();
      if (ev.key === 'ArrowRight') setI(x => Math.min(entregas.length - 1, x + 1));
      if (ev.key === 'ArrowLeft') setI(x => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = previo; };
  }, [entregas.length, onCerrar]);

  if (!e) return null;
  const archivo = e.archivos[archivoSel];
  const estado = e.devuelta ? { t: 'Devuelta para corregir', c: 'bg-amber-500/15 text-amber-200 border-amber-500/30' } : e.revisada ? { t: 'Revisada', c: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' } : { t: 'Sin revisar', c: 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)] border-[color:var(--c-818cf8)]/30' };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-[color:var(--c-12131d)] flex items-stretch justify-center" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar(); }}>
      <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.15 }} className="w-full h-full bg-[color:var(--c-1d1e2e)] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center gap-3 px-3 md:px-4 py-2.5 border-b border-[color:var(--c-282a3f)] flex-shrink-0">
          <Avatar id={e.estudiante.cuentaId} version={e.estudiante.avatarEn} nombre={e.estudiante.nombre} tamano={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm md:text-base font-semibold text-[color:var(--c-e0e0ec)] truncate">{e.estudiante.nombre}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estado.c}`}>{estado.t}</span>
              {e.tarde && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30 flex items-center gap-1"><Clock className="w-3 h-3" />Tarde</span>}
            </div>
            <p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{limpiar(e.evaluacion.nombre)} · Sección {e.evaluacion.seccion} · entregó el {fechaHora(e.entregadaEn)}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-30" title="Anterior (←)"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-xs tabular-nums text-[color:var(--c-8a8b9e)] w-14 text-center">{i + 1} de {entregas.length}</span>
            <button type="button" disabled={i === entregas.length - 1} onClick={() => setI(i + 1)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-30" title="Siguiente (→)"><ChevronRight className="w-5 h-5" /></button>
            <button type="button" onClick={onCerrar} className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-white/5 ml-1" title="Cerrar (Esc)"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Documento */}
          <div className="flex-1 min-h-[55vh] lg:min-h-0 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-[color:var(--c-282a3f)]">
            {(e.archivos.length > 1 || (e.archivos.length > 0 && e.url)) && (
              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-[color:var(--c-282a3f)] flex-shrink-0">
                {e.archivos.map((a, k) => {
                  const est = estiloDe(a.nombre); const Icono = est.icono;
                  return (
                    <button key={a.id} type="button" onClick={() => setArchivoSel(k)} className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs whitespace-nowrap transition-colors ${k === archivoSel ? 'border-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-e0e0ec)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-b0b0c4)] hover:border-[color:var(--c-818cf8)]/40'}`}>
                      <Icono className={`w-3.5 h-3.5 ${est.color}`} /><span className="max-w-[180px] truncate">{a.nombre}</span>{a.tamano ? <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{tamanoLegible(a.tamano)}</span> : null}
                    </button>
                  );
                })}
                {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-200 whitespace-nowrap"><Link2 className="w-3.5 h-3.5" />Enlace<ExternalLink className="w-3 h-3" /></a>}
              </div>
            )}
            <div className="flex-1 min-h-0 relative">
              {archivo ? <VistaArchivo key={`${e.id}:${archivo.id}`} fuente={`/api/entregas/${encodeURIComponent(e.id)}?archivoId=${encodeURIComponent(archivo.id)}`} nombre={archivo.nombre} tamano={archivo.tamano} />
                : e.url ? <TarjetaEnlace url={e.url} />
                : <p className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--c-8a8b9e)]">Esta entrega no tiene archivos.</p>}
            </div>
            {e.comentario && <p className="px-4 py-2.5 text-xs text-[color:var(--c-c0c0d0)] border-t border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] flex-shrink-0"><MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-[color:var(--c-a5b4fc)]" /><b className="text-[color:var(--c-d0d0da)]">Comentario del estudiante:</b> {e.comentario}</p>}
          </div>

          {/* Revisión */}
          <div className="lg:w-[380px] flex-shrink-0 overflow-y-auto">
            <PanelRevision key={e.id} e={e} rubrica={rubricas[e.evaluacion.id] ?? null} onActualizar={(c) => onActualizar(e.id, c)}
              onSiguiente={i < entregas.length - 1 ? () => setI(i + 1) : undefined} />
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function TarjetaEnlace({ url }: { url: string }) {
  let sitio = url; try { sitio = new URL(url).hostname.replace(/^www\./, ''); } catch { /* enlace raro */ }
  const Icono = ESTILO.enlace.icono;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="w-16 h-16 rounded-2xl border bg-indigo-500/10 border-indigo-500/25 flex items-center justify-center"><Icono className="w-8 h-8 text-indigo-300" /></span>
      <div><p className="text-sm font-medium text-[color:var(--c-e0e0ec)]">El estudiante entregó un enlace</p><p className="text-xs text-[color:var(--c-8a8b9e)] mt-1 break-all max-w-md">Te llevará a <b className="text-[color:var(--c-c7d2fe)]">{sitio}</b></p></div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="h-10 px-5 rounded-xl bg-[color:var(--c-818cf8)] text-white text-sm font-semibold flex items-center gap-2"><ExternalLink className="w-4 h-4" />Abrir el enlace</a>
    </div>
  );
}

// ---------- Panel derecho: nota, revisión, devolución y mensajes ----------
function PanelRevision({ e, rubrica, onActualizar, onSiguiente }: { e: EntregaBandeja; rubrica: RubricaEval | null; onActualizar: (c: Partial<EntregaBandeja>) => void; onSiguiente?: () => void }) {
  const conRubrica = !!rubrica?.criterios?.length;
  const [usarRubrica, setUsarRubrica] = useState(conRubrica);
  const [detalle, setDetalle] = useState<(number | null)[]>(() => rubrica?.criterios.map((_, k) => e.nota?.detalle?.[k] ?? null) ?? []);
  const [puntaje, setPuntaje] = useState(e.nota?.puntaje != null ? String(e.nota.puntaje).replace('.', ',') : '');
  const [obs, setObs] = useState(e.nota?.observaciones || '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ t: string; ok: boolean } | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [textoDevolucion, setTextoDevolucion] = useState('');

  const notaRubrica = useMemo(() => (rubrica && usarRubrica ? notaDesdeRubrica(rubrica, detalle) : null), [rubrica, usarRubrica, detalle]);
  const notaFinal = usarRubrica && conRubrica ? notaRubrica : (puntaje.trim() ? Number(puntaje.replace(',', '.')) : null);
  const notaValida = notaFinal == null || (Number.isFinite(notaFinal) && notaFinal >= 0 && notaFinal <= 20);
  const avisar = (t: string, ok = true) => { setAviso({ t, ok }); setTimeout(() => setAviso(null), 3500); };

  const guardarNota = async (yRevisar: boolean) => {
    if (!notaValida) { avisar('La nota debe estar entre 0 y 20.', false); return; }
    setGuardando(true);
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(e.evaluacion.id)}/notas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notas: [{ estudianteId: e.estudiante.id, puntaje: notaFinal, observaciones: obs, detalle: usarRubrica && conRubrica ? detalle : null }] }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar la nota.');
      const cambios: Partial<EntregaBandeja> = { nota: { puntaje: notaFinal, observaciones: obs || null, detalle: usarRubrica && conRubrica ? detalle : null } };
      if (yRevisar && !e.revisada) {
        const rr = await fetch(`/api/entregas/${encodeURIComponent(e.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisada: true }) });
        if (rr.ok) Object.assign(cambios, { revisada: true, devuelta: false });
      }
      onActualizar(cambios);
      window.dispatchEvent(new Event('entregas-cambiaron'));
      avisar(notaFinal == null ? 'Nota borrada.' : `Nota ${textoNota(notaFinal)} guardada${yRevisar ? ' y marcada como revisada' : ''}.`);
      if (yRevisar && onSiguiente) setTimeout(onSiguiente, 600);
    } catch (err: any) { avisar(err.message, false); } finally { setGuardando(false); }
  };

  const alternarRevisada = async () => {
    const r = await fetch(`/api/entregas/${encodeURIComponent(e.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisada: !e.revisada }) });
    if (!r.ok) { avisar('No se pudo guardar.', false); return; }
    onActualizar(e.revisada ? { revisada: false } : { revisada: true, devuelta: false });
    window.dispatchEvent(new Event('entregas-cambiaron'));
  };

  const devolver = async () => {
    const t = textoDevolucion.trim();
    if (t.length < 3) { avisar('Escribe qué debe corregir.', false); return; }
    const r = await fetch(`/api/evaluaciones/${encodeURIComponent(e.evaluacion.id)}/entregas`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId: e.estudiante.id, devolver: true, devolucion: t }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { avisar(d.error || 'No se pudo devolver.', false); return; }
    onActualizar({ devuelta: true, revisada: false, devolucion: t });
    window.dispatchEvent(new Event('entregas-cambiaron'));
    setDevolviendo(false); setTextoDevolucion('');
    avisar('Devuelta. El estudiante verá tu comentario y podrá entregar de nuevo.');
  };

  const etiqueta = 'text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]';
  return (
    <div className="p-4 space-y-5">
      {/* Nota */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={etiqueta}>Calificación</p>
          {conRubrica && (
            <button type="button" onClick={() => setUsarRubrica(v => !v)} className={`h-7 px-2.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 ${usarRubrica ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/40 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)]'}`}>
              <ClipboardCheck className="w-3.5 h-3.5" />{usarRubrica ? 'Con rúbrica' : 'Nota directa'}
            </button>
          )}
        </div>
        {usarRubrica && conRubrica ? (
          <div className="space-y-2.5">
            {rubrica!.criterios.map((c, k) => (
              <div key={k} className="rounded-xl border border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] p-2.5">
                <div className="flex items-start justify-between gap-2 mb-2"><p className="text-xs font-medium text-[color:var(--c-d0d0da)] leading-snug">{c.nombre}</p><span className="text-[10px] text-[color:var(--c-6a6b7e)] flex-shrink-0">{String(c.puntos).replace('.', ',')} pts</span></div>
                <div className="flex gap-1">
                  {NIVELES_RUBRICA.map((n, nivel) => (
                    <button key={n} type="button" title={n} onClick={() => setDetalle(d => d.map((x, j) => (j === k ? (x === nivel ? null : nivel) : x)))}
                      className={`flex-1 h-7 rounded-md border text-[11px] font-medium transition-colors ${detalle[k] === nivel ? COLOR_BOTON_NIVEL[nivel] : 'bg-[color:var(--c-232430)] border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>{NIVEL_CORTO[nivel]}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/25 px-3 py-2">
              <span className="text-xs text-[color:var(--c-c7d2fe)]">Nota según la rúbrica</span>
              <span className="text-xl font-bold text-[color:var(--c-e0e0ec)] tabular-nums">{notaRubrica == null ? '—' : textoNota(notaRubrica)}<span className="text-xs text-[color:var(--c-8a8b9e)] font-normal"> /20</span></span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input value={puntaje} onChange={(ev) => setPuntaje(ev.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} inputMode="decimal" placeholder="—" className={`w-24 h-12 text-center text-2xl font-bold rounded-xl bg-[color:var(--c-191a26)] border text-[color:var(--c-e0e0ec)] focus:outline-none focus:border-[color:var(--c-818cf8)] ${notaValida ? 'border-[color:var(--c-313248)]' : 'border-red-500/60'}`} />
            <span className="text-sm text-[color:var(--c-8a8b9e)]">de 20 puntos</span>
          </div>
        )}
        <textarea value={obs} onChange={(ev) => setObs(ev.target.value.slice(0, 500))} rows={2} placeholder="Observación de la nota (opcional, la verá el estudiante)" className="w-full px-3 py-2 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)] resize-none" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={guardando} onClick={() => guardarNota(false)} className="h-10 rounded-xl border border-[color:var(--c-313248)] text-sm font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center justify-center gap-1.5 disabled:opacity-50"><Save className="w-4 h-4" />Guardar nota</button>
          <button type="button" disabled={guardando} onClick={() => guardarNota(true)} className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50" title="Guarda la nota, la marca como revisada y pasa al siguiente">{guardando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Calificar y seguir</button>
        </div>
        <AnimatePresence>{aviso && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`text-xs rounded-lg px-3 py-2 border ${aviso.ok ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/25' : 'text-red-200 bg-red-500/10 border-red-500/25'}`}>{aviso.t}</motion.p>}</AnimatePresence>
      </section>

      {/* Estado de la revisión */}
      <section className="space-y-2">
        <p className={etiqueta}>Revisión</p>
        <button type="button" onClick={alternarRevisada} className={`w-full h-10 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${e.revisada ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] hover:border-emerald-500/40'}`}>
          {e.revisada ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}{e.revisada ? 'Revisada' : 'Marcar como revisada'}
        </button>
        {e.devuelta && e.devolucion && <p className="text-xs text-amber-100/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2"><b>Le pediste corregir:</b> {e.devolucion}</p>}
        {!devolviendo ? (
          <button type="button" onClick={() => setDevolviendo(true)} className="w-full h-10 rounded-xl border border-amber-500/30 text-sm font-medium text-amber-200 hover:bg-amber-500/10 flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" />Devolver para corregir</button>
        ) : (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <textarea autoFocus value={textoDevolucion} onChange={(ev) => setTextoDevolucion(ev.target.value.slice(0, 1000))} rows={3} placeholder="¿Qué debe corregir? (lo verá el estudiante)" className="w-full px-3 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-amber-400/60 resize-none" />
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setDevolviendo(false)} className="h-8 px-3 text-xs text-[color:var(--c-8a8b9e)]">Cancelar</button><button type="button" onClick={devolver} className="h-8 px-3 rounded-lg bg-amber-500 text-black text-xs font-semibold">Devolver</button></div>
          </div>
        )}
      </section>

      {/* Mensajes privados */}
      <Mensajes evaluacionId={e.evaluacion.id} estudianteId={e.estudiante.id} sinLeer={e.sinLeer} onLeidos={() => e.sinLeer && onActualizar({ sinLeer: 0 })} />
    </div>
  );
}

function Mensajes({ evaluacionId, estudianteId, sinLeer, onLeidos }: { evaluacionId: string; estudianteId: string; sinLeer: number; onLeidos: () => void }) {
  const [lista, setLista] = useState<{ id: string; autor: string; texto: string; createdAt: string }[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const base = `/api/evaluaciones/${encodeURIComponent(evaluacionId)}/comentarios`;
  useEffect(() => {
    let vivo = true;
    fetch(`${base}?estudianteId=${encodeURIComponent(estudianteId)}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(d => { if (vivo) { setLista(Array.isArray(d) ? d : []); if (sinLeer) onLeidos(); } }).catch(() => vivo && setLista([]));
    return () => { vivo = false; };
  }, [base, estudianteId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fin.current?.scrollIntoView({ block: 'nearest' }); }, [lista?.length]);
  const enviar = async () => {
    const t = texto.trim(); if (t.length < 2) return;
    setEnviando(true);
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId, texto: t }) }).catch(() => null);
    if (r?.ok) { const m = await r.json(); setLista(l => [...(l || []), m]); setTexto(''); }
    setEnviando(false);
  };
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Mensajes privados</p>
      <div className="rounded-xl border border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] p-2.5 max-h-60 overflow-y-auto space-y-2">
        {lista === null ? <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-3">Cargando…</p>
          : lista.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)] text-center py-3">Sin mensajes. Escríbele algo sobre su trabajo.</p>
          : lista.map(m => (
            <div key={m.id} className={`flex ${m.autor === 'PROFESOR' ? 'justify-end' : 'justify-start'}`}>
              <p className={`max-w-[85%] text-xs rounded-2xl px-3 py-2 whitespace-pre-wrap ${m.autor === 'PROFESOR' ? 'bg-[color:var(--c-818cf8)] text-white rounded-br-md' : 'bg-[color:var(--c-232430)] text-[color:var(--c-d0d0da)] rounded-bl-md'}`}>{m.texto}<span className="block text-[9px] opacity-60 mt-0.5">{fechaHora(m.createdAt)}</span></p>
            </div>
          ))}
        <div ref={fin} />
      </div>
      <div className="flex gap-2">
        <input value={texto} onChange={(ev) => setTexto(ev.target.value.slice(0, 1000))} onKeyDown={(ev) => { if (ev.key === 'Enter') enviar(); }} placeholder="Escribe un mensaje…" className="flex-1 h-10 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
        <button type="button" disabled={enviando || texto.trim().length < 2} onClick={enviar} className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
      </div>
    </section>
  );
}
