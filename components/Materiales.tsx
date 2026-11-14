'use client';
// Materiales de clase organizados por unidades (temas).
// Profesor: crea unidades, sube archivos, agrega enlaces y vincula evaluaciones del plan.
// Estudiante: ve las unidades visibles de cada materia y abre o descarga cada material.
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, ClipboardList, Download, ExternalLink, EyeOff, FileText, FolderOpen, Link2, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import Selector from '@/components/Selector';
import { confirmar } from '@/components/Confirmar';
import { subirAdjunto } from '@/components/MensajeAdjunto';

interface Material { id: string; tipo: 'ARCHIVO' | 'ENLACE' | 'EVALUACION'; titulo: string; url?: string | null; archivoTipo?: string | null; archivoTamano?: number | null; evaluacionId?: string; fecha?: string | null; seccion?: string }
interface Unidad { id: string; nombre: string; descripcion: string | null; orden: number; visibleDesde: string | null; materiales: Material[] }
interface GrupoEst { clave: string; token: string; materiaId: string; materia: string; profesor: string; seccion: string }

const ZONA = 'America/Caracas';
const fFecha = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
const peso = (n?: number | null) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const ext = (t: string) => (t.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase().slice(0, 4);
const dominio = (u?: string | null) => { try { return new URL(u || '').hostname.replace(/^www\./, ''); } catch { return 'Enlace'; } };
const paraInput = (d: string | null) => (d ? new Date(new Date(d).getTime() - 4 * 3600000).toISOString().slice(0, 10) : ''); // fecha en Caracas (UTC-4)
const desdeInput = (v: string) => (v ? new Date(`${v}T00:00:00-04:00`).toISOString() : null);

const campo = 'h-10 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] outline-none focus:border-[color:var(--c-818cf8)]/60';
const botonSuave = 'h-9 px-3 rounded-lg border border-[color:var(--c-313248)] text-xs font-medium text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-414258)] hover:text-[color:var(--c-e0e0ec)] flex items-center gap-1.5 transition-colors disabled:opacity-50';

type Props =
  | { modo: 'profesor'; materiaId: string | null; evaluaciones: { id: string; nombre: string; seccion: string }[] }
  | { modo: 'estudiante'; grupos: GrupoEst[] };

export default function Materiales(props: Props) {
  const esProfesor = props.modo === 'profesor';
  const grupos = props.modo === 'estudiante' ? props.grupos : [];
  const [clave, setClave] = useState('');
  const grupo = grupos.find(g => g.clave === clave) || grupos[0] || null;
  const materiaId = props.modo === 'profesor' ? props.materiaId : grupo?.materiaId || null;
  const base = props.modo === 'profesor' ? '/api/unidades' : grupo ? `/api/portal/${encodeURIComponent(grupo.token)}/materiales` : '';

  const [unidades, setUnidades] = useState<Unidad[] | null>(null);
  const [error, setError] = useState('');
  const [cerradas, setCerradas] = useState<string[]>([]);
  const [nueva, setNueva] = useState<{ nombre: string; descripcion: string; visibleDesde: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!materiaId || !base) return;
    const r = await fetch(`${base}?materiaId=${encodeURIComponent(materiaId)}`, { cache: 'no-store' }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (r?.ok && Array.isArray(d)) { setUnidades(d); setError(''); } else setError(d?.error || 'No se pudieron cargar los materiales.');
  }, [materiaId, base]);
  useEffect(() => { setUnidades(null); setError(''); cargar(); }, [cargar]);

  // Operaciones del profesor: todas terminan recargando la lista
  const pedir = async (url: string, metodo: string, cuerpo?: unknown) => {
    const r = await fetch(url, { method: metodo, headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(d.error || 'No se pudo completar.');
    await cargar();
  };
  const crearUnidad = async () => {
    if (!nueva || nueva.nombre.trim().length < 2) return;
    setGuardando(true); setError('');
    try { await pedir('/api/unidades', 'POST', { materiaId, nombre: nueva.nombre, descripcion: nueva.descripcion, visibleDesde: desdeInput(nueva.visibleDesde) }); setNueva(null); }
    catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  if (!materiaId) return <Vacio texto={esProfesor ? 'Abre una materia para organizar sus materiales.' : 'Únete a una clase para ver sus materiales.'} />;
  const abrirUrl = (m: Material, descargar = false) => `${base}${esProfesor ? '/materiales' : ''}?${esProfesor ? '' : `materiaId=${encodeURIComponent(materiaId)}&`}abrir=${encodeURIComponent(m.id)}${descargar ? '&descargar=1' : ''}`;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="mr-auto min-w-0">
          {esProfesor && <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)]">Materiales de clase</h2>}
          <p className="text-sm text-[color:var(--c-8a8b9e)]">{esProfesor ? 'Organiza guías, presentaciones, videos y enlaces por unidades. Los ven todas las secciones de la materia.' : 'Las guías, presentaciones y enlaces de tus materias, por unidades.'}</p>
        </div>
        {!esProfesor && grupos.length > 1 && (
          <Selector value={grupo?.clave || ''} onChange={(e) => setClave(e.target.value)} aria-label="Materia" className="h-10 w-full sm:w-72 px-3 rounded-xl bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d0d0da)]">
            {grupos.map(g => <option key={g.clave} value={g.clave}>{g.materia} · Prof. {g.profesor.split(' ')[0]}</option>)}
          </Selector>
        )}
        {esProfesor && !nueva && <button type="button" onClick={() => setNueva({ nombre: '', descripcion: '', visibleDesde: '' })} className="h-10 px-4 rounded-xl bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Nueva unidad</button>}
      </div>

      {error && <p className="text-sm text-red-300 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5">{error}</p>}

      {/* Formulario de unidad nueva */}
      <AnimatePresence initial={false}>
        {esProfesor && nueva && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} onSubmit={(e) => { e.preventDefault(); crearUnidad(); }} className="overflow-hidden">
            <div className="rounded-2xl border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-1d1e2e)] p-4 space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Nueva unidad</p><button type="button" onClick={() => setNueva(null)} aria-label="Cancelar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button></div>
              <div className="grid sm:grid-cols-[minmax(0,1fr)_180px] gap-3">
                <input autoFocus value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value.slice(0, 120) })} placeholder="Nombre (ej. Unidad 1 · Introducción)" className={campo} />
                <label className="flex flex-col gap-1 text-[11px] text-[color:var(--c-8a8b9e)] sm:-mt-5"><span>Visible desde (opcional)</span><input type="date" value={nueva.visibleDesde} onChange={(e) => setNueva({ ...nueva, visibleDesde: e.target.value })} className={campo} /></label>
              </div>
              <input value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value.slice(0, 500) })} placeholder="Descripción corta (opcional)" className={`${campo} w-full`} />
              <div className="flex justify-end"><button type="submit" disabled={guardando || nueva.nombre.trim().length < 2} className="h-9 px-4 rounded-xl bg-[color:var(--c-818cf8)] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{guardando && <Loader2 className="w-4 h-4 animate-spin" />}Crear unidad</button></div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {unidades === null && !error ? <div className="flex items-center justify-center gap-3 py-20 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Cargando…</div>
        : unidades && unidades.length === 0 ? <Vacio texto={esProfesor ? 'Aún no hay unidades. Crea la primera con «Nueva unidad» y agrégale archivos, enlaces o evaluaciones.' : 'Tu profesor todavía no ha publicado materiales.'} />
        : (
          <ol className="space-y-3">
            <AnimatePresence initial={false}>
              {(unidades || []).map((u, i) => (
                <motion.li key={u.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }} transition={{ duration: 0.2 }}>
                  <TarjetaUnidad u={u} numero={i + 1} total={unidades!.length} esProfesor={esProfesor} abierta={!cerradas.includes(u.id)}
                    onAlternar={() => setCerradas(c => (c.includes(u.id) ? c.filter(x => x !== u.id) : [...c, u.id]))}
                    materiaId={materiaId} evaluaciones={props.modo === 'profesor' ? props.evaluaciones : []} abrirUrl={abrirUrl} pedir={pedir} onError={setError} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <div className="rounded-2xl border border-dashed border-[color:var(--c-3a3b52)] py-14 px-6 flex flex-col items-center gap-3 text-center"><FolderOpen className="w-9 h-9 text-[color:var(--c-5f6074)]" /><p className="text-sm text-[color:var(--c-8a8b9e)] max-w-md">{texto}</p></div>;
}

function TarjetaUnidad({ u, numero, total, esProfesor, abierta, onAlternar, materiaId, evaluaciones, abrirUrl, pedir, onError }: {
  u: Unidad; numero: number; total: number; esProfesor: boolean; abierta: boolean; onAlternar: () => void; materiaId: string;
  evaluaciones: { id: string; nombre: string; seccion: string }[]; abrirUrl: (m: Material, descargar?: boolean) => string;
  pedir: (url: string, metodo: string, cuerpo?: unknown) => Promise<void>; onError: (t: string) => void;
}) {
  const [editando, setEditando] = useState<{ nombre: string; descripcion: string; visibleDesde: string } | null>(null);
  const [enlace, setEnlace] = useState<{ titulo: string; url: string } | null>(null);
  const [subiendo, setSubiendo] = useState<{ nombre: string; p: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const oculta = !!u.visibleDesde && new Date(u.visibleDesde).getTime() > Date.now();
  const hacer = async (f: () => Promise<void>) => { setOcupado(true); onError(''); try { await f(); } catch (e: any) { onError(e.message); } finally { setOcupado(false); } };

  const subir = async (lista: FileList | File[] | null) => {
    const archivos = Array.from(lista || []).slice(0, 10);
    if (!archivos.length) return;
    onError('');
    try {
      for (const f of archivos) {
        setSubiendo({ nombre: f.name, p: 0 });
        const adjunto = await subirAdjunto('/api/unidades/subida', { materiaId }, f, f.name, (p) => setSubiendo({ nombre: f.name, p }));
        await pedir('/api/unidades/materiales', 'POST', { unidadId: u.id, tipo: 'ARCHIVO', adjunto });
      }
    } catch (e: any) { onError(e.message); } finally { setSubiendo(null); if (archivo.current) archivo.current.value = ''; }
  };
  const vinculadas = new Set(u.materiales.filter(m => m.tipo === 'EVALUACION').map(m => m.evaluacionId));
  const porVincular = evaluaciones.filter(e => !vinculadas.has(e.id));

  return (
    <section onDragOver={esProfesor ? (e) => { e.preventDefault(); setArrastrando(true); } : undefined} onDragLeave={esProfesor ? () => setArrastrando(false) : undefined}
      onDrop={esProfesor ? (e) => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files); } : undefined}
      className={`rounded-2xl border bg-[color:var(--c-1d1e2e)] shadow-xl overflow-hidden transition-colors ${arrastrando ? 'border-[color:var(--c-818cf8)]' : 'border-[color:var(--c-313248)]'}`}>
      {/* Encabezado de la unidad */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={onAlternar} aria-expanded={abierta} className="min-w-0 flex-1 flex items-center gap-3 text-left">
          <span className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-a5b4fc)] text-sm font-bold flex items-center justify-center flex-shrink-0">{numero}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 flex-wrap"><span className="text-[15px] font-semibold text-[color:var(--c-e0e0ec)] truncate">{u.nombre}</span>
              {esProfesor && oculta && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-1"><EyeOff className="w-3 h-3" />Oculta hasta el {fFecha(u.visibleDesde!)}</span>}
            </span>
            <span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">{u.descripcion || `${u.materiales.length} material${u.materiales.length === 1 ? '' : 'es'}`}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-[color:var(--c-8a8b9e)] flex-shrink-0 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} />
        </button>
        {esProfesor && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button type="button" disabled={ocupado || numero === 1} onClick={() => hacer(() => pedir('/api/unidades', 'PATCH', { id: u.id, mover: 'arriba' }))} title="Subir" aria-label="Subir la unidad" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)] disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
            <button type="button" disabled={ocupado || numero === total} onClick={() => hacer(() => pedir('/api/unidades', 'PATCH', { id: u.id, mover: 'abajo' }))} title="Bajar" aria-label="Bajar la unidad" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)] disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
            <button type="button" onClick={() => setEditando(editando ? null : { nombre: u.nombre, descripcion: u.descripcion || '', visibleDesde: paraInput(u.visibleDesde) })} title="Editar la unidad" aria-label="Editar la unidad" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]"><Pencil className="w-4 h-4" /></button>
            <button type="button" disabled={ocupado} onClick={async () => { if (await confirmar({ titulo: 'Eliminar unidad', mensaje: `¿Eliminar «${u.nombre}» con sus ${u.materiales.length} material(es)? Los archivos se borran y no se pueden recuperar.`, boton: 'Eliminar' })) hacer(() => pedir(`/api/unidades?id=${encodeURIComponent(u.id)}`, 'DELETE')); }} title="Eliminar la unidad" aria-label="Eliminar la unidad" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border-t border-[color:var(--c-282a3f)] px-4 py-3 space-y-3">
              {/* Editar la unidad */}
              {editando && (
                <form onSubmit={(e) => { e.preventDefault(); hacer(async () => { await pedir('/api/unidades', 'PATCH', { id: u.id, nombre: editando.nombre, descripcion: editando.descripcion, visibleDesde: desdeInput(editando.visibleDesde) }); setEditando(null); }); }} className="rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-191a26)]/60 p-3 space-y-2">
                  <div className="grid sm:grid-cols-[minmax(0,1fr)_170px] gap-2">
                    <input autoFocus value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value.slice(0, 120) })} placeholder="Nombre de la unidad" className={campo} />
                    <input type="date" value={editando.visibleDesde} onChange={(e) => setEditando({ ...editando, visibleDesde: e.target.value })} title="Visible desde (vacío = siempre visible)" className={campo} />
                  </div>
                  <input value={editando.descripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value.slice(0, 500) })} placeholder="Descripción (opcional)" className={`${campo} w-full`} />
                  <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditando(null)} className={botonSuave}>Cancelar</button><button type="submit" disabled={ocupado || editando.nombre.trim().length < 2} className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Guardar</button></div>
                </form>
              )}

              {/* Materiales */}
              {u.materiales.length === 0 && !subiendo ? <p className="text-xs text-[color:var(--c-6a6b7e)] py-2">{esProfesor ? 'Sin materiales todavía. Arrastra archivos aquí o usa los botones de abajo.' : 'Esta unidad aún no tiene materiales.'}</p> : (
                <ul className="space-y-1.5">
                  {u.materiales.map(m => {
                    const esArchivo = m.tipo === 'ARCHIVO', esEnlace = m.tipo === 'ENLACE';
                    const href = esEnlace ? m.url || '#' : esArchivo ? abrirUrl(m) : undefined;
                    const cuerpo = (
                      <>
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${esArchivo ? 'bg-[color:var(--c-818cf8)]/12 text-[color:var(--c-a5b4fc)]' : esEnlace ? 'bg-teal-500/12 text-teal-300' : 'bg-amber-500/12 text-amber-300'}`}>
                          {esArchivo ? (ext(m.titulo) || <FileText className="w-4 h-4" />) : esEnlace ? <Link2 className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-[color:var(--c-e0e0ec)] truncate">{m.titulo}</span>
                          <span className="block text-[11px] text-[color:var(--c-8a8b9e)] truncate">
                            {esArchivo ? `Archivo${m.archivoTamano ? ` · ${peso(m.archivoTamano)}` : ''}` : esEnlace ? dominio(m.url) : <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />Evaluación{m.fecha ? ` · ${fFecha(m.fecha)}` : ''}{esProfesor && m.seccion ? ` · Sección ${m.seccion}` : ''}</span>}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={m.id} className="group flex items-center gap-1 rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)]/50 hover:border-[color:var(--c-3a3b52)] transition-colors">
                        {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5">{cuerpo}{esEnlace && <ExternalLink className="w-3.5 h-3.5 text-[color:var(--c-6a6b7e)] flex-shrink-0" />}</a>
                          : <div className="min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5">{cuerpo}</div>}
                        {esArchivo && <a href={abrirUrl(m, true)} title="Descargar" aria-label={`Descargar ${m.titulo}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-272839)] flex-shrink-0"><Download className="w-4 h-4" /></a>}
                        {esProfesor && <button type="button" disabled={ocupado} onClick={async () => { if (await confirmar({ titulo: m.tipo === 'EVALUACION' ? 'Quitar de la unidad' : 'Quitar material', mensaje: m.tipo === 'EVALUACION' ? `«${m.titulo}» deja de aparecer en esta unidad. La evaluación no se borra.` : `¿Quitar «${m.titulo}»?${esArchivo ? ' El archivo se borra.' : ''}`, boton: 'Quitar' })) hacer(() => pedir(`/api/unidades/materiales?id=${encodeURIComponent(m.id)}`, 'DELETE')); }} title="Quitar" aria-label={`Quitar ${m.titulo}`} className="w-8 h-8 mr-1.5 rounded-lg flex items-center justify-center text-[color:var(--c-6a6b7e)] hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                        {!esProfesor && <span className="w-1.5" />}
                      </li>
                    );
                  })}
                </ul>
              )}
              {subiendo && <div className="rounded-xl border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-818cf8)]/[0.06] px-3 py-2.5"><p className="text-xs text-[color:var(--c-c7d2fe)] truncate">Subiendo {subiendo.nombre}… {subiendo.p}%</p><div className="mt-1.5 h-1 rounded-full bg-[color:var(--c-272839)] overflow-hidden"><div className="h-full bg-[color:var(--c-818cf8)] transition-all" style={{ width: `${subiendo.p}%` }} /></div></div>}

              {/* Agregar (solo el profesor) */}
              {esProfesor && (
                <div className="space-y-2 pt-1">
                  {enlace && (
                    <form onSubmit={(e) => { e.preventDefault(); hacer(async () => { await pedir('/api/unidades/materiales', 'POST', { unidadId: u.id, tipo: 'ENLACE', ...enlace }); setEnlace(null); }); }} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2">
                      <input value={enlace.titulo} onChange={(e) => setEnlace({ ...enlace, titulo: e.target.value.slice(0, 150) })} placeholder="Título (opcional)" className={campo} />
                      <input autoFocus value={enlace.url} onChange={(e) => setEnlace({ ...enlace, url: e.target.value.slice(0, 600) })} placeholder="https://…" className={campo} />
                      <div className="flex gap-2"><button type="submit" disabled={ocupado || enlace.url.trim().length < 8} className="h-10 px-4 rounded-xl bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Agregar</button><button type="button" onClick={() => setEnlace(null)} aria-label="Cancelar" className="w-10 h-10 rounded-xl flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button></div>
                    </form>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input ref={archivo} type="file" multiple className="hidden" onChange={(e) => subir(e.target.files)} />
                    <button type="button" disabled={!!subiendo} onClick={() => archivo.current?.click()} className={botonSuave}><Upload className="w-3.5 h-3.5" />Subir archivos</button>
                    {!enlace && <button type="button" onClick={() => setEnlace({ titulo: '', url: '' })} className={botonSuave}><Link2 className="w-3.5 h-3.5" />Agregar enlace</button>}
                    {porVincular.length > 0 && (
                      <Selector value="" onChange={(e) => { const id = e.target.value; if (id) hacer(() => pedir('/api/unidades/materiales', 'POST', { unidadId: u.id, tipo: 'EVALUACION', evaluacionId: id })); }} aria-label="Vincular una evaluación" className={`${botonSuave} min-w-[200px] max-w-full`}>
                        <option value="">Vincular evaluación…</option>
                        {porVincular.map(e => <option key={e.id} value={e.id}>{e.nombre} · Sec. {e.seccion}</option>)}
                      </Selector>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
