'use client';
// Corrección con IA dentro del visor: lee la entrega, propone la nota (con la rúbrica si existe),
// dice qué corregir y cómo mejorar, y responde preguntas sobre el trabajo. El profesor decide la nota final.
import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Send, RotateCcw, ClipboardCheck, MessageSquare, Info } from 'lucide-react';
import { NIVELES_RUBRICA } from '@/lib/rubrica';
import { COLOR_BOTON_NIVEL, NIVEL_CORTO, textoNota } from '@/components/planificador/ModalNotas';

export interface Analisis {
  nota: number | null;
  criterios: { nombre: string; nivel: number | null; comentario: string }[];
  resumen: string; fortalezas: string[]; correcciones: string[]; mejoras: string[];
  confianza: 'alta' | 'media' | 'baja'; limitaciones: string | null; archivosLeidos: string[];
}
interface Msg { rol: 'user' | 'assistant'; texto: string }

function Texto({ t }: { t: string }) {
  return <>{t.split('\n').map((linea, i) => {
    const partes = linea.replace(/^\s*[-*]\s+/, '• ').split(/(\*\*[^*]+\*\*)/g);
    return <p key={i} className={linea.trim() ? '' : 'h-1.5'}>{partes.map((p, k) => (p.startsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <span key={k}>{p}</span>))}</p>;
  })}</>;
}

