'use client';
// Bandeja de entregas del profesor: todo lo que entregan sus estudiantes en la materia abierta, con filtros,
// buscador, contadores y el visor de revisión. En el Planificador se muestra en versión resumida (compacta).
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Search, RefreshCw, Clock, CheckCircle2, RotateCcw, MessageSquare, Download, ChevronRight, Users, Link2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { estiloDe, ESTILO, haceTiempo } from './tiposArchivo';
import Avatar from '@/components/Avatar';
import type { EntregaBandeja } from './VisorEntregas';
import type { RubricaEval } from '@/lib/rubrica';
import { textoNota } from '@/components/planificador/ModalNotas';
import { precargarArchivo } from './enlaces';

const VisorEntregas = dynamic(() => import('./VisorEntregas'));
const cargarVisor = () => import('./VisorEntregas').catch(() => null);
// Adelanta lo necesario para abrir una entrega: el visor y el enlace de su primer archivo
const adelantar = (e: EntregaBandeja) => { cargarVisor(); if (e.archivos[0]) precargarArchivo(fuenteDe(e.id, e.archivos[0].id)).catch(() => {}); };
export const fuenteDe = (entregaId: string, archivoId: string) => `/api/entregas/${encodeURIComponent(entregaId)}?archivoId=${encodeURIComponent(archivoId)}`;

interface ResumenEval { id: string; nombre: string; fecha: string | null; seccion: string; aceptaEntregas: boolean; rubrica: RubricaEval | null; estudiantes: number; entregadas: number; faltan: { id: string; nombre: string }[] }
interface Datos { archivos: boolean; entregas: EntregaBandeja[]; evaluaciones: ResumenEval[]; contadores: { total: number; sinRevisar: number; revisadas: number; devueltas: number; tarde: number; faltan: number } }
type Filtro = 'sinRevisar' | 'todas' | 'revisadas' | 'devueltas' | 'tarde' | 'faltan';

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '');
// Memoria de la última carga (al volver a la pestaña se ve al instante y se actualiza por detrás)
const memoria: { clave?: string; datos?: Datos } = {};

