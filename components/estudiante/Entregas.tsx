'use client';
// Entregas del estudiante: todas sus tareas por entregar, entregadas, revisadas y por corregir, de todas sus clases
import { useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { BloqueEntrega, type EntregaInfo } from '@/components/EntregaEstudiante';
import { type Resumen, type EstadoEntrega, colorDe, limpiar, fechaHora, cuandoTexto, estadoEntrega, ESTADO_ENTREGA } from './comun';

type Filtro = 'todas' | EstadoEntrega;
const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'todas', texto: 'Todas' }, { id: 'pendiente', texto: 'Pendientes' }, { id: 'atrasada', texto: 'Atrasadas' },
  { id: 'por_corregir', texto: 'Por corregir' }, { id: 'entregada', texto: 'Entregadas' }, { id: 'revisada', texto: 'Revisadas' },
];
const ORDEN: Record<EstadoEntrega, number> = { por_corregir: 0, atrasada: 1, pendiente: 2, entregada: 3, revisada: 4 };

export default function Entregas({ datos, onCambio }: { datos: Resumen; onCambio: (evaluacionId: string, entrega: EntregaInfo) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [abierta, setAbierta] = useState<string | null>(null);
  const lista = datos.evaluaciones
    .map(e => ({ e, s: estadoEntrega(e) }))
    .filter((x): x is { e: typeof x.e; s: EstadoEntrega } => !!x.s)
    .sort((a, b) => ORDEN[a.s] - ORDEN[b.s] || new Date(a.e.fecha || 0).getTime() - new Date(b.e.fecha || 0).getTime());
  const cuenta = (f: Filtro) => (f === 'todas' ? lista.length : lista.filter(x => x.s === f).length);
  const visibles = lista.filter(x => filtro === 'todas' || x.s === filtro);

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">Mis entregas</h1><p className="text-sm text-[color:var(--c-8a8b9e)]">Los trabajos que debes entregar en todas tus materias. Toca uno para entregarlo o ver cómo va.</p></div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTROS.map(f => (
          <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filtro === f.id ? 'border-[color:var(--c-818cf8)]/50 bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-e0e0ec)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
            {f.texto} <b className="ml-1">{cuenta(f.id)}</b>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--c-3a3b52)] py-12 flex flex-col items-center gap-2 text-center"><Inbox className="w-8 h-8 text-[color:var(--c-5f6074)]" /><p className="text-sm text-[color:var(--c-8a8b9e)]">{lista.length === 0 ? 'Tus profesores todavía no tienen evaluaciones con entrega.' : 'Nada en este filtro.'}</p></div>
      ) : (
        <ul className="space-y-2">
          {visibles.map(({ e, s }) => {
            const abiertaEsta = abierta === e.id;
            return (
              <li key={e.id} className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
                <button type="button" onClick={() => setAbierta(abiertaEsta ? null : e.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[color:var(--c-818cf8)]/[0.04]">
                  <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: colorDe(datos.grupos, e.grupo) }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{limpiar(e.nombre)}</span>
                    <span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">{e.materia}{e.fecha ? ` · ${s === 'atrasada' ? 'venció' : 'fecha límite'} ${fechaHora(e.fecha)} (${cuandoTexto(e.fecha)})` : ''}</span>
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ESTADO_ENTREGA[s].clase}`}>{ESTADO_ENTREGA[s].texto}</span>
                  <ChevronDown className={`w-4 h-4 text-[color:var(--c-8a8b9e)] transition-transform flex-shrink-0 ${abiertaEsta ? 'rotate-180' : ''}`} />
                </button>
                {abiertaEsta && (
                  <div className="px-4 pb-4">
                    <BloqueEntrega token={e.token} evaluacionId={e.id} entrega={e.entrega} archivos={datos.archivos} fechaEval={e.fecha} onCambio={(en) => onCambio(e.id, en)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
