'use client';

import { ExternalLink, Lock, LockOpen, Paperclip, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { enlacesDeDescripcion } from '@/lib/herramientasEnlaces';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PaginaSugeridaUI, SeccionExamen, VideoSugeridoUI } from '@/components/planificador/tipos';
import { limpiarTexto, pedirSugerenciasRecursos } from '@/components/planificador/utilidades';

// ============================================
// RECURSOS PARA EL PORTAL DEL ESTUDIANTE (videos, páginas, documentos)
// ============================================
export const DIAS_APERTURA_PORTAL = 7;
export function EditorRecursos({ seccion, materia, onGuardar, onCerrar }: { seccion: SeccionExamen; materia?: string; onGuardar: (recursos: { titulo: string; url: string }[] | null, abiertaManual: boolean) => void; onCerrar: () => void }) {
  const [filas, setFilas] = useState(() => (seccion.recursos?.length ? seccion.recursos : [{ titulo: '', url: '' }]).map(r => ({ ...r })));
  const [abrirYa, setAbrirYa] = useState(!!seccion.abiertaManual);
  // Búsqueda automática (YouTube + páginas verificadas)
  const [buscando, setBuscando] = useState(false);
  const [sugerencias, setSugerencias] = useState<{ videos: VideoSugeridoUI[]; paginas: PaginaSugeridaUI[]; avisos: string[] } | null>(null);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const buscar = async () => {
    setBuscando(true); setErrorBusqueda(''); setSugerencias(null);
    try {
      const d = await pedirSugerenciasRecursos(seccion, materia);
      setSugerencias(d);
      const yaEstan = new Set(filas.map(f => f.url.trim()));
      setElegidas([...d.videos.slice(0, 2), ...d.paginas.slice(0, 2)].map(x => x.url).filter(u => !yaEstan.has(u)));
    } catch (e: any) { setErrorBusqueda(e.message); } finally { setBuscando(false); }
  };
  const agregarElegidas = () => {
    if (!sugerencias) return;
    const todas = [...sugerencias.videos.map(v => ({ titulo: v.titulo, url: v.url })), ...sugerencias.paginas.map(p => ({ titulo: p.titulo, url: p.url }))].filter(x => elegidas.includes(x.url));
    setFilas(prev => {
      const actuales = prev.filter(f => f.url.trim());
      const urls = new Set(actuales.map(f => f.url.trim()));
      const juntas = [...actuales, ...todas.filter(x => !urls.has(x.url))].slice(0, 10);
      return juntas.length ? juntas : [{ titulo: '', url: '' }];
    });
    setSugerencias(null); setElegidas([]);
  };
  const alternarElegida = (u: string) => setElegidas(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, []);
  const urlValida = (u: string) => { const t = u.trim(); if (!t) return true; try { const x = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return /\./.test(x.hostname); } catch { return false; } };
  const esVideo = (u: string) => /(youtube\.com|youtu\.be)\//i.test(u);
  const hayErrores = filas.some(f => !urlValida(f.url));
  const fecha = seccion.fecha ? new Date(seccion.fecha) : null;
  const abreEl = fecha ? new Date(fecha.getTime() - DIAS_APERTURA_PORTAL * 86400000) : null;
  const yaAbierta = !fecha || (abreEl as Date).getTime() <= Date.now() || String(seccion.estado || '').toUpperCase() === 'REALIZADA';
  const guardar = () => {
    if (hayErrores) return;
    const lista = filas.map(f => ({ titulo: f.titulo.trim().slice(0, 120), url: f.url.trim() })).filter(f => f.url).map(f => ({ ...f, url: /^https?:\/\//i.test(f.url) ? f.url : `https://${f.url}` })).slice(0, 10);
    onGuardar(lista.length ? lista : null, abrirYa);
  };
  const campo = 'w-full bg-[color:var(--c-272839)] border rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)]';
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-[200] bg-[color:var(--c-0b0b12)]/75 flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }}
        className="w-full max-w-xl max-h-[92vh] flex flex-col bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[color:var(--c-313248)] flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><Paperclip className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[color:var(--c-blanco)]">Recursos para los estudiantes</p>
            <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{limpiarTexto(seccion.nombre)} · Sección {(seccion.grupoSeccion || 'A').toUpperCase()}</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-[color:var(--c-9a9bb0)]">Salen en la página personal de cada estudiante. Los videos de YouTube se ven ahí mismo; los demás enlaces se abren aparte.</p>
          <div className="rounded-xl border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-818cf8)]/5 p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={buscar} disabled={buscando} className="h-9 px-3 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
                {buscando ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {buscando ? 'Buscando videos y páginas…' : sugerencias ? 'Buscar otra vez' : 'Buscar recursos automáticamente'}
              </button>
              {(() => {
                // Enlaces oficiales de las herramientas que nombra la descripción (Figma, GitHub, Docker…)
                const faltan = enlacesDeDescripcion(seccion.descripcion || '').filter(h => !filas.some(f => f.url.trim() === h.url));
                return faltan.length > 0 ? (
                  <button type="button" onClick={() => setFilas(prev => [...prev.filter(f => f.titulo.trim() || f.url.trim()), ...faltan].slice(0, 10))} title={faltan.map(h => h.titulo.replace(' (herramienta)', '')).join(', ')}
                    className="h-9 px-3 rounded-lg border border-[color:var(--c-818cf8)]/40 text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 text-xs font-semibold flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Agregar enlaces de las herramientas ({faltan.length})
                  </button>
                ) : null;
              })()}
              <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Videos reales de YouTube y páginas comprobadas para «{limpiarTexto(seccion.nombre)}».</span>
            </div>
            {errorBusqueda && <p className="text-xs text-red-300">{errorBusqueda}</p>}
            {sugerencias && (
              <div className="space-y-3">
                {sugerencias.avisos.map((a, i) => <p key={i} className="text-[11px] text-amber-300">⚠ {a}</p>)}
                {sugerencias.videos.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--c-8a8b9e)] font-semibold">Videos</p>
                    {sugerencias.videos.map(v => (
                      <label key={v.url} className={`flex items-center gap-2.5 p-1.5 rounded-lg border cursor-pointer transition-colors ${elegidas.includes(v.url) ? 'border-[color:var(--c-818cf8)]/60 bg-[color:var(--c-818cf8)]/10' : 'border-[color:var(--c-313248)] hover:border-[color:var(--c-414258)]'}`}>
                        <input type="checkbox" checked={elegidas.includes(v.url)} onChange={() => alternarElegida(v.url)} className="w-4 h-4 accent-[color:var(--c-818cf8)] flex-shrink-0" />
                        <img src={v.miniatura} alt="" className="w-20 h-[45px] rounded object-cover flex-shrink-0 bg-black" loading="lazy" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-[color:var(--c-e0e0ec)] line-clamp-2">{v.titulo}</span>
                          <span className="block text-[10px] text-[color:var(--c-8a8b9e)] truncate">{v.canal} · {Math.floor(v.duracionSeg / 60)}:{String(v.duracionSeg % 60).padStart(2, '0')} min{v.vistas ? ` · ${v.vistas >= 1000000 ? `${(v.vistas / 1000000).toFixed(1)} M` : v.vistas >= 1000 ? `${Math.round(v.vistas / 1000)} mil` : v.vistas} vistas` : ''}</span>
                        </span>
                        <a href={v.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] flex-shrink-0" title="Ver en YouTube"><ExternalLink className="w-3.5 h-3.5" /></a>
                      </label>
                    ))}
                  </div>
                )}
                {sugerencias.paginas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--c-8a8b9e)] font-semibold">Páginas y herramientas (comprobadas)</p>
                    {sugerencias.paginas.map(pg => (
                      <label key={pg.url} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${elegidas.includes(pg.url) ? 'border-[color:var(--c-818cf8)]/60 bg-[color:var(--c-818cf8)]/10' : 'border-[color:var(--c-313248)] hover:border-[color:var(--c-414258)]'}`}>
                        <input type="checkbox" checked={elegidas.includes(pg.url)} onChange={() => alternarElegida(pg.url)} className="w-4 h-4 accent-[color:var(--c-818cf8)] flex-shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-[color:var(--c-e0e0ec)] truncate">{pg.titulo}</span>
                          <span className="block text-[10px] text-[color:var(--c-8a8b9e)] truncate">{(() => { try { return new URL(pg.url).hostname.replace(/^www\./, ''); } catch { return pg.url; } })()}{pg.descripcion ? ` · ${pg.descripcion}` : ''}</span>
                        </span>
                        <a href={pg.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] flex-shrink-0" title="Abrir"><ExternalLink className="w-3.5 h-3.5" /></a>
                      </label>
                    ))}
                  </div>
                )}
                {sugerencias.videos.length === 0 && sugerencias.paginas.length === 0 && <p className="text-xs text-[color:var(--c-8a8b9e)]">No se encontró nada útil. Prueba con un nombre de evaluación más claro (ej. «Diagramas UML de clases»).</p>}
                {(sugerencias.videos.length > 0 || sugerencias.paginas.length > 0) && (
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setSugerencias(null); setElegidas([]); }} className="h-8 px-3 rounded-lg text-xs text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)]">Descartar</button>
                    <button type="button" onClick={agregarElegidas} disabled={elegidas.length === 0} className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold disabled:opacity-40">Agregar seleccionados ({elegidas.length})</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2.5">
            {filas.map((f, i) => (
              <div key={i} className="rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1f2035)] p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] w-14 flex-shrink-0 text-center text-[color:var(--c-a0a0b8)] leading-tight">{f.url && esVideo(f.url) ? '▶️ Video' : '🔗 Enlace'}</span>
                  <input value={f.titulo} onChange={(e) => setFilas(prev => prev.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))} maxLength={120} placeholder="Título (ej. Video: qué son los microservicios)" className={`${campo} border-[color:var(--c-313248)]`} />
                  <button type="button" onClick={() => setFilas(prev => prev.length === 1 ? [{ titulo: '', url: '' }] : prev.filter((_, k) => k !== i))} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-red-400 rounded-lg flex-shrink-0" title="Quitar"><Trash2 className="w-4 h-4" /></button>
                </div>
                <input value={f.url} onChange={(e) => setFilas(prev => prev.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} maxLength={600} inputMode="url" placeholder="https://..." className={`${campo} ${urlValida(f.url) ? 'border-[color:var(--c-313248)]' : 'border-red-500 text-red-300'}`} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setFilas(prev => [...prev, { titulo: '', url: '' }])} disabled={filas.length >= 10} className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] text-xs font-medium flex items-center gap-1.5 hover:text-[color:var(--c-blanco)] disabled:opacity-40"><Plus className="w-3.5 h-3.5" />Agregar recurso</button>

          <div className="rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-181926)] p-3">
            {yaAbierta ? (
              <p className="text-xs text-emerald-300 flex items-center gap-2"><LockOpen className="w-4 h-4" />Los estudiantes ya pueden ver esta evaluación completa.</p>
            ) : (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={abrirYa} onChange={(e) => setAbrirYa(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[color:var(--c-818cf8)]" />
                <span>
                  <span className="text-sm text-[color:var(--c-d0d0da)] font-medium flex items-center gap-1.5">{abrirYa ? <LockOpen className="w-4 h-4 text-emerald-300" /> : <Lock className="w-4 h-4 text-[color:var(--c-8a8b9e)]" />}Abrirla ya para los estudiantes</span>
                  <span className="block text-[11px] text-[color:var(--c-8a8b9e)] mt-0.5">Si no, se abre sola {DIAS_APERTURA_PORTAL} días antes: el {abreEl!.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}. Mientras tanto ven solo el nombre, la fecha y el peso.</span>
                </span>
              </label>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[color:var(--c-313248)] flex items-center justify-end gap-2">
          <button type="button" onClick={onCerrar} className="h-9 px-4 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] text-xs font-medium hover:text-[color:var(--c-blanco)]">Cancelar</button>
          <button type="button" onClick={guardar} disabled={hayErrores} className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"><Save className="w-3.5 h-3.5" />{hayErrores ? 'Revisa los enlaces' : 'Guardar'}</button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
