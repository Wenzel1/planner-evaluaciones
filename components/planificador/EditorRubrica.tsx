'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ClipboardCheck, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { NIVELES_RUBRICA, type RubricaEval, normalizarRubrica, puntosNivel, rubricaSugerida, textoPuntos } from '@/lib/rubrica';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { SeccionExamen } from '@/components/planificador/tipos';
import { limpiarTexto } from '@/components/planificador/utilidades';

// ============================================
// EDITOR DE RÚBRICA (por evaluación)
// ============================================
export const COLOR_NIVEL = ['text-emerald-300', 'text-sky-300', 'text-amber-300', 'text-red-300'];
export function EditorRubrica({ seccion, onGuardar, onCerrar }: { seccion: SeccionExamen; onGuardar: (r: RubricaEval | null) => void; onCerrar: () => void }) {
  const existente = normalizarRubrica(seccion.rubrica);
  const [criterios, setCriterios] = useState(() => (existente || rubricaSugerida(seccion)).criterios.map(c => ({ ...c, puntos: String(c.puntos), descripciones: [...c.descripciones] })));
  const [editado, setEditado] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(0);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, []);
  const total = criterios.reduce((t, c) => t + (Number(c.puntos) || 0), 0);
  const cambiar = (i: number, cambio: Partial<{ nombre: string; puntos: string; descripciones: string[] }>) => {
    setEditado(true);
    setCriterios(prev => prev.map((c, k) => (k === i ? { ...c, ...cambio } : c)));
  };
  const sugerir = () => {
    if (editado && !window.confirm('Se reemplazará lo que escribiste por una rúbrica sugerida. ¿Continuar?')) return;
    setCriterios(rubricaSugerida(seccion).criterios.map(c => ({ ...c, puntos: String(c.puntos), descripciones: [...c.descripciones] })));
    setEditado(false); setAbierto(0);
  };
  const ajustarA20 = () => {
    if (total <= 0) return;
    const nuevos = criterios.map(c => ({ ...c, puntos: Math.max(0.5, Math.round(((Number(c.puntos) || 0) / total) * 20 * 2) / 2) }));
    const dif = Math.round((20 - nuevos.reduce((t, c) => t + c.puntos, 0)) * 2) / 2;
    if (nuevos.length) nuevos[0].puntos = Math.max(0.5, nuevos[0].puntos + dif);
    setCriterios(nuevos.map(c => ({ ...c, puntos: String(c.puntos) }))); setEditado(true);
  };
  const agregar = () => {
    if (criterios.length >= 8) return;
    setCriterios(prev => [...prev, { nombre: 'Nuevo criterio', puntos: '2', descripciones: ['', '', '', ''] }]);
    setAbierto(criterios.length); setEditado(true);
  };
  const quitar = (i: number) => { setCriterios(prev => prev.filter((_, k) => k !== i)); setAbierto(null); setEditado(true); };
  const guardar = () => {
    const r = normalizarRubrica({ criterios: criterios.map(c => ({ ...c, puntos: Number(c.puntos) || 0 })) });
    if (!r) { alert('Agrega al menos un criterio con nombre.'); return; }
    onGuardar(r);
  };
  const campo = 'w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)]';
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-[200] bg-[color:var(--c-0b0b12)]/75 flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16, ease: 'easeOut' }}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[color:var(--c-313248)] flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><ClipboardCheck className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[color:var(--c-blanco)]">Rúbrica de evaluación</p>
            <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{limpiarTexto(seccion.nombre)}{seccion.tipoActividad ? ` · ${seccion.tipoActividad}` : ''}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${total === 20 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`} title="La escala usual es de 20 puntos">{textoPuntos(total)} / 20 pts</span>
          <button type="button" onClick={onCerrar} className="p-1 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-2.5 border-b border-[color:var(--c-313248)] flex flex-wrap items-center gap-2 bg-[color:var(--c-181926)]">
          <button type="button" onClick={sugerir} className="h-8 px-3 rounded-lg bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/40 text-[color:var(--c-c7d2fe)] text-xs font-medium flex items-center gap-1.5 hover:bg-[color:var(--c-818cf8)]/25"><Sparkles className="w-3.5 h-3.5" />{existente || editado ? 'Sugerir otra vez' : 'Sugerida según la actividad'}</button>
          <button type="button" onClick={agregar} disabled={criterios.length >= 8} className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] text-xs font-medium flex items-center gap-1.5 hover:text-[color:var(--c-blanco)] disabled:opacity-40"><Plus className="w-3.5 h-3.5" />Agregar criterio</button>
          {total !== 20 && total > 0 && <button type="button" onClick={ajustarA20} className="h-8 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20">Ajustar a 20 pts</button>}
          <span className="text-[11px] text-[color:var(--c-6a6b7e)] ml-auto hidden sm:inline">Niveles: Excelente 100% · Bueno 75% · Regular 50% · Deficiente 25%</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {criterios.length === 0 && <p className="text-sm text-[color:var(--c-8a8b9e)] text-center py-8">Sin criterios. Usa “Sugerida” o “Agregar criterio”.</p>}
          {criterios.map((c, i) => (
            <div key={i} className={`rounded-xl border transition-colors ${abierto === i ? 'border-[color:var(--c-818cf8)]/50 bg-[color:var(--c-20213a)]' : 'border-[color:var(--c-313248)] bg-[color:var(--c-1f2035)]'}`}>
              <div className="flex items-center gap-2 p-2.5">
                <span className="w-6 h-6 rounded-full bg-[color:var(--c-272839)] text-[color:var(--c-a5b4fc)] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <input value={c.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} maxLength={120} placeholder="Nombre del criterio" className={`${campo} flex-1 min-w-0 font-medium`} />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="number" min={0} max={100} step={0.5} value={c.puntos} onChange={(e) => cambiar(i, { puntos: e.target.value })} className={`${campo} w-16 text-center`} />
                  <span className="text-[11px] text-[color:var(--c-8a8b9e)]">pts</span>
                </div>
                <button type="button" onClick={() => setAbierto(abierto === i ? null : i)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] rounded-lg" title="Ver niveles">{abierto === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                <button type="button" onClick={() => quitar(i)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-red-400 rounded-lg" title="Quitar criterio"><Trash2 className="w-4 h-4" /></button>
              </div>
              <AnimatePresence initial={false}>
                {abierto === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-2.5 pb-3">
                      {NIVELES_RUBRICA.map((nivel, k) => (
                        <label key={nivel} className="block">
                          <span className={`text-[11px] font-semibold ${COLOR_NIVEL[k]}`}>{nivel} <span className="text-[color:var(--c-6a6b7e)] font-normal">· {textoPuntos(puntosNivel(Number(c.puntos) || 0, k))} pts</span></span>
                          <textarea value={c.descripciones[k]} onChange={(e) => cambiar(i, { descripciones: c.descripciones.map((d, j) => (j === k ? e.target.value : d)) })} rows={2} maxLength={400} placeholder={`Qué hace el estudiante en nivel ${nivel.toLowerCase()}`} className={`${campo} mt-1 resize-none`} />
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[color:var(--c-313248)] flex flex-wrap items-center gap-2">
          {existente && <button type="button" onClick={() => { if (window.confirm('¿Quitar la rúbrica de esta evaluación?')) onGuardar(null); }} className="h-9 px-3 rounded-lg text-xs font-medium text-red-300 hover:bg-red-500/10">Quitar rúbrica</button>}
          <span className="text-[11px] text-[color:var(--c-6a6b7e)] hidden sm:inline">Sale en el PDF del plan de acción.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onCerrar} className="h-9 px-4 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] text-xs font-medium hover:text-[color:var(--c-blanco)]">Cancelar</button>
            <button type="button" onClick={guardar} className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Guardar rúbrica</button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
