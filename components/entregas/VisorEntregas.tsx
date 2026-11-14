'use client';
// Visor de revisión del profesor (como "Trabajo de los estudiantes" de Classroom):
// el documento a la izquierda y, a la derecha, la nota (directa o con la rúbrica), "Revisada", "Devolver para corregir"
// y los mensajes privados. Con ← → se pasa al siguiente estudiante sin cerrar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle2, RotateCcw, Send, ExternalLink, MessageSquare, ClipboardCheck, Clock, Link2, Save, Circle, Sparkles } from 'lucide-react';
import VistaArchivo from './VistaArchivo';
import Avatar from '@/components/Avatar';
import { precargarArchivo } from './enlaces';
import CorreccionIA, { type Analisis } from './CorreccionIA';

// Nota que propone la IA, para pasarla a la pestaña Revisión
interface Sugerencia { id: string; nota: number | null; detalle: (number | null)[] | null; obs: string; n: number }
import { BotonAdjuntar, Grabadora, subirAdjunto, type Adjunto } from '@/components/MensajeAdjunto';
import { Burbuja, SeparadorDia, diaChat, useBajarAlFinal } from '@/components/Burbuja';
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

export default function VisorEntregas({ entregas, inicio, archivoInicial = 0, rubricas, onCerrar, onActualizar }: {
  entregas: EntregaBandeja[]; inicio: number; archivoInicial?: number; rubricas: Record<string, RubricaEval | null>;
  onCerrar: () => void; onActualizar: (id: string, cambios: Partial<EntregaBandeja>) => void;
}) {
  const [i, setI] = useState(Math.min(Math.max(0, inicio), entregas.length - 1));
  const e = entregas[i];
  // Panel derecho: Revisión o Corrección con IA (el análisis de cada entrega se guarda mientras el visor está abierto)
  const [pestanaPanel, setPestanaPanel] = useState<'revision' | 'ia'>('revision');
  const [analisisIA, setAnalisisIA] = useState<Record<string, Analisis | undefined>>({});
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [versionChat, setVersionChat] = useState(0);
  // Abre el archivo que se tocó en la bandeja; al pasar a otro estudiante, su primer archivo
  const [archivoSel, setArchivoSel] = useState(archivoInicial);
  const primeraEntrega = useRef(e?.id);
  useEffect(() => { if (e?.id !== primeraEntrega.current) { primeraEntrega.current = e?.id; setArchivoSel(0); } }, [e?.id]);
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
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Documento */}
          <div className="flex-1 min-h-[55vh] lg:min-h-0 flex flex-col min-w-0 border-b lg:border-b-0 lg:border-r border-[color:var(--c-282a3f)]">
            {/* Una sola fila: quién entregó y sus archivos (el documento ocupa todo lo demás) */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[color:var(--c-282a3f)] flex-shrink-0 min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0 max-w-[45%] pr-2 border-r border-[color:var(--c-282a3f)]" title={`${limpiar(e.evaluacion.nombre)} · Sección ${e.evaluacion.seccion} · entregó el ${fechaHora(e.entregadaEn)}`}>
                <Avatar id={e.estudiante.cuentaId} version={e.estudiante.avatarEn} nombre={e.estudiante.nombre} tamano={28} />
                <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">{e.estudiante.nombre}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border flex-shrink-0 ${estado.c}`}>{estado.t}</span>
                {e.tarde && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-300 border-red-500/30 flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />Tarde</span>}
              </div>
              <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto sin-barra">
                {e.archivos.map((a, k) => {
                  const est = estiloDe(a.nombre); const Icono = est.icono;
                  return (
                    <button key={a.id} type="button" onClick={() => setArchivoSel(k)} className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs whitespace-nowrap transition-colors flex-shrink-0 ${k === archivoSel ? 'border-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-e0e0ec)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-b0b0c4)] hover:border-[color:var(--c-818cf8)]/40'}`}>
                      <Icono className={`w-3.5 h-3.5 ${est.color}`} /><span className="max-w-[170px] truncate">{a.nombre}</span>{a.tamano ? <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{tamanoLegible(a.tamano)}</span> : null}
                    </button>
                  );
                })}
                {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs whitespace-nowrap flex-shrink-0 ${ESTILO.enlace.fondo} ${ESTILO.enlace.color}`}><Link2 className="w-3.5 h-3.5" />Enlace<ExternalLink className="w-3 h-3" /></a>}
              </div>
              <button type="button" onClick={onCerrar} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] flex-shrink-0" title="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-h-0 relative">
              {archivo ? <VistaArchivo key={`${e.id}:${archivo.id}`} fuente={`/api/entregas/${encodeURIComponent(e.id)}?archivoId=${encodeURIComponent(archivo.id)}`} nombre={archivo.nombre} tamano={archivo.tamano} compacta />
                : e.url ? <TarjetaEnlace url={e.url} />
                : <p className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--c-8a8b9e)]">Esta entrega no tiene archivos.</p>}
            </div>
          </div>

          {/* Revisión */}
          <div className="lg:w-[480px] flex-shrink-0 flex flex-col min-h-0">
            {/* Revisión (nota, estado, mensajes) o Corrección con IA */}
            <div className="flex border-b border-[color:var(--c-282a3f)] flex-shrink-0">
              {([['revision', 'Revisión', ClipboardCheck], ['ia', 'Corrección IA', Sparkles]] as const).map(([id, txt, I]) => (
                <button key={id} type="button" onClick={() => setPestanaPanel(id)} className={`relative flex-1 min-w-0 h-11 flex items-center justify-center gap-1.5 text-[13px] font-medium transition-colors ${pestanaPanel === id ? 'text-[color:var(--c-e0e0ec)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
                  <I className={`w-4 h-4 ${pestanaPanel === id ? 'text-[color:var(--c-818cf8)]' : ''}`} />{txt}
                  {id === 'ia' && analisisIA[e.id]?.nota != null && <span className="text-[10px] font-bold px-1.5 rounded bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]">{String(analisisIA[e.id]!.nota).replace('.', ',')}</span>}
                  {pestanaPanel === id && <span className="absolute left-4 right-4 bottom-0 h-0.5 rounded-full bg-[color:var(--c-818cf8)]" />}
                </button>
              ))}
              <div className="flex items-center gap-0.5 px-1.5 border-l border-[color:var(--c-282a3f)] flex-shrink-0">
                <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-30" title="Anterior (←)"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[11px] tabular-nums text-[color:var(--c-8a8b9e)] min-w-[38px] text-center">{i + 1}/{entregas.length}</span>
                <button type="button" disabled={i === entregas.length - 1} onClick={() => setI(i + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-30" title="Siguiente (→)"><ChevronRight className="w-4 h-4" /></button>
                <button type="button" onClick={onCerrar} className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-white/5" title="Cerrar (Esc)"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              <div className={pestanaPanel === 'revision' ? 'flex flex-col flex-1' : 'hidden'}>
                <PanelRevision key={e.id} e={e} rubrica={rubricas[e.evaluacion.id] ?? null} onActualizar={(c) => onActualizar(e.id, c)}
                  onSiguiente={i < entregas.length - 1 ? () => setI(i + 1) : undefined}
                  sugerencia={sugerencia?.id === e.id ? sugerencia : null} versionChat={versionChat} />
              </div>
              {pestanaPanel === 'ia' && (
                <CorreccionIA key={e.id} entregaId={e.id} analisis={analisisIA[e.id] ?? null}
                  onAnalisis={(a) => setAnalisisIA(m => ({ ...m, [e.id]: a }))}
                  onUsarNota={(a) => { setSugerencia({ id: e.id, nota: a.nota, detalle: a.criterios.length ? a.criterios.map(c => c.nivel) : null, obs: a.resumen.slice(0, 500), n: Date.now() }); setPestanaPanel('revision'); }}
                  onEnviar={async (texto) => {
                    const r = await fetch(`/api/evaluaciones/${encodeURIComponent(e.evaluacion.id)}/comentarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId: e.estudiante.id, texto }) });
                    if (!r.ok) throw new Error('No se pudo enviar.');
                    setVersionChat(v => v + 1);
                  }} />
              )}
            </div>
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
function PanelRevision({ e, rubrica, onActualizar, onSiguiente, sugerencia, versionChat = 0 }: { e: EntregaBandeja; rubrica: RubricaEval | null; onActualizar: (c: Partial<EntregaBandeja>) => void; onSiguiente?: () => void; sugerencia?: Sugerencia | null; versionChat?: number }) {
  const conRubrica = !!rubrica?.criterios?.length;
  const [usarRubrica, setUsarRubrica] = useState(conRubrica);
  const [detalle, setDetalle] = useState<(number | null)[]>(() => rubrica?.criterios.map((_, k) => e.nota?.detalle?.[k] ?? null) ?? []);
  const [puntaje, setPuntaje] = useState(e.nota?.puntaje != null ? String(e.nota.puntaje).replace('.', ',') : '');
  const [obs, setObs] = useState(e.nota?.observaciones || '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ t: string; ok: boolean } | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [textoDevolucion, setTextoDevolucion] = useState('');

  // «Usar esta nota» de la IA: llena la calificación (el profesor la revisa y la guarda)
  useEffect(() => {
    if (!sugerencia) return;
    if (sugerencia.detalle && conRubrica && sugerencia.detalle.some(x => x != null)) { setUsarRubrica(true); setDetalle(rubrica!.criterios.map((_, k) => sugerencia.detalle![k] ?? null)); }
    else { setUsarRubrica(false); setPuntaje(sugerencia.nota == null ? '' : String(sugerencia.nota).replace('.', ',')); }
    if (sugerencia.obs) setObs(sugerencia.obs);
    setAviso({ t: 'Nota sugerida por la IA cargada. Revísala y pulsa «Guardar nota».', ok: true });
  }, [sugerencia?.n]); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div className="p-4 space-y-5 flex flex-col flex-1 min-h-full">
      {e.comentario && <p className="text-xs text-[color:var(--c-c0c0d0)] rounded-xl bg-[color:var(--c-161722)] border border-[color:var(--c-282a3f)] px-3 py-2.5"><MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-[color:var(--c-a5b4fc)]" /><b className="text-[color:var(--c-d0d0da)]">Comentario del estudiante:</b> {e.comentario}</p>}
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
      <Mensajes version={versionChat} evaluacionId={e.evaluacion.id} estudianteId={e.estudiante.id} sinLeer={e.sinLeer} onLeidos={() => e.sinLeer && onActualizar({ sinLeer: 0 })} />
    </div>
  );
}

function Mensajes({ evaluacionId, estudianteId, sinLeer, onLeidos, version = 0 }: { evaluacionId: string; estudianteId: string; sinLeer: number; onLeidos: () => void; version?: number }) {
  const [lista, setLista] = useState<{ id: string; autor: string; texto: string; createdAt: string; adjunto?: Adjunto | null }[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ nombre: string; p: number } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState('');
  const base = `/api/evaluaciones/${encodeURIComponent(evaluacionId)}/comentarios`;
  useEffect(() => {
    let vivo = true;
    fetch(`${base}?estudianteId=${encodeURIComponent(estudianteId)}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).then(d => { if (vivo) { setLista(Array.isArray(d) ? d : []); if (sinLeer) onLeidos(); } }).catch(() => vivo && setLista([]));
    return () => { vivo = false; };
  }, [base, estudianteId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const desplazar = useBajarAlFinal([lista?.length, progreso?.nombre]);
  const publicar = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteId, ...cuerpo }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(d.error || 'No se pudo enviar.');
    desplazar.forzar(); setLista(l => [...(l || []), d]);
  };
  const enviar = async () => {
    const t = texto.trim(); if (t.length < 2) return;
    setEnviando(true); setError('');
    try { await publicar({ texto: t }); setTexto(''); } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };
  // Archivo o nota de voz: se sube directo al almacenamiento y se envía como mensaje (con el texto escrito, si hay)
  const enviarAdjunto = async (archivo: File | Blob, nombre: string, duracion?: number) => {
    setEnviando(true); setError(''); setProgreso({ nombre, p: 0 });
    try {
      const adjunto = await subirAdjunto(`${base}/subida`, { estudianteId }, archivo, nombre, (p) => setProgreso({ nombre, p }), duracion);
      await publicar({ texto: texto.trim(), adjunto }); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); setProgreso(null); }
  };
  return (
    <section className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />Mensajes privados</p>
      {/* Alto fijo: los mensajes se desplazan por dentro (estilo WhatsApp) */}
      <div ref={desplazar.caja} onScroll={desplazar.onScroll} className="h-[340px] overscroll-contain rounded-xl border border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] px-2.5 py-2 overflow-y-auto custom-scrollbar">
        {lista === null ? <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-3">Cargando…</p>
          : lista.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)] text-center py-6">Sin mensajes. Escríbele, envíale un archivo o una nota de voz.</p>
          : lista.map((m, k) => {
            const prev = lista[k - 1];
            const nuevoDia = !prev || diaChat(prev.createdAt) !== diaChat(m.createdAt);
            const seguido = !!prev && !nuevoDia && prev.autor === m.autor && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
            return (
              <div key={m.id}>
                {nuevoDia && <SeparadorDia fecha={m.createdAt} />}
                <Burbuja mio={m.autor === 'PROFESOR'} seguido={seguido} texto={m.texto} createdAt={m.createdAt}
                  adjunto={m.adjunto} urlAdjunto={`${base}?estudianteId=${encodeURIComponent(estudianteId)}&adjunto=${encodeURIComponent(m.id)}`} />
              </div>
            );
          })}
        {progreso && (
          <div className="flex justify-end mt-2"><div className="w-48 rounded-xl rounded-tr-sm bg-[#22406a] px-3 py-2"><p className="text-[11px] text-[#e9edf5]/80 truncate">Enviando {progreso.nombre}…</p><div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-white/70 transition-all" style={{ width: `${progreso.p}%` }} /></div></div></div>
        )}
      </div>
      {/* Escribir (una sola grabadora, que no se reemplaza al grabar) */}
      <div className="flex gap-1.5 items-center">
        {!grabando && (
          <div className="flex-1 min-w-0 flex items-center gap-1 h-11 pl-1 pr-3 rounded-full bg-[color:var(--c-232430)] border border-transparent focus-within:border-[color:var(--c-818cf8)]/50">
            <BotonAdjuntar deshabilitado={enviando} onArchivo={(f) => enviarAdjunto(f, f.name)} />
            <input value={texto} onChange={(ev) => setTexto(ev.target.value.slice(0, 1000))} onKeyDown={(ev) => { if (ev.key === 'Enter') enviar(); }} placeholder="Escribe un mensaje" className="flex-1 min-w-0 h-full bg-transparent text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
          </div>
        )}
        {texto.trim().length >= 2 && !grabando
          ? <button type="button" disabled={enviando} onClick={enviar} aria-label="Enviar" className="w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send className="w-4 h-4" /></button>
          : (
            <div className={grabando ? 'flex-1 min-w-0 flex items-center' : 'w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] flex items-center justify-center flex-shrink-0 [&_button]:!text-white [&_button:hover]:!bg-transparent'}>
              <Grabadora deshabilitado={enviando} onGrabando={setGrabando} onListo={(audio, nombre, seg) => enviarAdjunto(audio, nombre, seg)} />
            </div>
          )}
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </section>
  );
}
