'use client';
// Calificaciones del estudiante: promedio por materia, qué le falta para aprobar y cada nota
import { type Resumen, type AbrirEvaluacion, colorDe, limpiar, fechaCorta, textoNota, paraAprobar } from './comun';

const TONO = { ok: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', aviso: 'text-amber-300 bg-amber-500/10 border-amber-500/25', mal: 'text-red-300 bg-red-500/10 border-red-500/25', neutro: 'text-[color:var(--c-c0c0d0)] bg-[color:var(--c-272839)] border-[color:var(--c-313248)]' };

export default function Calificaciones({ datos, onAbrir }: { datos: Resumen; onAbrir: AbrirEvaluacion }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--c-8a8b9e)]">Notas sobre 20. Se aprueba con 10.</p>
      {datos.grupos.length === 0 && <p className="text-sm text-[color:var(--c-8a8b9e)]">Todavía no estás en ninguna clase.</p>}
      <div className={`grid gap-4 ${datos.grupos.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {datos.grupos.map(g => {
          const evs = datos.evaluaciones.filter(e => e.grupo === g.clave && e.estado !== 'CANCELADA').sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
          const meta = paraAprobar(g);
          const color = colorDe(datos.grupos, g.clave);
          return (
            <section key={g.clave} className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
              <div className="px-4 py-4 flex items-start gap-3 border-b border-[color:var(--c-282a3f)]" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-[color:var(--c-e0e0ec)] truncate">{g.materia}</h2>
                  <p className="text-xs text-[color:var(--c-8a8b9e)]">Prof. {g.profesor} · Sección {g.seccion}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold leading-none ${g.promedio == null ? 'text-[color:var(--c-6a6b7e)]' : g.promedio >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{g.promedio == null ? '—' : textoNota(g.promedio)}</p>
                  <p className="text-[10px] text-[color:var(--c-6a6b7e)] mt-1">promedio</p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--c-8a8b9e)]">
                  <div className="flex-1 h-1.5 rounded-full bg-[color:var(--c-282a3f)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, g.pesoEvaluado)}%`, background: color }} /></div>
                  <span>{g.pesoEvaluado}% evaluado</span>
                </div>
                <p className={`text-xs rounded-lg border px-3 py-2 ${TONO[meta.tono]}`}>{meta.texto}</p>
              </div>
              <table className="w-full text-sm table-fixed">
                <thead><tr className="text-[11px] uppercase tracking-wider text-[color:var(--c-8a8b9e)] border-y border-[color:var(--c-282a3f)]"><th className="text-left font-semibold px-4 py-2">Evaluación</th><th className="text-right font-semibold px-2 py-2 w-16">Peso</th><th className="text-right font-semibold px-4 py-2 w-20">Nota</th></tr></thead>
                <tbody className="divide-y divide-[color:var(--c-282a3f)]">
                  {evs.map(e => (
                    <tr key={e.id} className="hover:bg-[color:var(--c-818cf8)]/[0.04] cursor-pointer" onClick={() => onAbrir({ claseId: e.claseId, materiaId: g.materiaId, evaluacionId: e.id })}>
                      <td className="px-4 py-2.5"><span className="block text-[color:var(--c-d0d0da)] truncate">{limpiar(e.nombre)}</span><span className="block text-[11px] text-[color:var(--c-6a6b7e)] truncate">{e.fecha ? fechaCorta(e.fecha) : 'Sin fecha'}{e.nota?.observaciones ? ` · «${e.nota.observaciones}»` : ''}</span></td>
                      <td className="px-2 py-2.5 text-right text-[color:var(--c-8a8b9e)]">{e.peso ?? '—'}%</td>
                      <td className="px-4 py-2.5 text-right">{e.nota ? <b className={e.nota.puntaje >= 10 ? 'text-emerald-300' : 'text-red-300'}>{textoNota(e.nota.puntaje)}</b> : <span className="text-[color:var(--c-6a6b7e)]">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
