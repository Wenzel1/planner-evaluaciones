'use client';

import { AlertCircle, ClipboardCheck, GraduationCap, MessageSquare, Save, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NIVELES_RUBRICA, type RubricaEval, normalizarRubrica, puntosNivel, textoPuntos, totalRubrica } from '@/lib/rubrica';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { FilaNota, SeccionExamen } from '@/components/planificador/tipos';
import { limpiarTexto, medioEnvio, olvidarCache, pedirConCache } from '@/components/planificador/utilidades';

export const NIVEL_CORTO = ['Exc.', 'Bueno', 'Reg.', 'Def.'];
export const COLOR_BOTON_NIVEL = ['bg-emerald-500/20 border-emerald-500/50 text-emerald-200', 'bg-sky-500/20 border-sky-500/50 text-sky-200', 'bg-amber-500/20 border-amber-500/50 text-amber-200', 'bg-red-500/20 border-red-500/50 text-red-200'];
export const textoNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));
export function notaDesdeRubrica(r: RubricaEval, detalle: (number | null)[]): number | null {
  if (!detalle.some(x => x != null)) return null;
  const total = totalRubrica(r) || 20;
  const suma = r.criterios.reduce((t, c, i) => t + (detalle[i] != null ? puntosNivel(c.puntos, detalle[i] as number) : 0), 0);
  return Math.round((suma / total) * 20 * 100) / 100;
}
export function ModalNotas({ seccion, onCerrar, agregarNotificacion, onEstadoCambiado }: { seccion: SeccionExamen; onCerrar: () => void; agregarNotificacion: (m: string) => void; onEstadoCambiado?: (id: string, estado: string) => void }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<FilaNota[]>([]);
  const [rubrica, setRubrica] = useState<RubricaEval | null>(null);
  const [conRubrica, setConRubrica] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [envio, setEnvio] = useState<{ total: number; enviados: number; fallidos: number } | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const nombre = limpiarTexto(seccion.nombre);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d: any = await pedirConCache(`/api/evaluaciones/${encodeURIComponent(seccion.id)}/notas`); // casi siempre ya viene precargado
        if (!vivo) return;
        const rub = normalizarRubrica(d.evaluacion?.rubrica);
        setRubrica(rub);
        const lista: FilaNota[] = (d.estudiantes || []).map((e: any) => {
          const p = e.puntaje == null ? '' : String(e.puntaje).replace('.', ',');
          return { id: e.id, nombre: e.nombre, tieneTelefono: !!e.tieneTelefono, activo: e.activo !== false, puntaje: p, observaciones: e.observaciones || '', detalle: rub ? rub.criterios.map((_, i) => (Array.isArray(e.detalle) && Number.isInteger(e.detalle[i]) ? e.detalle[i] : null)) : [], verObs: !!e.observaciones, guardado: '' };
        });
        setFilas(lista.map(f => ({ ...f, guardado: firma(f) })));
        // Con rúbrica por defecto si existe y nadie tiene nota puesta a mano
        setConRubrica(!!rub && !lista.some(f => f.puntaje && !f.detalle.some(x => x != null)));
      } catch (e: any) { if (vivo) setError(e.message); } finally { if (vivo) setCargando(false); }
    })();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { vivo = false; window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, [seccion.id]);

  const numero = (t: string) => { const n = Number(String(t).replace(',', '.')); return t.trim() === '' || !Number.isFinite(n) ? null : n; };
  const invalida = (f: FilaNota) => f.puntaje.trim() !== '' && (numero(f.puntaje) == null || (numero(f.puntaje) as number) < 0 || (numero(f.puntaje) as number) > 20);
  const firma = (f: FilaNota) => { const n = numero(f.puntaje); return `${n == null ? '' : String(n).replace('.', ',')}|${f.observaciones.trim()}|${JSON.stringify(f.detalle.some(x => x != null) ? f.detalle : null)}`; };
  const cambiadas = filas.filter(f => firma(f) !== f.guardado);
  const hayErrores = filas.some(invalida);

  const actualizar = (id: string, cambio: Partial<FilaNota>) => setFilas(prev => prev.map(f => (f.id === id ? { ...f, ...cambio } : f)));
  const elegirNivel = (f: FilaNota, criterio: number, nivel: number) => {
    if (!rubrica) return;
    const detalle = f.detalle.map((x, i) => (i === criterio ? (x === nivel ? null : nivel) : x));
    const nota = notaDesdeRubrica(rubrica, detalle);
    actualizar(f.id, { detalle, puntaje: nota == null ? '' : String(nota).replace('.', ',') });
  };
  const siguiente = (id: string) => {
    const i = filas.findIndex(f => f.id === id);
    const prox = filas[i + 1];
    if (prox) refs.current[prox.id]?.focus();
  };

  const notas = filas.map(f => numero(f.puntaje)).filter((n): n is number => n != null && n >= 0 && n <= 20);
  const promedio = notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : null;
  const aprobados = notas.filter(n => n >= 10).length;

  const guardar = async () => {
    if (hayErrores || cambiadas.length === 0) return;
    setGuardando(true);
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(seccion.id)}/notas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: cambiadas.map(f => ({ estudianteId: f.id, puntaje: numero(f.puntaje), observaciones: f.observaciones, detalle: f.detalle.some(x => x != null) ? f.detalle : null })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron guardar las notas.');
      setFilas(prev => prev.map(f => ({ ...f, guardado: firma(f) })));
      olvidarCache(`/api/evaluaciones/${encodeURIComponent(seccion.id)}/notas`); olvidarCache('/api/estudiantes');
      agregarNotificacion(`📝 Notas de "${nombre}" guardadas (${d.guardadas} con nota${d.borradas ? `, ${d.borradas} borrada(s)` : ''}).`);
      if (d.estado && d.estado !== seccion.estado) onEstadoCambiado?.(seccion.id, d.estado);
    } catch (e: any) { alert(e.message); } finally { setGuardando(false); }
  };

  const destinatarios = filas.filter(f => f.tieneTelefono && f.guardado.split('|')[0] !== '');
  const enviar = async () => {
    if (cambiadas.length > 0) { alert('Primero guarda las notas.'); return; }
    if (destinatarios.length === 0) { alert('Nadie con nota guardada tiene teléfono.'); return; }
    if (!window.confirm(`Se enviará por ${medioEnvio()} su nota a ${destinatarios.length} estudiante(s). Cada uno recibe solo la suya. ¿Continuar?`)) return;
    setEnviando(true); setEnvio(null);
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(seccion.id)}/notas/enviar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteIds: destinatarios.map(f => f.id) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron enviar las notas.');
      setEnvio({ total: d.total, enviados: 0, fallidos: 0 });
      // Sigue el avance del envío (n8n manda de a uno con pausas)
      for (let intento = 0; intento < 60; intento++) {
        await new Promise(res => setTimeout(res, 3000));
        const e = await fetch(`/api/whatsapp/envios?lote=${encodeURIComponent(d.loteId)}`).then(x => x.json()).catch(() => null);
        if (!e?.items) continue;
        const enviados = e.items.filter((i: any) => i.estado === 'ENVIADO').length;
        const fallidos = e.items.filter((i: any) => i.estado === 'FALLIDO').length;
        setEnvio({ total: e.items.length, enviados, fallidos });
        if (enviados + fallidos >= e.items.length) break;
      }
      agregarNotificacion(`📲 Notas de "${nombre}" enviadas por ${medioEnvio()}.`);
    } catch (e: any) { alert(e.message); } finally { setEnviando(false); }
  };

  const cerrar = () => { if (cambiadas.length > 0 && !window.confirm('Hay notas sin guardar. ¿Cerrar de todas formas?')) return; onCerrar(); };
  const campo = 'bg-[color:var(--c-272839)] border rounded-lg px-2.5 py-1.5 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none';

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-[200] bg-[color:var(--c-0b0b12)]/75 flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16, ease: 'easeOut' }}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[color:var(--c-313248)] flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0"><GraduationCap className="w-5 h-5 text-emerald-300" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[color:var(--c-blanco)]">Notas</p>
            <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{nombre} · Sección {(seccion.grupoSeccion || 'A').toUpperCase()}{seccion.peso != null ? ` · ${seccion.peso}%` : ''}</p>
          </div>
          <button type="button" onClick={cerrar} className="p-1 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)]"><X className="w-5 h-5" /></button>
        </div>

        {!cargando && !error && filas.length > 0 && (
          <div className="px-5 py-2.5 border-b border-[color:var(--c-313248)] bg-[color:var(--c-181926)] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-[color:var(--c-8a8b9e)]">Calificados <b className="text-[color:var(--c-d0d0da)]">{notas.length}/{filas.length}</b></span>
            <span className="text-[color:var(--c-8a8b9e)]">Promedio <b className="text-[color:var(--c-a5b4fc)]">{promedio == null ? '—' : textoNota(Math.round(promedio * 100) / 100)}</b></span>
            <span className="text-[color:var(--c-8a8b9e)]">Aprobados <b className="text-emerald-300">{aprobados}</b></span>
            {notas.length > 0 && <span className="text-[color:var(--c-8a8b9e)]">Rango <b className="text-[color:var(--c-d0d0da)]">{textoNota(Math.min(...notas))}–{textoNota(Math.max(...notas))}</b></span>}
            {rubrica && (
              <button type="button" onClick={() => setConRubrica(v => !v)} className={`ml-auto h-7 px-2.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${conRubrica ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/50 text-[color:var(--c-c7d2fe)]' : 'bg-[color:var(--c-232430)] border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)]'}`}>
                <ClipboardCheck className="w-3.5 h-3.5" />{conRubrica ? 'Con rúbrica' : 'Nota directa'}
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {cargando && <div className="flex items-center justify-center gap-2 py-12 text-sm text-[color:var(--c-8a8b9e)]"><div className="w-4 h-4 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando estudiantes…</div>}
          {error && <div className="m-2 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}
          {!cargando && !error && filas.length === 0 && (
            <div className="text-center py-12 text-sm text-[color:var(--c-8a8b9e)]">No hay estudiantes activos en la Sección {(seccion.grupoSeccion || 'A').toUpperCase()}.<br />Agrégalos en la pestaña <b className="text-[color:var(--c-d0d0da)]">Estudiantes</b> con el grupo {(seccion.grupoSeccion || 'A').toUpperCase()}.</div>
          )}
          <div className="space-y-1.5">
            {filas.map((f, idx) => {
              const n = numero(f.puntaje);
              const mal = invalida(f);
              const usarRubrica = conRubrica && !!rubrica;
              const expandida = usarRubrica && abierta === f.id;
              return (
                <div key={f.id} className={`rounded-xl border transition-colors ${expandida ? 'border-[color:var(--c-818cf8)]/50 bg-[color:var(--c-20213a)]' : 'border-[color:var(--c-2a2b3d)] bg-[color:var(--c-1f2035)]'}`}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="w-6 text-[11px] text-[color:var(--c-6a6b7e)] text-right flex-shrink-0">{idx + 1}</span>
                    <button type="button" onClick={() => usarRubrica && setAbierta(expandida ? null : f.id)} className={`flex-1 min-w-0 text-left text-sm truncate ${usarRubrica ? 'hover:text-[color:var(--c-blanco)] cursor-pointer' : 'cursor-default'} ${f.activo ? 'text-[color:var(--c-d0d0da)]' : 'text-[color:var(--c-6a6b7e)] line-through'}`} title={f.nombre}>
                      {f.nombre}
                      {usarRubrica && <span className="ml-2 text-[11px] text-[color:var(--c-6a6b7e)]">{f.detalle.filter(x => x != null).length}/{rubrica!.criterios.length} criterios</span>}
                    </button>
                    {firma(f) !== f.guardado && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Sin guardar" />}
                    <button type="button" onClick={() => actualizar(f.id, { verObs: !f.verObs })} className={`p-1.5 rounded-lg ${f.observaciones ? 'text-[color:var(--c-a5b4fc)]' : 'text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-a5b4fc)]'}`} title="Observación"><MessageSquare className="w-4 h-4" /></button>
                    <input ref={(el) => { refs.current[f.id] = el; }} inputMode="decimal" value={f.puntaje} readOnly={usarRubrica}
                      onChange={(e) => actualizar(f.id, { puntaje: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); siguiente(f.id); } }}
                      onClick={() => usarRubrica && setAbierta(f.id)}
                      placeholder="—" className={`${campo} w-16 text-center font-semibold ${mal ? 'border-red-500 text-red-300' : n == null ? 'border-[color:var(--c-313248)]' : n >= 10 ? 'border-emerald-500/40 text-emerald-200' : 'border-red-500/40 text-red-200'} ${usarRubrica ? 'cursor-pointer' : ''}`} />
                    <span className="text-[11px] text-[color:var(--c-6a6b7e)] w-6">/20</span>
                  </div>
                  {f.verObs && (
                    <div className="px-3 pb-2 pl-11">
                      <input value={f.observaciones} onChange={(e) => actualizar(f.id, { observaciones: e.target.value.slice(0, 500) })} placeholder="Observación (opcional, le llega con la nota)" className={`${campo} w-full text-xs border-[color:var(--c-313248)] focus:border-[color:var(--c-818cf8)]`} />
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {expandida && rubrica && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-3 pb-3 pl-11 space-y-2">
                          {rubrica.criterios.map((c, ci) => (
                            <div key={ci} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                              <span className="text-xs text-[color:var(--c-b0b0c4)] sm:w-44 truncate" title={c.nombre}>{c.nombre} <span className="text-[color:var(--c-6a6b7e)]">({textoPuntos(c.puntos)})</span></span>
                              <div className="flex gap-1 flex-1">
                                {NIVELES_RUBRICA.map((nv, k) => (
                                  <button key={nv} type="button" onClick={() => elegirNivel(f, ci, k)} title={c.descripciones[k] || nv}
                                    className={`flex-1 h-7 rounded-md border text-[11px] font-medium transition-colors ${f.detalle[ci] === k ? COLOR_BOTON_NIVEL[k] : 'bg-[color:var(--c-232430)] border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]'}`}>
                                    {NIVEL_CORTO[k]} {textoPuntos(puntosNivel(c.puntos, k))}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {!cargando && !error && filas.length > 0 && (
          <div className="px-5 py-3 border-t border-[color:var(--c-313248)] flex flex-wrap items-center gap-2">
            {envio ? (
              <span className="text-xs text-[color:var(--c-8a8b9e)]">📲 Enviadas <b className="text-emerald-300">{envio.enviados}</b>/{envio.total}{envio.fallidos ? <> · <b className="text-red-300">{envio.fallidos}</b> fallidas</> : null}</span>
            ) : (
              <span className="text-[11px] text-[color:var(--c-6a6b7e)] hidden sm:inline">{conRubrica && rubrica ? 'Toca un estudiante y elige el nivel de cada criterio.' : 'Enter pasa al siguiente. Deja vacío para quitar la nota.'}</span>
            )}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={enviar} disabled={enviando || guardando || destinatarios.length === 0} title={destinatarios.length === 0 ? 'Guarda notas de estudiantes con teléfono' : `Enviar a ${destinatarios.length}`}
                className="h-9 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                {enviando ? <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}Enviar por {medioEnvio()}
              </button>
              <button type="button" onClick={guardar} disabled={guardando || hayErrores || cambiadas.length === 0}
                className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {guardando ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {hayErrores ? 'Hay notas fuera de 0–20' : cambiadas.length ? `Guardar (${cambiadas.length})` : 'Guardado'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
