'use client';
// Calendario del estudiante: todas sus evaluaciones del mes, con un color por materia
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, Download } from 'lucide-react';
import { type Resumen, type AbrirEvaluacion, colorDe, limpiar, fechaHora, enlaceGoogle, cuandoTexto } from './comun';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Día (en hora de Venezuela) de una fecha, como "2026-11-27"
const diaDe = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(d));

export default function Calendario({ datos, onAbrir }: { datos: Resumen; onAbrir: AbrirEvaluacion }) {
  const hoy = new Date();
  const [mes, setMes] = useState({ a: hoy.getFullYear(), m: hoy.getMonth() });
  const [ocultas, setOcultas] = useState<string[]>([]);
  const evs = datos.evaluaciones.filter(e => e.fecha && e.estado !== 'CANCELADA' && !ocultas.includes(e.grupo));
  const porDia = useMemo(() => {
    const m = new Map<string, typeof evs>();
    for (const e of evs) { const k = diaDe(e.fecha!); m.set(k, [...(m.get(k) || []), e]); }
    return m;
  }, [evs]);
  const primero = new Date(mes.a, mes.m, 1);
  const desplaz = (primero.getDay() + 6) % 7; // semana empieza el lunes
  const diasMes = new Date(mes.a, mes.m + 1, 0).getDate();
  const celdas = Array.from({ length: Math.ceil((desplaz + diasMes) / 7) * 7 }, (_, i) => i - desplaz + 1);
  const claveDia = (d: number) => `${mes.a}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hoyClave = diaDe(hoy);
  const delMes = evs.filter(e => diaDe(e.fecha!).startsWith(`${mes.a}-${String(mes.m + 1).padStart(2, '0')}`)).sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime());
  const abrir = (e: typeof evs[number]) => onAbrir({ claseId: e.claseId, materiaId: datos.grupos.find(g => g.clave === e.grupo)?.materiaId, evaluacionId: e.id });
  const mover = (n: number) => setMes(({ a, m }) => { const d = new Date(a, m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)] mr-auto">{MESES[mes.m]} {mes.a}</h1>
        <button type="button" onClick={() => setMes({ a: hoy.getFullYear(), m: hoy.getMonth() })} className="h-9 px-3 rounded-lg border border-[color:var(--c-313248)] text-xs font-medium text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-414258)]">Hoy</button>
        <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="w-9 h-9 rounded-lg border border-[color:var(--c-313248)] flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-414258)]"><ChevronLeft className="w-4 h-4" /></button>
        <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="w-9 h-9 rounded-lg border border-[color:var(--c-313248)] flex items-center justify-center text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-414258)]"><ChevronRight className="w-4 h-4" /></button>
      </div>
      {/* Materias (tocar para mostrar u ocultar) y su calendario para el teléfono */}
      <div className="flex flex-wrap gap-2">
        {datos.grupos.map(g => {
          const visible = !ocultas.includes(g.clave);
          return (
            <span key={g.clave} className={`inline-flex items-center gap-1 rounded-full border text-xs ${visible ? 'border-[color:var(--c-313248)] text-[color:var(--c-d0d0da)]' : 'border-dashed border-[color:var(--c-313248)] text-[color:var(--c-6a6b7e)]'}`}>
              <button type="button" onClick={() => setOcultas(o => (visible ? [...o, g.clave] : o.filter(x => x !== g.clave)))} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5" title={visible ? 'Ocultar del calendario' : 'Mostrar en el calendario'}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: visible ? colorDe(datos.grupos, g.clave) : 'transparent', border: `2px solid ${colorDe(datos.grupos, g.clave)}` }} />{g.materia}
              </button>
              <a href={`/api/portal/${encodeURIComponent(g.token)}/calendario?materia=${encodeURIComponent(g.materiaId)}`} title="Agregar todas sus evaluaciones a mi calendario (Google, Outlook, el del teléfono)" className="pr-2.5 pl-1 py-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)]"><Download className="w-3.5 h-3.5" /></a>
            </span>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[color:var(--c-282a3f)]">{DIAS.map(d => <div key={d} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] text-center">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {celdas.map((d, i) => {
            const valido = d >= 1 && d <= diasMes;
            const lista = valido ? porDia.get(claveDia(d)) || [] : [];
            const esHoy = valido && claveDia(d) === hoyClave;
            return (
              <div key={i} className={`min-h-[72px] sm:min-h-[96px] border-b border-r border-[color:var(--c-282a3f)] p-1 sm:p-1.5 ${(i + 1) % 7 === 0 ? 'border-r-0' : ''} ${valido ? '' : 'bg-[color:var(--c-161722)]/60'}`}>
                {valido && <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs ${esHoy ? 'bg-[color:var(--c-818cf8)] text-white font-semibold' : 'text-[color:var(--c-8a8b9e)]'}`}>{d}</span>}
                <div className="space-y-1 mt-0.5">
                  {lista.slice(0, 3).map(e => (
                    <button key={e.id} type="button" onClick={() => abrir(e)} title={`${limpiar(e.nombre)} · ${e.materia}`} className="w-full text-left text-[10px] sm:text-[11px] leading-tight px-1.5 py-1 rounded-md truncate text-[color:var(--c-e0e0ec)] hover:brightness-110" style={{ background: `${colorDe(datos.grupos, e.grupo)}33`, borderLeft: `3px solid ${colorDe(datos.grupos, e.grupo)}` }}>
                      {limpiar(e.nombre)}
                    </button>
                  ))}
                  {lista.length > 3 && <p className="text-[10px] text-[color:var(--c-8a8b9e)] px-1">+{lista.length - 3} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista del mes (cómoda en el teléfono) */}
      <section className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
        <h2 className="px-4 py-3 text-sm font-semibold text-[color:var(--c-e0e0ec)] border-b border-[color:var(--c-282a3f)]">Este mes ({delMes.length})</h2>
        {delMes.length === 0 ? <p className="px-4 py-6 text-sm text-[color:var(--c-8a8b9e)]">No hay evaluaciones en {MESES[mes.m].toLowerCase()}.</p> : (
          <ul className="divide-y divide-[color:var(--c-282a3f)]">
            {delMes.map(e => {
              const g = enlaceGoogle(e);
              return (
                <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: colorDe(datos.grupos, e.grupo) }} />
                  <button type="button" onClick={() => abrir(e)} className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-medium text-[color:var(--c-d0d0da)] truncate hover:underline">{limpiar(e.nombre)}</span>
                    <span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">{e.materia} · {fechaHora(e.fecha!)} · {cuandoTexto(e.fecha)}</span>
                  </button>
                  {g && <a href={g} target="_blank" rel="noopener noreferrer" title="Agregar a Google Calendar" className="h-8 px-2.5 rounded-lg border border-[color:var(--c-313248)] text-[11px] text-[color:var(--c-c7d2fe)] flex items-center gap-1.5 hover:border-[color:var(--c-414258)] flex-shrink-0"><CalendarPlus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Google Calendar</span></a>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
