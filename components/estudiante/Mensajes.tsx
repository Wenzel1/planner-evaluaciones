'use client';
import Selector from '@/components/Selector';
// Mensajes del estudiante: todas sus conversaciones privadas con sus profesores (una por evaluación)
import { useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { BloqueMensajes } from '@/components/EntregaEstudiante';
import { type Resumen, colorDe, limpiar } from './comun';

export default function Mensajes({ datos, onLeidos }: { datos: Resumen; onLeidos: (evaluacionId: string) => void }) {
  const conversaciones = datos.evaluaciones.filter(e => e.mensajes > 0).sort((a, b) => b.mensajesNuevos - a.mensajesNuevos);
  const todas = datos.evaluaciones.filter(e => e.estado !== 'CANCELADA');
  const [sel, setSel] = useState<string | null>(conversaciones[0]?.id ?? null);
  const [nueva, setNueva] = useState(false);
  const actual = datos.evaluaciones.find(e => e.id === sel);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="mr-auto"><h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">Mensajes</h1><p className="text-sm text-[color:var(--c-8a8b9e)]">Tus conversaciones privadas: solo las ve el profesor de esa materia.</p></div>
        <button type="button" onClick={() => setNueva(v => !v)} className="h-9 px-3 rounded-lg bg-[color:var(--c-818cf8)] text-white text-xs font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" />Escribir a un profesor</button>
      </div>
      {nueva && (
        <div className="rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--c-8a8b9e)]">¿Sobre qué evaluación?</span>
          <Selector defaultValue="" onChange={(e) => { if (e.target.value) { setSel(e.target.value); setNueva(false); } }} className="flex-1 min-w-[220px] h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d0d0da)]">
            <option value="" disabled>Elige una evaluación…</option>
            {todas.map(e => <option key={e.id} value={e.id}>{limpiar(e.nombre)} · {e.materia}</option>)}
          </Selector>
        </div>
      )}
      <div className="grid md:grid-cols-[300px_minmax(0,1fr)] gap-4">
        <ul className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden divide-y divide-[color:var(--c-282a3f)] self-start">
          {conversaciones.length === 0 && <li className="px-4 py-6 text-sm text-[color:var(--c-8a8b9e)]">Aún no tienes conversaciones.</li>}
          {conversaciones.map(e => (
            <li key={e.id}><button type="button" onClick={() => setSel(e.id)} className={`w-full px-4 py-3 flex items-center gap-3 text-left ${sel === e.id ? 'bg-[color:var(--c-818cf8)]/10' : 'hover:bg-[color:var(--c-818cf8)]/[0.04]'}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorDe(datos.grupos, e.grupo) }} />
              <span className="flex-1 min-w-0"><span className={`block text-sm truncate ${e.mensajesNuevos ? 'font-semibold text-[color:var(--c-e0e0ec)]' : 'text-[color:var(--c-d0d0da)]'}`}>{limpiar(e.nombre)}</span><span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">Prof. {e.profesor} · {e.materia}</span></span>
              {e.mensajesNuevos > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--c-818cf8)] text-white text-[10px] font-bold flex items-center justify-center">{e.mensajesNuevos}</span>}
            </button></li>
          ))}
        </ul>
        <div>
          {actual ? (
            <div className="space-y-2">
              <p className="text-sm text-[color:var(--c-8a8b9e)]"><b className="text-[color:var(--c-d0d0da)]">{limpiar(actual.nombre)}</b> · {actual.materia} · Prof. {actual.profesor}</p>
              <BloqueMensajes key={actual.id} token={actual.token} evaluacionId={actual.id} nuevos={actual.mensajesNuevos} siempreAbierto onLeidos={() => onLeidos(actual.id)} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--c-3a3b52)] py-12 flex flex-col items-center gap-2 text-center"><MessageSquare className="w-8 h-8 text-[color:var(--c-5f6074)]" /><p className="text-sm text-[color:var(--c-8a8b9e)]">Elige una conversación o escribe a un profesor.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
