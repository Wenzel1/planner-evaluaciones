'use client';
// Asistente de estudio del estudiante: explica los temas de su evaluación y le hace preguntas de práctica (no hace la tarea).
import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';

interface Opcion { id: string; nombre: string }
interface Msg { rol: 'user' | 'assistant'; texto: string }

// Formato mínimo: **negrita** y listas con guion
function Texto({ t }: { t: string }) {
  return <>{t.split('\n').map((linea, i) => {
    const partes = linea.replace(/^\s*[-*]\s+/, '• ').split(/(\*\*[^*]+\*\*)/g);
    return <p key={i} className={linea.trim() ? '' : 'h-2'}>{partes.map((p, k) => (p.startsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <span key={k}>{p}</span>))}</p>;
  })}</>;
}

export default function TutorEstudio({ token, evaluaciones, inicial }: { token: string; evaluaciones: Opcion[]; inicial?: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [evId, setEvId] = useState<string>(inicial || evaluaciones[0]?.id || '');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs.length, pensando]);
  const nombreEv = evaluaciones.find(e => e.id === evId)?.nombre;

  const preguntar = async (t: string) => {
    const nuevos = [...msgs, { rol: 'user' as const, texto: t }];
    setMsgs(nuevos); setTexto(''); setPensando(true); setError('');
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}/tutor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId: evId || undefined, mensajes: nuevos }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No pude responder.');
      setMsgs(prev => [...prev, { rol: 'assistant', texto: d.texto }]);
    } catch (e: any) { setError(e.message); } finally { setPensando(false); }
  };
  const sugerencias = nombreEv
    ? [`Explícame de qué trata «${nombreEv}»`, 'Hazme 3 preguntas de práctica', '¿Cómo organizo mi estudio esta semana?']
    : ['¿Cómo me preparo para mis evaluaciones?', 'Hazme preguntas de práctica'];

  return (
    <>
      {!abierto && (
        <button type="button" onClick={() => setAbierto(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-[color:var(--c-818cf8)] text-white text-sm font-semibold shadow-lg shadow-[color:var(--c-818cf8)]/30 hover:brightness-110">
          <Bot className="w-5 h-5" />Asistente de estudio
        </button>
      )}
      {abierto && (
        <div className="fixed z-50 inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px] h-[min(600px,calc(100dvh-24px))] flex flex-col bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[color:var(--c-313248)] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[color:var(--c-818cf8)] flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Asistente de estudio</p><p className="text-[11px] text-[color:var(--c-8a8b9e)]">Te explica y te hace practicar; la tarea la haces tú 😉</p></div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="p-1.5 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
          </div>
          {evaluaciones.length > 0 && (
            <div className="px-4 py-2 border-b border-[color:var(--c-2a2b3d)]">
              <select value={evId} onChange={(e) => { setEvId(e.target.value); setMsgs([]); }} className="w-full h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-d8d8e2)] outline-none">
                <option value="">Mis evaluaciones en general</option>
                {evaluaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {!msgs.length && (
              <div className="space-y-2">
                <p className="text-sm text-[color:var(--c-b0b0c4)] flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />¿Por dónde empezamos?</p>
                {sugerencias.map(s => <button key={s} type="button" onClick={() => preguntar(s)} className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-[color:var(--c-313248)] text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10">{s}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[88%] px-3 py-2 rounded-xl text-sm leading-relaxed space-y-0.5 ${m.rol === 'user' ? 'ml-auto bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-e0e0ec)]' : 'bg-[color:var(--c-272839)] text-[color:var(--c-d0d0da)]'}`}><Texto t={m.texto} /></div>
            ))}
            {pensando && <div className="w-fit px-3 py-2 rounded-xl bg-[color:var(--c-272839)]"><span className="eva-escribe !ml-0"><i /><i /><i /></span></div>}
            {error && <p className="text-xs text-red-300">{error}</p>}
            <div ref={fin} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (texto.trim() && !pensando) preguntar(texto.trim()); }} className="p-3 border-t border-[color:var(--c-2a2b3d)] flex gap-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1500} placeholder="Pregúntame lo que no entiendas…" className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/60" />
            <button type="submit" disabled={!texto.trim() || pensando} aria-label="Enviar" className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      )}
    </>
  );
}
