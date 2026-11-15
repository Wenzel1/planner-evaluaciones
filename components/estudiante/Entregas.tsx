'use client';
// Entregas del estudiante: todas sus tareas por entregar, entregadas, revisadas y por corregir, de todas sus clases.
// Arriba un resumen por estado (sirve de filtro); abajo la lista a la izquierda y el detalle de la elegida a la derecha
// (en pantallas angostas el detalle se abre debajo de la tarea).
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Lock, CheckCircle2, ChevronDown, ChevronRight, Clock, FileCheck2, Inbox, Layers, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BloqueEntrega, type EntregaInfo } from '@/components/EntregaEstudiante';
import { type Resumen, type EstadoEntrega, colorDe, limpiar, fechaHora, cuandoTexto, estadoEntrega, ESTADO_ENTREGA } from './comun';

type Filtro = 'todas' | EstadoEntrega;
const FILTROS: { id: Filtro; texto: string; icono: any; color: string }[] = [
  { id: 'todas', texto: 'Todas', icono: Layers, color: 'var(--c-a5b4fc)' },
  { id: 'pendiente', texto: 'Pendientes', icono: Clock, color: '#b0b0c4' },
  { id: 'atrasada', texto: 'Atrasadas', icono: AlertTriangle, color: '#dfa9a9' },
  { id: 'por_corregir', texto: 'Por corregir', icono: RotateCcw, color: '#d9c397' },
  { id: 'entregada', texto: 'Entregadas', icono: FileCheck2, color: 'var(--c-a5b4fc)' },
  { id: 'revisada', texto: 'Revisadas', icono: CheckCircle2, color: '#a0cdb7' },
];
const ORDEN: Record<EstadoEntrega, number> = { por_corregir: 0, atrasada: 1, pendiente: 2, entregada: 3, revisada: 4, bloqueada: 5 };

// Ancho disponible del contenido (no de la ventana): con el menú y la columna derecha puede ser angosto
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ancho };
}