export default function BandejaEntregas({ materiaId, compacta = false, linea = false, onVerTodo }: { materiaId: string | null; compacta?: boolean; linea?: boolean; onVerTodo?: () => void }) {
  const clave = materiaId || 'todas';
  const [datos, setDatos] = useState<Datos | null>(() => (memoria.clave === clave ? memoria.datos ?? null : null));
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('sinRevisar');
  const [evaluacion, setEvaluacion] = useState('');
  const [seccion, setSeccion] = useState('');
  const [buscar, setBuscar] = useState('');
  const [visor, setVisor] = useState<{ ids: string[]; inicio: number; archivo: number } | null>(null);
  const [descargando, setDescargando] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/entregas${materiaId ? `?materiaId=${encodeURIComponent(materiaId)}` : ''}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la bandeja.');
      setDatos(d); setError(''); memoria.clave = clave; memoria.datos = d;
    } catch (e: any) { setError(e.message); } finally { setCargando(false); }
  }, [materiaId, clave]);

  // El visor se descarga en segundo plano apenas abre la bandeja (así la primera entrega abre al instante)
  useEffect(() => { const t = setTimeout(cargarVisor, 1200); return () => clearTimeout(t); }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    const alCambiar = () => cargar();
    window.addEventListener('entregas-cambiaron', alCambiar);
    return () => { clearInterval(t); window.removeEventListener('entregas-cambiaron', alCambiar); };
  }, [cargar]);

  const porId = useMemo(() => new Map((datos?.entregas || []).map(e => [e.id, e])), [datos]);
  const secciones = useMemo(() => [...new Set((datos?.evaluaciones || []).map(e => e.seccion))].sort(), [datos]);
  const rubricas = useMemo(() => Object.fromEntries((datos?.evaluaciones || []).map(e => [e.id, e.rubrica])), [datos]);

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (datos?.entregas || []).filter(e =>
      (!evaluacion || e.evaluacion.id === evaluacion) && (!seccion || e.evaluacion.seccion === seccion)
      && (!q || e.estudiante.nombre.toLowerCase().includes(q) || e.evaluacion.nombre.toLowerCase().includes(q) || e.archivos.some(a => a.nombre.toLowerCase().includes(q)))
      && (filtro === 'todas' || (filtro === 'sinRevisar' && !e.revisada && !e.devuelta) || (filtro === 'revisadas' && e.revisada) || (filtro === 'devueltas' && e.devuelta) || (filtro === 'tarde' && e.tarde)));
  }, [datos, filtro, evaluacion, seccion, buscar]);

  const faltantes = useMemo(() => (datos?.evaluaciones || []).filter(ev => (!evaluacion || ev.id === evaluacion) && (!seccion || ev.seccion === seccion) && ev.faltan.length > 0), [datos, evaluacion, seccion]);

  const actualizar = (id: string, cambios: Partial<EntregaBandeja>) => setDatos(d => {
    if (!d) return d;
    const entregas = d.entregas.map(e => (e.id === id ? { ...e, ...cambios } : e));
    const n = { ...d, entregas, contadores: { ...d.contadores, sinRevisar: entregas.filter(e => !e.revisada && !e.devuelta).length, revisadas: entregas.filter(e => e.revisada).length, devueltas: entregas.filter(e => e.devuelta).length } };
    memoria.datos = n; return n;
  });

  // El visor recorre la lista tal como estaba al abrirlo (aunque al revisar una deje de cumplir el filtro)
  const abrir = (id: string, archivo = 0) => { const ids = visibles.map(e => e.id); const e = porId.get(id); if (e) { adelantar(e); if (e.archivos[archivo]) precargarArchivo(fuenteDe(e.id, e.archivos[archivo].id)).catch(() => {}); } setVisor({ ids, inicio: Math.max(0, ids.indexOf(id)), archivo }); };

  // Descargar todas las entregas de una evaluación en un .zip (se arma en el navegador)
  const descargarTodas = async (ev: ResumenEval) => {
    setDescargando(ev.id);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const lista = (datos?.entregas || []).filter(e => e.evaluacion.id === ev.id);
      for (const e of lista) {
        const carpeta = zip.folder(e.estudiante.nombre.replace(/[\\/:*?"<>|]/g, '_'))!;
        if (e.url) carpeta.file('enlace.txt', `${e.url}\n`);
        if (e.comentario) carpeta.file('comentario.txt', e.comentario);
        for (const a of e.archivos) {
          const r = await fetch(`/api/entregas/${encodeURIComponent(e.id)}?archivoId=${encodeURIComponent(a.id)}&modo=url`);
          const d = await r.json().catch(() => ({}));
          if (!r.ok) continue;
          const b = await fetch(d.ver).then(x => (x.ok ? x.blob() : null)).catch(() => null);
          if (b) carpeta.file(a.nombre, b);
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${limpiar(ev.nombre).replace(/[\\/:*?"<>|]/g, '_')} - Sección ${ev.seccion}.zip`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { alert('No se pudo armar el .zip. Intenta de nuevo.'); } finally { setDescargando(''); }
  };

  const c = datos?.contadores;
  const FILTROS: { id: Filtro; texto: string; n?: number; color: string }[] = [
    { id: 'sinRevisar', texto: 'Sin revisar', n: c?.sinRevisar, color: 'text-[color:var(--c-c7d2fe)]' },
    { id: 'todas', texto: 'Todas', n: c?.total, color: 'text-[color:var(--c-d0d0da)]' },
    { id: 'revisadas', texto: 'Revisadas', n: c?.revisadas, color: 'text-emerald-300' },
    { id: 'devueltas', texto: 'Devueltas', n: c?.devueltas, color: 'text-amber-300' },
    { id: 'tarde', texto: 'Tarde', n: c?.tarde, color: 'text-red-300' },
    { id: 'faltan', texto: 'Faltan', n: c?.faltan, color: 'text-[color:var(--c-8a8b9e)]' },
  ];
  const evSel = (datos?.evaluaciones || []).find(e => e.id === evaluacion);
  const lista = compacta ? visibles.slice(0, 5) : visibles;

  // Versión de una línea (Planificador): solo los números y el acceso a la bandeja
  if (linea) {
    if (!datos || (c!.total === 0 && c!.faltan === 0)) return null;
    return (
      <button type="button" onClick={onVerTodo} className="w-full flex items-center gap-3 rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] px-4 py-2.5 text-left hover:border-[color:var(--c-818cf8)]/40 transition-colors group">
        <Inbox className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
        <span className="text-sm text-[color:var(--c-c0c0d0)] min-w-0 truncate">
          {c!.sinRevisar > 0 ? <><b className="text-[color:var(--c-e0e0ec)]">{c!.sinRevisar}</b> entrega{c!.sinRevisar === 1 ? '' : 's'} sin revisar</> : 'Todas las entregas revisadas'}
          {c!.faltan > 0 && <span className="text-[color:var(--c-8a8b9e)]"> · {c!.faltan} por entregar</span>}
        </span>
        <span className="ml-auto text-xs font-medium text-[color:var(--c-c7d2fe)] flex items-center gap-1 flex-shrink-0">Abrir bandeja<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </button>
    );
  }

  return (
    <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl shadow-xl overflow-hidden">
      {/* Encabezado */}
      <div className="px-4 md:px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap">
        <span className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/30 flex items-center justify-center relative">
          <Inbox className="w-5 h-5 text-[color:var(--c-a5b4fc)]" />
          {!!c?.sinRevisar && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[color:var(--c-818cf8)] ring-2 ring-[color:var(--c-1d1e2e)] animate-pulse" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Bandeja de entregas</h2>
          <p className="text-xs text-[color:var(--c-8a8b9e)]">
            {!datos ? 'Cargando…' : c!.total === 0 ? 'Aquí llegarán los trabajos de tus estudiantes.' : `${c!.total} entrega${c!.total === 1 ? '' : 's'} · ${c!.sinRevisar} sin revisar · ${c!.faltan} por entregar`}
          </p>
        </div>
        <button type="button" onClick={cargar} className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10" title="Actualizar"><RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /></button>
        {compacta && onVerTodo && <button type="button" onClick={onVerTodo} className="h-9 px-3 rounded-lg text-xs font-semibold text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/30 hover:bg-[color:var(--c-818cf8)]/20 flex items-center gap-1.5">Abrir bandeja<ArrowRight className="w-3.5 h-3.5" /></button>}
      </div>

      {/* Filtros */}
      <div className="px-4 md:px-5 pb-3 space-y-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTROS.filter(f => !compacta || ['sinRevisar', 'todas', 'devueltas', 'faltan'].includes(f.id)).map(f => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={`relative h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filtro === f.id ? 'border-[color:var(--c-818cf8)]/50 bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-e0e0ec)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
              {f.texto}{f.n != null && <span className={`ml-1.5 font-bold ${f.color}`}>{f.n}</span>}
            </button>
          ))}
        </div>
        {!compacta && (
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]"><Search className="w-4 h-4 text-[color:var(--c-5f6074)] absolute left-3 top-1/2 -translate-y-1/2" /><input value={buscar} onChange={(ev) => setBuscar(ev.target.value)} placeholder="Buscar estudiante, evaluación o archivo…" className="w-full h-9 pl-9 pr-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" /></div>
            <select value={evaluacion} onChange={(ev) => setEvaluacion(ev.target.value)} className="h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d0d0da)] max-w-[260px]">
              <option value="">Todas las evaluaciones</option>
              {(datos?.evaluaciones || []).map(ev => <option key={ev.id} value={ev.id}>{limpiar(ev.nombre)} · Sec. {ev.seccion} ({ev.entregadas}/{ev.estudiantes})</option>)}
            </select>
            {secciones.length > 1 && <select value={seccion} onChange={(ev) => setSeccion(ev.target.value)} className="h-9 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d0d0da)]"><option value="">Todas las secciones</option>{secciones.map(s => <option key={s} value={s}>Sección {s}</option>)}</select>}
            {evSel && evSel.entregadas > 0 && datos?.archivos && <button type="button" disabled={!!descargando} onClick={() => descargarTodas(evSel)} className="h-9 px-3 rounded-lg border border-[color:var(--c-313248)] text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5 disabled:opacity-60">{descargando ? <span className="w-3.5 h-3.5 border-2 border-[color:var(--c-818cf8)]/30 border-t-[color:var(--c-818cf8)] rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}Descargar todas (.zip)</button>}
          </div>
        )}
        {evSel && !compacta && (
          <div className="flex items-center gap-3 text-xs text-[color:var(--c-8a8b9e)]">
            <div className="flex-1 h-1.5 rounded-full bg-[color:var(--c-282a3f)] overflow-hidden"><div className="h-full bg-gradient-to-r from-[color:var(--c-818cf8)] to-emerald-400 rounded-full" style={{ width: `${evSel.estudiantes ? Math.min(100, (evSel.entregadas / evSel.estudiantes) * 100) : 0}%` }} /></div>
            <span><b className="text-[color:var(--c-d0d0da)]">{evSel.entregadas}</b> de {evSel.estudiantes} entregaron</span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className={`border-t border-[color:var(--c-282a3f)] ${compacta ? '' : 'min-h-[320px]'}`}>
        {error && <p className="m-4 text-sm text-red-200 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
        {!datos && !error ? <Esqueleto filas={compacta ? 3 : 6} />
          : datos && filtro === 'faltan' ? <Faltantes lista={faltantes} compacta={compacta} />
          : datos && lista.length === 0 ? <Vacio filtro={filtro} total={datos.contadores.total} />
          : (
            <ul className="divide-y divide-[color:var(--c-282a3f)]">
              <AnimatePresence initial={false}>
                {lista.map((e, k) => <Fila key={e.id} e={e} k={k} onAbrir={(archivo) => abrir(e.id, archivo)} />)}
              </AnimatePresence>
            </ul>
          )}
        {compacta && visibles.length > 5 && filtro !== 'faltan' && <button type="button" onClick={onVerTodo} className="w-full py-2.5 text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/5 border-t border-[color:var(--c-282a3f)]">Ver las {visibles.length} entregas →</button>}
      </div>

      <AnimatePresence>
        {visor && (
          <VisorEntregas
            entregas={visor.ids.map(id => porId.get(id)).filter(Boolean) as EntregaBandeja[]}
            inicio={visor.inicio} archivoInicial={visor.archivo} rubricas={rubricas}
            onCerrar={() => setVisor(null)} onActualizar={actualizar}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Fila({ e, k, onAbrir }: { e: EntregaBandeja; k: number; onAbrir: (archivo?: number) => void }) {
  const estado = e.devuelta ? { t: 'Devuelta', c: 'bg-amber-500/10 text-amber-300 border-amber-500/30', i: RotateCcw }
    : e.revisada ? { t: 'Revisada', c: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', i: CheckCircle2 }
    : { t: 'Nueva', c: 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)] border-[color:var(--c-818cf8)]/30', i: Sparkles };
  const IconoEstado = estado.i;
  return (
    <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(k, 10) * 0.025 } }} exit={{ opacity: 0 }}
      onMouseEnter={() => adelantar(e)} className="px-4 md:px-5 py-3.5 hover:bg-[color:var(--c-818cf8)]/[0.03] transition-colors">
      <button type="button" onClick={() => onAbrir(0)} onTouchStart={() => adelantar(e)} onFocus={() => adelantar(e)} className="w-full text-left flex items-center gap-3 group">
        <Avatar id={e.estudiante.cuentaId} version={e.estudiante.avatarEn} nombre={e.estudiante.nombre} tamano={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm truncate ${!e.revisada && !e.devuelta ? 'font-semibold text-[color:var(--c-e0e0ec)]' : 'font-medium text-[color:var(--c-c0c0d0)]'}`}>{e.estudiante.nombre}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${estado.c}`}><IconoEstado className="w-3 h-3" />{estado.t}</span>
            {e.tarde && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-300 border-red-500/30 flex items-center gap-1"><Clock className="w-3 h-3" />Tarde</span>}
            {e.sinLeer > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{e.sinLeer}</span>}
          </div>
          <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{limpiar(e.evaluacion.nombre)} · Sec. {e.evaluacion.seccion} · {haceTiempo(e.entregadaEn)}</p>
        </div>
        {e.nota?.puntaje != null && <span className="flex-shrink-0 text-right"><span className="block text-lg font-bold text-[color:var(--c-e0e0ec)] tabular-nums leading-none">{textoNota(e.nota.puntaje)}</span><span className="text-[10px] text-[color:var(--c-6a6b7e)]">/20</span></span>}
        <ChevronRight className="w-4 h-4 text-[color:var(--c-5f6074)] group-hover:text-[color:var(--c-a5b4fc)] flex-shrink-0" />
      </button>
      {/* Archivos como cuadros: cada uno abre ESE archivo en el visor */}
      {(e.archivos.length > 0 || e.url) && (
        <div className="flex gap-2 mt-2 pt-1 pl-[52px] overflow-x-auto pb-1 relative">
          {e.archivos.map((a, i) => {
            const est = estiloDe(a.nombre); const I = est.icono;
            const ext = (a.nombre.match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase();
            return (
              <button key={a.id} type="button" onClick={() => onAbrir(i)} onMouseEnter={() => precargarArchivo(fuenteDe(e.id, a.id)).catch(() => {})} title={`Abrir ${a.nombre}`}
                className={`flex-shrink-0 w-[104px] h-[104px] rounded-xl border p-2.5 flex flex-col text-left hover:-translate-y-0.5 hover:shadow-lg transition-all ${est.fondo}`}>
                <span className="flex items-start justify-between"><I className={`w-7 h-7 ${est.color}`} /><span className={`text-[9px] font-bold tracking-wider ${est.color}`}>{ext}</span></span>
                <span className="mt-auto text-[11px] leading-tight text-[color:var(--c-d0d0da)] line-clamp-2 break-all">{a.nombre}</span>
              </button>
            );
          })}
          {e.url && (
            <a href={e.url} target="_blank" rel="noopener noreferrer" title={e.url} className={`flex-shrink-0 w-[104px] h-[104px] rounded-xl border p-2.5 flex flex-col hover:-translate-y-0.5 hover:shadow-lg transition-all ${ESTILO.enlace.fondo}`}>
              <Link2 className={`w-7 h-7 ${ESTILO.enlace.color}`} />
              <span className="mt-auto text-[11px] leading-tight text-[color:var(--c-d0d0da)] line-clamp-2 break-all">{(() => { try { return new URL(e.url).hostname.replace(/^www\./, ''); } catch { return 'Enlace'; } })()}</span>
            </a>
          )}
        </div>
      )}
    </motion.li>
  );
}

function Faltantes({ lista, compacta }: { lista: ResumenEval[]; compacta: boolean }) {
  if (!lista.length) return <Vacio filtro="faltan" total={1} />;
  return (
    <div className="p-4 md:p-5 space-y-3">
      {lista.slice(0, compacta ? 2 : undefined).map(ev => (
        <div key={ev.id} className="rounded-xl border border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] p-3">
          <div className="flex items-center justify-between gap-2 mb-2"><p className="text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{limpiar(ev.nombre)} <span className="text-[color:var(--c-6a6b7e)] font-normal">· Sec. {ev.seccion}</span></p><span className="text-xs text-[color:var(--c-8a8b9e)] flex items-center gap-1 flex-shrink-0"><Users className="w-3.5 h-3.5" />faltan {ev.faltan.length} de {ev.estudiantes}</span></div>
          <div className="flex flex-wrap gap-1.5">{ev.faltan.slice(0, compacta ? 8 : 60).map(s => <span key={s.id} className="text-[11px] px-2 py-1 rounded-md bg-[color:var(--c-232430)] text-[color:var(--c-b0b0c4)]">{s.nombre}</span>)}{ev.faltan.length > (compacta ? 8 : 60) && <span className="text-[11px] text-[color:var(--c-6a6b7e)] px-1 py-1">+{ev.faltan.length - (compacta ? 8 : 60)}</span>}</div>
        </div>
      ))}
    </div>
  );
}

function Vacio({ filtro, total }: { filtro: Filtro; total: number }) {
  const t = total === 0
    ? { titulo: 'Todavía no hay entregas', texto: 'Cuando tus estudiantes entreguen sus trabajos desde su cuenta, aparecerán aquí al momento. Comparte el código de clase para que se unan.' }
    : filtro === 'sinRevisar' ? { titulo: '¡Todo revisado! 🎉', texto: 'No tienes entregas pendientes por revisar.' }
    : filtro === 'faltan' ? { titulo: 'Todos entregaron', texto: 'Ningún estudiante tiene entregas pendientes.' }
    : { titulo: 'Nada por aquí', texto: 'Ninguna entrega coincide con este filtro.' };
  return (
    <div className="py-12 px-6 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-2xl bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 flex items-center justify-center"><Inbox className="w-7 h-7 text-[color:var(--c-a5b4fc)]" /></span>
      <p className="text-sm font-semibold text-[color:var(--c-d0d0da)]">{t.titulo}</p>
      <p className="text-xs text-[color:var(--c-8a8b9e)] max-w-sm">{t.texto}</p>
    </div>
  );
}

function Esqueleto({ filas }: { filas: number }) {
  return (
    <ul className="divide-y divide-[color:var(--c-282a3f)]">
      {Array.from({ length: filas }, (_, k) => (
        <li key={k} className="px-5 py-3.5 flex items-center gap-3 animate-pulse">
          <span className="w-10 h-10 rounded-full bg-[color:var(--c-282a3f)]" />
          <span className="flex-1 space-y-2"><span className="block h-3 w-1/3 rounded bg-[color:var(--c-282a3f)]" /><span className="block h-2.5 w-1/2 rounded bg-[color:var(--c-232430)]" /></span>
        </li>
      ))}
    </ul>
  );
}
