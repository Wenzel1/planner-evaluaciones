'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MessageSquare, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { ObservacionRecibida, OpinionEstudiante } from '@/components/planificador/tipos';
import { Tooltip } from '@/components/planificador/ui';
import { ESTILO_ROL, limpiarTexto } from '@/components/planificador/utilidades';

export function OpinionesEstudiantes({ items, onVistas, onBorrar }: { items: OpinionEstudiante[]; onVistas: (id?: string) => void; onBorrar: (ids: string[]) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null); // id de la opinión, o 'todas'
  const [borrando, setBorrando] = useState(false);
  const borrar = async (ids: string[]) => { setBorrando(true); try { await onBorrar(ids); } finally { setBorrando(false); setConfirmar(null); } };
  const [filtro, setFiltro] = useState<'sugerencias' | 'todas'>('sugerencias');
  const [seccion, setSeccion] = useState('todas');
  if (items.length === 0) return null;
  const secciones = [...new Set(items.map(o => (o.seccion || 'A').toUpperCase()))].sort();
  const deSeccion = items.filter(o => seccion === 'todas' || (o.seccion || 'A').toUpperCase() === seccion);
  const deAcuerdo = deSeccion.filter(o => o.deAcuerdo).length;
  const sugerencias = deSeccion.filter(o => !o.deAcuerdo).length;
  const nuevas = items.filter(o => !o.leida).length;
  const visibles = deSeccion.filter(o => filtro === 'todas' || !o.deAcuerdo);
  const pct = deSeccion.length ? Math.round((deAcuerdo / deSeccion.length) * 100) : 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${nuevas ? 'border-[color:var(--c-818cf8)]/40 bg-[color:var(--c-818cf8)]/5' : 'border-[color:var(--c-313248)] bg-[color:var(--c-1f2035)]'}`}>
      <button type="button" onClick={() => setAbierto(v => !v)} className="w-full px-4 py-3 flex items-center gap-3 text-left flex-wrap">
        <Users className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
        <span className="text-sm font-semibold text-[color:var(--c-d0d0da)]">Opiniones de los estudiantes</span>
        <span className="text-xs text-emerald-300">👍 {items.filter(o => o.deAcuerdo).length} de acuerdo</span>
        <span className="text-xs text-amber-300">💬 {items.filter(o => !o.deAcuerdo).length} sugerencia(s)</span>
        {nuevas > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--c-818cf8)] text-white">{nuevas} nueva{nuevas === 1 ? '' : 's'}</span>}
        <ChevronDown className={`w-4 h-4 ml-auto text-[color:var(--c-8a8b9e)] transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[color:var(--c-313248)]">
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1">
                  {['todas', ...secciones].map(l => (
                    <button key={l} type="button" onClick={() => setSeccion(l)} className={`h-7 px-2.5 rounded-md text-xs font-semibold ${seccion === l ? 'bg-[color:var(--c-818cf8)] text-white' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]'}`}>{l === 'todas' ? 'Todas' : `Sec. ${l}`}</button>
                  ))}
                </div>
                <div className="flex gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1">
                  {([['sugerencias', `Sugerencias (${sugerencias})`], ['todas', `Todas (${deSeccion.length})`]] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setFiltro(v)} className={`h-7 px-2.5 rounded-md text-xs font-semibold ${filtro === v ? 'bg-[color:var(--c-272839)] text-[color:var(--c-blanco)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]'}`}>{t}</button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {nuevas > 0 && <button type="button" onClick={() => onVistas()} className="text-xs text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)] underline">Marcar todas como vistas</button>}
                  {visibles.length > 0 && (confirmar === 'todas'
                    ? <span className="flex items-center gap-1.5 text-xs"><span className="text-red-200">¿Borrar {visibles.length}?</span><button type="button" disabled={borrando} onClick={() => borrar(visibles.map(o => o.id))} className="px-2 py-1 rounded-md bg-red-500/20 border border-red-500/40 text-red-200 font-semibold hover:bg-red-500/30 disabled:opacity-50">{borrando ? 'Borrando…' : 'Sí, borrar'}</button><button type="button" onClick={() => setConfirmar(null)} className="px-2 py-1 rounded-md text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]">No</button></span>
                    : <button type="button" onClick={() => setConfirmar('todas')} className="flex items-center gap-1 text-xs text-red-300/80 hover:text-red-200"><Trash2 className="w-3.5 h-3.5" />Borrar {filtro === 'sugerencias' ? 'sugerencias' : 'opiniones'}{seccion !== 'todas' ? ` de Sec. ${seccion}` : ''}</button>)}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-[color:var(--c-8a8b9e)] mb-1"><span>{pct}% de acuerdo</span><span>{deSeccion.length} opinaron</span></div>
                <div className="h-2 rounded-full bg-amber-500/30 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-[color:var(--c-282a3f)] border border-[color:var(--c-282a3f)] rounded-xl">
                {visibles.length === 0 && <p className="px-3 py-6 text-center text-xs text-[color:var(--c-8a8b9e)]">{filtro === 'sugerencias' ? 'Nadie ha dejado sugerencias en esta sección.' : 'Sin opiniones.'}</p>}
                {visibles.map(o => (
                  <div key={o.id} className={`px-3 py-2.5 flex items-start gap-3 ${!o.leida ? 'bg-[color:var(--c-818cf8)]/5' : ''}`}>
                    <span className="text-base leading-none mt-0.5">{o.deAcuerdo ? '👍' : '💬'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-[color:var(--c-d0d0da)]">{o.estudiante}</span>
                        <span className="text-[color:var(--c-8a8b9e)]">· Sec. {(o.seccion || 'A').toUpperCase()} · {o.materia} · {new Date(o.fecha).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}</span>
                        {!o.leida && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--c-818cf8)]" />}
                      </div>
                      {o.comentario ? <p className="text-sm text-[color:var(--c-c0c0cc)] mt-0.5 whitespace-pre-wrap break-words">{o.comentario}</p> : <p className="text-xs text-[color:var(--c-6a6b7e)] mt-0.5">Está de acuerdo con el plan.</p>}
                    </div>
                    {!o.leida && <button type="button" onClick={() => onVistas(o.id)} className="shrink-0 text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)]">Visto</button>}
                    {confirmar === o.id
                      ? <span className="shrink-0 flex items-center gap-1"><button type="button" disabled={borrando} onClick={() => borrar([o.id])} className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-200 font-semibold disabled:opacity-50">¿Borrar?</button><button type="button" onClick={() => setConfirmar(null)} className="p-0.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]" aria-label="No borrar"><X className="w-3.5 h-3.5" /></button></span>
                      : <Tooltip text="Borrar esta opinión"><button type="button" onClick={() => setConfirmar(o.id)} aria-label="Borrar opinión" className="shrink-0 p-1 rounded-md text-[color:var(--c-6a6b7e)] hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button></Tooltip>}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ObservacionesRecibidas({ items, onLeer }: { items: ObservacionRecibida[]; onLeer: (id?: string) => void }) {
  const [verLeidas, setVerLeidas] = useState(false);
  if (items.length === 0) return null;
  const sinLeer = items.filter(o => !o.leida);
  const leidas = items.filter(o => o.leida);

  const tarjeta = (o: ObservacionRecibida, nueva: boolean) => (
    <div key={o.id} className="p-4 flex items-start gap-3">
      <MessageSquare className={`w-4 h-4 flex-shrink-0 mt-0.5 ${nueva ? 'text-amber-300' : 'text-[color:var(--c-6a6b7e)]'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-[color:var(--c-d0d0da)]">{o.autorNombre}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[o.autorRol] || ''}`}>{o.autorRol}</span>
          <span className="text-[color:var(--c-8a8b9e)]">· {o.materia.nombre}{o.evaluacionNombre ? ` · «${limpiarTexto(o.evaluacionNombre)}»` : ''}</span>
          <span className="text-[color:var(--c-6a6b7e)]">· {new Date(o.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-sm text-[color:var(--c-c0c0cc)] mt-1 whitespace-pre-wrap break-words">{o.mensaje}</p>
      </div>
      {nueva && <button onClick={() => onLeer(o.id)} className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors">Entendido</button>}
    </div>
  );

  return (
    <div className="space-y-3">
      {sinLeer.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2 flex-wrap">
            <MessageSquare className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-amber-200">Observaciones nuevas ({sinLeer.length})</h3>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Un administrador revisó tu trabajo.</span>
            {sinLeer.length > 1 && <button onClick={() => onLeer()} className="ml-auto text-xs text-amber-200/80 hover:text-amber-100 underline">Marcar todas como leídas</button>}
          </div>
          <div className="divide-y divide-amber-500/10">{sinLeer.map(o => tarjeta(o, true))}</div>
        </div>
      )}
      {leidas.length > 0 && (
        <div>
          <button onClick={() => setVerLeidas(v => !v)} className="text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)] flex items-center gap-1">
            {verLeidas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{verLeidas ? 'Ocultar' : 'Ver'} observaciones leídas ({leidas.length})
          </button>
          {verLeidas && <div className="mt-2 bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl divide-y divide-[color:var(--c-313248)] overflow-hidden">{leidas.map(o => tarjeta(o, false))}</div>}
        </div>
      )}
    </div>
  );
}