export default function Entregas({ datos, onCambio }: { datos: Resumen; onCambio: (evaluacionId: string, entrega: EntregaInfo) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [sel, setSel] = useState<string | null>(null);
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const dosColumnas = ancho >= 760;
  const lista = datos.evaluaciones
    .map(e => ({ e, s: estadoEntrega(e) }))
    .filter((x): x is { e: typeof x.e; s: EstadoEntrega } => !!x.s)
    .sort((a, b) => ORDEN[a.s] - ORDEN[b.s] || new Date(a.e.fecha || 0).getTime() - new Date(b.e.fecha || 0).getTime());
  const cuenta = (f: Filtro) => (f === 'todas' ? lista.length : lista.filter(x => x.s === f).length);
  const visibles = lista.filter(x => filtro === 'todas' || x.s === filtro);
  // En dos columnas siempre hay una elegida (la primera del filtro)
  const elegida = visibles.find(x => x.e.id === sel) || (dosColumnas ? visibles[0] : undefined);

  const detalle = (x: { e: typeof lista[number]['e']; s: EstadoEntrega }) => x.s === 'bloqueada' ? (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-[color:var(--c-3a3b52)] px-4 py-5">
      <Lock className="w-5 h-5 text-[color:var(--c-8a8b9e)] flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-[color:var(--c-d0d0da)]">Todavía no puedes entregar</p>
        <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">{x.e.abreEl ? `Se abre el ${new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(x.e.abreEl))}. Podrás entregar desde ese día.` : 'Se abre unos días antes de su fecha. Podrás entregar desde ese día.'}</p>
      </div>
    </div>
  ) : (
    <BloqueEntrega key={x.e.id} token={x.e.token} evaluacionId={x.e.id} entrega={x.e.entrega} archivos={datos.archivos} fechaEval={x.e.fecha} sinMarco onCambio={(en) => onCambio(x.e.id, en)} />
  );

  return (
    <div ref={ref} className="space-y-5">
      <p className="text-sm text-[color:var(--c-8a8b9e)]">Los trabajos que debes entregar en esta materia. Solo puedes entregar en las evaluaciones abiertas.</p>

      {/* Resumen por estado (también filtra) */}
      <div className={`grid gap-2 ${ancho >= 640 ? 'grid-cols-6' : 'grid-cols-3'}`}>
        {FILTROS.map(f => {
          const activo = filtro === f.id; const n = cuenta(f.id);
          return (
            <button key={f.id} type="button" onClick={() => { setFiltro(f.id); setSel(null); }}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${activo ? 'border-[color:var(--c-818cf8)]/45 bg-[color:var(--c-818cf8)]/10' : 'border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] hover:border-[color:var(--c-3a3b52)]'}`}>
              <span className="flex items-center justify-between"><f.icono className="w-4 h-4" style={{ color: f.color }} /><span className={`text-lg font-semibold tabular-nums ${n ? 'text-[color:var(--c-e0e0ec)]' : 'text-[color:var(--c-5f6074)]'}`}>{n}</span></span>
              <span className={`block mt-1 text-[11px] font-medium truncate ${activo ? 'text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)]'}`}>{f.texto}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--c-3a3b52)] py-14 flex flex-col items-center gap-2 text-center"><Inbox className="w-8 h-8 text-[color:var(--c-5f6074)]" /><p className="text-sm text-[color:var(--c-8a8b9e)]">{lista.length === 0 ? 'Tus profesores todavía no tienen evaluaciones con entrega.' : 'No hay entregas en este grupo.'}</p></div>
      ) : (
        <div className={dosColumnas ? 'grid grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start' : ''}>
          {/* Lista */}
          <ul className="space-y-2">
            {visibles.map(x => {
              const { e, s } = x;
              const activa = elegida?.e.id === e.id;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setSel(!dosColumnas && activa ? null : e.id)}
                    className={`w-full rounded-xl border px-3.5 py-3 flex items-center gap-3 text-left transition-colors ${activa ? 'border-[color:var(--c-818cf8)]/40 bg-[color:var(--c-818cf8)]/[0.07]' : 'border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] hover:border-[color:var(--c-3a3b52)]'}`}>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-bold" style={{ background: colorDe(datos.grupos, e.grupo) + '33', color: colorDe(datos.grupos, e.grupo) }}>{(e.materia || '?').charAt(0).toUpperCase()}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-[color:var(--c-e0e0ec)] leading-snug line-clamp-2">{limpiar(e.nombre)}</span>
                      <span className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-1 text-[11px] text-[color:var(--c-8a8b9e)] min-w-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full border whitespace-nowrap ${ESTADO_ENTREGA[s].clase}`}>{s === 'entregada' ? 'Entregada' : ESTADO_ENTREGA[s].texto}</span>
                        <span className="truncate">{e.materia}</span>
                        {e.fecha && <><span>·</span><span className={`whitespace-nowrap ${s === 'atrasada' ? 'text-red-300' : ''}`}>{cuandoTexto(e.fecha)}</span></>}
                      </span>
                    </span>
                    {dosColumnas ? <ChevronRight className={`w-4 h-4 flex-shrink-0 ${activa ? 'text-[color:var(--c-a5b4fc)]' : 'text-[color:var(--c-5f6074)]'}`} /> : <ChevronDown className={`w-4 h-4 text-[color:var(--c-8a8b9e)] transition-transform flex-shrink-0 ${activa ? 'rotate-180' : ''}`} />}
                  </button>
                  {/* Angosto: el detalle se abre debajo */}
                  <AnimatePresence initial={false}>
                    {!dosColumnas && activa && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="pt-2"><Detalle x={x} grupos={datos.grupos}>{detalle(x)}</Detalle></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>

          {/* Ancho: el detalle a la derecha */}
          {dosColumnas && elegida && (
            <motion.div key={elegida.e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="sticky top-0">
              <Detalle x={elegida} grupos={datos.grupos}>{detalle(elegida)}</Detalle>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function Detalle({ x, grupos, children }: { x: { e: Resumen['evaluaciones'][number]; s: EstadoEntrega }; grupos: Resumen['grupos']; children: React.ReactNode }) {
  const { e, s } = x;
  const color = colorDe(grupos, e.grupo);
  return (
    <div className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden shadow-xl">
      <div className="px-5 pt-4 pb-4 border-b border-[color:var(--c-282a3f)]" style={{ backgroundImage: `linear-gradient(135deg, ${color}14, transparent 60%)` }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: color + '22', color }}>{e.materia}</span>
          <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Prof. {e.profesor}</span>
          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ESTADO_ENTREGA[s].clase}`}>{ESTADO_ENTREGA[s].texto}</span>
        </div>
        <h2 className="mt-2 text-base font-semibold text-[color:var(--c-e0e0ec)] leading-snug">{limpiar(e.nombre)}</h2>
        {e.fecha && (
          <p className={`mt-1.5 text-xs flex items-center gap-1.5 ${s === 'atrasada' ? 'text-red-300' : 'text-[color:var(--c-9a9bb0)]'}`}>
            <CalendarClock className="w-3.5 h-3.5" />{s === 'atrasada' ? 'Venció' : 'Fecha límite:'} {fechaHora(e.fecha)} · {cuandoTexto(e.fecha)}
          </p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
