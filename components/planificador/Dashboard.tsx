'use client';

import { Activity, AlertCircle, Award, BarChart3, BookOpen, Brain, Calendar, CheckCircle, ChevronDown, ChevronUp, Clock, FileText, GraduationCap, Info, MessageSquare, Pencil, PieChart, RefreshCw, Search, ShieldCheck, Trash2, User, Users as UsersIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { calcularAlertas } from '@/lib/alertas';
import { useEffect, useState } from 'react';
import { PlanificacionExamen, SeccionExamen, UsuarioSesion } from '@/components/planificador/tipos';
import { ESTILO_ROL, limpiarTexto, opcionesSeccion } from '@/components/planificador/utilidades';

// ============================================
// DASHBOARD
// ============================================
export function Dashboard({ planificacion }: { planificacion: PlanificacionExamen }) {
  const totalEvaluaciones = planificacion.secciones.length;
  const pesoTotal = planificacion.secciones.reduce((acc, sec) => acc + (sec.peso || 0), 0);
  const promedioPeso = totalEvaluaciones > 0 ? (pesoTotal / totalEvaluaciones).toFixed(1) : 0;
  const evaluacionesConDescripcion = planificacion.secciones.filter(s => s.descripcion).length;
  const porcentajeCompletado = totalEvaluaciones > 0 ? Math.round((evaluacionesConDescripcion / totalEvaluaciones) * 100) : 0;
  const evaluacion1 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 1') || s.nombre?.toLowerCase().includes('evaluacion 1'));
  const evaluacion2 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 2') || s.nombre?.toLowerCase().includes('evaluacion 2'));
  const evaluacion3 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 3') || s.nombre?.toLowerCase().includes('evaluacion 3'));
  const evaluacion4 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 4') || s.nombre?.toLowerCase().includes('evaluacion 4'));
  // Distribución real por estrategia (taller, laboratorio, proyecto…), de mayor a menor
  const COLORES_TIPO = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-cyan-500'];
  const porTipo = Object.entries(planificacion.secciones.reduce((acc: Record<string, SeccionExamen[]>, s) => { const t = String(s.tipoActividad || 'Sin estrategia').trim(); (acc[t] ||= []).push(s); return acc; }, {}))
    .sort((x, y) => y[1].length - x[1].length).slice(0, 6).map(([l, d], i) => ({ l, d, c: COLORES_TIPO[i % COLORES_TIPO.length] }));
  const nivelesBloom = ['recordar', 'comprender', 'aplicar', 'analizar', 'evaluar', 'crear'];
  const distribucionBloom = nivelesBloom.map(nivel => ({ nivel, count: planificacion.secciones.filter(s => s.nivelBloom === nivel).length }));
  const bloomDominante = [...distribucionBloom].sort((a, b) => b.count - a.count)[0];
  const tiempoTotal = planificacion.secciones.reduce((acc, sec) => acc + (sec.tiempoEstimadoMinutos || 0), 0);
  const statsCards = [
    { titulo: 'Total Evaluaciones', valor: totalEvaluaciones, icono: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', borde: 'border-blue-500/20' },
    { titulo: 'Peso Promedio', valor: `${promedioPeso}%`, icono: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
    { titulo: 'Tiempo Total', valor: `${tiempoTotal} min`, icono: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', borde: 'border-amber-500/20' },
    { titulo: 'Completado', valor: `${porcentajeCompletado}%`, icono: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', borde: 'border-purple-500/20' }
  ];

  return (
    <div className="@container space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 data-tutorial="dash-titulo" className="text-2xl font-bold text-[color:var(--c-d0d0da)] flex items-center gap-3"><BarChart3 className="w-6 h-6 text-[color:var(--c-818cf8)]" />Dashboard</h2><p className="text-sm text-[color:var(--c-8a8b9e)] mt-1">Resumen para {planificacion.materia || 'la asignatura'}</p></div><div className="flex items-center gap-2 text-xs text-[color:var(--c-8a8b9e)]"><Calendar className="w-4 h-4" /><span>{new Date().toLocaleDateString()}</span></div></div>
      <div className="grid grid-cols-2 @3xl:grid-cols-4 gap-3 @lg:gap-4">{statsCards.map((stat, index) => (<motion.div key={stat.titulo} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, duration: 0.3 }} className={`bg-[color:var(--c-1f2035)] border ${stat.borde} rounded-xl p-4 shadow-lg`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-[color:var(--c-8a8b9e)] font-medium leading-tight">{stat.titulo}</p><p className="text-xl @lg:text-2xl font-bold text-[color:var(--c-d0d0da)] mt-1 whitespace-nowrap">{stat.valor}</p></div><div className={`${stat.bg} p-2.5 rounded-xl flex-shrink-0`}><stat.icono className={`w-5 h-5 ${stat.color}`} /></div></div></motion.div>))}</div>
      <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.3 }} className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-5"><h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2 mb-4"><PieChart className="w-4 h-4 text-[color:var(--c-818cf8)]" />Distribución por Tipo</h3><div className="space-y-3">{porTipo.map(e=>(<div key={e.l}><div className="flex justify-between text-xs text-[color:var(--c-b0b0c4)] mb-1"><span>{e.l}</span><span>{e.d.length} eval.</span></div><div className="w-full h-2 bg-[color:var(--c-313248)] rounded-full overflow-hidden"><div className={`h-full ${e.c} rounded-full transition-all duration-500`} style={{ width: totalEvaluaciones > 0 ? `${(e.d.length / totalEvaluaciones) * 100}%` : '0%' }} /></div></div>))}</div></motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.3 }} className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-5"><h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-[color:var(--c-818cf8)]" />Niveles Bloom</h3><div className="space-y-1.5">{distribucionBloom.map((item, idx) => (<div key={item.nivel}><div className="flex justify-between text-xs text-[color:var(--c-b0b0c4)] mb-0.5"><span className="capitalize">{item.nivel}</span><span>{item.count}</span></div><div className="w-full h-1.5 bg-[color:var(--c-313248)] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${['bg-red-500','bg-orange-500','bg-yellow-500','bg-green-500','bg-blue-500','bg-purple-500'][idx]}`} style={{ width: totalEvaluaciones > 0 ? `${(item.count / totalEvaluaciones) * 100}%` : '0%' }} /></div></div>))}</div></motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.3 }} className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-5"><h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-[color:var(--c-818cf8)]" />Detalle</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-[color:var(--c-8a8b9e)] border-b border-[color:var(--c-313248)]"><th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Evaluación</th><th className="pb-2 font-medium">Peso</th><th className="pb-2 font-medium">Tiempo</th><th className="pb-2 font-medium">Bloom</th><th className="pb-2 font-medium">Estado</th></tr></thead><tbody className="divide-y divide-[color:var(--c-313248)]">{planificacion.secciones.map((sec, idx) => (<tr key={sec.id} className="hover:bg-[color:var(--c-272839)]/50 transition-colors"><td className="py-2 text-[color:var(--c-8a8b9e)] text-xs">{idx + 1}</td><td className="py-2 text-[color:var(--c-d0d0da)] font-medium">{limpiarTexto(sec.nombre)}</td><td className="py-2 text-[color:var(--c-b0b0c4)]">{sec.peso || 0}%</td><td className="py-2 text-[color:var(--c-b0b0c4)]">{sec.tiempoEstimadoMinutos || '?'} min</td><td className="py-2"><span className="capitalize text-xs text-[color:var(--c-b0b0c4)]">{sec.nivelBloom || '-'}</span></td><td className="py-2">{sec.descripcion ? <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span> : <span className="text-amber-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />Sin desc</span>}</td></tr>))}{planificacion.secciones.length === 0 && (<tr><td colSpan={6} className="py-4 text-center text-[color:var(--c-8a8b9e)]">No hay evaluaciones</td></tr>)}</tbody></table></div></motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.3 }} className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-4 flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-lg"><BookOpen className="w-5 h-5 text-blue-400" /></div><div><p className="text-xs text-[color:var(--c-8a8b9e)]">Asignatura</p><p className="text-sm font-semibold text-[color:var(--c-d0d0da)]">{planificacion.materia || 'Sin asignar'}</p></div></div>
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-4 flex items-center gap-3"><div className="bg-emerald-500/10 p-2 rounded-lg"><Brain className="w-5 h-5 text-emerald-400" /></div><div><p className="text-xs text-[color:var(--c-8a8b9e)]">Bloom Dominante</p><p className="text-sm font-semibold text-[color:var(--c-d0d0da)] capitalize">{bloomDominante && bloomDominante.count > 0 ? bloomDominante.nivel : 'Sin datos'}</p></div></div>
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-4 flex items-center gap-3"><div className="bg-purple-500/10 p-2 rounded-lg"><Award className="w-5 h-5 text-purple-400" /></div><div><p className="text-xs text-[color:var(--c-8a8b9e)]">Estado</p><p className="text-sm font-semibold text-[color:var(--c-d0d0da)] capitalize">{totalEvaluaciones > 0 ? 'En progreso' : 'Sin eval.'}</p></div></div>
      </motion.div>
    </div>
  );
}

export function DashboardPorRol({ planificacion, usuario, onMiTrabajo }: { planificacion: PlanificacionExamen; usuario?: UsuarioSesion | null; onMiTrabajo?: () => void }) {
  const [modo, setModo] = useState<'mio' | 'equipo'>(usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN' ? 'equipo' : 'mio');
  const esSuper = usuario?.rol === 'SUPERADMIN';
  const esAdminPlus = esSuper || usuario?.rol === 'ADMIN';
  if (!esAdminPlus) return <Dashboard planificacion={planificacion} />;

  const opciones = [
    { id: 'mio' as const, label: 'Mi trabajo', icon: BarChart3 },
    { id: 'equipo' as const, label: esSuper ? 'Todo el sistema' : 'Todos los profesores', icon: UsersIcon },
  ];
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 p-1 bg-[color:var(--c-161722)] border border-[color:var(--c-282a3f)] rounded-xl">
        {opciones.map(o => (
          <button key={o.id} onClick={() => { setModo(o.id); if (o.id === 'mio' && esSuper) onMiTrabajo?.(); }} className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modo === o.id ? 'text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)]'}`}>
            {modo === o.id && <motion.div layoutId="pill-dashboard-modo" className="absolute inset-0 bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 rounded-lg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <o.icon className="relative z-10 w-4 h-4" /><span className="relative z-10">{o.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={modo} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {modo === 'mio' ? <Dashboard planificacion={planificacion} /> : <DashboardEquipo esSuper={esSuper} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function DashboardEquipo({ esSuper }: { esSuper: boolean }) {
  interface EvalResumen { id: string; grupoSeccion: string; descripcion: string | null; enfoque: string | null; nivelBloom: string | null; tiempoEstimadoMinutos: number | null; cantidadGrupos: number | null; personasPorGrupo: number | null; nombre: string; peso: number | null; tipoActividad: string | null; fecha: string | null }
  interface ObsResumen { id: string; autorNombre: string; evaluacionNombre: string | null; mensaje: string; leida: boolean; createdAt: string }
  interface MateriaResumen { id: string; nombre: string; fechaExamen: string | null; evaluaciones: EvalResumen[]; observaciones: ObsResumen[] }
  interface FilaResumen { id: string; nombre: string; email: string; rol: string; activo: boolean; pendiente: boolean; materias: MateriaResumen[]; totalMaterias: number; totalEvaluaciones: number; totalEstudiantes: number; ultimaActividad: string | null }
  interface Resumen {
    totales: { cuentas: { SUPERADMIN: number; ADMIN: number; USUARIO: number; desactivadas: number; pendientes: number }; materias: number; evaluaciones: number; estudiantes: number };
    usuarios: FilaResumen[];
    sinDueno: { materias: number; evaluaciones: number; estudiantes: number };
  }
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [confirmandoEval, setConfirmandoEval] = useState<string | null>(null);

  // ----- Supervisión: contenido completo de las evaluaciones, edición (solo superadmin) y estudiantes de cada profesor -----
  interface EstudianteSup { id: string; nombre: string; email: string; telefono: string | null; grupo: string; estado: string }
  const [evalAbierta, setEvalAbierta] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ id: string; campos: Record<string, string>; error: string; guardando: boolean } | null>(null);
  const [estudiantesDe, setEstudiantesDe] = useState<Record<string, EstudianteSup[] | 'cargando' | 'error'>>({});
  const [confirmandoEst, setConfirmandoEst] = useState<string | null>(null);
  const [edicionEst, setEdicionEst] = useState<{ id: string; duenoId: string; campos: Record<string, string>; error: string; guardando: boolean } | null>(null);
  const [mostrarAlertas, setMostrarAlertas] = useState(!esSuper); // el superadmin la ve cerrada al entrar; el admin, abierta como antes
  const ETIQUETA_ALERTA: Record<string, string> = { sinMaterias: 'SIN MATERIAS', peso: 'PESOS', choque: 'FECHAS', proxima: 'PRÓXIMA', observacion: 'OBSERVACIÓN' };

  const aFechaInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const cambiarCampo = (k: string, v: string) => setEdicion(prev => (prev ? { ...prev, campos: { ...prev.campos, [k]: v } } : prev));
  const iniciarEdicion = (ev: EvalResumen) => setEdicion({
    id: ev.id, error: '', guardando: false,
    campos: {
      nombre: ev.nombre, peso: ev.peso != null ? String(ev.peso) : '', fecha: aFechaInput(ev.fecha), tipoActividad: ev.tipoActividad || '', enfoque: ev.enfoque || '',
      tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos != null ? String(ev.tiempoEstimadoMinutos) : '', cantidadGrupos: ev.cantidadGrupos != null ? String(ev.cantidadGrupos) : '',
      personasPorGrupo: ev.personasPorGrupo != null ? String(ev.personasPorGrupo) : '', grupoSeccion: ev.grupoSeccion || 'A', descripcion: ev.descripcion || '',
    },
  });
  const guardarEdicion = async () => {
    if (!edicion) return;
    const c = edicion.campos;
    const numero = (v: string) => (v === '' ? null : Number(v));
    setEdicion({ ...edicion, guardando: true, error: '' });
    try {
      const r = await fetch(`/api/evaluaciones/${edicion.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: c.nombre, peso: numero(c.peso), fecha: c.fecha === '' ? null : new Date(c.fecha + 'T00:00:00').toISOString(), tipoActividad: c.tipoActividad, enfoque: c.enfoque,
          tiempoEstimadoMinutos: numero(c.tiempoEstimadoMinutos), cantidadGrupos: numero(c.cantidadGrupos), personasPorGrupo: numero(c.personasPorGrupo), grupoSeccion: c.grupoSeccion, descripcion: c.descripcion,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setEdicion({ ...edicion, guardando: false, error: d.error || 'No se pudo guardar.' }); return; }
      setEdicion(null);
      await cargar();
    } catch { setEdicion({ ...edicion, guardando: false, error: 'No se pudo conectar con el servidor.' }); }
  };

  const cargarEstudiantes = async (duenoId: string) => {
    setEstudiantesDe(prev => ({ ...prev, [duenoId]: 'cargando' }));
    try {
      const r = await fetch(`/api/estudiantes?todos=1&duenoId=${duenoId}`);
      if (!r.ok) throw new Error('error');
      const lista = await r.json();
      setEstudiantesDe(prev => ({ ...prev, [duenoId]: lista }));
    } catch { setEstudiantesDe(prev => ({ ...prev, [duenoId]: 'error' })); }
  };
  const eliminarEstudiante = async (est: EstudianteSup, duenoId: string) => {
    if (confirmandoEst !== est.id) { setConfirmandoEst(est.id); setTimeout(() => setConfirmandoEst(prev => (prev === est.id ? null : prev)), 3000); return; }
    setConfirmandoEst(null);
    const r = await fetch(`/api/estudiantes?id=${est.id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'No se pudo eliminar al estudiante.'); return; }
    await cargarEstudiantes(duenoId);
    await cargar();
  };
  const guardarEstudiante = async () => {
    if (!edicionEst) return;
    const c = edicionEst.campos;
    setEdicionEst({ ...edicionEst, guardando: true, error: '' });
    try {
      const r = await fetch('/api/estudiantes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: edicionEst.id, nombre: c.nombre, email: c.email, telefono: c.telefono, grupo: c.grupo }) });
      const d = await r.json();
      if (!r.ok) { setEdicionEst({ ...edicionEst, guardando: false, error: d.error || 'No se pudo guardar.' }); return; }
      const dueno = edicionEst.duenoId;
      setEdicionEst(null);
      await cargarEstudiantes(dueno);
    } catch { setEdicionEst({ ...edicionEst, guardando: false, error: 'No se pudo conectar con el servidor.' }); }
  };
  const alertas = datos ? calcularAlertas(datos.usuarios as any) : [];
  // Observaciones: el admin escribe una nota sobre una evaluación (o sobre la materia) y el profesor la recibe
  const [composer, setComposer] = useState<{ materiaId: string; evaluacionNombre: string | null } | null>(null);
  const [textoObs, setTextoObs] = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);
  const [errorObs, setErrorObs] = useState('');
  const abrirComposer = (materiaId: string, evaluacionNombre: string | null) => { setComposer({ materiaId, evaluacionNombre }); setTextoObs(''); setErrorObs(''); };
  const enviarObservacion = async () => {
    if (!composer) return;
    if (textoObs.trim().length < 3) { setErrorObs('Escribe al menos 3 caracteres.'); return; }
    setEnviandoObs(true); setErrorObs('');
    try {
      const r = await fetch('/api/observaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId: composer.materiaId, evaluacionNombre: composer.evaluacionNombre, mensaje: textoObs }) });
      const d = await r.json();
      if (!r.ok) { setErrorObs(d.error || 'No se pudo enviar la observación.'); return; }
      setComposer(null); setTextoObs('');
      await cargar();
    } catch { setErrorObs('No se pudo conectar con el servidor.'); }
    finally { setEnviandoObs(false); }
  };
  const esComposer = (materiaId: string, nombre: string | null) => composer?.materiaId === materiaId && composer.evaluacionNombre === nombre;
  const formularioObservacion = (
    <div className="mt-1.5 mb-2 bg-[color:var(--c-191a26)] border border-yellow-500/30 rounded-lg p-3 space-y-2">
      <textarea value={textoObs} onChange={(e) => setTextoObs(e.target.value)} maxLength={500} rows={3} placeholder="Escribe tu observación para el profesor..." className="w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-3 py-2 text-xs text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-yellow-500/50" />
      {errorObs && <p className="text-red-400 text-[11px]">{errorObs}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{textoObs.length}/500</span>
        <div className="flex gap-2">
          <button onClick={() => setComposer(null)} className="px-3 py-1.5 text-xs text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg">Cancelar</button>
          <button onClick={enviarObservacion} disabled={enviandoObs} className="px-3 py-1.5 text-xs font-semibold text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 disabled:opacity-60">{enviandoObs ? 'Enviando...' : 'Enviar observación'}</button>
        </div>
      </div>
    </div>
  );

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/resumen');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar el resumen.');
      setDatos(d);
    } catch (e: any) { setError(e.message || 'No se pudo cargar el resumen.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString() : '—');

  // Moderación: elimina una evaluación (confirmación en dos pasos). Queda registrada en la Actividad.
  const eliminarEvaluacion = async (idEval: string) => {
    if (confirmandoEval !== idEval) { setConfirmandoEval(idEval); setTimeout(() => setConfirmandoEval(prev => (prev === idEval ? null : prev)), 3000); return; }
    setConfirmandoEval(null);
    const r = await fetch(`/api/evaluaciones/${idEval}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || 'No se pudo eliminar la evaluación.'); return; }
    await cargar();
  };
  const filas = (datos?.usuarios || []).filter(u => {
    const q = busqueda.trim().toLowerCase();
    return !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const tarjetas = datos ? [
    { titulo: 'Profesores', valor: datos.totales.cuentas.USUARIO, icono: UsersIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
    { titulo: 'Materias', valor: datos.totales.materias, icono: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', borde: 'border-blue-500/20' },
    { titulo: 'Evaluaciones', valor: datos.totales.evaluaciones, icono: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', borde: 'border-amber-500/20' },
    { titulo: 'Estudiantes', valor: datos.totales.estudiantes, icono: GraduationCap, color: 'text-purple-400', bg: 'bg-purple-500/10', borde: 'border-purple-500/20' },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--c-d0d0da)] flex items-center gap-3"><UsersIcon className="w-6 h-6 text-[color:var(--c-818cf8)]" />{esSuper ? 'Todo el sistema' : 'Todos los profesores'}</h2>
          <p className="text-sm text-[color:var(--c-8a8b9e)] mt-1">{esSuper ? 'Control total: revisa, edita y elimina el trabajo y los estudiantes de cualquier profesor.' : 'Revisa el trabajo y los estudiantes de cada profesor. Puedes eliminarlos como moderación; editarlos es del superadmin.'}</p>
        </div>
        <button onClick={cargar} disabled={cargando} className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl hover:border-[color:var(--c-818cf8)]/40 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />Actualizar
        </button>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {cargando && !datos && <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando...</div>}

      <AnimatePresence>
        {edicionEst && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setEdicionEst(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-2xl space-y-3">
              <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Editar estudiante</h3>
              {([['nombre', 'Nombre completo'], ['email', 'Correo'], ['telefono', 'Teléfono']] as const).map(([k, et]) => (
                <input key={k} value={edicionEst.campos[k]} onChange={(e) => setEdicionEst({ ...edicionEst, campos: { ...edicionEst.campos, [k]: e.target.value } })} placeholder={et} className="w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2.5 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
              ))}
              <select value={edicionEst.campos.grupo} onChange={(e) => setEdicionEst({ ...edicionEst, campos: { ...edicionEst.campos, grupo: e.target.value } })} className="w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2.5 text-sm text-[color:var(--c-e0e0ec)]">
                {opcionesSeccion(edicionEst.campos.grupo).map(g => <option key={g} value={g}>Grupo {g}</option>)}
              </select>
              {edicionEst.error && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{edicionEst.error}</span></p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEdicionEst(null)} className="flex-1 py-2.5 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl">Cancelar</button>
                <button onClick={guardarEstudiante} disabled={edicionEst.guardando} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[color:var(--c-818cf8)] rounded-xl disabled:opacity-60">{edicionEst.guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {datos && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tarjetas.map((t, i) => (
              <motion.div key={t.titulo} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }} className={`bg-[color:var(--c-1f2035)] border ${t.borde} rounded-xl p-4 shadow-lg`}>
                <div className="flex items-center justify-between"><div><p className="text-xs text-[color:var(--c-8a8b9e)]">{t.titulo}</p><p className="text-2xl font-bold text-[color:var(--c-d0d0da)] mt-1">{t.valor}</p></div><div className={`${t.bg} p-2.5 rounded-lg`}><t.icono className={`w-5 h-5 ${t.color}`} /></div></div>
              </motion.div>
            ))}
          </div>

          {esSuper && (
            <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2 mb-4"><ShieldCheck className="w-4 h-4 text-[color:var(--c-818cf8)]" />Cuentas del sistema</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {([['SUPERADMIN', datos.totales.cuentas.SUPERADMIN], ['ADMIN', datos.totales.cuentas.ADMIN], ['USUARIO', datos.totales.cuentas.USUARIO]] as [string, number][]).map(([rol, n]) => (
                  <div key={rol} className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg p-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[rol]}`}>{rol}</span><p className="text-xl font-bold text-[color:var(--c-d0d0da)] mt-2">{n}</p></div>
                ))}
                <div className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg p-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADAS</span><p className="text-xl font-bold text-[color:var(--c-d0d0da)] mt-2">{datos.totales.cuentas.desactivadas}</p></div>
                <div className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg p-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">PENDIENTES</span><p className="text-xl font-bold text-[color:var(--c-d0d0da)] mt-2">{datos.totales.cuentas.pendientes}</p></div>
              </div>
            </div>
          )}

          {alertas.length > 0 && (
            <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
              <button onClick={() => setMostrarAlertas(v => !v)} className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[color:var(--c-232438)] transition-colors">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span className="text-sm font-semibold text-[color:var(--c-d0d0da)]">Atención y próximas evaluaciones</span>
                <span className="text-xs text-[color:var(--c-8a8b9e)]">{alertas.filter(a => a.tipo !== 'proxima').length} por revisar · {alertas.filter(a => a.tipo === 'proxima').length} próximas (14 días)</span>
                <span className="ml-auto text-[color:var(--c-8a8b9e)]">{mostrarAlertas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
              </button>
              {mostrarAlertas && (
                <div className="border-t border-[color:var(--c-313248)] divide-y divide-[color:var(--c-313248)] max-h-72 overflow-y-auto">
                  {alertas.slice(0, 40).map((a, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                      <span className={`mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${a.gravedad === 'alta' ? 'bg-red-500/10 text-red-300 border-red-500/30' : a.gravedad === 'media' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'}`}>{ETIQUETA_ALERTA[a.tipo]}</span>
                      <span className="flex-1 text-[color:var(--c-c0c0cc)] break-words"><strong className="text-[color:var(--c-d0d0da)]">{a.usuario}</strong> · {limpiarTexto(a.texto)}</span>
                      {a.fecha && <span className="text-[color:var(--c-8a8b9e)] whitespace-nowrap">{new Date(a.fecha).toLocaleDateString()}</span>}
                    </div>
                  ))}
                  {alertas.length > 40 && <div className="px-4 py-2 text-[11px] text-[color:var(--c-6a6b7e)]">... y {alertas.length - 40} más.</div>}
                </div>
              )}
            </div>
          )}

          <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[color:var(--c-313248)] flex items-center gap-3">
              <Search className="w-4 h-4 text-[color:var(--c-6a6b7e)]" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo..." className="flex-1 bg-transparent text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
              <span className="text-xs text-[color:var(--c-8a8b9e)]">{filas.length} cuenta(s)</span>
            </div>
            {filas.length === 0 ? (
              <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">No hay cuentas que coincidan.</div>
            ) : (
              <div className="divide-y divide-[color:var(--c-313248)]">
                {filas.map(u => {
                  const expandido = abierto === u.id;
                  return (
                    <div key={u.id}>
                      <button onClick={() => setAbierto(expandido ? null : u.id)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-[color:var(--c-232438)] transition-colors">
                        <div className="w-9 h-9 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-[color:var(--c-818cf8)]" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{u.nombre}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[u.rol] || ''}`}>{u.rol}</span>
                            {u.pendiente && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">PENDIENTE</span>}
                            {!u.activo && !u.pendiente && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADA</span>}
                          </div>
                          <div className="text-xs text-[color:var(--c-8a8b9e)] truncate">{u.email}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-5 text-xs text-[color:var(--c-b0b0c4)]">
                          <span title="Materias"><BookOpen className="w-3.5 h-3.5 inline mr-1 text-blue-400" />{u.totalMaterias}</span>
                          <span title="Evaluaciones"><FileText className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{u.totalEvaluaciones}</span>
                          <span title="Estudiantes"><GraduationCap className="w-3.5 h-3.5 inline mr-1 text-purple-400" />{u.totalEstudiantes}</span>
                          <span className="text-[color:var(--c-8a8b9e)] w-24 text-right" title="Última actividad">{fecha(u.ultimaActividad)}</span>
                        </div>
                        {expandido ? <ChevronUp className="w-4 h-4 text-[color:var(--c-8a8b9e)] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[color:var(--c-8a8b9e)] flex-shrink-0" />}
                      </button>
                      <AnimatePresence initial={false}>
                        {expandido && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-[color:var(--c-191a26)]">
                            <div className="p-4 space-y-4">
                              <p className="sm:hidden text-xs text-[color:var(--c-8a8b9e)]">{u.totalMaterias} materia(s) · {u.totalEvaluaciones} evaluación(es) · {u.totalEstudiantes} estudiante(s)</p>
                              <div>
                                <button onClick={() => { const est = estudiantesDe[u.id]; if (!est || est === 'error') cargarEstudiantes(u.id); else setEstudiantesDe(prev => { const copia = { ...prev }; delete copia[u.id]; return copia; }); }} className="flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200"><GraduationCap className="w-4 h-4" />{estudiantesDe[u.id] && estudiantesDe[u.id] !== 'error' ? 'Ocultar estudiantes' : `Ver estudiantes (${u.totalEstudiantes})`}</button>
                                {estudiantesDe[u.id] === 'cargando' && <p className="text-xs text-[color:var(--c-8a8b9e)] mt-2">Cargando...</p>}
                                {estudiantesDe[u.id] === 'error' && <p className="text-xs text-red-400 mt-2">No se pudo cargar la lista.</p>}
                                {Array.isArray(estudiantesDe[u.id]) && (
                                  <div className="mt-2 space-y-1.5">
                                    {(estudiantesDe[u.id] as EstudianteSup[]).length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)]">No tiene estudiantes.</p> : (estudiantesDe[u.id] as EstudianteSup[]).map(est => (
                                      <div key={est.id} className="flex items-center gap-3 bg-[color:var(--c-1f2035)] border border-[color:var(--c-282a3f)] rounded-lg px-3 py-2 text-xs">
                                        <div className="flex-1 min-w-0 truncate"><span className="text-[color:var(--c-d0d0da)]">{est.nombre}</span><span className="text-[color:var(--c-8a8b9e)]"> · {est.email}{est.telefono ? ` · ${est.telefono}` : ''}</span></div>
                                        <span className="text-[color:var(--c-a5b4fc)] font-semibold whitespace-nowrap">Grupo {est.grupo}</span>
                                        {esSuper && <button onClick={() => setEdicionEst({ id: est.id, duenoId: u.id, error: '', guardando: false, campos: { nombre: est.nombre, email: est.email, telefono: est.telefono || '', grupo: est.grupo } })} title="Editar estudiante" className="p-1.5 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-272839)] rounded-md"><Pencil className="w-3.5 h-3.5" /></button>}
                                        <button onClick={() => eliminarEstudiante(est, u.id)} title="Eliminar estudiante (moderación)" className={`px-1.5 py-1 rounded-md transition-colors ${confirmandoEst === est.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[color:var(--c-6a6b7e)] hover:text-red-400 hover:bg-red-500/10'}`}>{confirmandoEst === est.id ? '¿Seguro?' : <Trash2 className="w-3.5 h-3.5" />}</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {u.materias.length === 0 ? (
                                <p className="text-xs text-[color:var(--c-8a8b9e)]">Aún no ha creado materias.</p>
                              ) : u.materias.map(m => (
                                <div key={m.id}>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <h4 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><BookOpen className="w-4 h-4 text-[color:var(--c-818cf8)]" />{m.nombre}</h4>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => abrirComposer(m.id, null)} className="flex items-center gap-1 text-[11px] text-yellow-300/80 hover:text-yellow-200" title="Dejar una observación sobre esta materia"><MessageSquare className="w-3.5 h-3.5" />Observación general</button>
                                      <span className="text-xs text-[color:var(--c-8a8b9e)]">Examen: {fecha(m.fechaExamen)}</span>
                                    </div>
                                  </div>
                                  {esComposer(m.id, null) && formularioObservacion}
                                  {m.evaluaciones.length === 0 ? (
                                    <p className="text-xs text-[color:var(--c-6a6b7e)] pl-6">Sin evaluaciones guardadas.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {m.evaluaciones.map((ev, i) => (
                                        <div key={i}>
                                        <div className="flex items-center gap-3 bg-[color:var(--c-1f2035)] border border-[color:var(--c-282a3f)] rounded-lg px-3 py-2 text-xs">
                                          <button onClick={() => setEvalAbierta(evalAbierta === ev.id ? null : ev.id)} className="flex-1 min-w-0 truncate text-left text-[color:var(--c-d0d0da)] hover:text-[color:var(--c-blanco)]" title="Ver el contenido completo"><span className="text-[color:var(--c-a5b4fc)] mr-1.5">[{ev.grupoSeccion || 'A'}]</span>{limpiarTexto(ev.nombre)}</button>
                                          {ev.tipoActividad && <span className="hidden sm:inline text-[color:var(--c-8a8b9e)] truncate max-w-[140px]">🎯 {ev.tipoActividad}</span>}
                                          <span className="text-[color:var(--c-8a8b9e)]">📅 {fecha(ev.fecha)}</span>
                                          <span className="font-semibold text-[color:var(--c-a5b4fc)] w-10 text-right">{ev.peso != null ? `${ev.peso}%` : '—'}</span>
                                          <button onClick={() => abrirComposer(m.id, ev.nombre)} title="Dejar una observación sobre esta evaluación" className="px-1.5 py-1 rounded-md text-[color:var(--c-6a6b7e)] hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors"><MessageSquare className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => eliminarEvaluacion(ev.id)} title="Eliminar evaluación (moderación)" className={`px-1.5 py-1 rounded-md transition-colors ${confirmandoEval === ev.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[color:var(--c-6a6b7e)] hover:text-red-400 hover:bg-red-500/10'}`}>{confirmandoEval === ev.id ? '¿Seguro?' : <Trash2 className="w-3.5 h-3.5" />}</button>
                                        </div>
                                        {esComposer(m.id, ev.nombre) && formularioObservacion}
                                        {evalAbierta === ev.id && (
                                          <div className="mt-1.5 mb-2 bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-lg p-3 text-xs space-y-3">
                                            {edicion?.id === ev.id ? (
                                              <>
                                                <p className="text-[11px] text-amber-300">Al guardar, el profesor recibirá una observación automática con lo que cambiaste.</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                  {([['nombre', 'Nombre', 'text', 'col-span-2'], ['peso', 'Peso (%)', 'number', ''], ['fecha', 'Fecha', 'date', ''], ['tipoActividad', 'Tipo de actividad', 'text', ''], ['enfoque', 'Enfoque', 'text', ''], ['tiempoEstimadoMinutos', 'Duración (min)', 'number', ''], ['grupoSeccion', 'Sección', 'text', ''], ['cantidadGrupos', 'Grupos', 'number', ''], ['personasPorGrupo', 'Personas/grupo', 'number', '']] as const).map(([k, et, tipo, extra]) => (
                                                    <label key={k} className={`block ${extra}`}><span className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)]">{et}</span><input type={tipo} value={edicion.campos[k]} onChange={(e) => cambiarCampo(k, e.target.value)} maxLength={k === 'grupoSeccion' ? 1 : undefined} className="mt-1 w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--c-e0e0ec)] focus:outline-none focus:border-[color:var(--c-818cf8)]" /></label>
                                                  ))}
                                                </div>
                                                <label className="block"><span className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)]">Descripción</span><textarea value={edicion.campos.descripcion} onChange={(e) => cambiarCampo('descripcion', e.target.value)} rows={4} maxLength={4000} className="mt-1 w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--c-e0e0ec)] focus:outline-none focus:border-[color:var(--c-818cf8)]" /></label>
                                                {edicion.error && <p className="text-red-400 text-[11px]">{edicion.error}</p>}
                                                <div className="flex gap-2 justify-end">
                                                  <button onClick={() => setEdicion(null)} className="px-3 py-1.5 text-xs text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg">Cancelar</button>
                                                  <button onClick={guardarEdicion} disabled={edicion.guardando} className="px-3 py-1.5 text-xs font-semibold text-white bg-[color:var(--c-818cf8)] rounded-lg disabled:opacity-60">{edicion.guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[color:var(--c-9a9bb0)]">
                                                  <span>Sección: <b className="text-[color:var(--c-d0d0da)]">{ev.grupoSeccion || 'A'}</b></span>
                                                  <span>Tipo: <b className="text-[color:var(--c-d0d0da)]">{ev.tipoActividad || '—'}</b></span>
                                                  <span>Duración: <b className="text-[color:var(--c-d0d0da)]">{ev.tiempoEstimadoMinutos != null ? `${ev.tiempoEstimadoMinutos} min` : '—'}</b></span>
                                                  <span>Nivel Bloom: <b className="text-[color:var(--c-d0d0da)]">{ev.nivelBloom || '—'}</b></span>
                                                  <span>Grupos: <b className="text-[color:var(--c-d0d0da)]">{ev.cantidadGrupos ?? '—'}</b></span>
                                                  <span>Personas/grupo: <b className="text-[color:var(--c-d0d0da)]">{ev.personasPorGrupo ?? '—'}</b></span>
                                                  <span className="col-span-2">Enfoque: <b className="text-[color:var(--c-d0d0da)]">{ev.enfoque || '—'}</b></span>
                                                </div>
                                                <div><p className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] mb-1">Descripción</p><p className="text-[color:var(--c-c0c0cc)] whitespace-pre-wrap break-words">{ev.descripcion || 'Sin descripción.'}</p></div>
                                                {esSuper && <button onClick={() => iniciarEdicion(ev)} className="flex items-center gap-1.5 text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)]"><Pencil className="w-3.5 h-3.5" />Editar esta evaluación</button>}
                                              </>
                                            )}
                                          </div>
                                        )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {m.observaciones.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)]">Observaciones enviadas</p>
                                      {m.observaciones.map(o => (
                                        <div key={o.id} className="flex items-start gap-2 text-[11px] text-[color:var(--c-9a9bb0)]">
                                          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5 text-yellow-300/70" />
                                          <span className="flex-1 break-words"><span className="text-[color:var(--c-c0c0cc)]">{o.autorNombre}</span>{o.evaluacionNombre ? ` · «${limpiarTexto(o.evaluacionNombre)}»` : ''}: {o.mensaje}</span>
                                          <span className={`flex-shrink-0 ${o.leida ? 'text-emerald-400/80' : 'text-amber-300/80'}`}>{o.leida ? 'leída' : 'sin leer'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
            )}
          </div>

          {(datos.sinDueno.materias > 0 || datos.sinDueno.estudiantes > 0) && (
            <p className="text-xs text-[color:var(--c-8a8b9e)] flex items-start gap-2"><Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" /><span>Hay datos sin dueño ({datos.sinDueno.materias} materia(s), {datos.sinDueno.evaluaciones} evaluación(es) y {datos.sinDueno.estudiantes} estudiante(s)). Suelen venir de cuentas eliminadas o de antes de existir los usuarios.</span></p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// AVISOS DEL PLAN: suma de pesos y evaluaciones en el mismo día (por sección)
// ============================================
export function AlertasPlan({ secciones }: { secciones: SeccionExamen[] }) {
  if (secciones.length === 0) return null;

  const suma = secciones.reduce((acc, s) => acc + (s.peso ?? 0), 0);

  // Agrupa por día (en hora local) para detectar evaluaciones que caen el mismo día
  const porDia = new Map<string, SeccionExamen[]>();
  secciones.forEach(s => {
    if (!s.fecha) return;
    const d = new Date(s.fecha);
    if (isNaN(d.getTime())) return;
    const clave = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    porDia.set(clave, [...(porDia.get(clave) || []), s]);
  });
  const choques = [...porDia.values()].filter(lista => lista.length > 1);

  const chip = 'flex items-start gap-2 text-xs rounded-lg px-3 py-2 border';
  if (suma === 100 && choques.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {/* Si suman 100% no se dice nada aquí (se ve como ✓ en la barra de la sección); solo se avisa si hay un problema */}
      {suma === 100 ? null : suma < 100 ? (
        <div className={`${chip} bg-amber-500/10 border-amber-500/30 text-amber-300`}><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>Los pesos suman {suma}%: faltan {100 - suma}% para llegar a 100%.</span></div>
      ) : (
        <div className={`${chip} bg-red-500/10 border-red-500/30 text-red-300`}><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>Los pesos suman {suma}%: sobran {suma - 100}% sobre el 100%.</span></div>
      )}
      {choques.map((lista, i) => (
        <div key={i} className={`${chip} bg-amber-500/10 border-amber-500/30 text-amber-300`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{lista.length} evaluaciones caen el {new Date(lista[0].fecha as any).toLocaleDateString()}: {lista.map(s => limpiarTexto(s.nombre)).join(', ')}.</span>
        </div>
      ))}
    </div>
  );
}
