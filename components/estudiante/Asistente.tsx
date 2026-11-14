'use client';
import Selector from '@/components/Selector';
// Asistente de estudio del estudiante (panel grande a la izquierda, como el chat del profesor):
// explica los temas, hace preguntas de práctica y ayuda a organizar el estudio. No hace la tarea.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles, PanelLeftClose, RotateCcw } from 'lucide-react';
import { type Resumen, limpiar, cuandoTexto } from './comun';
import { useBajarAlFinal } from '@/components/Burbuja';

interface Msg { rol: 'user' | 'assistant'; texto: string }

// Formato mínimo: **negrita** y listas con guion
function Texto({ t }: { t: string }) {
  return <>{t.split('\n').map((linea, i) => {
    const partes = linea.replace(/^\s*[-*]\s+/, '• ').split(/(\*\*[^*]+\*\*)/g);
    return <p key={i} className={linea.trim() ? '' : 'h-2'}>{partes.map((p, k) => (p.startsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <span key={k}>{p}</span>))}</p>;
  })}</>;
}

export default function Asistente({ datos, nombre, onOcultar }: { datos: Resumen | null; nombre: string; onOcultar?: () => void }) {
  const grupos = datos?.grupos || [];
  const [grupo, setGrupo] = useState('');
  const [evId, setEvId] = useState('');
  // Una conversación por tema (materia o evaluación); se conserva al cambiar
  const [conversaciones, setConversaciones] = useState<Record<string, Msg[]>>({});
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const fin = useRef<HTMLDivElement>(null);

  // Por defecto: la próxima evaluación
  useEffect(() => {
    if (!datos || grupo) return;
    const prox = datos.evaluaciones.filter(e => e.fecha && new Date(e.fecha).getTime() > Date.now() && e.estado !== 'CANCELADA').sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime())[0];
    setGrupo(prox?.grupo || grupos[0]?.clave || '');
    setEvId(prox?.id || '');
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = grupos.find(x => x.clave === grupo) || grupos[0];
  const evaluaciones = useMemo(() => (datos?.evaluaciones || []).filter(e => e.grupo === g?.clave && e.estado !== 'CANCELADA'), [datos, g?.clave]);
  const ev = evaluaciones.find(e => e.id === evId);
  const clave = `${g?.clave || ''}:${evId}`;
  const msgs = conversaciones[clave] || [];
  const desplazar = useBajarAlFinal([msgs.length, pensando, clave]);

  const preguntar = async (t: string) => {
    if (!g || !t.trim()) return;
    const nuevos = [...msgs, { rol: 'user' as const, texto: t.trim() }];
    desplazar.forzar(); setConversaciones(c => ({ ...c, [clave]: nuevos })); setTexto(''); setPensando(true); setError('');
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(g.token)}/tutor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId: evId || undefined, mensajes: nuevos }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No pude responder.');
      setConversaciones(c => ({ ...c, [clave]: [...(c[clave] || nuevos), { rol: 'assistant', texto: d.texto }] }));
    } catch (e: any) { setError(e.message); } finally { setPensando(false); }
  };
  const sugerencias = ev
    ? [`Explícame de qué trata «${limpiar(ev.nombre)}»`, 'Hazme 3 preguntas de práctica', '¿Qué debería estudiar primero?', 'Hazme un plan de estudio para esta semana']
    : ['¿Cómo me preparo para mis evaluaciones?', 'Hazme preguntas de práctica', 'Explícame un tema que no entiendo'];

  return (
    <div className="h-full flex flex-col bg-[color:var(--c-161722)]">
      {/* Encabezado */}
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-[color:var(--c-282a3f)] flex-shrink-0">
        <span className="w-8 h-8 rounded-xl bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/30 flex items-center justify-center"><Bot className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Asistente de estudio</p><p className="text-[10px] text-[color:var(--c-8a8b9e)]">Te explica y te pone a prueba. No hace la tarea por ti.</p></div>
        {msgs.length > 0 && <button type="button" onClick={() => setConversaciones(c => ({ ...c, [clave]: [] }))} title="Nueva conversación" aria-label="Nueva conversación" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10"><RotateCcw className="w-4 h-4" /></button>}
        {onOcultar && <button type="button" onClick={onOcultar} title="Ocultar el asistente" aria-label="Ocultar el asistente" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10"><PanelLeftClose className="w-4 h-4" /></button>}
      </div>

      {/* Sobre qué estudiar */}
      <div className="px-4 py-3 border-b border-[color:var(--c-282a3f)] grid grid-cols-2 gap-2 flex-shrink-0">
        <Selector value={g?.clave || ''} onChange={(e) => { setGrupo(e.target.value); setEvId(''); }} className="h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-d0d0da)] min-w-0">
          {grupos.map(x => <option key={x.clave} value={x.clave}>{x.materia}</option>)}
        </Selector>
        <Selector value={evId} onChange={(e) => setEvId(e.target.value)} className="h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-d0d0da)] min-w-0">
          <option value="">Toda la materia</option>
          {evaluaciones.map(e => <option key={e.id} value={e.id}>{limpiar(e.nombre)}</option>)}
        </Selector>
      </div>

      {/* Conversación */}
      <div ref={desplazar.caja} onScroll={desplazar.onScroll} className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-4 py-4 space-y-3">
        {!datos ? <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-8">Cargando tus materias…</p> : msgs.length === 0 ? (
          <div className="space-y-4 pt-4">
            <div className="text-center">
              <span className="w-12 h-12 mx-auto rounded-2xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center"><Sparkles className="w-6 h-6 text-[color:var(--c-a5b4fc)]" /></span>
              <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] mt-3">Hola, {nombre.split(' ')[0]}. ¿Qué estudiamos?</p>
              <p className="text-xs text-[color:var(--c-8a8b9e)] mt-1">{ev ? <>Sobre «{limpiar(ev.nombre)}»{ev.fecha ? ` · ${cuandoTexto(ev.fecha)}` : ''}</> : g ? `Sobre ${g.materia}` : 'Únete a una clase para empezar.'}</p>
            </div>
            <div className="space-y-1.5">
              {sugerencias.map(s => <button key={s} type="button" onClick={() => preguntar(s)} className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-818cf8)]/50 hover:text-[color:var(--c-e0e0ec)] transition-colors">{s}</button>)}
            </div>
          </div>
        ) : msgs.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] text-[13px] leading-relaxed rounded-2xl px-3.5 py-2.5 space-y-1 ${m.rol === 'user' ? 'bg-[color:var(--c-818cf8)] text-white rounded-br-md' : 'bg-[color:var(--c-232430)] text-[color:var(--c-d0d0da)] rounded-bl-md'}`}><Texto t={m.texto} /></div>
          </div>
        ))}
        {pensando && <div className="flex"><div className="rounded-2xl rounded-bl-md bg-[color:var(--c-232430)] px-3.5 py-3 flex gap-1">{[0, 1, 2].map(k => <span key={k} className="w-1.5 h-1.5 rounded-full bg-[color:var(--c-8a8b9e)] animate-bounce" style={{ animationDelay: `${k * 0.15}s` }} />)}</div></div>}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div ref={fin} />
      </div>

      {/* Escribir */}
      <form onSubmit={(e) => { e.preventDefault(); preguntar(texto); }} className="p-3 border-t border-[color:var(--c-282a3f)] flex gap-2 flex-shrink-0">
        <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 1500))} disabled={!g} placeholder={g ? 'Pregúntale lo que no entiendas…' : 'Únete a una clase primero'} className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
        <button type="submit" disabled={pensando || !texto.trim() || !g} aria-label="Enviar" className="w-11 h-11 rounded-xl bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
