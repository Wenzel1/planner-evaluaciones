'use client';
// Página personal del estudiante: /e/<token>
// Muestra SU plan de evaluación, los recursos de lo que ya está abierto, la rúbrica y sus notas.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Lock, Calendar, Clock, Users, Target, ChevronDown, Download, PlayCircle, ExternalLink,
  CheckCircle2, CircleDot, Hourglass, ClipboardCheck, MessageSquare, AlertCircle, BookOpen, Sparkles, FileText, CalendarPlus, Flag,
} from 'lucide-react';
import { NIVELES_RUBRICA, puntosNivel, textoPuntos, type RubricaEval } from '@/lib/rubrica';

interface Recurso { titulo: string; url: string }
interface Nota { puntaje: number; observaciones: string | null; detalle: (number | null)[] | null }
interface Evaluacion {
  id: string; nombre: string; tipoActividad: string | null; enfoque: string | null; peso: number | null;
  fecha: string | null; duracion: number | null; cantidadGrupos: number | null; personasPorGrupo: number | null;
  estado: string; abierta: boolean; abreEl: string | null; descripcion: string | null;
  recursos: Recurso[]; rubrica: RubricaEval | null; nota: Nota | null; preparado?: boolean;
}
interface Opinion { deAcuerdo: boolean; comentario: string | null; fecha: string }
interface Materia { id: string; nombre: string; evaluaciones: Evaluacion[]; promedio: number | null; opinion: Opinion | null }
interface Datos { estudiante: { nombre: string; seccion: string }; profesor: string; materias: Materia[]; generado: string }

const ZONA = 'America/Caracas';
const fFecha = (d: string, op: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, ...op }).format(new Date(d));
const fNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));
const DIA = 86400000;

