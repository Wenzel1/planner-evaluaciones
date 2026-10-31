'use client';
// Examen en línea de una evaluación (profesor): editor de preguntas + entregas de los estudiantes (corregir y publicar).
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CheckCircle, Sparkles, Send, RotateCcw, Lock, LockOpen, FileCheck, Clock, AlertCircle, ChevronLeft, Save } from 'lucide-react';
import { normalizarExamen, notaDe, esObjetiva, TIPOS_PREGUNTA, type Examen, type Pregunta, type TipoPregunta, type Correccion } from '@/lib/examen';

export interface EvalExamen { id: string; nombre: string; fecha?: Date | string | null; tiempoEstimadoMinutos?: number | null; grupoSeccion?: string }
interface Entrega {
  estudianteId: string; nombre: string; estado: 'sin_empezar' | 'en_curso' | 'entregado' | 'publicada';
  inicio: string | null; limite: string | null; entregadoEn: string | null;
  respuestas: Record<string, any>; correccion: Correccion; nota: number | null; comentario: string; porCorregir: number;
}

const ZONA = 'America/Caracas';
const fHora = (d: string | Date) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const fNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));
const limpiar = (t: string) => String(t || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').trim();
const nuevaPregunta = (tipo: TipoPregunta, i: number): Pregunta => tipo === 'seleccion'
  ? { id: `p${Date.now()}${i}`, tipo, enunciado: '', opciones: ['', '', '', ''], correcta: 0, puntos: 2 }
  : tipo === 'vf' ? { id: `p${Date.now()}${i}`, tipo, enunciado: '', correcta: 1, puntos: 1 }
  : { id: `p${Date.now()}${i}`, tipo, enunciado: '', esperado: '', puntos: 5 };

const campo = 'w-full bg-[#191a26] border border-[#313248] rounded-lg px-3 py-2 text-[13px] text-[#e0e0ec] outline-none focus:border-[#818cf8]/60 placeholder-[#5f6074]';
const boton = 'h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50';

// ---------- Editor de preguntas (también lo usa el chat para "editar antes de adjuntar") ----------
export function EditorPreguntas({ examen, onChange }: { examen: Examen; onChange: (e: Examen) => void }) {
  const set = (cambio: Partial<Examen>) => onChange({ ...examen, ...cambio });
  const setP = (i: number, cambio: Partial<Pregunta>) => set({ preguntas: examen.preguntas.map((p, k) => (k === i ? { ...p, ...cambio } : p)) });
  const total = examen.preguntas.reduce((t, p) => t + (Number(p.puntos) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_170px] gap-2">
        <textarea value={examen.instrucciones} onChange={(e) => set({ instrucciones: e.target.value })} rows={2} placeholder="Instrucciones para el estudiante" className={`${campo} resize-y`} />
        <label className="text-[11px] text-[#8a8b9e]">Duración (min)<input type="number" min={5} max={300} value={examen.duracionMin} onChange={(e) => set({ duracionMin: Number(e.target.value) || 0 })} className={`${campo} mt-1`} /></label>
        <label className="text-[11px] text-[#8a8b9e]">Corrección
          <select value={examen.modoCorreccion} onChange={(e) => set({ modoCorreccion: e.target.value as any })} className={`${campo} mt-1`}>
            <option value="sugerida">La IA sugiere, yo publico</option>
            <option value="profesor">Solo yo corrijo</option>
            <option value="automatica">Automática (se publica sola)</option>
          </select>
        </label>
      </div>
      {examen.modoCorreccion === 'automatica' && examen.preguntas.some(p => !esObjetiva(p)) && (
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />Con preguntas de desarrollo o informe, la nota automática la pone la IA sin que nadie la revise. Recomendado: "La IA sugiere, yo publico".</p>
      )}
      <ol className="space-y-3">
        {examen.preguntas.map((p, i) => (
          <li key={p.id} className="rounded-xl border border-[#313248] bg-[#1d1e2e] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#818cf8]/15 text-[#a5b4fc] text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <select value={p.tipo} onChange={(e) => { const t = e.target.value as TipoPregunta; setP(i, { ...nuevaPregunta(t, i), id: p.id, enunciado: p.enunciado, puntos: p.puntos }); }} className="bg-[#191a26] border border-[#313248] rounded-lg px-2 py-1 text-[12px] text-[#c0c0d0]">
                {(Object.keys(TIPOS_PREGUNTA) as TipoPregunta[]).map(t => <option key={t} value={t}>{TIPOS_PREGUNTA[t]}</option>)}
              </select>
              <label className="ml-auto text-[11px] text-[#8a8b9e] flex items-center gap-1">Puntos<input type="number" step={0.25} min={0} value={p.puntos} onChange={(e) => setP(i, { puntos: Number(e.target.value) || 0 })} className="w-16 bg-[#191a26] border border-[#313248] rounded-md px-1.5 py-1 text-[12px] text-[#e0e0ec] text-right" /></label>
              <button type="button" onClick={() => set({ preguntas: examen.preguntas.filter((_, k) => k !== i) })} aria-label="Quitar pregunta" className="p-1.5 rounded-lg text-[#6a6b7e] hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <textarea value={p.enunciado} onChange={(e) => setP(i, { enunciado: e.target.value })} rows={2} placeholder="Enunciado de la pregunta" className={`${campo} resize-y`} />
            {p.tipo === 'seleccion' && (
              <div className="space-y-1.5">
                {(p.opciones || []).map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input type="radio" name={`c-${p.id}`} checked={p.correcta === k} onChange={() => setP(i, { correcta: k })} className="accent-emerald-400" title="Marcar como correcta" />
                    <span className="text-[11px] text-[#6a6b7e] w-4">{'abcdef'[k]})</span>
                    <input value={o} onChange={(e) => setP(i, { opciones: (p.opciones || []).map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Opción ${k + 1}`} className={`${campo} py-1.5 ${p.correcta === k ? 'border-emerald-500/50' : ''}`} />
                    {(p.opciones || []).length > 2 && <button type="button" onClick={() => setP(i, { opciones: (p.opciones || []).filter((_, j) => j !== k), correcta: (p.correcta ?? 0) >= k && (p.correcta ?? 0) > 0 ? (p.correcta ?? 0) - 1 : p.correcta })} className="p-1 text-[#6a6b7e] hover:text-red-300"><X className="w-3 h-3" /></button>}
                  </div>
                ))}
                {(p.opciones || []).length < 6 && <button type="button" onClick={() => setP(i, { opciones: [...(p.opciones || []), ''] })} className="text-[11px] text-[#a5b4fc] hover:text-white">+ opción</button>}
                <p className="text-[10px] text-[#6a6b7e]">Marca con el círculo la respuesta correcta.</p>
              </div>
            )}
            {p.tipo === 'vf' && (
              <div className="flex gap-3 text-[12px] text-[#c0c0d0]">
                <label className="flex items-center gap-1.5"><input type="radio" checked={p.correcta === 1} onChange={() => setP(i, { correcta: 1 })} className="accent-emerald-400" />Verdadero</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={p.correcta === 0} onChange={() => setP(i, { correcta: 0 })} className="accent-emerald-400" />Falso</label>
              </div>
            )}
            {(p.tipo === 'desarrollo' || p.tipo === 'informe') && (
              <textarea value={p.esperado || ''} onChange={(e) => setP(i, { esperado: e.target.value })} rows={2} placeholder="Qué debe incluir la respuesta (guía para corregir; el estudiante no la ve)" className={`${campo} resize-y text-[12px]`} />
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TIPOS_PREGUNTA) as TipoPregunta[]).map(t => (
          <button key={t} type="button" onClick={() => set({ preguntas: [...examen.preguntas, nuevaPregunta(t, examen.preguntas.length)] })} className="h-8 px-2.5 rounded-lg border border-dashed border-[#3a3b52] text-[11px] text-[#a5b4fc] hover:border-[#818cf8]/60 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" />{TIPOS_PREGUNTA[t]}</button>
        ))}
        <span className={`ml-auto text-[12px] font-semibold ${Math.abs(total - 20) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>Total: {fNota(Math.round(total * 100) / 100)}/20{Math.abs(total - 20) >= 0.01 ? ' (al guardar se ajusta a 20)' : ''}</span>
      </div>
    </div>
  );
}

// ---------- Ventana completa ----------
export default function ModalExamen({ evaluacion, inicial, onCerrar, onGuardado, notificar }: {
  evaluacion: EvalExamen; inicial?: Examen | null; onCerrar: () => void;
  onGuardado?: (examen: Examen | null) => void; notificar?: (m: string) => void;
}) {
  const [pestana, setPestana] = useState<'preguntas' | 'entregas'>(inicial ? 'preguntas' : 'entregas');
  const [cargando, setCargando] = useState(true);
  const [examen, setExamen] = useState<Examen | null>(inicial || null);
  const [guardado, setGuardado] = useState<Examen | null>(null);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [ventana, setVentana] = useState<{ abre: string | null; cierra: string | null }>({ abre: null, cierra: null });
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [viendo, setViendo] = useState<string | null>(null);
  const url = `/api/evaluaciones/${encodeURIComponent(evaluacion.id)}/examen`;

  const cargar = async () => {
    try {
      const r = await fetch(url); const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar el examen.');
      setGuardado(d.examen); if (!inicial) setExamen(d.examen);
      setEntregas(d.entregas || []); setVentana({ abre: d.abre, cierra: d.cierra });
      if (!d.examen && !inicial) setPestana('preguntas');
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accion = async (cuerpo: any, etiqueta: string) => {
    setOcupado(etiqueta); setError('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
      return d;
    } catch (e: any) { setError(e.message); return null; } finally { setOcupado(''); }
  };

  const guardar = async () => {
    if (!examen) return;
    const limpio = normalizarExamen(examen);
    if (!limpio) { setError('Agrega al menos una pregunta con enunciado.'); return; }
    const d = await accion({ accion: 'guardar', examen: limpio }, 'guardar');
    if (d) { setGuardado(d.examen); setExamen(d.examen); onGuardado?.(d.examen); notificar?.(`📝 Examen de «${limpiar(evaluacion.nombre)}» guardado (${d.examen.preguntas.length} preguntas).`); }
  };
  const quitar = async () => {
    if (!window.confirm('¿Quitar el examen de esta evaluación? Los estudiantes ya no podrán presentarlo.')) return;
    const d = await accion({ accion: 'guardar', examen: null }, 'quitar');
    if (d) { setGuardado(null); setExamen(null); onGuardado?.(null); }
  };
  const abrirYa = async (abrir: boolean) => {
    const d = await accion({ accion: 'abrir_ya', abrir }, 'abrir');
    if (d) { setGuardado(d.examen); setExamen(d.examen); onGuardado?.(d.examen); await cargar(); notificar?.(abrir ? '🔓 Examen abierto ahora para los estudiantes.' : '🔒 El examen vuelve a abrirse en la fecha de la evaluación.'); }
  };
  const publicarTodas = async () => { const d = await accion({ accion: 'publicar' }, 'publicar'); if (d) { await cargar(); notificar?.(`✅ ${d.publicadas} nota(s) publicada(s).`); } };
  const sugerirTodas = async () => { const d = await accion({ accion: 'sugerir' }, 'sugerir'); if (d) { await cargar(); notificar?.(d.error ? `⚠️ La IA no pudo corregir algunas: ${d.error}` : `✨ La IA sugirió la nota de ${d.hechas} examen(es).`); } };

  const sinPublicar = entregas.filter(e => e.estado === 'entregado' && e.nota != null).length;
  const conPendientes = entregas.filter(e => e.estado === 'entregado' && e.porCorregir > 0).length;
  const sinCambios = useMemo(() => JSON.stringify(examen) === JSON.stringify(guardado), [examen, guardado]);
  const sel = entregas.find(e => e.estudianteId === viendo) || null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-2 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border border-[#313248] bg-[#161722] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#282a3f] flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[#818cf8]/15 flex items-center justify-center"><FileCheck className="w-5 h-5 text-[#a5b4fc]" /></span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#e0e0ec] truncate">Examen en línea · {limpiar(evaluacion.nombre)}</h2>
            <p className="text-[11px] text-[#8a8b9e]">
              {ventana.abre ? <>Se abre {fHora(ventana.abre)}{guardado?.desde ? ' (abierto a mano)' : ''} · se puede empezar hasta {ventana.cierra ? fHora(ventana.cierra) : '—'}</> : 'Ponle fecha a la evaluación para que el examen se abra.'}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto p-2 rounded-lg text-[#8a8b9e] hover:text-white hover:bg-[#272839]"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pt-3 flex items-center gap-1 border-b border-[#282a3f]">
          {(['preguntas', 'entregas'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setPestana(t); setViendo(null); }} className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px ${pestana === t ? 'border-[#818cf8] text-white' : 'border-transparent text-[#8a8b9e] hover:text-[#c0c0d0]'}`}>
              {t === 'preguntas' ? 'Preguntas' : `Entregas${entregas.filter(e => e.entregadoEn).length ? ` (${entregas.filter(e => e.entregadoEn).length})` : ''}`}
            </button>
          ))}
          {guardado && (
            <button type="button" disabled={!!ocupado} onClick={() => abrirYa(!guardado.desde)} className={`ml-auto mb-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${guardado.desde ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-[#232430] border border-[#313248] text-[#c0c0d0] hover:text-white'}`}>
              {guardado.desde ? <><Lock className="w-3.5 h-3.5" />Volver a la fecha</> : <><LockOpen className="w-3.5 h-3.5" />Abrir ahora (para probar)</>}
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {cargando ? <p className="text-sm text-[#8a8b9e] py-10 text-center">Cargando…</p> : pestana === 'preguntas' ? (
            examen ? <EditorPreguntas examen={examen} onChange={setExamen} /> : (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-[#a8a9bc]">Esta evaluación todavía no tiene examen en línea.</p>
                <p className="text-[12px] text-[#6a6b7e]">Pídeselo al agente ("prepárame el examen de esta evaluación") o créalo aquí.</p>
                <button type="button" onClick={() => setExamen({ tipo: 'mixto', instrucciones: 'Lee con atención y responde todas las preguntas.', duracionMin: evaluacion.tiempoEstimadoMinutos || 60, modoCorreccion: 'sugerida', preguntas: [nuevaPregunta('seleccion', 0)] })} className={`${boton} mx-auto bg-[#818cf8] text-white hover:bg-[#6366f1]`}><Plus className="w-4 h-4" />Crear examen</button>
              </div>
            )
          ) : !guardado ? <p className="text-sm text-[#8a8b9e] py-10 text-center">Primero guarda el examen.</p> : sel ? (
            <DetalleEntrega examen={guardado} entrega={sel} ocupado={ocupado} onVolver={() => setViendo(null)}
              onGuardar={async (correccion, comentario, publicarYa) => {
                const d = await accion({ accion: 'corregir', estudianteId: sel.estudianteId, correccion, comentario }, 'corregir');
                if (d && publicarYa) await accion({ accion: 'publicar', estudianteIds: [sel.estudianteId] }, 'publicar');
                if (d) { await cargar(); notificar?.(publicarYa ? `✅ Nota de ${sel.nombre} publicada.` : `💾 Corrección de ${sel.nombre} guardada.`); }
              }}
              onSugerir={async () => { const d = await accion({ accion: 'sugerir', estudianteId: sel.estudianteId }, 'sugerir'); if (d) { await cargar(); if (d.error) setError(d.error); } }}
              onReabrir={async () => { if (!window.confirm(`¿Borrar el intento de ${sel.nombre} para que presente el examen de nuevo?`)) return; const d = await accion({ accion: 'reabrir', estudianteId: sel.estudianteId }, 'reabrir'); if (d) { setViendo(null); await cargar(); } }}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[12px] text-[#8a8b9e]">{entregas.filter(e => e.entregadoEn).length} de {entregas.length} entregaron · {entregas.filter(e => e.estado === 'en_curso').length} respondiendo</span>
                <button type="button" onClick={cargar} className="text-[11px] text-[#a5b4fc] hover:text-white flex items-center gap-1"><RotateCcw className="w-3 h-3" />Actualizar</button>
                <div className="ml-auto flex gap-2">
                  {conPendientes > 0 && guardado.modoCorreccion !== 'profesor' && <button type="button" disabled={!!ocupado} onClick={sugerirTodas} className={`${boton} bg-[#232430] border border-[#313248] text-[#c0c0d0] hover:text-white`}>{ocupado === 'sugerir' ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}Sugerir notas ({conPendientes})</button>}
                  {sinPublicar > 0 && <button type="button" disabled={!!ocupado} onClick={publicarTodas} className={`${boton} bg-emerald-500/90 text-white hover:bg-emerald-500`}><Send className="w-3.5 h-3.5" />Publicar notas ({sinPublicar})</button>}
                </div>
              </div>
              <div className="rounded-xl border border-[#2a2b3d] divide-y divide-[#2a2b3d] overflow-hidden">
                {entregas.length === 0 && <p className="px-4 py-6 text-sm text-[#8a8b9e] text-center">No hay estudiantes activos en la sección {evaluacion.grupoSeccion || ''}.</p>}
                {entregas.map(e => (
                  <button key={e.estudianteId} type="button" disabled={!e.entregadoEn && e.estado !== 'en_curso'} onClick={() => setViendo(e.estudianteId)} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#1d1e2e] disabled:hover:bg-transparent">
                    <span className="flex-1 min-w-0 text-[13px] text-[#d0d0da] truncate">{e.nombre}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${e.estado === 'publicada' ? 'bg-emerald-500/15 text-emerald-300' : e.estado === 'entregado' ? 'bg-[#818cf8]/15 text-[#c7d2fe]' : e.estado === 'en_curso' ? 'bg-amber-500/15 text-amber-300' : 'bg-[#232430] text-[#6a6b7e]'}`}>
                      {e.estado === 'publicada' ? 'Publicada' : e.estado === 'entregado' ? (e.porCorregir ? `Por corregir (${e.porCorregir})` : 'Por publicar') : e.estado === 'en_curso' ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Respondiendo</span> : 'No ha empezado'}
                    </span>
                    <span className={`w-14 text-right text-[13px] font-semibold ${e.nota == null ? 'text-[#5f6074]' : e.nota >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{e.nota == null ? '—' : fNota(e.nota)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-[12px] text-red-300 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{error}</p>}
        </div>

        {pestana === 'preguntas' && examen && (
          <div className="px-5 py-3 border-t border-[#282a3f] flex flex-wrap items-center gap-2 bg-[#191a26]">
            {guardado && <button type="button" disabled={!!ocupado} onClick={quitar} className={`${boton} text-[#8a8b9e] hover:text-red-300 hover:bg-red-500/10`}><Trash2 className="w-3.5 h-3.5" />Quitar examen</button>}
            <span className="ml-auto text-[11px] text-[#6a6b7e]">{sinCambios && guardado ? 'Sin cambios' : 'Cambios sin guardar'}</span>
            <button type="button" disabled={!!ocupado || (sinCambios && !!guardado)} onClick={guardar} className={`${boton} bg-[#818cf8] text-white hover:bg-[#6366f1]`}>{ocupado === 'guardar' ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}{guardado ? 'Guardar cambios' : 'Adjuntar a la evaluación'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Corregir el examen de un estudiante ----------
function DetalleEntrega({ examen, entrega, ocupado, onVolver, onGuardar, onSugerir, onReabrir }: {
  examen: Examen; entrega: Entrega; ocupado: string; onVolver: () => void;
  onGuardar: (c: Record<string, { puntos: number | null; comentario: string }>, comentario: string, publicar: boolean) => void;
  onSugerir: () => void; onReabrir: () => void;
}) {
  const [c, setC] = useState<Record<string, { puntos: number | null; comentario: string }>>(() =>
    Object.fromEntries(examen.preguntas.map(p => [p.id, { puntos: entrega.correccion?.[p.id]?.puntos ?? null, comentario: entrega.correccion?.[p.id]?.comentario || '' }])));
  const [comentario, setComentario] = useState(entrega.comentario || '');
  const nota = notaDe(examen, Object.fromEntries(Object.entries(c).map(([k, v]: [string, any]) => [k, { puntos: v?.puntos ?? null, comentario: v?.comentario, fuente: 'profesor' as const }])));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onVolver} className="text-[12px] text-[#a5b4fc] hover:text-white flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" />Entregas</button>
        <h3 className="text-[14px] font-semibold text-[#e0e0ec]">{entrega.nombre}</h3>
        <span className="text-[11px] text-[#8a8b9e]">{entrega.entregadoEn ? `entregó ${fHora(entrega.entregadoEn)}` : 'todavía respondiendo'}</span>
        <span className={`ml-auto text-lg font-bold ${nota == null ? 'text-[#6a6b7e]' : nota >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{nota == null ? 'Sin nota' : `${fNota(nota)}/20`}</span>
      </div>
      <ol className="space-y-3">
        {examen.preguntas.map((p, i) => {
          const r = entrega.respuestas?.[p.id];
          const fuente = entrega.correccion?.[p.id]?.fuente;
          return (
            <li key={p.id} className="rounded-xl border border-[#2a2b3d] bg-[#1d1e2e] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-[#6a6b7e] mt-0.5">{i + 1}.</span>
                <p className="flex-1 text-[13px] text-[#d0d0da]">{p.enunciado}</p>
                <span className="text-[10px] text-[#8a8b9e] whitespace-nowrap">{TIPOS_PREGUNTA[p.tipo]} · {fNota(p.puntos)} pts</span>
              </div>
              {p.tipo === 'seleccion' && (
                <ul className="ml-5 space-y-0.5 text-[12px]">
                  {(p.opciones || []).map((o, k) => (
                    <li key={k} className={k === p.correcta ? 'text-emerald-300' : r === k ? 'text-red-300' : 'text-[#8a8b9e]'}>{r === k ? '●' : '○'} {o}{k === p.correcta ? ' ✔' : ''}</li>
                  ))}
                  {r == null && <li className="text-amber-300">Sin responder</li>}
                </ul>
              )}
              {p.tipo === 'vf' && <p className="ml-5 text-[12px]"><span className={r == null ? 'text-amber-300' : r === p.correcta ? 'text-emerald-300' : 'text-red-300'}>{r == null ? 'Sin responder' : r === 1 ? 'Respondió: Verdadero' : 'Respondió: Falso'}</span> <span className="text-[#6a6b7e]">· correcta: {p.correcta === 1 ? 'Verdadero' : 'Falso'}</span></p>}
              {!esObjetiva(p) && (
                <>
                  <div className="ml-5 rounded-lg bg-[#161722] border border-[#2a2b3d] px-3 py-2 text-[13px] text-[#c0c0d0] whitespace-pre-wrap max-h-60 overflow-y-auto">{String(r ?? '').trim() || <span className="text-amber-300">Sin responder</span>}</div>
                  {p.esperado && <p className="ml-5 text-[11px] text-[#6a6b7e]">Se esperaba: {p.esperado}</p>}
                </>
              )}
              <div className="ml-5 flex flex-wrap items-center gap-2">
                <input type="number" step={0.25} min={0} max={p.puntos} value={c[p.id]?.puntos ?? ''} onChange={(e) => setC(prev => ({ ...prev, [p.id]: { ...prev[p.id], puntos: e.target.value === '' ? null : Math.min(p.puntos, Math.max(0, Number(e.target.value))) } }))} className="w-20 bg-[#191a26] border border-[#313248] rounded-md px-2 py-1 text-[12px] text-[#e0e0ec] text-right" />
                <span className="text-[11px] text-[#6a6b7e]">/ {fNota(p.puntos)}</span>
                {fuente === 'ia' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-1"><Sparkles className="w-3 h-3" />Sugerido por la IA</span>}
                {fuente === 'auto' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">Automático</span>}
                {!esObjetiva(p) && <input value={c[p.id]?.comentario || ''} onChange={(e) => setC(prev => ({ ...prev, [p.id]: { ...prev[p.id], comentario: e.target.value } }))} placeholder="Comentario para el estudiante" className="flex-1 min-w-[180px] bg-[#191a26] border border-[#313248] rounded-md px-2 py-1 text-[12px] text-[#e0e0ec]" />}
              </div>
            </li>
          );
        })}
      </ol>
      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentario general (lo ve el estudiante con su nota)" className={`${campo} resize-y`} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!ocupado} onClick={onReabrir} className={`${boton} text-[#8a8b9e] hover:text-amber-300 hover:bg-amber-500/10`}><RotateCcw className="w-3.5 h-3.5" />Permitir presentarlo de nuevo</button>
        {examen.preguntas.some(p => !esObjetiva(p)) && entrega.entregadoEn && <button type="button" disabled={!!ocupado} onClick={onSugerir} className={`${boton} bg-[#232430] border border-[#313248] text-[#c0c0d0] hover:text-white`}>{ocupado === 'sugerir' ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}Sugerir con IA</button>}
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={!!ocupado || !entrega.entregadoEn} onClick={() => onGuardar(c, comentario, false)} className={`${boton} bg-[#232430] border border-[#313248] text-[#c0c0d0] hover:text-white`}><Save className="w-3.5 h-3.5" />Guardar</button>
          <button type="button" disabled={!!ocupado || !entrega.entregadoEn || nota == null} onClick={() => onGuardar(c, comentario, true)} className={`${boton} bg-emerald-500/90 text-white hover:bg-emerald-500`}><CheckCircle className="w-3.5 h-3.5" />{entrega.estado === 'publicada' ? 'Actualizar nota publicada' : 'Guardar y publicar'}</button>
        </div>
      </div>
    </div>
  );
}