export default function CorreccionIA({ entregaId, analisis, onAnalisis, onUsarNota, onEnviar }: {
  entregaId: string; analisis: Analisis | null; onAnalisis: (a: Analisis) => void;
  onUsarNota: (a: Analisis) => void; onEnviar: (texto: string) => Promise<void>;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<Msg[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const analizar = async () => {
    setCargando(true); setError(''); setEnviado(false);
    try {
      const r = await fetch(`/api/entregas/${encodeURIComponent(entregaId)}/corregir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo revisar.');
      onAnalisis(d.analisis); setChat([]);
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  };
  const preguntar = async (t: string) => {
    const q = t.trim(); if (!q) return;
    const historial = [...chat, { rol: 'user' as const, texto: q }];
    setChat(historial); setPregunta(''); setPensando(true);
    try {
      const r = await fetch(`/api/entregas/${encodeURIComponent(entregaId)}/corregir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta: q, historial: chat, analisis }) });
      const d = await r.json().catch(() => ({}));
      setChat(h => [...h, { rol: 'assistant', texto: r.ok ? d.respuesta : (d.error || 'No pude responder.') }]);
    } catch { setChat(h => [...h, { rol: 'assistant', texto: 'No pude responder.' }]); } finally { setPensando(false); }
  };
  const enviar = async () => {
    if (!analisis) return;
    const texto = ['Retroalimentación de tu entrega:', analisis.correcciones.length ? `\nQué corregir:\n${analisis.correcciones.map(x => `• ${x}`).join('\n')}` : '', analisis.mejoras.length ? `\nCómo mejorarlo:\n${analisis.mejoras.map(x => `• ${x}`).join('\n')}` : ''].join('\n').trim();
    await onEnviar(texto.slice(0, 1000)); setEnviado(true);
  };

  const titulo = 'text-[11px] font-semibold uppercase tracking-wider';
  if (!analisis) {
    return (
      <div className="p-5 space-y-4">
        <div className="rounded-2xl border border-[color:var(--c-818cf8)]/25 bg-[color:var(--c-818cf8)]/[0.06] p-5 text-center space-y-3">
          <span className="w-12 h-12 mx-auto rounded-2xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center"><Sparkles className="w-6 h-6 text-[color:var(--c-a5b4fc)]" /></span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Corregir con IA</p>
            <p className="text-xs text-[color:var(--c-8a8b9e)] mt-1 leading-relaxed">La IA lee los archivos de la entrega (PDF, Word, PowerPoint, Excel, código e imágenes), los compara con la consigna y la rúbrica, propone una nota y te dice qué corregir y cómo mejorarlo. Tú decides la nota final.</p>
          </div>
          <button type="button" onClick={analizar} disabled={cargando} className="h-10 px-5 rounded-xl bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
            {cargando ? <><Loader2 className="w-4 h-4 animate-spin" />Leyendo la entrega…</> : <><Sparkles className="w-4 h-4" />Analizar con IA</>}
          </button>
          {cargando && <p className="text-[11px] text-[color:var(--c-6a6b7e)]">Puede tardar unos 20 a 40 segundos.</p>}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
        <p className="text-[11px] text-[color:var(--c-6a6b7e)] flex gap-1.5"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />Los archivos se envían a la IA (Google Gemini) solo para esta corrección.</p>
      </div>
    );
  }

  const tonoConfianza = analisis.confianza === 'alta' ? 'text-emerald-300' : analisis.confianza === 'media' ? 'text-amber-300' : 'text-red-300';
  return (
    <div className="p-4 space-y-4">
      {/* Nota sugerida */}
      <div className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-161722)] p-4">
        <div className="flex items-center gap-4">
          <div>
            <p className={`${titulo} text-[color:var(--c-8a8b9e)]`}>Nota sugerida</p>
            <p className="text-4xl font-bold text-[color:var(--c-e0e0ec)] tabular-nums leading-tight">{analisis.nota == null ? '—' : textoNota(analisis.nota)}<span className="text-sm font-normal text-[color:var(--c-6a6b7e)]"> /20</span></p>
            <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Confianza <b className={tonoConfianza}>{analisis.confianza}</b></p>
          </div>
          <div className="ml-auto flex flex-col gap-2">
            <button type="button" onClick={() => onUsarNota(analisis)} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4" />Usar esta nota</button>
            <button type="button" onClick={analizar} disabled={cargando} className="h-8 px-3 rounded-lg border border-[color:var(--c-313248)] text-[11px] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] flex items-center gap-1.5 disabled:opacity-50">{cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Volver a analizar</button>
          </div>
        </div>
        {analisis.resumen && <p className="text-[13px] text-[color:var(--c-c0c0d0)] mt-3 leading-relaxed">{analisis.resumen}</p>}
      </div>

      {/* Rúbrica */}
      {analisis.criterios.length > 0 && (
        <section className="space-y-2">
          <p className={`${titulo} text-[color:var(--c-8a8b9e)]`}>Por criterio</p>
          {analisis.criterios.map((c, k) => (
            <div key={k} className="rounded-xl border border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] p-2.5">
              <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-[color:var(--c-d0d0da)]">{c.nombre}</p>{c.nivel != null && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 ${COLOR_BOTON_NIVEL[c.nivel]}`} title={NIVELES_RUBRICA[c.nivel]}>{NIVEL_CORTO[c.nivel]}</span>}</div>
              {c.comentario && <p className="text-[11px] text-[color:var(--c-8a8b9e)] mt-1 leading-snug">{c.comentario}</p>}
            </div>
          ))}
        </section>
      )}

      <Lista titulo="Fortalezas" items={analisis.fortalezas} icono={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 mt-0.5" />} color="text-emerald-300" />
      <Lista titulo="Qué corregir" items={analisis.correcciones} icono={<AlertTriangle className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />} color="text-amber-300" />
      <Lista titulo="Cómo mejorarlo" items={analisis.mejoras} icono={<ArrowRight className="w-3.5 h-3.5 text-[color:var(--c-a5b4fc)] flex-shrink-0 mt-0.5" />} color="text-[color:var(--c-a5b4fc)]" />

      {(analisis.correcciones.length > 0 || analisis.mejoras.length > 0) && (
        <button type="button" onClick={enviar} disabled={enviado} className="w-full h-10 rounded-xl border border-[color:var(--c-818cf8)]/35 bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[color:var(--c-818cf8)]/20 disabled:opacity-60">
          {enviado ? <><CheckCircle2 className="w-4 h-4" />Enviado al estudiante</> : <><MessageSquare className="w-4 h-4" />Enviar correcciones al estudiante</>}
        </button>
      )}
      {(analisis.limitaciones || analisis.archivosLeidos.length > 0) && (
        <p className="text-[11px] text-[color:var(--c-6a6b7e)] leading-snug">{analisis.archivosLeidos.length > 0 && <>Leyó: {analisis.archivosLeidos.join(', ')}. </>}{analisis.limitaciones}</p>
      )}

      {/* Preguntas sobre la entrega */}
      <section className="space-y-2 pt-1">
        <p className={`${titulo} text-[color:var(--c-8a8b9e)]`}>Pregúntale sobre esta entrega</p>
        {chat.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {['¿Por qué esa nota?', '¿Qué es lo más grave?', 'Dame un comentario breve para el estudiante'].map(s => <button key={s} type="button" onClick={() => preguntar(s)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[color:var(--c-313248)] text-[color:var(--c-b0b0c4)] hover:border-[color:var(--c-818cf8)]/50">{s}</button>)}
          </div>
        )}
        <div className="space-y-2">
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] text-xs leading-relaxed rounded-2xl px-3 py-2 space-y-0.5 ${m.rol === 'user' ? 'bg-[color:var(--c-818cf8)] text-white rounded-br-md' : 'bg-[color:var(--c-232430)] text-[color:var(--c-d0d0da)] rounded-bl-md'}`}><Texto t={m.texto} /></div>
            </div>
          ))}
          {pensando && <div className="flex"><div className="rounded-2xl rounded-bl-md bg-[color:var(--c-232430)] px-3 py-2.5 flex gap-1">{[0, 1, 2].map(k => <span key={k} className="w-1.5 h-1.5 rounded-full bg-[color:var(--c-8a8b9e)] animate-bounce" style={{ animationDelay: `${k * 0.15}s` }} />)}</div></div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); preguntar(pregunta); }} className="flex gap-2">
          <input value={pregunta} onChange={(e) => setPregunta(e.target.value.slice(0, 1500))} placeholder="Ej.: ¿cumple con la consigna?" className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
          <button type="submit" disabled={pensando || !pregunta.trim()} aria-label="Preguntar" className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send className="w-4 h-4" /></button>
        </form>
      </section>
    </div>
  );
}

function Lista({ titulo, items, icono, color }: { titulo: string; items: string[]; icono: React.ReactNode; color: string }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${color}`}>{titulo}</p>
      <ul className="space-y-1.5">{items.map((t, i) => <li key={i} className="flex gap-2 text-[13px] text-[color:var(--c-c0c0d0)] leading-snug">{icono}<span>{t}</span></li>)}</ul>
    </section>
  );
}