function cuandoFalta(fecha: string, ahora: number): string {
  const ms = new Date(fecha).getTime() - ahora;
  if (ms <= 0) return 'ya pasó';
  const dias = Math.floor(ms / DIA);
  if (dias === 0) { const h = Math.max(1, Math.round(ms / 3600000)); return h === 1 ? 'en 1 hora' : `en ${h} horas`; }
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

function idYouTube(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}
const dominio = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

// ¿Cuánto necesita en lo que falta para llegar a 10? Usa el peso de cada evaluación (si nadie tiene peso, todas valen igual).
interface Meta { tipo: 'sin-notas' | 'necesita' | 'aprobado' | 'no-alcanza' | 'cerrado'; necesita?: number; faltan: number; pesoFalta: number; acumulado: number; maximo: number; final?: number }
function calcularMeta(evs: Evaluacion[]): Meta {
  const conPeso = evs.some(e => (e.peso ?? 0) > 0);
  const peso = (e: Evaluacion) => (conPeso ? Math.max(0, e.peso ?? 0) : 1);
  const total = evs.reduce((t, e) => t + peso(e), 0) || 1;
  const hechas = evs.filter(e => e.nota);
  const faltan = evs.filter(e => !e.nota && peso(e) > 0);
  const pesoHecho = hechas.reduce((t, e) => t + peso(e), 0);
  const pesoFalta = faltan.reduce((t, e) => t + peso(e), 0);
  const suma = hechas.reduce((t, e) => t + e.nota!.puntaje * peso(e), 0);
  const acumulado = suma / total;                // puntos ya ganados sobre 20
  const maximo = acumulado + (20 * pesoFalta) / total; // lo máximo a lo que puede llegar
  const base = { faltan: faltan.length, pesoFalta: conPeso ? pesoFalta : Math.round((pesoFalta / total) * 100), acumulado, maximo };
  if (hechas.length === 0) return { tipo: 'sin-notas', ...base, necesita: 10 };
  if (pesoFalta === 0) return { tipo: 'cerrado', ...base, final: suma / (pesoHecho || 1) };
  const necesita = Math.ceil(((10 * total - suma) / pesoFalta) * 10) / 10;
  if (necesita <= 0) return { tipo: 'aprobado', ...base, necesita: 0 };
  if (necesita > 20) return { tipo: 'no-alcanza', ...base, necesita };
  return { tipo: 'necesita', ...base, necesita };
}

type Situacion = 'calificada' | 'realizada' | 'proxima' | 'abierta' | 'bloqueada';
function situacion(e: Evaluacion, ahora: number): Situacion {
  if (e.nota) return 'calificada';
  if (e.estado === 'REALIZADA' || (e.fecha && new Date(e.fecha).getTime() < ahora)) return 'realizada';
  if (!e.abierta) return 'bloqueada';
  return 'abierta';
}

const ESTILO: Record<Situacion, { texto: string; clase: string; Icono: any }> = {
  calificada: { texto: 'Calificada', clase: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', Icono: CheckCircle2 },
  realizada: { texto: 'Esperando nota', clase: 'bg-sky-500/10 text-sky-300 border-sky-500/30', Icono: Hourglass },
  proxima: { texto: 'Próxima', clase: 'bg-[#818cf8]/15 text-[#c7d2fe] border-[#818cf8]/40', Icono: CircleDot },
  abierta: { texto: 'Abierta', clase: 'bg-[#818cf8]/10 text-[#a5b4fc] border-[#818cf8]/30', Icono: CircleDot },
  bloqueada: { texto: 'Bloqueada', clase: 'bg-[#272839] text-[#8a8b9e] border-[#313248]', Icono: Lock },
};
const COLOR_NIVEL = ['text-emerald-300', 'text-sky-300', 'text-amber-300', 'text-red-300'];
const FONDO_NIVEL = ['bg-emerald-500/15 border-emerald-500/40', 'bg-sky-500/15 border-sky-500/40', 'bg-amber-500/15 border-amber-500/40', 'bg-red-500/15 border-red-500/40'];

export default function PortalEstudiante() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [verPlan, setVerPlan] = useState(true); // el plan sale abierto al entrar

  useEffect(() => {
    let vivo = true;
    const delProfesor = new URLSearchParams(window.location.search).get('profesor') === '1'; // el profesor mirando: no cuenta como visita
    fetch(`/api/portal/${encodeURIComponent(token)}${delProfesor ? '?profesor=1' : ''}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo cargar tu plan.'); return d; })
      .then((d: Datos) => { if (vivo) { setDatos(d); setMateriaId(d.materias[0]?.id ?? null); } })
      .catch(e => { if (vivo) setError(e instanceof TypeError ? 'Sin conexión. Revisa tu internet e intenta de nuevo.' : e.message); });
    const t = setInterval(() => setAhora(Date.now()), 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [token]);

  const materia = datos?.materias.find(m => m.id === materiaId) || datos?.materias[0] || null;
  const lista = useMemo(() => {
    if (!materia) return [];
    let marcada = false;
    return materia.evaluaciones.map(e => {
      let s = situacion(e, ahora);
      if (s === 'abierta' && !marcada) { s = 'proxima'; marcada = true; }
      return { e, s };
    });
  }, [materia, ahora]);
  const proxima = lista.find(x => x.s === 'proxima')?.e || lista.find(x => x.s === 'bloqueada')?.e || null;

  // Abre por defecto la próxima evaluación
  useEffect(() => { if (materia) setAbierta(lista.find(x => x.s === 'proxima')?.e.id ?? null); }, [materia?.id]);

  if (error) return (
    <Pantalla>
      <div className="max-w-md mx-auto mt-24 text-center px-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4"><AlertCircle className="w-7 h-7 text-red-300" /></div>
        <h1 className="text-lg font-semibold text-white">No pudimos abrir tu plan</h1>
        <p className="text-sm text-[#9a9bb0] mt-2">{error}</p>
      </div>
    </Pantalla>
  );
  if (!datos) return (
    <Pantalla>
      <div className="flex items-center justify-center gap-3 mt-32 text-[#9a9bb0] text-sm"><span className="w-5 h-5 border-2 border-[#818cf8] border-t-transparent rounded-full animate-spin" />Cargando tu plan…</div>
    </Pantalla>
  );

  const primer = datos.estudiante.nombre.trim().split(/\s+/)[0];
  const realizadas = lista.filter(x => x.s === 'calificada' || x.s === 'realizada').length;
  const total = lista.length;

  const irA = (id: string) => {
    setAbierta(id);
    setTimeout(() => document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const calHref = materia ? `/api/portal/${encodeURIComponent(token)}/calendario?materia=${encodeURIComponent(materia.id)}` : '#';
  const marcarPreparado = (id: string, valor: boolean) => setDatos(prev => prev ? { ...prev, materias: prev.materias.map(m => ({ ...m, evaluaciones: m.evaluaciones.map(e => e.id === id ? { ...e, preparado: valor } : e) })) } : prev);
  const pdfHref = materia ? `/api/portal/${encodeURIComponent(token)}/pdf?materia=${encodeURIComponent(materia.id)}` : '#';

  return (
    <Pantalla>
      {/* Celular: una sola columna. Computadora (lg): panel fijo a la izquierda con el estudiante y su resumen, evaluaciones a la derecha */}
      <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-16 lg:grid lg:grid-cols-[340px_1fr] lg:gap-10 xl:gap-14">
        <aside className="lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:pb-10 [scrollbar-width:none]">
          {/* Encabezado: el estudiante es el protagonista */}
          <header className="pt-8 sm:pt-12 pb-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#818cf8] font-semibold">
              <GraduationCap className="w-4 h-4" />Mi plan de evaluación
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-[2.6rem] font-bold text-white leading-tight">Hola, {primer} 👋</h1>
            <p className="mt-1 text-base sm:text-lg text-[#c7c8d8]">{datos.estudiante.nombre}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-[#818cf8]/15 border border-[#818cf8]/35 text-[#c7d2fe] font-semibold">Sección {datos.estudiante.seccion}</span>
              <span className="text-[#8a8b9e]">Prof. {datos.profesor}</span>
            </div>
          </header>

          {datos.materias.length > 1 && (
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
              {datos.materias.map(m => (
                <button key={m.id} onClick={() => setMateriaId(m.id)} className={`shrink-0 h-9 px-4 rounded-xl text-sm font-medium border text-left transition-colors ${m.id === materia?.id ? 'bg-[#818cf8] border-[#818cf8] text-white' : 'bg-[#1c1d2a] border-[#2a2b3d] text-[#a0a0b8] hover:text-white'}`}>{m.nombre}</button>
              ))}
            </div>
          )}

          {materia && (
            <>
              {datos.materias.length === 1 && <p className="text-sm text-[#9a9bb0] mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#818cf8]" />{materia.nombre}</p>}

              {/* Resumen */}
              <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-2 gap-3 mb-8 lg:mb-6">
                <div className="sm:col-span-1 lg:col-span-2 rounded-2xl border border-[#818cf8]/30 bg-gradient-to-br from-[#818cf8]/15 to-[#1c1d2a] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[#a5b4fc] font-semibold">Próxima evaluación</p>
                  {proxima && proxima.fecha ? (
                    <button type="button" onClick={() => irA(proxima.id)} className="text-left w-full">
                      <p className="mt-1.5 text-white font-semibold leading-snug line-clamp-2">{proxima.nombre}</p>
                      <p className="mt-1 text-sm text-[#c7d2fe]">{cuandoFalta(proxima.fecha, ahora)} · {fFecha(proxima.fecha, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </button>
                  ) : <p className="mt-1.5 text-sm text-[#c7d2fe]">{total > 0 && realizadas === total ? '¡Terminaste todas! 🎉' : 'Sin fecha por ahora'}</p>}
                </div>
                <div className="rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[#8a8b9e] font-semibold">Avance</p>
                  <p className="mt-1.5 text-2xl font-bold text-white">{realizadas}<span className="text-base text-[#8a8b9e] font-medium"> / {total}</span></p>
                  <div className="mt-2 h-1.5 rounded-full bg-[#272839] overflow-hidden"><div className="h-full rounded-full bg-[#818cf8]" style={{ width: `${total ? (realizadas / total) * 100 : 0}%` }} /></div>
                </div>
                <div className="rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-4">
                  <p className="text-[11px] uppercase tracking-wider text-[#8a8b9e] font-semibold">Mi promedio</p>
                  {materia.promedio != null ? (
                    <p className={`mt-1.5 text-2xl font-bold ${materia.promedio >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{fNota(materia.promedio)}<span className="text-base text-[#8a8b9e] font-medium"> / 20</span></p>
                  ) : <p className="mt-1.5 text-sm text-[#8a8b9e]">Aún sin notas</p>}
                </div>
                <TarjetaMeta meta={calcularMeta(materia.evaluaciones)} />
              </section>

              {/* Solo en computadora: el lapso de un vistazo, para saltar a cada evaluación */}
              <nav className="hidden lg:block rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-2 mb-6">
                <p className="px-2 pt-1.5 pb-2 text-[11px] uppercase tracking-wider text-[#8a8b9e] font-semibold">El lapso de un vistazo</p>
                {lista.map(({ e, s }) => (
                  <button key={e.id} type="button" onClick={() => irA(e.id)} className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors hover:bg-[#232438] ${abierta === e.id ? 'bg-[#232438]' : ''}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s === 'calificada' ? (e.nota!.puntaje >= 10 ? 'bg-emerald-400' : 'bg-red-400') : s === 'realizada' ? 'bg-sky-400' : s === 'bloqueada' ? 'bg-[#4a4b60]' : 'bg-[#818cf8]'}`} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm truncate ${s === 'bloqueada' ? 'text-[#8a8b9e]' : 'text-[#e0e0ec]'}`}>{e.nombre}</span>
                      <span className="block text-[11px] text-[#7a7b90]">{e.fecha ? fFecha(e.fecha, { day: 'numeric', month: 'short' }) : 'Sin fecha'}{e.peso != null ? ` · ${e.peso}%` : ''}</span>
                    </span>
                    {e.nota ? <span className={`text-sm font-bold ${e.nota.puntaje >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{fNota(e.nota.puntaje)}</span> : s === 'bloqueada' ? <Lock className="w-3.5 h-3.5 text-[#5a5b70]" /> : null}
                  </button>
                ))}
              </nav>

              <div className="hidden lg:flex flex-col gap-3">
                <a href={pdfHref} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#1c1d2a] border border-[#313248] text-sm text-[#d0d0da] font-medium hover:border-[#818cf8]/50"><Download className="w-4 h-4" />Descargar en PDF</a>
                <a href={calHref} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#1c1d2a] border border-[#313248] text-sm text-[#d0d0da] font-medium hover:border-[#818cf8]/50"><CalendarPlus className="w-4 h-4" />Agregar a mi calendario</a>
                <p className="text-xs text-[#6a6b7e] text-center">🔒 Este enlace es solo tuyo. No lo compartas: muestra tus notas.</p>
              </div>
            </>
          )}
        </aside>

        <div className="min-w-0 lg:pt-12">
          {datos.materias.length === 0 && (
            <div className="rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-8 text-center text-sm text-[#9a9bb0]">Tu profesor todavía no ha publicado evaluaciones para tu sección.</div>
          )}
          {materia && (
            <>
              {/* El plan de evaluación con el mismo diseño del Plan de Acción de la app (abierto al entrar, se puede cerrar) */}
              <section className="mb-8">
                <button type="button" onClick={() => setVerPlan(v => !v)} className="w-full flex items-center gap-3 mb-3 text-left group">
                  <span className="w-8 h-8 rounded-xl bg-[#818cf8]/15 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#a5b4fc]" /></span>
                  <span className="flex-1 text-sm font-semibold text-[#9a9bb0] uppercase tracking-wider group-hover:text-white transition-colors">Plan de evaluación</span>
                  <span className="text-xs text-[#7a7b90] group-hover:text-[#c7d2fe]">{verPlan ? 'Cerrar' : 'Ver plan'}</span>
                  <ChevronDown className={`w-5 h-5 text-[#6a6b7e] transition-transform ${verPlan ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {verPlan && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <PlanDeAccion materia={materia} profesor={datos.profesor} seccion={datos.estudiante.seccion} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <OpinionPlan token={token} materia={materia} onGuardada={(op) => setDatos(prev => prev ? { ...prev, materias: prev.materias.map(m => m.id === materia.id ? { ...m, opinion: op } : m) } : prev)} />
              </section>

              <h2 className="text-sm font-semibold text-[#9a9bb0] uppercase tracking-wider mb-3">Mis evaluaciones</h2>
              <ol className="space-y-3">
                {lista.map(({ e, s }, i) => (
                  <TarjetaPortal key={e.id} e={e} s={s} indice={i + 1} abierta={abierta === e.id} onAlternar={() => setAbierta(abierta === e.id ? null : e.id)} ahora={ahora} token={token} materiaNombre={materia.nombre} onPreparado={marcarPreparado} />
                ))}
              </ol>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 lg:hidden">
                <a href={pdfHref} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#1c1d2a] border border-[#313248] text-sm text-[#d0d0da] font-medium hover:border-[#818cf8]/50">
                  <Download className="w-4 h-4" />Descargar en PDF
                </a>
                <a href={calHref} className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#1c1d2a] border border-[#313248] text-sm text-[#d0d0da] font-medium hover:border-[#818cf8]/50">
                  <CalendarPlus className="w-4 h-4" />Agregar a mi calendario
                </a>
                <p className="text-xs text-[#6a6b7e] sm:ml-auto">🔒 Este enlace es solo tuyo. No lo compartas: muestra tus notas.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </Pantalla>
  );
}

// Mismo diseño que la vista previa del Plan de Acción en la app del profesor (hoja blanca)
function PlanDeAccion({ materia, profesor, seccion }: { materia: Materia; profesor: string; seccion: string }) {
  const lista = materia.evaluaciones;
  const fCorta = (d: string | null) => (d ? fFecha(d, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  return (
    <div className="w-full border border-slate-200 rounded-xl bg-white text-slate-800 font-sans shadow-lg">
      <div className="p-4 sm:p-10 relative">
        <div className="sm:absolute sm:top-10 sm:right-10 inline-block mb-4 sm:mb-0 text-[10px] uppercase tracking-widest font-bold text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20 px-3 py-1 rounded-md">Sección {seccion}</div>
        <div className="mb-8 border-b-2 border-[#1e3a8a] pb-6">
          <span className="text-[11px] font-bold text-[#60a5fa] uppercase tracking-widest">Plan de Acción</span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1e3a8a] mt-1 sm:pr-32">{materia.nombre}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-slate-500"><p>👤 Prof. {profesor}</p><p>📅 {fFecha(new Date().toISOString(), { day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div>
        </div>
        <div className="overflow-x-auto mb-8 rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left bg-white text-[13px] sm:text-base">
            <thead><tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500"><th className="p-2.5 sm:p-4">Contenido</th><th className="p-2.5 sm:p-4">Estrategia</th><th className="p-2.5 sm:p-4 text-center">Peso</th><th className="p-2.5 sm:p-4 text-center">Fecha</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map(e => (
                <tr key={e.id}>
                  <td className="p-2.5 sm:p-4 font-medium text-slate-700">{e.nombre}{!e.abierta && <span className="ml-1.5 text-xs" title="Los detalles se abren 7 días antes">🔒</span>}</td>
                  <td className="p-2.5 sm:p-4 text-slate-600">{e.tipoActividad || 'Desarrollo'}</td>
                  <td className="p-2.5 sm:p-4 text-center font-bold text-[#1e3a8a]">{e.peso || 0}%</td>
                  <td className="p-2.5 sm:p-4 text-center text-slate-600 whitespace-nowrap"><span className="sm:hidden">{e.fecha ? fFecha(e.fecha, { day: '2-digit', month: '2-digit' }) : '—'}</span><span className="hidden sm:inline">{fCorta(e.fecha)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8">
          <div><p className="text-xs text-slate-400 uppercase mb-1">Prof. {profesor}</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Firma</p></div>
          <div><p className="text-xs text-slate-400 uppercase mb-1">Coordinación Académica</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Sello</p></div>
        </div>
      </div>
    </div>
  );
}

// ¿Está de acuerdo con el plan? Le llega al profesor en el Planificador. Se puede cambiar después.
function OpinionPlan({ token, materia, onGuardada }: { token: string; materia: Materia; onGuardada: (o: Opinion) => void }) {
  const op = materia.opinion;
  const [modo, setModo] = useState<'ver' | 'sugerir'>('ver');
  const [texto, setTexto] = useState(op?.comentario || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  useEffect(() => { setModo('ver'); setEditando(false); setError(''); setTexto(materia.opinion?.comentario || ''); }, [materia.id]);

  const enviar = async (deAcuerdo: boolean) => {
    setEnviando(true); setError('');
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}/opinion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId: materia.id, deAcuerdo, comentario: texto }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      onGuardada(d.opinion); setModo('ver'); setEditando(false);
    } catch (e: any) { setError(e instanceof TypeError ? 'Sin conexión. Intenta de nuevo.' : e.message); } finally { setEnviando(false); }
  };

  if (op && !editando) return (
    <div className="mt-3 rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-4 flex items-start gap-3">
      <span className="text-xl leading-none mt-0.5">{op.deAcuerdo ? '👍' : '💬'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{op.deAcuerdo ? 'Dijiste que estás de acuerdo con el plan.' : 'Le enviaste una sugerencia a tu profesor.'}</p>
        {op.comentario && <p className="text-sm text-[#a8a9bc] mt-1 whitespace-pre-wrap break-words">“{op.comentario}”</p>}
        <p className="text-[11px] text-[#6a6b7e] mt-1.5">¡Gracias! Tu profesor ya puede verlo.</p>
      </div>
      <button type="button" onClick={() => { setEditando(true); setModo(op.deAcuerdo ? 'ver' : 'sugerir'); }} className="shrink-0 text-xs text-[#a5b4fc] hover:text-white">Cambiar</button>
    </div>
  );

  return (
    <div className="mt-3 rounded-2xl border border-[#818cf8]/30 bg-[#1d1e33] p-4">
      <p className="text-sm font-semibold text-white">¿Estás de acuerdo con este plan de evaluación?</p>
      <p className="text-xs text-[#9a9bb0] mt-0.5">Tu opinión le llega a tu profesor con tu nombre.</p>
      {modo === 'ver' ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button type="button" disabled={enviando} onClick={() => { setTexto(''); enviar(true); }} className="flex-1 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-50">👍 Sí, estoy de acuerdo</button>
          <button type="button" disabled={enviando} onClick={() => setModo('sugerir')} className="flex-1 h-11 rounded-xl bg-[#232438] border border-[#313248] text-[#d0d0da] text-sm font-semibold hover:border-[#818cf8]/50 disabled:opacity-50">💬 Tengo una sugerencia</button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 600))} rows={3} autoFocus placeholder="Ej.: ¿Se puede mover la exposición una semana? Coincide con el parcial de otra materia." className="w-full bg-[#191a26] border border-[#313248] rounded-xl px-3 py-2 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] outline-none focus:border-[#818cf8]/60 resize-none" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6a6b7e]">{texto.length}/600</span>
            <button type="button" onClick={() => { setModo('ver'); if (op) setEditando(false); }} className="ml-auto h-9 px-4 rounded-xl text-sm text-[#a0a0b8] hover:text-white">Cancelar</button>
            <button type="button" disabled={enviando || texto.trim().length < 5} onClick={() => enviar(false)} className="h-9 px-4 rounded-xl bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-semibold disabled:opacity-40">{enviando ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#13141d] text-[#d0d0da] font-['Inter',system-ui,sans-serif] [background-image:radial-gradient(ellipse_at_top,rgba(129,140,248,0.12),transparent_60%)]">{children}</main>;
}

function TarjetaPortal({ e, s, indice, abierta, onAlternar, ahora, token, materiaNombre, onPreparado }: { e: Evaluacion; s: Situacion; indice: number; abierta: boolean; onAlternar: () => void; ahora: number; token: string; materiaNombre: string; onPreparado: (id: string, v: boolean) => void }) {
  const porHacer = s === 'proxima' || s === 'abierta';
  const est = ESTILO[s];
  const bloqueada = s === 'bloqueada';
  const tieneContenido = !bloqueada && (!!e.descripcion || e.recursos.length > 0 || !!e.rubrica || !!e.nota || porHacer);
  return (
    <li id={`ev-${e.id}`} className={`scroll-mt-6 rounded-2xl border transition-colors ${s === 'proxima' ? 'border-[#818cf8]/50 bg-[#1d1e33] shadow-[0_0_0_1px_rgba(129,140,248,0.15)]' : bloqueada ? 'border-[#24253a] bg-[#191a26]' : 'border-[#2a2b3d] bg-[#1c1d2a]'}`}>
      <button type="button" onClick={tieneContenido ? onAlternar : undefined} className={`w-full text-left p-4 flex gap-3 ${tieneContenido ? 'cursor-pointer' : 'cursor-default'}`}>
        <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold ${bloqueada ? 'bg-[#22233a] text-[#5a5b70]' : 'bg-[#818cf8]/15 text-[#a5b4fc]'}`}>{bloqueada ? <Lock className="w-4 h-4" /> : indice}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className={`flex-1 font-semibold leading-snug ${bloqueada ? 'text-[#8a8b9e]' : 'text-white'}`}>{e.nombre}</h3>
            {porHacer && e.preparado && <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/30"><CheckCircle2 className="w-3 h-3" />Preparado</span>}
            {e.nota ? (
              <span className={`shrink-0 text-lg font-bold ${e.nota.puntaje >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{fNota(e.nota.puntaje)}<span className="text-xs text-[#8a8b9e] font-medium">/20</span></span>
            ) : (
              <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${est.clase}`}><est.Icono className="w-3 h-3" />{est.texto}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#9a9bb0]">
            {e.fecha && <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fFecha(e.fecha, { weekday: 'short', day: 'numeric', month: 'short' })} · {fFecha(e.fecha, { hour: 'numeric', minute: '2-digit' })}</span>}
            {e.peso != null && <span className="inline-flex items-center gap-1"><Target className="w-3.5 h-3.5" />{e.peso}%</span>}
            {e.tipoActividad && <span>{e.tipoActividad}</span>}
            {e.duracion ? <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{e.duracion} min</span> : null}
            {(e.personasPorGrupo ?? 0) > 1 && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />Grupos de {e.personasPorGrupo}</span>}
          </div>
          {bloqueada && e.abreEl && <p className="mt-2 text-xs text-[#7a7b90]">🔒 Se abre el {fFecha(e.abreEl, { weekday: 'long', day: 'numeric', month: 'long' })}. Ahí verás de qué se trata, los recursos y la rúbrica.</p>}
          {s === 'proxima' && e.fecha && !abierta && <p className="mt-2 text-xs text-[#a5b4fc]">Es {cuandoFalta(e.fecha, ahora)}. Toca para ver cómo prepararte.</p>}
        </div>
        {tieneContenido && <ChevronDown className={`w-5 h-5 shrink-0 mt-1.5 text-[#6a6b7e] transition-transform ${abierta ? 'rotate-180' : ''}`} />}
      </button>

      <AnimatePresence initial={false}>
        {abierta && tieneContenido && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-5 sm:pl-[60px] space-y-5">
              {e.nota && <BloqueNota e={e} />}
              {e.descripcion && (
                <div>
                  <Subtitulo Icono={BookOpen}>De qué se trata</Subtitulo>
                  <p className="text-sm text-[#c0c0d0] whitespace-pre-wrap leading-relaxed">{e.descripcion}</p>
                </div>
              )}
              {e.recursos.length > 0 && (
                <div>
                  <Subtitulo Icono={Sparkles}>Recursos para estudiar</Subtitulo>
                  <div className="space-y-2.5">
                    {e.recursos.map((r, k) => {
                      const yt = idYouTube(r.url);
                      return yt ? (
                        <div key={k} className="rounded-xl overflow-hidden border border-[#2a2b3d] bg-black">
                          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                            <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={r.titulo || 'Video'} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                          </div>
                          {r.titulo && <p className="px-3 py-2 text-xs text-[#c0c0d0] bg-[#1c1d2a] flex items-center gap-1.5"><PlayCircle className="w-3.5 h-3.5 text-red-400" />{r.titulo}</p>}
                        </div>
                      ) : (
                        <a key={k} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[#2a2b3d] bg-[#20213a] px-3 py-2.5 hover:border-[#818cf8]/50 transition-colors">
                          <span className="w-8 h-8 rounded-lg bg-[#818cf8]/15 flex items-center justify-center shrink-0"><ExternalLink className="w-4 h-4 text-[#a5b4fc]" /></span>
                          <span className="min-w-0 flex-1"><span className="block text-sm text-white truncate">{r.titulo || dominio(r.url)}</span><span className="block text-[11px] text-[#7a7b90] truncate">{dominio(r.url)}</span></span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {e.rubrica && !e.nota && (
                <div>
                  <Subtitulo Icono={ClipboardCheck}>Así te van a evaluar</Subtitulo>
                  <Rubrica rubrica={e.rubrica} />
                </div>
              )}
              {porHacer && <BloquePreparado e={e} token={token} materiaNombre={materiaNombre} onPreparado={onPreparado} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// "Ya me preparé" + agregar esta evaluación a Google Calendar
function BloquePreparado({ e, token, materiaNombre, onPreparado }: { e: Evaluacion; token: string; materiaNombre: string; onPreparado: (id: string, v: boolean) => void }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const alternar = async () => {
    const valor = !e.preparado;
    setGuardando(true); setError(''); onPreparado(e.id, valor); // se ve el cambio al instante
    try {
      const r = await fetch(`/api/portal/${encodeURIComponent(token)}/preparado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId: e.id, preparado: valor }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar.');
    } catch (err: any) { onPreparado(e.id, !valor); setError(err instanceof TypeError ? 'Sin conexión. Intenta de nuevo.' : err.message); } finally { setGuardando(false); }
  };
  const google = e.fecha ? (() => {
    const ini = new Date(e.fecha); const fin = new Date(ini.getTime() + Math.max(15, e.duracion || 60) * 60000);
    const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const p = new URLSearchParams({ action: 'TEMPLATE', text: `${e.nombre} · ${materiaNombre}`, dates: `${f(ini)}/${f(fin)}`, details: [e.tipoActividad, e.peso != null ? `Vale ${e.peso}%` : '', typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''].filter(Boolean).join('\n') });
    return `https://calendar.google.com/calendar/render?${p}`;
  })() : null;
  return (
    <div className="flex flex-col sm:flex-row gap-2 pt-1">
      <button type="button" onClick={alternar} disabled={guardando}
        className={`flex-1 h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 ${e.preparado ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'bg-[#232438] border-[#313248] text-[#d0d0da] hover:border-emerald-500/40'}`}>
        {e.preparado ? <><CheckCircle2 className="w-4 h-4" />¡Ya me preparé!</> : <><Flag className="w-4 h-4" />Marcar «Ya me preparé»</>}
      </button>
      {google && (
        <a href={google} target="_blank" rel="noopener noreferrer" className="h-11 px-4 rounded-xl border border-[#313248] bg-[#191a26] text-sm text-[#c0c0d0] flex items-center justify-center gap-2 hover:border-[#818cf8]/50">
          <CalendarPlus className="w-4 h-4" />Google Calendar
        </a>
      )}
      {error && <p className="text-xs text-red-300 sm:self-center">{error}</p>}
    </div>
  );
}

// Tarjeta "Para aprobar": lo que necesita en lo que falta para llegar a 10
function TarjetaMeta({ meta }: { meta: Meta }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / 20) * 100))}%`;
  const color = meta.tipo === 'aprobado' || (meta.tipo === 'cerrado' && (meta.final ?? 0) >= 10) ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
    : meta.tipo === 'no-alcanza' || (meta.tipo === 'cerrado' && (meta.final ?? 0) < 10) ? 'border-red-500/30 bg-red-500/[0.06]'
    : meta.tipo === 'necesita' && (meta.necesita ?? 0) > 15 ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-[#2a2b3d] bg-[#1c1d2a]';
  let titulo = '', detalle = '';
  if (meta.tipo === 'sin-notas') { titulo = 'Necesitas 10 de promedio'; detalle = 'Todavía no tienes notas. Cada evaluación suma según su peso.'; }
  else if (meta.tipo === 'necesita') { titulo = `Necesitas ${fNota(meta.necesita!)} de promedio`; detalle = `en ${meta.faltan === 1 ? 'la evaluación que falta' : `las ${meta.faltan} evaluaciones que faltan`} (${meta.pesoFalta}% de la nota) para aprobar con 10.`; }
  else if (meta.tipo === 'aprobado') { titulo = '¡Ya tienes los puntos para aprobar! 🎉'; detalle = 'Aunque falten evaluaciones, ya llegaste al 10. Sigue así para subir tu nota.'; }
  else if (meta.tipo === 'no-alcanza') { titulo = 'Con lo que falta no llegas al 10'; detalle = `Aunque saques 20 en todo lo que falta, llegarías a ${fNota(Math.round(meta.maximo * 10) / 10)}. Habla con tu profesor sobre recuperación o actividades extra.`; }
  else { titulo = (meta.final ?? 0) >= 10 ? `Aprobaste con ${fNota(Math.round((meta.final ?? 0) * 100) / 100)} 🎉` : `Terminaste con ${fNota(Math.round((meta.final ?? 0) * 100) / 100)}`; detalle = (meta.final ?? 0) >= 10 ? '¡Felicitaciones! Ya tienes todas tus notas.' : 'Ya tienes todas tus notas. Consulta con tu profesor si hay recuperación.'; }
  return (
    <div className={`sm:col-span-3 lg:col-span-2 rounded-2xl border p-4 ${color}`}>
      <p className="text-[11px] uppercase tracking-wider text-[#8a8b9e] font-semibold">Para aprobar</p>
      <p className="mt-1.5 text-white font-semibold leading-snug">{titulo}</p>
      <p className="mt-1 text-xs text-[#a8a9bc] leading-relaxed">{detalle}</p>
      {meta.tipo !== 'sin-notas' && meta.tipo !== 'cerrado' && (
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-[#272839] overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[#818cf8]/25" style={{ width: pct(meta.maximo) }} title="Lo máximo que puedes alcanzar" />
            <div className="absolute inset-y-0 left-0 bg-[#818cf8]" style={{ width: pct(meta.acumulado) }} />
            <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: '50%' }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#7a7b90]"><span>Llevas {fNota(Math.round(meta.acumulado * 10) / 10)} pts</span><span>10 para aprobar</span><span>Máx. {fNota(Math.round(meta.maximo * 10) / 10)}</span></div>
        </div>
      )}
    </div>
  );
}

function Subtitulo({ Icono, children }: { Icono: any; children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-[#8a8b9e] mb-2 flex items-center gap-1.5"><Icono className="w-3.5 h-3.5 text-[#818cf8]" />{children}</p>;
}

function Rubrica({ rubrica, detalle }: { rubrica: RubricaEval; detalle?: (number | null)[] | null }) {
  return (
    <div className="space-y-2">
      {rubrica.criterios.map((c, i) => {
        const elegido = detalle && Number.isInteger(detalle[i]) ? (detalle[i] as number) : null;
        return (
          <details key={i} className="group rounded-xl border border-[#2a2b3d] bg-[#191a26]">
            <summary className="list-none cursor-pointer px-3 py-2.5 flex items-center gap-2">
              <span className="flex-1 text-sm text-[#d8d8e4] font-medium">{c.nombre}</span>
              {elegido != null
                ? <span className={`text-xs font-semibold ${COLOR_NIVEL[elegido]}`}>{NIVELES_RUBRICA[elegido]} · {textoPuntos(puntosNivel(c.puntos, elegido))}/{textoPuntos(c.puntos)}</span>
                : <span className="text-xs text-[#8a8b9e]">{textoPuntos(c.puntos)} pts</span>}
              <ChevronDown className="w-4 h-4 text-[#6a6b7e] group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {NIVELES_RUBRICA.map((n, k) => (
                <div key={n} className={`rounded-lg border px-2.5 py-2 ${elegido === k ? FONDO_NIVEL[k] : 'border-[#2a2b3d]'}`}>
                  <p className={`text-[11px] font-semibold ${COLOR_NIVEL[k]}`}>{n} · {textoPuntos(puntosNivel(c.puntos, k))} pts{elegido === k ? ' ← tú' : ''}</p>
                  <p className="text-xs text-[#a8a9bc] mt-0.5 leading-relaxed">{c.descripciones[k] || '—'}</p>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function BloqueNota({ e }: { e: Evaluacion }) {
  const n = e.nota!;
  const aprobado = n.puntaje >= 10;
  return (
    <div className={`rounded-2xl border p-4 ${aprobado ? 'border-emerald-500/30 bg-emerald-500/[0.07]' : 'border-red-500/30 bg-red-500/[0.07]'}`}>
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold ${aprobado ? 'text-emerald-300' : 'text-red-300'}`}>{fNota(n.puntaje)}<span className="text-base text-[#8a8b9e] font-medium">/20</span></div>
        <div>
          <p className={`text-sm font-semibold ${aprobado ? 'text-emerald-200' : 'text-red-200'}`}>{aprobado ? '¡Aprobada! 🎉' : 'No aprobada'}</p>
          {e.peso != null && <p className="text-xs text-[#9a9bb0]">Vale {e.peso}% de la nota final</p>}
        </div>
      </div>
      {n.observaciones && <p className="mt-3 text-sm text-[#d0d0da] flex gap-2"><MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-[#a5b4fc]" />{n.observaciones}</p>}
      {e.rubrica && n.detalle && n.detalle.some(x => x != null) && (
        <div className="mt-4"><Subtitulo Icono={ClipboardCheck}>Detalle de tu nota</Subtitulo><Rubrica rubrica={e.rubrica} detalle={n.detalle} /></div>
      )}
    </div>
  );
}
