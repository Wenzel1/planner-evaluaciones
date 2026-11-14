'use client';
// Mensajes del estudiante: sus conversaciones privadas con sus profesores (una por evaluación),
// como WhatsApp de escritorio: la lista a la izquierda y la conversación abierta a la derecha, a todo el alto.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Lock, MessageSquare, Plus, Search, X } from 'lucide-react';
import Selector from '@/components/Selector';
import { BloqueMensajes } from '@/components/EntregaEstudiante';
import { type Resumen, colorDe, limpiar } from './comun';

export default function Mensajes({ datos, onLeidos }: { datos: Resumen; onLeidos: (evaluacionId: string) => void }) {
  const conversaciones = datos.evaluaciones.filter(e => e.mensajes > 0).sort((a, b) => b.mensajesNuevos - a.mensajesNuevos);
  const todas = datos.evaluaciones.filter(e => e.estado !== 'CANCELADA');
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = caja.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const dos = ancho >= 700; // lista y conversación lado a lado
  const [sel, setSel] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [buscar, setBuscar] = useState('');
  const elegidoId = sel ?? (dos ? conversaciones[0]?.id ?? null : null);
  const actual = datos.evaluaciones.find(e => e.id === elegidoId);
  const filtro = buscar.trim().toLowerCase();
  const lista = conversaciones.filter(e => !filtro || `${e.nombre} ${e.materia} ${e.profesor}`.toLowerCase().includes(filtro));
  // Si eligió una evaluación sin conversación todavía, también aparece arriba en la lista
  const enLista = actual && !lista.some(e => e.id === actual.id) ? [actual, ...lista] : lista;
  const inicial = (t: string) => (t || '?').trim().charAt(0).toUpperCase();

  const columnaLista = (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-3 border-b border-[color:var(--c-282a3f)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 h-9 flex items-center gap-2 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-2a2b3d)] focus-within:border-[color:var(--c-818cf8)]/50">
            <Search className="w-3.5 h-3.5 text-[color:var(--c-6a6b7e)] flex-shrink-0" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar" className="flex-1 min-w-0 bg-transparent text-[13px] text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
          </div>
          <button type="button" onClick={() => setNueva(v => !v)} title="Escribir a un profesor" aria-label="Escribir a un profesor" className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${nueva ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'bg-[color:var(--c-818cf8)] text-white hover:bg-[color:var(--c-6366f1)]'}`}>{nueva ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</button>
        </div>
        {nueva && (
          <Selector defaultValue="" onChange={(e) => { if (e.target.value) { setSel(e.target.value); setNueva(false); } }} className="w-full h-9 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-d0d0da)]">
            <option value="" disabled>¿Sobre qué evaluación le escribes?</option>
            {todas.map(e => <option key={e.id} value={e.id}>{limpiar(e.nombre)} · {e.materia}</option>)}
          </Selector>
        )}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {enLista.length === 0 && <li className="px-4 py-10 text-center text-sm text-[color:var(--c-8a8b9e)]">{filtro ? 'Nada coincide con tu búsqueda.' : 'Aún no tienes conversaciones. Toca ＋ para escribirle a un profesor.'}</li>}
        {enLista.map(e => {
          const activa = e.id === elegidoId; const color = colorDe(datos.grupos, e.grupo);
          return (
            <li key={e.id}>
              <button type="button" onClick={() => setSel(e.id)} className={`w-full px-3 py-3 flex items-center gap-3 text-left border-l-2 transition-colors ${activa ? 'bg-[color:var(--c-818cf8)]/10 border-[color:var(--c-818cf8)]' : 'border-transparent hover:bg-[color:var(--c-818cf8)]/[0.04]'}`}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold" style={{ background: color + '26', color }}>{inicial(e.profesor)}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><span className={`flex-1 min-w-0 text-[13px] truncate ${e.mensajesNuevos ? 'font-semibold text-[color:var(--c-e0e0ec)]' : 'font-medium text-[color:var(--c-d0d0da)]'}`}>Prof. {e.profesor}</span><span className="text-[10px] text-[color:var(--c-6a6b7e)] flex-shrink-0 truncate max-w-[40%]">{e.materia}</span></span>
                  <span className="flex items-center gap-2 mt-0.5"><span className="flex-1 min-w-0 text-[12px] text-[color:var(--c-8a8b9e)] truncate">{limpiar(e.nombre)}</span>{e.mensajesNuevos > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--c-818cf8)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{e.mensajesNuevos}</span>}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const columnaChat = actual ? (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-16 px-4 flex items-center gap-3 border-b border-[color:var(--c-282a3f)] flex-shrink-0">
        {!dos && <button type="button" onClick={() => setSel(null)} aria-label="Volver a la lista" className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-232430)]"><ArrowLeft className="w-4 h-4" /></button>}
        <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold" style={{ background: colorDe(datos.grupos, actual.grupo) + '26', color: colorDe(datos.grupos, actual.grupo) }}>{inicial(actual.profesor)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">Prof. {actual.profesor}</p>
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{limpiar(actual.nombre)} · {actual.materia}</p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-[color:var(--c-6a6b7e)]"><Lock className="w-3 h-3" />Privado</span>
      </div>
      <div className="flex-1 min-h-0">
        <BloqueMensajes key={actual.id} panel token={actual.token} evaluacionId={actual.id} nuevos={actual.mensajesNuevos} onLeidos={() => onLeidos(actual.id)} />
      </div>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-[color:var(--c-161722)]">
      <span className="w-14 h-14 rounded-2xl bg-[color:var(--c-818cf8)]/10 flex items-center justify-center"><MessageSquare className="w-7 h-7 text-[color:var(--c-a5b4fc)]" /></span>
      <p className="text-sm font-medium text-[color:var(--c-d0d0da)]">Tus mensajes privados</p>
      <p className="text-xs text-[color:var(--c-8a8b9e)] max-w-xs">Elige una conversación o toca ＋ para escribirle a un profesor sobre una evaluación. Solo la ve ese profesor.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">Mensajes</h1><p className="text-sm text-[color:var(--c-8a8b9e)]">Tus conversaciones privadas: solo las ve el profesor de esa materia.</p></div>
      <div ref={caja} className="h-[calc(100dvh-230px)] min-h-[460px] rounded-2xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
        {dos ? (
          <div className="h-full grid grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-r border-[color:var(--c-282a3f)] min-h-0">{columnaLista}</div>
            <div className="min-h-0">{columnaChat}</div>
          </div>
        ) : actual ? columnaChat : columnaLista}
      </div>
    </div>
  );
}
