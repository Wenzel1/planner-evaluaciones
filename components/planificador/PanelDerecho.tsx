'use client';

import { Activity, BarChart3, BookOpen, CalendarDays, CheckCircle, ChevronDown, ChevronUp, CircleHelp, ClipboardList, Copy, FileText, KeyRound, LogOut, PanelLeftOpen, Pencil, Plus, Sparkles, Trash2, User, UserCog, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { type Examen } from '@/lib/examen';
import { type RubricaEval, textoPuntos, totalRubrica } from '@/lib/rubrica';
import { apiEstudiantes } from '@/lib/api';
import { enlacesDeDescripcion } from '@/lib/herramientasEnlaces';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertasPlan, DashboardPorRol } from '@/components/planificador/Dashboard';
import { DragDropSecciones } from '@/components/planificador/DragDropSecciones';
import { EvaluacionesApiladas } from '@/components/planificador/EvaluacionesApiladas';
import { CampanitaNotificacionesFlotante } from '@/components/planificador/Notificaciones';
import { ErroresEvaluacion, EvaluacionFormulario, MateriaCorta, PanelDerechoHandle, PanelDerechoProps, PlanificacionExamen, SeccionExamen } from '@/components/planificador/tipos';
import { BotonTema, Tooltip, VentanaFlotante } from '@/components/planificador/ui';
import { planAccionHTML } from '@/components/planificador/planAccionHTML';
import { useAvisosProfesor } from '@/components/planificador/useAvisosProfesor';
import { EVAL_POR_ABRIR, MATERIA_ACTIVA, calcularFechasEvaluaciones, esIdGuardado, estadoVisibleEvaluacion, heredado, limpiarTexto, pedirSugerenciasRecursos, planVisto, validarContenidoSE, validarEnfoque } from '@/components/planificador/utilidades';
import dynamic from 'next/dynamic';
import { CargandoPanel } from '@/components/planificador/ui';

// Se descargan solo cuando se abren (la primera carga del Planificador queda mas liviana)
const ActividadPanel = dynamic(() => import('@/components/planificador/Administracion').then(m => m.ActividadPanel), { loading: CargandoPanel });
const ConfigSistemaPanel = dynamic(() => import('@/components/planificador/Administracion').then(m => m.ConfigSistemaPanel), { loading: CargandoPanel });
const PapeleraPanel = dynamic(() => import('@/components/planificador/Administracion').then(m => m.PapeleraPanel), { loading: CargandoPanel });
const CalendarioPanel = dynamic(() => import('@/components/planificador/CalendarioPanel').then(m => m.CalendarioPanel), { loading: CargandoPanel });
const PerfilPanel = dynamic(() => import('@/components/planificador/Cuenta').then(m => m.PerfilPanel), { loading: CargandoPanel });
const EstudiantesPanel = dynamic(() => import('@/components/planificador/EstudiantesPanel').then(m => m.EstudiantesPanel), { loading: CargandoPanel });
const ObservacionesRecibidas = dynamic(() => import('@/components/planificador/Opiniones').then(m => m.ObservacionesRecibidas));
const OpinionesEstudiantes = dynamic(() => import('@/components/planificador/Opiniones').then(m => m.OpinionesEstudiantes));
const UsuariosPanel = dynamic(() => import('@/components/planificador/UsuariosPanel').then(m => m.UsuariosPanel), { loading: CargandoPanel });
const CodigoClase = dynamic(() => import('@/components/CodigoClase'));


export const COLOR_TEXTO_ROL: Record<string, string> = { SUPERADMIN: 'text-fuchsia-300', ADMIN: 'text-indigo-300', USUARIO: 'text-emerald-300' };

export function SelectorMateria({ materias, actualId, actualNombre, onAbrir, onNueva, onRenombrar }: { materias: MateriaCorta[]; actualId: string | null; actualNombre: string; onAbrir: (id: string) => Promise<void>; onNueva: (nombre: string) => Promise<void>; onRenombrar?: (nombre: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera); return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  const correr = async (f: () => Promise<void>) => { setOcupado(true); try { await f(); } catch (e: any) { alert(e?.message || 'No se pudo.'); setOcupado(false); } };
  return (
    <div ref={ref} className="relative">
      <Tooltip text={actualNombre ? `Materia: ${actualNombre}` : 'Materia'} lado="abajo">
        <button type="button" disabled={ocupado} onClick={() => setAbierto(v => !v)} className="h-9 px-2 sm:px-3 flex items-center gap-1.5 rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] text-[color:var(--c-c0c0d0)] hover:text-[color:var(--c-blanco)] hover:border-[color:var(--c-818cf8)]/40 text-xs font-medium max-w-[200px] disabled:opacity-60">
          {ocupado ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BookOpen className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />}
          <span className="hidden @6xl:inline truncate">{actualNombre || 'Materia'}</span>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        </button>
      </Tooltip>
      {abierto && (
        <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-64 z-50 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl shadow-2xl p-1.5">
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] font-semibold">Mis materias</p>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {materias.length === 0 && <p className="px-2.5 py-2 text-xs text-[color:var(--c-8a8b9e)]">Todavía no hay materias guardadas.</p>}
            {materias.map(m => (
              <button key={m.id} type="button" onClick={() => { setAbierto(false); if (m.id !== actualId) correr(() => onAbrir(m.id)); }} className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] flex items-center gap-2 ${m.id === actualId ? 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-blanco)]' : 'text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-272839)]'}`}>
                <span className="flex-1 truncate">{m.id === actualId && actualNombre ? actualNombre : m.nombre}</span>{m.id === actualId && <CheckCircle className="w-3.5 h-3.5 text-[color:var(--c-a5b4fc)]" />}
              </button>
            ))}
          </div>
          <div className="border-t border-[color:var(--c-313248)] mt-1 pt-1">
            {onRenombrar && actualId && <button type="button" onClick={() => { const n = window.prompt('Nuevo nombre de esta materia:', actualNombre)?.trim().slice(0, 120); setAbierto(false); if (n && n !== actualNombre) onRenombrar(n); }} className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-272839)] flex items-center gap-2"><Pencil className="w-3.5 h-3.5" />Cambiar nombre de esta materia</button>}
            <button type="button" onClick={() => { const n = window.prompt('Nombre de la nueva materia:')?.trim(); setAbierto(false); if (n) correr(() => onNueva(n)); }} className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] text-[color:var(--c-a5b4fc)] hover:bg-[color:var(--c-272839)] flex items-center gap-2"><Plus className="w-3.5 h-3.5" />Nueva materia</button>
          </div>
        </div>
      )}
    </div>
  );
}
export let contadorNotif = 0; // ids de notificación únicos aunque lleguen dos en el mismo milisegundo

export const PanelDerecho = forwardRef<PanelDerechoHandle, PanelDerechoProps>(function PanelDerecho({ onSeccionActivaCambia, chatAbierto = true, onAbrirChat, usuario, onLogout, onUsuarioActualizado, onConfigActualizada, datosCargados, planificacion, setPlanificacion, propuestaPendiente, aceptarPropuesta, setPropuestaPendiente, vistaInicial, onCambiarVista, pdfUrl: pdfUrlProp, setPdfUrl: setPdfUrlProp, pdfAbierto: pdfAbiertoProp, setPdfAbierto: setPdfAbiertoProp, generarPDF, planificacionId, setPlanificacionId, materias = [], materiaActivaId = null, onAbrirMateria, onNuevaMateria, onTutorial }: PanelDerechoProps, ref) {
  MATERIA_ACTIVA.nombre = planificacion?.materia || ''; // para el validador de temas (perfil de la materia)
  const [vista, setVista] = useState<'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema' | 'calendario'>(vistaInicial);
  const [numEvaluaciones, setNumEvaluaciones] = useState(1); 
  const seccionesGuardadasRef = useRef<HTMLDivElement>(null);
  // --- Tarjetas incluidas en el "Plan de Acción" ---
  // Todas empiezan incluidas (círculo morado). Al desmarcar una, sale del plan; al marcarla, vuelve a entrar.
  const [tarjetasExcluidas, setTarjetasExcluidas] = useState<string[]>([]);
  const toggleTarjetaSeleccionada = (id: string) => {
    setTarjetasExcluidas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  // --- Secciones/paralelos (A, B, C...) del grupo de estudiantes que comparten la materia ---
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>(['A', 'B', 'C']);
  // Si al cargar aparecen evaluaciones de otras secciones (ej. 'E'), se agregan a las pestañas
  useEffect(() => {
    const letras = new Set(planificacion.secciones.map((s: SeccionExamen) => s.grupoSeccion || 'A'));
    setSeccionesDisponibles(prev => { const faltan = [...letras].filter(l => !prev.includes(l)); return faltan.length ? [...prev, ...faltan].sort() : prev; });
  }, [planificacion.secciones]);
  const [seccionActiva, setSeccionActiva] = useState<string>('A');
  useEffect(() => { onSeccionActivaCambia?.(seccionActiva); }, [seccionActiva]); // el chat guarda en la sección que estás viendo
  const agregarNuevaSeccion = () => {
    // Genera la siguiente letra disponible después de la última (A, B, C, D...)
    const ultima = seccionesDisponibles[seccionesDisponibles.length - 1] || 'A';
    const siguienteCodigo = ultima.charCodeAt(0) + 1;
    if (siguienteCodigo > 'Z'.charCodeAt(0)) return; // límite razonable
    const nuevaLetra = String.fromCharCode(siguienteCodigo);
    setSeccionesDisponibles(prev => [...prev, nuevaLetra]);
    setSeccionActiva(nuevaLetra);
    // La sección nueva queda registrada con su código de clase
    if (materiaActivaId) fetch('/api/materias/secciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId: materiaActivaId, letra: nuevaLetra }) }).catch(() => {});
  };
  // Secciones registradas de la materia (con código de clase) y solicitudes pendientes de cada una
  const [verCodigo, setVerCodigo] = useState(false);
  const [solicitudesSeccion, setSolicitudesSeccion] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!materiaActivaId) return;
    fetch(`/api/materias/secciones?materiaId=${encodeURIComponent(materiaActivaId)}`).then(r => (r.ok ? r.json() : [])).then((lista: { letra: string; pendientes: number }[]) => {
      if (!Array.isArray(lista) || !lista.length) return;
      setSeccionesDisponibles(prev => {
        const deEvaluaciones = new Set(planificacion.secciones.map((x: SeccionExamen) => x.grupoSeccion || 'A'));
        const letras = [...new Set([...lista.map(x => x.letra), ...deEvaluaciones])].sort();
        return letras.length ? letras : prev;
      });
      setSolicitudesSeccion(Object.fromEntries(lista.map(x => [x.letra, x.pendientes])));
      if (!lista.some(x => x.letra === seccionActiva)) setSeccionActiva(lista[0].letra);
    }).catch(() => {});
  }, [materiaActivaId]);
  const cambiarSeccionActiva = (letra: string) => {
    setSeccionActiva(letra);
  };
  const eliminarSeccionActiva = () => {
    if (seccionesDisponibles.length <= 1) {
      alert('Debe existir al menos una sección activa.');
      return;
    }
    const letra = seccionActiva;
    const restantes = seccionesDisponibles.filter(l => l !== letra);
    const estadoActualizado = { ...planificacion, secciones: planificacion.secciones.filter(s => (s.grupoSeccion || 'A') !== letra) };
    setPlanificacion(estadoActualizado);
    sincronizarConBD(estadoActualizado);
    setSeccionesDisponibles(restantes);
    setSeccionActiva(restantes[0]);
    // Limpia también el plan de acción propio de la sección eliminada
    setPdfPorSeccion(prev => { const copia = { ...prev }; delete copia[letra]; return copia; });
    setPdfAbiertoPorSeccion(prev => { const copia = { ...prev }; delete copia[letra]; return copia; });
    agregarNotificacion(`🗑️ Sección ${letra} eliminada.`);
  };
  // --- Copiar el plan de la sección activa a otra sección (A → B, C...) ---
  const [copiaAbierta, setCopiaAbierta] = useState(false);
  const [copiaDestino, setCopiaDestino] = useState('');
  const [copiaModo, setCopiaModo] = useState<'agregar' | 'reemplazar'>('agregar');
  const [copiaDias, setCopiaDias] = useState('0');
  const siguienteLetraLibre = (() => {
    const ultima = seccionesDisponibles[seccionesDisponibles.length - 1] || 'A';
    const c = ultima.charCodeAt(0) + 1;
    return c > 'Z'.charCodeAt(0) ? null : String.fromCharCode(c);
  })();
  const abrirCopia = () => {
    const otra = seccionesDisponibles.find(l => l !== seccionActiva) || siguienteLetraLibre || '';
    setCopiaDestino(otra); setCopiaModo('agregar'); setCopiaDias('0'); setCopiaAbierta(true);
  };
  // Busca y asigna recursos (2 videos + 2 páginas) a las evaluaciones de la sección que aún no tienen
  const [llenandoRecursos, setLlenandoRecursos] = useState<{ hechas: number; total: number } | null>(null);
  const recursosParaTodas = async () => {
    const pendientes = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva && !(s.recursos?.length) && !['CANCELADA', 'REALIZADA'].includes(String(s.estado || '').toUpperCase()));
    if (pendientes.length === 0) { agregarNotificacion(`📎 Todas las evaluaciones de la Sección ${seccionActiva} ya tienen recursos.`); return; }
    if (!window.confirm(`Se buscarán videos y páginas para ${pendientes.length} evaluación(es) de la Sección ${seccionActiva} que no tienen recursos, y se asignarán 2 videos y 2 páginas a cada una. Luego puedes revisarlos en el botón 📎 de cada tarjeta. ¿Continuar?`)) return;
    setLlenandoRecursos({ hechas: 0, total: pendientes.length });
    const resumen: string[] = [];
    for (let i = 0; i < pendientes.length; i++) {
      const sec = pendientes[i];
      try {
        const d = await pedirSugerenciasRecursos(sec, planificacion.materia);
        const recursos = [...d.videos.slice(0, 2), ...d.paginas.slice(0, 2)].map(x => ({ titulo: x.titulo, url: x.url }));
        if (recursos.length) {
          setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id && !(s.recursos?.length) ? { ...s, recursos } : s) }));
          resumen.push(`«${limpiarTexto(sec.nombre)}»: ${d.videos.slice(0, 2).length} video(s), ${d.paginas.slice(0, 2).length} página(s)`);
        } else resumen.push(`«${limpiarTexto(sec.nombre)}»: no se encontró nada`);
        if (d.avisos.some(a => /cupo/i.test(a)) && !d.videos.length && !d.paginas.length) { resumen.push('Se detuvo: se acabó el cupo diario.'); break; }
      } catch (e: any) {
        resumen.push(`«${limpiarTexto(sec.nombre)}»: ${e.message}`);
        if (/cupo|clave/i.test(e.message)) break; // no tiene sentido seguir
      }
      setLlenandoRecursos({ hechas: i + 1, total: pendientes.length });
    }
    setLlenandoRecursos(null);
    agregarNotificacion(`📎 Recursos de la Sección ${seccionActiva}: ${resumen.join(' · ')}`);
  };
  const copiarPlanASeccion = () => {
    const destino = copiaDestino;
    const origen = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva && !tarjetasExcluidas.includes(s.id));
    if (!destino || destino === seccionActiva || origen.length === 0) return;
    const enDestino = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === destino);
    if (copiaModo === 'reemplazar' && enDestino.length > 0) {
      const realizadas = enDestino.filter((s: SeccionExamen) => String(s.estado || '').toUpperCase() === 'REALIZADA').length;
      const aviso = `Se borrarán las ${enDestino.length} evaluación(es) que ya tiene la Sección ${destino}${realizadas ? ` (incluidas ${realizadas} ya realizada(s))` : ''} y se pondrán las copias. ¿Continuar?`;
      if (!window.confirm(aviso)) return;
    }
    const dias = Math.max(-365, Math.min(365, parseInt(copiaDias, 10) || 0));
    const base = Date.now();
    const copias: SeccionExamen[] = origen.map((s: SeccionExamen, i: number) => {
      const { estado: _estado, ...resto } = s;
      const fecha = s.fecha ? new Date(new Date(s.fecha).getTime() + dias * 86400000) : undefined;
      return { ...resto, id: `copia${destino}-${base}-${i}`, grupoSeccion: destino, fecha };
    });
    const conservadas = copiaModo === 'reemplazar' ? planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') !== destino) : planificacion.secciones;
    const nuevasSecciones = [...conservadas, ...copias].map((s, idx) => ({ ...s, orden: idx }));
    setPlanificacion({ ...planificacion, secciones: nuevasSecciones }); // el guardado automático lo sube a la base de datos
    if (!seccionesDisponibles.includes(destino)) setSeccionesDisponibles(prev => [...prev, destino].sort());
    // El plan de acción viejo de la sección destino ya no corresponde
    setPdfPorSeccion(prev => { const copia = { ...prev }; delete copia[destino]; return copia; });
    setPdfAbiertoPorSeccion(prev => { const copia = { ...prev }; delete copia[destino]; return copia; });
    const pesoTotal = nuevasSecciones.filter(s => s.grupoSeccion === destino).reduce((t, s) => t + (Number(s.peso) || 0), 0);
    agregarNotificacion(`📋 ${copias.length} evaluación(es) copiadas de la Sección ${seccionActiva} a la Sección ${destino}${dias ? ` (fechas corridas ${dias > 0 ? '+' : ''}${dias} día(s))` : ''}.`);
    if (pesoTotal > 100) agregarNotificacion(`⚠️ La Sección ${destino} ahora suma ${pesoTotal}% de peso. Revisa los porcentajes.`);
    setCopiaAbierta(false);
    setSeccionActiva(destino);
  };
  // Evaluaciones que pertenecen a la sección activa (A, B, C...)
  const seccionesFiltradas = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva);
  // Los 4 formularios manuales ocupan mucho: si la sección ya tiene evaluaciones se pliegan.
  // Se abren solos cuando tienen algo (una propuesta del agente o una evaluación en edición) o con el botón.
  const [verFormularios, setVerFormularios] = useState(false);
  // La guía de primeros pasos se puede cerrar; se recuerda por sección en este navegador
  // Guía "Primeros pasos": se recuerda cerrada por cuenta y por materia (cada cuenta y cada materia nueva la vuelve a ver)
  const claveGuia = `guia_pasos_cerrada:${usuario?.id || 'anon'}:${materiaActivaId || 'sin-materia'}`;
  const [guiasCerradas, setGuiasCerradas] = useState<string[]>([]);
  useEffect(() => { try { setGuiasCerradas(JSON.parse(localStorage.getItem(claveGuia) || '[]')); } catch { setGuiasCerradas([]); } }, [claveGuia]);
  const cerrarGuia = () => setGuiasCerradas(prev => { const n = [...new Set([...prev, seccionActiva])]; try { localStorage.setItem(claveGuia, JSON.stringify(n)); } catch { /* sin almacenamiento */ } return n; });
  // El plan usa solo las evaluaciones de la sección activa que siguen marcadas
  const seccionesParaPlan = seccionesFiltradas.filter((s: SeccionExamen) => !tarjetasExcluidas.includes(s.id));
  const idsSeleccionados = seccionesParaPlan.map((s: SeccionExamen) => s.id);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const [scrollToSections, setScrollToSections] = useState(false);
  const [pdfPorSeccion, setPdfPorSeccion] = useState<Record<string, string | null>>({});
  const [pdfAbiertoPorSeccion, setPdfAbiertoPorSeccion] = useState<Record<string, boolean>>({});
  // Cada sección (A, B, C...) tiene su propio Plan de Acción generado; cambiar de pestaña
  // no debe mostrar el plan de otra sección.
  const pdfUrlLocal = pdfPorSeccion[seccionActiva] ?? null;
  const pdfAbiertoLocal = pdfAbiertoPorSeccion[seccionActiva] ?? false;
  const [cargandoPdf, setCargandoPdf] = useState(false);
  // Cambia la fecha desde el calendario (arrastrar o "Cambiar fecha"). El guardado automático la lleva a la base de datos
  // y los recordatorios de WhatsApp se calculan con la fecha nueva.
  const guardarRecursosEvaluacion = (sec: SeccionExamen, recursos: { titulo: string; url: string }[] | null, abiertaManual: boolean) => {
    setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id ? { ...s, recursos, abiertaManual } : s) })); // se guarda sola
    agregarNotificacion(`📎 "${limpiarTexto(sec.nombre)}": ${recursos?.length ? `${recursos.length} recurso(s)` : 'sin recursos'}${abiertaManual ? ' · abierta para los estudiantes' : ''}.`);
  };
  const guardarRubricaEvaluacion = (sec: SeccionExamen, rubrica: RubricaEval | null) => {
    setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id ? { ...s, rubrica } : s) })); // se guarda sola
    // El plan de acción ya generado de esta sección queda viejo: se vuelve a generar al abrirlo
    const letra = sec.grupoSeccion || 'A';
    setPdfPorSeccion(prev => { const copia = { ...prev }; delete copia[letra]; return copia; });
    agregarNotificacion(rubrica ? `📋 Rúbrica de "${limpiarTexto(sec.nombre)}" guardada (${textoPuntos(totalRubrica(rubrica))} pts).` : `🗑️ Rúbrica de "${limpiarTexto(sec.nombre)}" quitada.`);
  };
  // Enlaces oficiales de las herramientas que nombra cada evaluación: se agregan solos a sus Recursos.
  // Se recuerda qué herramientas ya se agregaron, así un enlace que el profesor borra no vuelve a aparecer.
  useEffect(() => {
    if (!datosCargados) return;
    const cambios = new Map<string, { titulo: string; url: string }[]>();
    for (const s of planificacion.secciones) {
      if (!esIdGuardado(s.id) || !s.descripcion) continue;
      const herramientas = enlacesDeDescripcion(s.descripcion);
      if (!herramientas.length) continue;
      const clave = `herramientasAgregadas:${s.id}`;
      let vistas: string[] = [];
      try { vistas = JSON.parse(localStorage.getItem(clave) || '[]'); } catch { vistas = []; }
      const nuevas = herramientas.filter(h => !vistas.includes(h.url));
      if (!nuevas.length) continue;
      try { localStorage.setItem(clave, JSON.stringify([...vistas, ...nuevas.map(h => h.url)])); } catch { /* sin almacenamiento */ }
      const actuales = s.recursos || [];
      const agregar = nuevas.filter(h => !actuales.some(r => r.url === h.url));
      if (agregar.length) cambios.set(s.id, [...actuales, ...agregar].slice(0, 10));
    }
    if (cambios.size) {
      const total = [...cambios.entries()].reduce((t, [id, lista]) => t + lista.length - (planificacion.secciones.find(x => x.id === id)?.recursos?.length || 0), 0);
      setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(x => (cambios.has(x.id) ? { ...x, recursos: cambios.get(x.id)! } : x)) }));
      agregarNotificacion(`🧰 Se agregaron ${total} enlace${total === 1 ? '' : 's'} de herramientas a los recursos de ${cambios.size} evaluaci${cambios.size === 1 ? 'ón' : 'ones'} (Figma, GitHub… según su descripción). Puedes quitarlos con 📎.`);
    }
  }, [planificacion.secciones, datosCargados]);
  const cambiarFechaEvaluacion = (sec: SeccionExamen, fecha: Date) => {
    const anterior = sec.fecha ? new Date(sec.fecha) : null;
    setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id ? { ...s, fecha } : s) }));
    // Si ya estaba guardada y la fecha nueva es futura, se ofrece avisar a los estudiantes del cambio
    const realmenteCambio = !anterior || Math.abs(anterior.getTime() - fecha.getTime()) > 60_000;
    if (esIdGuardado(sec.id) && realmenteCambio && fecha.getTime() > Date.now() && !['REALIZADA', 'CANCELADA'].includes(String(sec.estado || '').toUpperCase())) {
      setTimeout(async () => {
        if (!window.confirm(`¿Avisar a los estudiantes de la Sección ${(sec.grupoSeccion || 'A').toUpperCase()} que «${limpiarTexto(sec.nombre)}» cambió de fecha?`)) return;
        const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'avisar_cambio', evaluacionId: sec.id, fecha: fecha.toISOString(), fechaAnterior: anterior?.toISOString() }) }).catch(() => null);
        const d = await r?.json().catch(() => ({})) ?? {};
        if (!r?.ok) agregarNotificacion(`⚠️ ${d.error || 'No se pudo avisar a los estudiantes.'}`);
        else if (d.desactivado) agregarNotificacion('ℹ️ Los avisos de cambios están apagados (Calendario → Recordatorios).');
        else agregarNotificacion(d.ok === false ? `⚠️ No se pudo avisar: ${d.error || 'error de envío'}` : `📣 Se avisó del cambio de fecha a ${d.total} estudiante(s).`);
      }, 150);
    }
    agregarNotificacion(`📅 "${limpiarTexto(sec.nombre)}" ahora es el ${fecha.toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}.`);
  };
  // Marca una evaluación como realizada / reprogramada / cancelada (se guarda al instante en la base de datos)
  const cambiarEstadoEvaluacion = async (sec: SeccionExamen, estado: string, fecha?: Date): Promise<boolean> => {
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(sec.id)}/estado`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, fecha: fecha ? fecha.toISOString() : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { agregarNotificacion('❌ ' + (d.error || 'No se pudo cambiar el estado.')); return false; }
      setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id ? { ...s, estado: d.estado, fecha: d.fecha ? new Date(d.fecha) : s.fecha } : s) }));
      const textos: Record<string, string> = { REALIZADA: '✅ Evaluación marcada como realizada.', REPROGRAMADA: '🔁 Evaluación reprogramada. Los recordatorios usarán la nueva fecha.', CANCELADA: '⛔ Evaluación cancelada: no se enviarán recordatorios.', PROGRAMADA: '🗓 Evaluación programada de nuevo.' };
      agregarNotificacion(textos[d.estado] || 'Estado actualizado.');
      if (d.aviso?.total) agregarNotificacion(d.aviso.ok ? `📣 Se avisó del cambio a ${d.aviso.total} estudiante(s).` : `⚠️ No se pudo avisar a los estudiantes: ${d.aviso.error || 'error de envío'}`);
      return true;
    } catch {
      agregarNotificacion('❌ No se pudo conectar con el servidor.');
      return false;
    }
  };
  // Genera el Plan de Acción de la sección activa con la lista indicada (PDF por n8n; si falla, versión HTML)
  const generarPlanAccion = async (lista: SeccionExamen[], silencioso = false) => {
    if (lista.length === 0) { if (!silencioso) alert('No hay evaluaciones marcadas para generar el plan.'); return; }
    setCargandoPdf(true);
    try {
      await new Promise(resolve => requestAnimationFrame(resolve)); // deja que se pinte el spinner
      let urlFinal: string | null = null;
      if (generarPDF) { try { urlFinal = await generarPDF(lista); } catch { console.log('n8n no disponible'); } }
      if (!urlFinal) {
        const html = generarPlanVisual(lista);
        if (html) urlFinal = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      }
      if (urlFinal) {
        setPdfUrl(urlFinal);
        if (!silencioso) setPdfAbierto(false);
        agregarNotificacion(silencioso ? '🔄 Plan de Acción actualizado con las evaluaciones marcadas.' : '📄 Plan de Acción generado correctamente.');
      }
    } catch (err) {
      console.error(err);
      agregarNotificacion('❌ Error al generar el Plan de Acción.');
    } finally {
      setCargandoPdf(false);
    }
  };
  const [campanaActiva, setCampanaActiva] = useState(false);
  const [mostrarMenuEnvio, setMostrarMenuEnvio] = useState(false);
  const [enviarA, setEnviarA] = useState<'profesor' | 'estudiantes' | null>(null);
  const [filtroEnvio, setFiltroEnvio] = useState<'todos' | 'seleccionar' | null>(null);
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');
  const [notificaciones, setNotificaciones] = useState<{id: string, mensaje: string, timestamp: Date, leido: boolean}[]>([{ id: 'bienvenida', mensaje: '👋 Bienvenido al planificador', timestamp: new Date(), leido: false }]);

    // Total de estudiantes registrados (para auto-calcular grupos).
  // Se recalcula por sección/paralelo (A, B, C...) usando el campo "grupo" que ya
  // existe en el modelo de Estudiante, para que el cálculo de equipos de la
  // evaluación corresponda solo a los estudiantes de la sección activa.
  const [totalEstudiantes, setTotalEstudiantes] = useState(8); // 8 por defecto
  const [estudiantesSeccion, setEstudiantesSeccion] = useState<number | null>(null); // número real (null = cargando), para la guía de primeros pasos

  useEffect(() => {
    const cargarTotal = async () => {
      try {
        const data = await apiEstudiantes.listar();
        setEstudiantesSeccion(Array.isArray(data) ? data.filter((e: any) => (e?.grupo || 'A') === seccionActiva && String(e?.estado || 'ACTIVO').toUpperCase() === 'ACTIVO').length : 0);
        if (Array.isArray(data) && data.length > 0) {
          const delaSeccion = data.filter((e: any) => (e?.grupo || 'A') === seccionActiva);
          // Si aún no hay estudiantes cargados con ese código de sección específico,
          // se usa el total general como respaldo para no bloquear la planificación.
          setTotalEstudiantes(delaSeccion.length > 0 ? delaSeccion.length : data.length);
        }
      } catch {
        // Si falla, mantiene el valor por defecto (8)
      }
    };
    cargarTotal();
  }, [seccionActiva, vista === 'planificacion']); // también al volver al planificador (por si agregó estudiantes)

  // Estados para el efecto glow
  const [glow1, setGlow1] = useState(false);
  const [glow2, setGlow2] = useState(false);
  const [glow3, setGlow3] = useState(false);
  const [glow4, setGlow4] = useState(false);

  // --- Botón "atrás" del navegador: cada pestaña queda en el historial, así "atrás" vuelve a la pestaña anterior
  // en vez de salir de la app. Se conserva el estado interno de Next.js (history.state) para no romper su router.
  const reemplazarHistorial = useRef(false);
  const desdeHistorial = useRef(false);
  useEffect(() => { setVista(vistaInicial); }, [vistaInicial]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (desdeHistorial.current) { desdeHistorial.current = false; return; }
    const estado = window.history.state || {};
    if (estado.vistaApp === vista) return;
    const nuevo = { ...estado, vistaApp: vista };
    if (reemplazarHistorial.current || estado.vistaApp === undefined) window.history.replaceState(nuevo, '');
    else window.history.pushState(nuevo, '');
    reemplazarHistorial.current = false;
  }, [vista]);
  useEffect(() => {
    const alVolver = (e: PopStateEvent) => {
      const v = e.state?.vistaApp;
      if (v) { desdeHistorial.current = true; setVista(v); }
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  useEffect(() => { onCambiarVista(vista); }, [vista, onCambiarVista]);
  useEffect(() => { if (pdfUrlProp !== undefined) setPdfPorSeccion(prev => ({ ...prev, [seccionActiva]: pdfUrlProp })); }, [pdfUrlProp]);
  useEffect(() => { if (pdfAbiertoProp !== undefined) setPdfAbiertoPorSeccion(prev => ({ ...prev, [seccionActiva]: pdfAbiertoProp })); }, [pdfAbiertoProp]);

  const setPdfUrl = (url: string | null) => { setPdfPorSeccion(prev => ({ ...prev, [seccionActiva]: url })); if (setPdfUrlProp) setPdfUrlProp(url); };
  const setPdfAbierto = (abierto: boolean) => { setPdfAbiertoPorSeccion(prev => ({ ...prev, [seccionActiva]: abierto })); if (setPdfAbiertoProp) setPdfAbiertoProp(abierto); };
  const agregarNotificacion = (mensaje: string) => { setNotificaciones(prev => [{ id: `notif-${Date.now()}-${++contadorNotif}`, mensaje, timestamp: new Date(), leido: false }, ...prev.slice(0, 19)]); };
  const scrollToTarjeta = () => { setTimeout(() => { if (tarjetaRef.current) tarjetaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); };
  
  useEffect(() => { if (scrollToSections && seccionesGuardadasRef.current && vista === 'planificacion') { requestAnimationFrame(() => { seccionesGuardadasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScrollToSections(false); }); } }, [planificacion.secciones, scrollToSections, vista]);

  const evalInit: EvaluacionFormulario = { materia: '', duracionMinutos: null, duracionUnidad: 'min', peso: null, fecha: new Date(), tipoActividad: '', descripcion: '', cantidadGrupos: null, personasPorGrupo: null, editandoId: null, mostrarDescripcion: false, enfoque: '', errores: {}, origenAgente: {}, };
  const [evaluacion1, setEvaluacion1] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion2, setEvaluacion2] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion3, setEvaluacion3] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion4, setEvaluacion4] = useState<EvaluacionFormulario>({...evalInit});
  const formulariosConContenido = [evaluacion1, evaluacion2, evaluacion3, evaluacion4].some(f => !!f.editandoId || !!String(f.materia || '').trim() || !!String(f.descripcion || '').trim() || !!String(f.tipoActividad || '').trim());
  const mostrarFormularios = seccionesFiltradas.length === 0 || formulariosConContenido || verFormularios;

  const limpiarYScroll = () => { setEvaluacion1({...evalInit}); setEvaluacion2({...evalInit}); setEvaluacion3({...evalInit}); setEvaluacion4({...evalInit}); setNumEvaluaciones(1); setScrollToSections(true); setVista('planificacion'); setGlow1(false); setGlow2(false); setGlow3(false); setGlow4(false); };
  useImperativeHandle(ref, () => ({
    limpiarYScroll, notificar: agregarNotificacion,
    // Libres = vacíos o llenados por el agente (no se pisa lo que el profesor esté escribiendo a mano)
    formulariosLibres: () => [evaluacion1, evaluacion2, evaluacion3, evaluacion4].every(f => !f.editandoId && (f.origenAgente?.materia || (!String(f.materia || '').trim() && !String(f.descripcion || '').trim() && !String(f.tipoActividad || '').trim()))),
    // Guarda ya lo que esté pendiente (antes de cambiar de materia) y espera a que termine
    guardarAhora: async () => {
      if (datosCargados && !conflictoRef.current && firmaDePlan(planificacion) !== ultimaFirma.current && (planIdRef.current || planificacion.secciones.length > 0)) await sincronizarConBD(planificacion);
      await colaSync.current;
    },
    cambiarSeccion: (letra: string) => {
      const l = String(letra || '').toUpperCase(); if (!/^[A-Z]$/.test(l)) return;
      setSeccionesDisponibles(prev => (prev.includes(l) ? prev : [...prev, l].sort()));
      setSeccionActiva(l);
    },
  }));

  // Al marcar o desmarcar una tarjeta, el Plan de Acción ya generado de esta sección se rehace (espera 1 s por si marcas varias)
  const regenerarRef = useRef<() => void>(() => {});
  regenerarRef.current = () => { if (pdfUrlLocal && seccionesParaPlan.length > 0 && !cargandoPdf) generarPlanAccion(seccionesParaPlan, true); };
  const primeraVezExcluidas = useRef(true);
  useEffect(() => {
    if (primeraVezExcluidas.current) { primeraVezExcluidas.current = false; return; }
    const t = setTimeout(() => regenerarRef.current(), 1000);
    return () => clearTimeout(t);
  }, [tarjetasExcluidas]);
    // Función para guardar en Supabase sin interrumpir la UI
  // ----- Guardado en la base de datos -----
  // Los guardados pasan por una cola (uno a la vez): antes, dos guardados seguidos podían crear materias duplicadas
  // o perder cambios. planIdRef guarda el id del plan al instante, sin esperar a que React actualice el estado.
  const planIdRef = useRef<string | null>(planificacionId);
  useEffect(() => { planIdRef.current = planificacionId; }, [planificacionId]);
  const colaSync = useRef<Promise<void>>(Promise.resolve());
  const ultimaFirma = useRef<string | null>(null);
  const [estadoGuardado, setEstadoGuardado] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo');

  const firmaDePlan = (p: PlanificacionExamen) => JSON.stringify([
    p.materia, p.estado, p.tipoExamen, new Date(p.fechaExamen).getTime(), p.duracionMinutos,
    p.secciones.map(s => [s.nombre, s.tipoPregunta, s.nivelBloom, s.peso, s.cantidadPreguntas, s.contenidosEvaluados, s.tiempoEstimadoMinutos, s.tipoActividad, s.descripcion, s.cantidadGrupos, s.personasPorGrupo, s.orden, s.enfoque, s.fecha ? new Date(s.fecha).getTime() : null, s.grupoSeccion || 'A', s.rubrica ?? null, s.recursos ?? null, !!s.abiertaManual]),
    p.rubrica,
  ]);

  const conflictoRef = useRef(false); // otra ventana guardó este plan: se dejan de guardar cambios hasta recargar
  const sincronizarInterno = async (planActualizada: PlanificacionExamen) => {
    if (conflictoRef.current) return;
    const firma = firmaDePlan(planActualizada);
    setEstadoGuardado('guardando');
    try {
      const planId = planIdRef.current;
      let materiaId: string | undefined = !planId && materiaActivaId ? materiaActivaId : undefined;
      if (!planId && !materiaId) {
        // Primera vez: se crea la materia y luego el plan
        const resMateria = await fetch('/api/materias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: planActualizada.materia || 'Nueva Asignatura', codigo: `MAT-${Date.now()}` }),
        });
        const nuevaMateria = await resMateria.json();
        if (!resMateria.ok || !nuevaMateria.id) throw new Error(nuevaMateria.error || 'No se pudo crear la materia');
        materiaId = nuevaMateria.id;
      }

      const dataParaDB = {
        ...(materiaId ? { materiaId } : {}),
        materiaNombre: planActualizada.materia,
        estado: planActualizada.estado.toUpperCase(),
        tipoExamen: planActualizada.tipoExamen.toUpperCase(),
        fechaExamen: planActualizada.fechaExamen.toISOString(),
        duracionMinutos: planActualizada.duracionMinutos,
        evaluaciones: planActualizada.secciones.map((ev, idx) => ({
          id: ev.id,
          nombre: ev.nombre, tipoPregunta: ev.tipoPregunta.toUpperCase(), nivelBloom: ev.nivelBloom.toUpperCase(),
          peso: ev.peso, cantidadPreguntas: ev.cantidadPreguntas, contenidosEvaluados: ev.contenidosEvaluados,
          tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos, tipoActividad: ev.tipoActividad, descripcion: ev.descripcion,
          cantidadGrupos: ev.cantidadGrupos, personasPorGrupo: ev.personasPorGrupo, orden: ev.orden ?? idx,
          enfoque: ev.enfoque, fecha: ev.fecha ? ev.fecha.toISOString() : null, grupoSeccion: ev.grupoSeccion || 'A',
          rubrica: ev.rubrica, // undefined = no se toca; null = se borra
          recursos: ev.recursos, abiertaManual: ev.abiertaManual,
          ...((ev as any).quitarExamen ? { quitarExamen: true } : {}), // cambió de tema: borra el examen viejo
        })),
        rubrica: planActualizada.rubrica.map(crit => ({
          nombre: crit.nombre, peso: crit.peso, descripcion: crit.descripcion,
          niveles: (crit.niveles || []).map(niv => ({ nombre: niv.nombre, puntaje: niv.puntaje, descripcion: niv.descripcion })),
        })),
      };

      const respuesta = planId
        ? await fetch(`/api/planificaciones/${planId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dataParaDB, vistoEn: planVisto.en }) })
        : await fetch('/api/planificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataParaDB) });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 409 && cuerpo.codigo === 'PLAN_CAMBIADO') {
        conflictoRef.current = true;
        setEstadoGuardado('error');
        agregarNotificacion(`⚠️ ${cuerpo.error}`);
        return;
      }
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo guardar el plan');
      if (cuerpo.updatedAt) planVisto.en = cuerpo.updatedAt;
      if (!planId && cuerpo.id) { planIdRef.current = cuerpo.id; setPlanificacionId(cuerpo.id); }
      // Las evaluaciones nuevas reciben su id definitivo: así conservan estado, recordatorios y calificaciones
      const idsNuevos: Record<string, string> = cuerpo.idsNuevos || {};
      if (Object.keys(idsNuevos).length > 0) {
        const cambiar = (id: string) => idsNuevos[id] || id;
        setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => idsNuevos[s.id] ? { ...s, id: idsNuevos[s.id] } : s) }));
        setTarjetasExcluidas(prev => prev.map(cambiar));
        const ajustarForm = (prev: EvaluacionFormulario) => (prev.editandoId && idsNuevos[prev.editandoId] ? { ...prev, editandoId: idsNuevos[prev.editandoId] } : prev);
        setEvaluacion1(ajustarForm); setEvaluacion2(ajustarForm); setEvaluacion3(ajustarForm); setEvaluacion4(ajustarForm);
      }

      // La marca de "borrar examen" ya se aplicó: se quita para no borrar uno que se adjunte después
      const enviadas = new Set(planActualizada.secciones.filter(s => (s as any).quitarExamen).map(s => idsNuevos[s.id] || s.id));
      if (enviadas.size) setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => (enviadas.has(s.id) && (s as any).quitarExamen ? (({ quitarExamen, ...resto }: any) => resto)(s) : s)) }));
      ultimaFirma.current = firma;
      setEstadoGuardado('guardado');
    } catch (error) {
      console.error('Error guardando en BD:', error);
      setEstadoGuardado('error');
      agregarNotificacion('⚠️ No se pudo guardar en la base de datos. Revisa tu conexión: se reintentará con el próximo cambio.');
    }
  };

  const sincronizarConBD = (planActualizada: PlanificacionExamen): Promise<void> => {
    const tarea = colaSync.current.then(() => sincronizarInterno(planActualizada));
    colaSync.current = tarea.catch(() => {});
    return tarea;
  };

  // Guardado automático: cualquier cambio en el plan (configuración, borrados hechos desde el chat, etc.) se guarda solo.
  // El punto de partida es lo que se cargó de la base de datos; si no cambió nada, no se guarda.
  useEffect(() => {
    if (!datosCargados) return;
    const firma = firmaDePlan(planificacion);
    if (ultimaFirma.current === null) { ultimaFirma.current = firma; return; }
    if (firma === ultimaFirma.current) return;
    if (!planIdRef.current && planificacion.secciones.length === 0) return; // todavía no hay nada que guardar
    const temporizador = setTimeout(() => { sincronizarConBD(planificacion); }, 500); // se guarda medio segundo después del último cambio
    return () => clearTimeout(temporizador);
  }, [planificacion, datosCargados]);

  useEffect(() => {
    if (propuestaPendiente?.evaluaciones) {
      const lista = propuestaPendiente.evaluaciones.slice(0, 4);
      // Casillas desde la 1: una evaluación propuesta = una casilla (antes la #4 caía en la casilla 4 con las de arriba vacías)
      const casillas = lista.map((_, idx) => idx + 1);
      const mayor = Math.max(1, lista.length);
      setNumEvaluaciones(lista.length || 1);
      const fechaBase = new Date(); const fechas = calcularFechasEvaluaciones(fechaBase, Math.max(mayor, lista.length));
      lista.forEach((p, i) => {
        const idx = casillas[i] - 1;
        let fechaExamen = fechas[idx] || new Date();
        if (p.fecha && p.hora) fechaExamen = new Date(`${p.fecha}T${p.hora}:00`);
        else if (p.fecha) fechaExamen = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha)) ? `${p.fecha}T08:00:00` : p.fecha);
        // Grupos con números: si solo vino "personas por grupo", se calcula cuántos grupos salen con los estudiantes de la sección
        const personas = p.personasPorGrupo ?? null;
        const grupos = p.cantidadGrupos ?? (personas && totalEstudiantes > 0 ? Math.max(1, Math.ceil(totalEstudiantes / personas)) : null);
        // Si edita una evaluación ya guardada, el formulario queda "editando" esa (al guardar la actualiza en vez de agregar otra)
        const evalData: EvaluacionFormulario = { materia: p.materia, duracionMinutos: p.duracionMinutos ?? null, duracionUnidad: 'min', peso: p.peso ?? null, fecha: fechaExamen, tipoActividad: p.tipoActividad || '', descripcion: p.descripcion || '', cantidadGrupos: grupos, personasPorGrupo: personas, editandoId: p.existenteId || null, mostrarDescripcion: false, enfoque: p.enfoque || '', errores: {}, origenAgente: { materia: true, tipoActividad: true, descripcion: true } };
        if (idx === 0) { setEvaluacion1(evalData); activarGlow(1); }
        else if (idx === 1) { setEvaluacion2(evalData); activarGlow(2); }
        else if (idx === 2) { setEvaluacion3(evalData); activarGlow(3); }
        else if (idx === 3) { setEvaluacion4(evalData); activarGlow(4); }
      });
      // Las casillas que sobran quedan limpias (sin restos de una propuesta anterior)
      [setEvaluacion1, setEvaluacion2, setEvaluacion3, setEvaluacion4].slice(lista.length).forEach(f => f({ ...evalInit, fecha: new Date() }));
      setPropuestaPendiente(null);
    }
  }, [propuestaPendiente, setPropuestaPendiente]);

  const activarGlow = (num: number) => {
    const setters = [setGlow1, setGlow2, setGlow3, setGlow4];
    const setter = setters[num-1];
    if (setter) {
      setter(true);
      setTimeout(() => setter(false), 1500);
    }
  };

  const cargarSeccionParaEditar = (seccion: SeccionExamen) => {
    if (seccion.grupoSeccion) setSeccionActiva(seccion.grupoSeccion);
    const nombreLimpio = limpiarTexto(seccion.nombre);
    const esEval1 = seccion.nombre.toLowerCase().includes('evaluación 1') || seccion.nombre.toLowerCase().includes('evaluacion 1');
    const esEval2 = seccion.nombre.toLowerCase().includes('evaluación 2') || seccion.nombre.toLowerCase().includes('evaluacion 2');
    const esEval3 = seccion.nombre.toLowerCase().includes('evaluación 3') || seccion.nombre.toLowerCase().includes('evaluacion 3');
    const datosBase: EvaluacionFormulario = { materia: nombreLimpio, duracionMinutos: seccion.tiempoEstimadoMinutos ?? null, duracionUnidad: 'min', peso: seccion.peso ?? null, fecha: seccion.fecha || new Date(), tipoActividad: seccion.tipoActividad || '', descripcion: seccion.descripcion || '', cantidadGrupos: seccion.cantidadGrupos ?? null, personasPorGrupo: seccion.personasPorGrupo ?? null, editandoId: seccion.id, mostrarDescripcion: false, enfoque: seccion.enfoque || '', errores: {} }; 
    if (esEval1) setEvaluacion1(datosBase);
    else if (esEval2) setEvaluacion2(datosBase);
    else if (esEval3) setEvaluacion3(datosBase);
    else setEvaluacion4(datosBase);
    const numFormulario = esEval1 ? 1 : esEval2 ? 2 : esEval3 ? 3 : 4;
    setNumEvaluaciones(prev => Math.max(prev, numFormulario));
    setVista('planificacion');
    // Desliza suavemente hacia los campos de la evaluación para que el usuario
    // vea de inmediato los datos cargados, sin tener que buscarlos manualmente.
    scrollToTarjeta();
  };

  const limpiarEvaluacion1 = () => setEvaluacion1({...evalInit});
  const limpiarEvaluacion2 = () => setEvaluacion2({...evalInit});
  const limpiarEvaluacion3 = () => setEvaluacion3({...evalInit});
  const limpiarEvaluacion4 = () => setEvaluacion4({...evalInit});

    // Genera el Plan de Acción como HTML visual (sin depender de n8n)
  // El HTML del plan se arma en planAccionHTML.ts
  const generarPlanVisual = (seccionesOverride?: SeccionExamen[]): string | null => planAccionHTML(planificacion, seccionesOverride ?? planificacion.secciones, usuario?.nombre);

    const limpiarTodasLasEvaluaciones = () => {
    const estadoVacio = { ...planificacion, secciones: [] };
    setPlanificacion(estadoVacio);
    sincronizarConBD(estadoVacio); // ESTA LÍNEA ES LA QUE BORRA DE LA BD
    limpiarEvaluacion1(); limpiarEvaluacion2(); limpiarEvaluacion3(); limpiarEvaluacion4();
    if (pdfUrlLocal) { URL.revokeObjectURL(pdfUrlLocal); setPdfUrl(null); setPdfAbierto(false); setMostrarMenuEnvio(false); }
    agregarNotificacion('🧹 Todas las evaluaciones eliminadas de la BD.');
  };

  const crearSeccion = (evalData: EvaluacionFormulario, tipo: string, idPrefix: string): SeccionExamen => {
    const materiaLimpia = limpiarTexto(evalData.materia);
    const duracionMin = evalData.duracionUnidad === 'hrs' ? (evalData.duracionMinutos || 0) * 60 : evalData.duracionMinutos;
    return { id: evalData.editandoId || `${idPrefix}-${Date.now()}`, nombre: `${tipo}: ${materiaLimpia}`, tipoPregunta: 'desarrollo', peso: evalData.peso, cantidadPreguntas: 1, contenidosEvaluados: [], nivelBloom: 'comprender', tiempoEstimadoMinutos: duracionMin, tipoActividad: evalData.tipoActividad || undefined, descripcion: evalData.descripcion, cantidadGrupos: evalData.cantidadGrupos ?? undefined, personasPorGrupo: evalData.personasPorGrupo ?? undefined, orden: planificacion.secciones.length, enfoque: evalData.enfoque || undefined, fecha: evalData.fecha, grupoSeccion: evalData.editandoId ? (planificacion.secciones.find(s => s.id === evalData.editandoId)?.grupoSeccion || seccionActiva) : seccionActiva, ...heredado(planificacion.secciones.find(s => s.id === evalData.editandoId), materiaLimpia), abiertaManual: evalData.editandoId ? planificacion.secciones.find(s => s.id === evalData.editandoId)?.abiertaManual : undefined };
  };

            const guardarEval = async (ev: EvaluacionFormulario, tipo: string, prefix: string, limpiar: () => void, setEv: (updater: (prev: EvaluacionFormulario) => EvaluacionFormulario) => void) => {
    if (!ev.materia.trim()) { alert(`Completa el nombre de ${tipo}`); return; }

    // === VALIDACIÓN DE INGENIERÍA DE SOFTWARE ===
    // Nota: si un campo todavía contiene texto autocompletado por el agente (no editado
    // manualmente por el usuario), se omite la validación de palabras clave para ese campo.
    const nuevosErrores: ErroresEvaluacion = {};

    const advertencias: string[] = [];
    if (ev.materia.trim() && !ev.origenAgente?.materia) {
      const rMateria = validarContenidoSE(ev.materia);
      if (!rMateria.valido) nuevosErrores.materia = rMateria.error;
      else if (rMateria.advertencia) advertencias.push(`• Contenido: ${rMateria.advertencia}`);
    }
    if (ev.tipoActividad.trim() && !ev.origenAgente?.tipoActividad) {
      const rTipo = validarContenidoSE(ev.tipoActividad);
      if (!rTipo.valido) nuevosErrores.tipoActividad = rTipo.error;
      // La estrategia ("Taller", "Debate"...) suele no tener palabras técnicas: no se advierte por eso
    }
    if (ev.enfoque?.trim()) {
      const rEnfoque = validarEnfoque(ev.enfoque);
      if (!rEnfoque.valido) nuevosErrores.enfoque = rEnfoque.error;
    }
    if (ev.descripcion?.trim() && !ev.origenAgente?.descripcion) {
      const rDesc = validarContenidoSE(ev.descripcion);
      if (!rDesc.valido) nuevosErrores.descripcion = rDesc.error;
      else if (rDesc.advertencia) advertencias.push(`• Descripción: ${rDesc.advertencia}`);
    }

    {
      const original = ev.editandoId ? planificacion.secciones.find(s => s.id === ev.editandoId)?.fecha : null;
      const misma = original && Math.abs(new Date(original).getTime() - ev.fecha.getTime()) < 60000;
      if (ev.fecha.getTime() < Date.now() - 60000 && !misma) {
        agregarNotificacion('📅 La fecha de la evaluación ya pasó. Elige hoy (a una hora que no haya pasado) o un día futuro.');
        return;
      }
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setEv(prev => ({ ...prev, errores: nuevosErrores }));
      agregarNotificacion('❌ Corrige los campos marcados en rojo antes de guardar.');
      return;
    }
    if (advertencias.length > 0 && !window.confirm(`Esto no parece del todo un tema de Ingeniería de Software:\n\n${advertencias.join('\n')}\n\n¿Quieres guardarla igual?`)) {
      return;
    }
    // === FIN VALIDACIÓN ===

    const nuevaSeccion = crearSeccion(ev, tipo, prefix);
    
    const estadoActualizado: PlanificacionExamen = {
      ...planificacion,
      secciones: ev.editandoId 
        ? planificacion.secciones.map(sec => sec.id === ev.editandoId ? nuevaSeccion : sec)
        : [...planificacion.secciones, nuevaSeccion]
    };

    // 1. Actualizar en el frontend
    setPlanificacion(estadoActualizado);
    
    // 2. Guardar en la BD
    sincronizarConBD(estadoActualizado);
    
    // 3. Si la sección activa llegó a 4 evaluaciones, generar su Plan de Acción automáticamente (solo con las de ESTA sección)
    const deEstaSeccion = estadoActualizado.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva && !tarjetasExcluidas.includes(s.id));
    if (deEstaSeccion.length === 4 && generarPDF) {
      agregarNotificacion('📄 Generando Plan de Acción...');
      const url = await generarPDF(deEstaSeccion);
      if (url) agregarNotificacion('✅ Plan de Acción generado (4 evaluaciones).');
    }
    
    agregarNotificacion(`✅ ${tipo} "${ev.materia}" guardada.`);
    limpiar(); 
    setVista('planificacion'); 
    setScrollToSections(true);
  };
  
  const guardarEvaluacion1 = () => guardarEval(evaluacion1, 'Evaluación 1', 'eval1', limpiarEvaluacion1, setEvaluacion1);
  const guardarEvaluacion2 = () => guardarEval(evaluacion2, 'Evaluación 2', 'eval2', limpiarEvaluacion2, setEvaluacion2);
  const guardarEvaluacion3 = () => guardarEval(evaluacion3, 'Evaluación 3', 'eval3', limpiarEvaluacion3, setEvaluacion3);
  const guardarEvaluacion4 = () => guardarEval(evaluacion4, 'Evaluación 4', 'eval4', limpiarEvaluacion4, setEvaluacion4);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (vista === 'planificacion') {
          if (evaluacion1.materia.trim()) guardarEvaluacion1();
          if (numEvaluaciones >= 2 && evaluacion2.materia.trim()) guardarEvaluacion2();
          if (numEvaluaciones >= 3 && evaluacion3.materia.trim()) guardarEvaluacion3();
          if (numEvaluaciones >= 4 && evaluacion4.materia.trim()) guardarEvaluacion4();
          agregarNotificacion('💾 Evaluaciones guardadas con Ctrl+S');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vista, numEvaluaciones, evaluacion1, evaluacion2, evaluacion3, evaluacion4]);

  const puedeAdministrar = usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN';
  const esSuperadmin = usuario?.rol === 'SUPERADMIN';
  // Si un USUARIO intenta llegar a una vista de administración (ej. por el chat), se le devuelve al Dashboard
  useEffect(() => { if (!puedeAdministrar && vista === 'usuarios') { reemplazarHistorial.current = true; setVista('estadisticas'); } }, [puedeAdministrar, vista]);
  useEffect(() => { if (!esSuperadmin && (vista === 'actividad' || vista === 'sistema')) { reemplazarHistorial.current = true; setVista('estadisticas'); } }, [esSuperadmin, vista]);
  // Avisos de la campanita y contadores de las pestañas (useAvisosProfesor.ts)
  const { borrarOpiniones, marcarObservacionLeida, marcarOpinionesVistas, observaciones, opiniones, solicitudesEstudiantes, solicitudesPendientes } = useAvisosProfesor({ usuario, vista, puedeAdministrar, esSuperadmin, agregarNotificacion });
  // Pestañas ordenadas por rol. 'admin' = supervisión del sistema; 'trabajo' = el espacio propio de la persona.
  // El superadmin no tiene la pestaña Planificador: lo abre desde el ícono del chat, junto a la configuración del agente.
  type Pestana = { id: 'planificacion' | 'estadisticas' | 'estudiantes' | 'usuarios' | 'actividad' | 'papelera' | 'calendario'; label: string; icon: any; grupo: 'admin' | 'trabajo'; badge?: number };
  const tabDashboard: Pestana = { id: 'estadisticas', label: 'Dashboard', icon: BarChart3, grupo: puedeAdministrar ? 'admin' : 'trabajo' };
  const tabPlanificador: Pestana = { id: 'planificacion', label: 'Planificador', icon: ClipboardList, grupo: 'trabajo' };
  const tabEstudiantes: Pestana = { id: 'estudiantes', label: 'Estudiantes', icon: Users, grupo: 'trabajo', badge: solicitudesEstudiantes };
  const tabPapelera: Pestana = { id: 'papelera', label: 'Papelera', icon: Trash2, grupo: 'trabajo' };
  const tabUsuarios: Pestana = { id: 'usuarios', label: 'Usuarios', icon: UserCog, grupo: 'admin', badge: solicitudesPendientes };
  const tabActividad: Pestana = { id: 'actividad', label: 'Actividad', icon: Activity, grupo: 'admin' };
  const tabCalendario: Pestana = { id: 'calendario', label: 'Calendario', icon: CalendarDays, grupo: 'trabajo' };
  const tabs: Pestana[] = esSuperadmin
    ? [tabDashboard, tabUsuarios, tabActividad, tabCalendario, tabEstudiantes, tabPapelera]
    : puedeAdministrar
      ? [tabDashboard, tabUsuarios, tabPlanificador, tabCalendario, tabEstudiantes, tabPapelera]
      : [tabDashboard, tabPlanificador, tabCalendario, tabEstudiantes, tabPapelera];

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <style>{` input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } .sin-barra { scrollbar-width: none; } .sin-barra::-webkit-scrollbar { display: none; } `}</style>
      <div className="@container px-2 sm:px-4 py-2 sm:py-3 border-b border-[color:var(--c-282a3f)] flex flex-wrap @4xl:flex-nowrap items-center gap-x-2 gap-y-2 bg-[color:var(--c-161722)] flex-shrink-0">
        <AnimatePresence initial={false}>
          {!chatAbierto && onAbrirChat && (
            <motion.div key="abrir-chat" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0 flex items-center gap-2 overflow-hidden">
              <Tooltip text="Mostrar chat (Ctrl+B)" lado="abajo">
                <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={onAbrirChat} aria-label="Mostrar el chat" className="group/abrir w-9 h-9 flex items-center justify-center rounded-xl border border-[color:var(--c-818cf8)]/25 bg-gradient-to-br from-[color:var(--c-818cf8)]/15 to-[color:var(--c-6366f1)]/5 text-[color:var(--c-a5b4fc)] hover:text-white hover:border-[color:var(--c-818cf8)]/60 hover:from-[color:var(--c-818cf8)]/40 hover:to-[color:var(--c-6366f1)]/25 hover:shadow-lg hover:shadow-[color:var(--c-818cf8)]/25 transition-all">
                  <PanelLeftOpen className="w-[18px] h-[18px] transition-transform duration-200 group-hover/abrir:translate-x-0.5" />
                </motion.button>
              </Tooltip>
              <span className="w-px h-6 bg-[color:var(--c-313248)]" aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
        <div data-tutorial="pestanas" className="order-last basis-full @4xl:order-none @4xl:basis-auto flex-1 min-w-0 flex items-center gap-1 md:gap-2 overflow-x-auto sin-barra -mx-1 px-1 @4xl:mx-0 @4xl:px-0">
        {tabs.map((tab, i) => (<div key={tab.id} className="flex items-center gap-1 md:gap-2 flex-shrink-0">{i > 0 && tabs[i - 1].grupo !== tab.grupo && (<span className="w-px h-6 bg-[color:var(--c-313248)] mx-1" aria-hidden="true" />)}<motion.button onClick={() => setVista(tab.id)} title={tab.label} aria-label={tab.label} className={`relative flex items-center gap-1.5 px-2.5 @5xl:px-3.5 py-2 rounded-xl text-[13px] @5xl:text-sm font-medium transition-all duration-300 font-['Inter'] whitespace-nowrap ${vista === tab.id ? 'text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/10' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]'}`}>{vista === tab.id && (<motion.div layoutId="activeTab" className="absolute inset-0 bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />)}<tab.icon className={`relative z-10 w-4 h-4 transition-colors ${vista === tab.id ? 'text-[color:var(--c-818cf8)]' : ''}`} /><span className="relative z-10">{tab.label}</span>{(tab.badge ?? 0) > 0 && (<span className="relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{tab.badge}</span>)}</motion.button></div>))}
        </div>
        {/* Botón de configuración junto a la campanita */}
        <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2 ml-auto">
          {onAbrirMateria && onNuevaMateria && (
            <div data-tutorial="materia" className="flex items-center"><SelectorMateria materias={materias} actualId={materiaActivaId} actualNombre={planificacion.materia} onAbrir={onAbrirMateria} onNueva={onNuevaMateria} onRenombrar={(nombre) => { setPlanificacion(prev => ({ ...prev, materia: nombre })); agregarNotificacion(`✏️ La materia ahora se llama «${nombre}».`); }} /></div>
          )}
          {onTutorial && (
            <Tooltip text="Ver el tutorial" lado="abajo">
              <button data-tutorial="ayuda" onClick={onTutorial} aria-label="Ver el tutorial" className="flex items-center justify-center w-9 h-9 rounded-xl text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-1d1e2e)] transition-colors">
                <CircleHelp className="w-[18px] h-[18px]" />
              </button>
            </Tooltip>
          )}
          <BotonTema />
          <CampanitaNotificacionesFlotante notificaciones={notificaciones} setNotificaciones={setNotificaciones} campanaActiva={campanaActiva} setCampanaActiva={setCampanaActiva} />
          {usuario && (
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[color:var(--c-282a3f)]">
              <Tooltip text="Mi perfil">
                <button onClick={() => setVista('perfil')} className={`flex items-center gap-2 px-2 py-1 rounded-xl transition-colors ${vista === 'perfil' ? 'bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20' : 'hover:bg-[color:var(--c-1d1e2e)] border border-transparent'}`}>
                  <User className="w-4 h-4 text-[color:var(--c-8a8b9e)] md:hidden" />
                  <div className="hidden md:flex flex-col items-end leading-tight">
                    <span className="text-xs font-medium text-[color:var(--c-d0d0da)] max-w-[140px] truncate">{usuario.nombre}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${COLOR_TEXTO_ROL[usuario.rol] || 'text-[color:var(--c-818cf8)]'}`}>{usuario.rol}</span>
                  </div>
                </button>
              </Tooltip>
              <Tooltip text="Cerrar sesión">
                <button onClick={() => onLogout && onLogout()} className="p-2 text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut className="w-4 h-4" /></button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-[color:var(--c-161722)]">
        <AnimatePresence mode="wait">
          {vista === 'calendario' && (
            <motion.div key="calendario" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto">
              <CalendarioPanel
                secciones={planificacion.secciones}
                materia={planificacion.materia || 'Asignatura'}
                onCambiarFecha={cambiarFechaEvaluacion}
                onCambiarEstado={cambiarEstadoEvaluacion}
                onIrAPlanificador={(s: SeccionExamen) => { EVAL_POR_ABRIR.id = s.id; setSeccionActiva((s.grupoSeccion || 'A').toUpperCase()); setVista('planificacion'); }}
                agregarNotificacion={agregarNotificacion}
              />
            </motion.div>
          )}
          {vista === 'estadisticas' && (<motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><DashboardPorRol planificacion={planificacion} usuario={usuario} onMiTrabajo={() => { if (typeof window !== 'undefined' && window.innerWidth >= 768) onAbrirChat?.(); }} /></motion.div>)}
          {vista === 'planificacion' && (
            <motion.div key="plan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-5 max-w-5xl mx-auto">
                <ObservacionesRecibidas items={observaciones} onLeer={marcarObservacionLeida} />
                <OpinionesEstudiantes items={opiniones} onVistas={marcarOpinionesVistas} onBorrar={borrarOpiniones} />
                {/* Guía de primeros pasos: solo mientras falten estudiantes o evaluaciones en la sección */}
                {datosCargados && estudiantesSeccion !== null && (estudiantesSeccion === 0 || seccionesFiltradas.length === 0) && !guiasCerradas.includes(seccionActiva) && (
                  <div className="rounded-2xl border border-[color:var(--c-818cf8)]/25 bg-gradient-to-br from-[color:var(--c-22234a)]/70 to-[color:var(--c-1d1e2e)] p-5">
                    <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /><h3 className="text-sm font-semibold text-[color:var(--c-blanco)] flex-1">Primeros pasos · Sección {seccionActiva}</h3><button type="button" onClick={cerrarGuia} aria-label="Cerrar la guía" title="Cerrar la guía" className="p-1 -mr-1 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button></div>
                    <p className="text-xs text-[color:var(--c-9a9bb0)] mt-1">Tres pasos y tus estudiantes tendrán su plan de evaluación.</p>
                    <ol className="mt-4 grid gap-2 sm:grid-cols-3">
                      {[
                        { hecho: (estudiantesSeccion ?? 0) > 0, titulo: 'Agrega tus estudiantes', texto: (estudiantesSeccion ?? 0) > 0 ? `${estudiantesSeccion} en la sección` : 'Uno por uno o desde Excel', boton: 'Ir a Estudiantes', hacer: () => setVista('estudiantes') },
                        { hecho: seccionesFiltradas.length > 0, titulo: 'Crea tu plan', texto: seccionesFiltradas.length > 0 ? `${seccionesFiltradas.length} evaluación(es)` : 'Pídeselo a EvaPlanner: «Hazme un plan de 4 evaluaciones»', boton: 'Abrir el chat', hacer: () => onAbrirChat?.() },
                        { hecho: false, titulo: 'Envíales el plan', texto: 'Genera el Plan de Acción y pulsa enviar: cada estudiante recibe el enlace a su página personal.', boton: '', hacer: () => {} },
                      ].map((paso, i) => (
                        <li key={paso.titulo} className={`rounded-xl border p-3 flex flex-col gap-2 ${paso.hecho ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-[color:var(--c-313248)] bg-[color:var(--c-1b1c2b)]'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${paso.hecho ? 'bg-emerald-500 text-white' : 'bg-[color:var(--c-2c2d42)] text-[color:var(--c-a5b4fc)]'}`}>{paso.hecho ? '✓' : i + 1}</span>
                            <span className={`text-[13px] font-medium ${paso.hecho ? 'text-emerald-200' : 'text-[color:var(--c-e0e0ec)]'}`}>{paso.titulo}</span>
                          </div>
                          <p className="text-[11px] text-[color:var(--c-8a8b9e)] leading-snug flex-1">{paso.texto}</p>
                          {!paso.hecho && paso.boton && <button type="button" onClick={paso.hacer} className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)] border border-[color:var(--c-818cf8)]/30 hover:bg-[color:var(--c-818cf8)]/25 disabled:opacity-40 disabled:cursor-not-allowed">{paso.boton}</button>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div ref={tarjetaRef} data-tutorial="formularios">
                {!mostrarFormularios ? (
                  <button type="button" onClick={() => setVerFormularios(true)} className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--c-3a3b52)] bg-[color:var(--c-1b1c2b)]/60 px-5 py-4 text-left hover:border-[color:var(--c-818cf8)]/50 hover:bg-[color:var(--c-1f2035)] transition-colors">
                    <span className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/25 flex items-center justify-center"><Pencil className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></span>
                    <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-[color:var(--c-e0e0ec)]">Crear o editar evaluaciones a mano</span><span className="block text-xs text-[color:var(--c-8a8b9e)]">O pídeselo a EvaPlanner en el chat: las propuestas aparecen aquí solas.</span></span>
                    <ChevronDown className="w-4 h-4 text-[color:var(--c-8a8b9e)]" />
                  </button>
                ) : (<>
                {seccionesFiltradas.length > 0 && !formulariosConContenido && (
                  <div className="flex justify-end mb-1"><button type="button" onClick={() => setVerFormularios(false)} className="text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] flex items-center gap-1"><ChevronUp className="w-3.5 h-3.5" />Ocultar formularios</button></div>
                )}
                <EvaluacionesApiladas 
                evaluacion1={evaluacion1} setEvaluacion1={setEvaluacion1} guardarEvaluacion1={guardarEvaluacion1} limpiarEvaluacion1={limpiarEvaluacion1}
                evaluacion2={evaluacion2} setEvaluacion2={setEvaluacion2} guardarEvaluacion2={guardarEvaluacion2} limpiarEvaluacion2={limpiarEvaluacion2}
                evaluacion3={evaluacion3} setEvaluacion3={setEvaluacion3} guardarEvaluacion3={guardarEvaluacion3} limpiarEvaluacion3={limpiarEvaluacion3}
                evaluacion4={evaluacion4} setEvaluacion4={setEvaluacion4} guardarEvaluacion4={guardarEvaluacion4} limpiarEvaluacion4={limpiarEvaluacion4}
                numEvaluaciones={numEvaluaciones} setNumEvaluaciones={setNumEvaluaciones}
                justFilled1={glow1} justFilled2={glow2} justFilled3={glow3} justFilled4={glow4}
                totalEstudiantes={totalEstudiantes}
              />
                </>)}
                </div>
              <div ref={seccionesGuardadasRef} data-tutorial="guardadas" className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-sm font-medium text-[color:var(--c-9090a8)] uppercase tracking-wider font-['Inter']">
                      Evaluaciones guardadas (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={`${seccionActiva}-${seccionesFiltradas.length}`}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="inline-block"
                        >
                          {seccionesFiltradas.length}
                        </motion.span>
                      </AnimatePresence>
                      )
                    </h2>
                    {/* Pestañas de Sección/Paralelo (grupos de estudiantes que ven la materia en común) */}
                    <div data-tutorial="secciones" className="flex items-center gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1">
                      {seccionesDisponibles.map((letra) => (
                        <Tooltip key={letra} text={`Sección ${letra}`}>
                          <button
                            type="button"
                            onClick={() => cambiarSeccionActiva(letra)}
                            className={`relative w-7 h-7 rounded-md text-xs font-semibold transition-colors duration-200 ${seccionActiva === letra ? 'text-[color:var(--c-blanco)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-232430)]'}`}
                          >
                            {seccionActiva === letra && (
                              <motion.span
                                layoutId="pill-seccion-activa"
                                className="absolute inset-0 bg-[color:var(--c-818cf8)] rounded-md shadow-md z-0"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                            <span className="relative z-10">{letra}</span>
                          </button>
                        </Tooltip>
                      ))}
                      <Tooltip text="Añadir nueva sección">
                        <button
                          type="button"
                          onClick={agregarNuevaSeccion}
                          className="w-7 h-7 rounded-md text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-232430)] transition-all flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text={seccionesDisponibles.length <= 1 ? 'Debe existir al menos una sección' : `Eliminar Sección ${seccionActiva}`}>
                        <button
                          type="button"
                          onClick={eliminarSeccionActiva}
                          disabled={seccionesDisponibles.length <= 1}
                          className="w-7 h-7 rounded-md text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--c-8a8b9e)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                    {materiaActivaId && (
                      <Tooltip text={`Código para que los estudiantes se unan a la Sección ${seccionActiva}`}>
                        <button type="button" data-tutorial="codigo-clase" onClick={() => setVerCodigo(true)} className="relative h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/20">
                          <KeyRound className="w-3.5 h-3.5" />Código de clase
                          {(solicitudesSeccion[seccionActiva] || 0) > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center" title="Solicitudes por aceptar en Estudiantes">{solicitudesSeccion[seccionActiva]}</span>}
                        </button>
                      </Tooltip>
                    )}
                    <AnimatePresence>
                      {verCodigo && materiaActivaId && (
                        <VentanaFlotante onCerrar={() => setVerCodigo(false)} ancho="max-w-xl">
                          <CodigoClase materiaId={materiaActivaId} materia={planificacion.materia} letra={seccionActiva} onCerrar={() => setVerCodigo(false)} notificar={agregarNotificacion} />
                        </VentanaFlotante>
                      )}
                    </AnimatePresence>
                    {seccionesFiltradas.length > 0 && (
                      <Tooltip text={`Buscar videos y páginas para las evaluaciones de la Sección ${seccionActiva} que aún no tienen recursos`}>
                        <button type="button" onClick={recursosParaTodas} disabled={!!llenandoRecursos}
                          className="h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors bg-[color:var(--c-161722)] border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)] hover:border-[color:var(--c-818cf8)]/50 disabled:opacity-80">
                          {llenandoRecursos ? <span className="w-3.5 h-3.5 border-2 border-[color:var(--c-818cf8)]/40 border-t-[color:var(--c-818cf8)] rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[color:var(--c-a5b4fc)]" />}
                          {llenandoRecursos ? `Buscando ${llenandoRecursos.hechas}/${llenandoRecursos.total}…` : 'Recursos para todas'}
                        </button>
                      </Tooltip>
                    )}
                    {seccionesParaPlan.length > 0 && (
                      <div className="relative">
                        <Tooltip text={`Copiar el plan de la Sección ${seccionActiva} a otra sección`}>
                          <button type="button" onClick={() => (copiaAbierta ? setCopiaAbierta(false) : abrirCopia())}
                            className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${copiaAbierta ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/50 text-[color:var(--c-c7d2fe)]' : 'bg-[color:var(--c-161722)] border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)] hover:border-[color:var(--c-818cf8)]/50'}`}>
                            <Copy className="w-3.5 h-3.5" />Copiar a…
                          </button>
                        </Tooltip>
                        <AnimatePresence>
                          {copiaAbierta && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                              className="absolute left-0 top-11 z-40 w-[290px] max-w-[calc(100vw-32px)] bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-xl shadow-2xl p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-[color:var(--c-blanco)]">Copiar plan de la Sección {seccionActiva}</p>
                                  <p className="text-[11px] text-[color:var(--c-8a8b9e)] mt-0.5">{seccionesParaPlan.length} evaluación(es) marcadas con el círculo morado</p>
                                </div>
                                <button type="button" onClick={() => setCopiaAbierta(false)} className="text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)]"><X className="w-4 h-4" /></button>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] mb-1.5">Copiar a</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {[...seccionesDisponibles.filter(l => l !== seccionActiva), ...(siguienteLetraLibre ? [siguienteLetraLibre] : [])].map(l => {
                                    const nueva = !seccionesDisponibles.includes(l);
                                    const cuantas = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === l).length;
                                    return (
                                      <button key={l} type="button" onClick={() => setCopiaDestino(l)} title={nueva ? 'Crea esta sección nueva' : `${cuantas} evaluación(es) ahora`}
                                        className={`h-8 px-2.5 rounded-md border text-xs font-semibold transition-colors ${copiaDestino === l ? 'bg-[color:var(--c-818cf8)] border-[color:var(--c-818cf8)] text-white' : 'bg-[color:var(--c-232430)] border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)]'}`}>
                                        {nueva ? `+ ${l} (nueva)` : `${l}${cuantas ? ` · ${cuantas}` : ''}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {copiaDestino && planificacion.secciones.some((s: SeccionExamen) => (s.grupoSeccion || 'A') === copiaDestino) && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] mb-1.5">La Sección {copiaDestino} ya tiene evaluaciones</p>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {([['agregar', 'Agregar'], ['reemplazar', 'Reemplazar']] as const).map(([v, t]) => (
                                      <button key={v} type="button" onClick={() => setCopiaModo(v)}
                                        className={`h-8 rounded-md border text-xs font-medium transition-colors ${copiaModo === v ? (v === 'reemplazar' ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/50 text-[color:var(--c-c7d2fe)]') : 'bg-[color:var(--c-232430)] border-[color:var(--c-313248)] text-[color:var(--c-a0a0b8)] hover:text-[color:var(--c-blanco)]'}`}>{t}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <label className="block">
                                <span className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)]">Correr las fechas (días)</span>
                                <div className="mt-1.5 flex items-center gap-2">
                                  <input type="number" min={-365} max={365} value={copiaDias} onChange={(e) => setCopiaDias(e.target.value)}
                                    className="w-20 bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--c-e0e0ec)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />
                                  <span className="text-[11px] text-[color:var(--c-8a8b9e)]">0 = mismas fechas · 1 = un día después</span>
                                </div>
                              </label>
                              <button type="button" onClick={copiarPlanASeccion} disabled={!copiaDestino}
                                className="w-full h-9 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors">
                                <Copy className="w-3.5 h-3.5" />Copiar a la Sección {copiaDestino || '…'}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {seccionesFiltradas.length > 0 && (
                      <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${seccionesParaPlan.length === seccionesFiltradas.length ? 'bg-[color:var(--c-a855f7)]/10 text-[color:var(--c-c084fc)] border-[color:var(--c-a855f7)]/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`} title="Las tarjetas con el círculo morado entran en el Plan de Acción">
                        {seccionesParaPlan.length} de {seccionesFiltradas.length} en el plan
                      </span>
                    )}
                    {seccionesFiltradas.filter((s: SeccionExamen) => estadoVisibleEvaluacion(s).porConfirmar).length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-full border font-medium bg-amber-500/10 text-amber-300 border-amber-500/30" title="Su fecha ya pasó: indica si se realizó, se reprogramó o se canceló (clic en la etiqueta de la tarjeta)">
                        ⚠ {seccionesFiltradas.filter((s: SeccionExamen) => estadoVisibleEvaluacion(s).porConfirmar).length} por confirmar
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2" data-tutorial="plan-accion">
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generarPlanAccion(seccionesParaPlan)}
                        disabled={seccionesParaPlan.length === 0 || cargandoPdf} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          seccionesParaPlan.length === 0 || cargandoPdf 
                            ? 'bg-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] cursor-not-allowed' 
                            : 'bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white shadow-md'
                        }`}
                      >
                        {cargandoPdf ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-t-white rounded-full animate-spin"></div>
                            Generando...
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            Generar Plan de Acción
                          </>
                        )}
                      </motion.button>
                  </div>
                </div>
                <AlertasPlan secciones={seccionesFiltradas} />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={seccionActiva}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <DragDropSecciones
                      secciones={seccionesFiltradas} onReorder={(nuevoOrden: SeccionExamen[]) => setPlanificacion(prev => { let i = 0; const nuevasSecciones = prev.secciones.map(s => (s.grupoSeccion || 'A') === seccionActiva ? nuevoOrden[i++] : s); return { ...prev, secciones: nuevasSecciones }; })} onEdit={cargarSeccionParaEditar} onDelete={(id: string) => { 
  const estadoActualizado = { ...planificacion, secciones: planificacion.secciones.filter(s => s.id !== id) };
  setPlanificacion(estadoActualizado);
  sincronizarConBD(estadoActualizado);
  setTarjetasExcluidas(prev => prev.filter(x => x !== id));
  agregarNotificacion(`🗑️ Evaluación eliminada de la BD.`); 
}}
                      selectedIds={idsSeleccionados} onToggleSelect={toggleTarjetaSeleccionada} seccionesPlan={seccionesParaPlan} profesor={usuario?.nombre} seccionActiva={seccionActiva} onCambiarEstado={cambiarEstadoEvaluacion} onGuardarRubrica={guardarRubricaEvaluacion} onGuardarRecursos={guardarRecursosEvaluacion} onEstadoLocal={(id: string, estado: string) => setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === id ? { ...s, estado } : s) }))} onExamenLocal={(id: string, examen: Examen | null) => setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === id ? { ...s, examen } : s) }))}
                      mostrarMenuEnvio={mostrarMenuEnvio} setMostrarMenuEnvio={setMostrarMenuEnvio} scrollToTarjeta={scrollToTarjeta} planificacion={planificacion} 
                      mensajeWhatsApp={mensajeWhatsApp} setMensajeWhatsApp={setMensajeWhatsApp} enviarA={enviarA} setEnviarA={setEnviarA} filtroEnvio={filtroEnvio} setFiltroEnvio={setFiltroEnvio} pdfUrl={pdfUrlLocal}
  pdfAbierto={pdfAbiertoLocal}
  setPdfAbierto={setPdfAbierto}
  setPdfUrl={setPdfUrl}
  agregarNotificacion={agregarNotificacion}
  generarPDF={generarPDF}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              {planificacion.comentariosAgente.length > 0 && (<div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-xl"><h2 className="text-sm font-medium text-[color:var(--c-9090a8)] uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']"><Sparkles className="w-4 h-4 text-[color:var(--c-818cf8)]" /> Feedback del agente</h2><div className="space-y-2">{planificacion.comentariosAgente.slice(-3).map(c => (<motion.p key={c.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-base text-[color:var(--c-9090a4)] leading-relaxed font-['Inter']">{c.mensaje}</motion.p>))}</div></div>)}
            </motion.div>
          )}
          {vista === 'estudiantes' && (<motion.div key="estudiantes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><EstudiantesPanel /></motion.div>)}
          {vista === 'papelera' && (<motion.div key="papelera" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto"><PapeleraPanel usuario={usuario} /></motion.div>)}
          {vista === 'sistema' && esSuperadmin && (<motion.div key="sistema" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto"><ConfigSistemaPanel onGuardada={(c) => onConfigActualizada && onConfigActualizada(c)} /></motion.div>)}
          {vista === 'actividad' && esSuperadmin && (<motion.div key="actividad" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><ActividadPanel /></motion.div>)}
          {vista === 'perfil' && (<motion.div key="perfil" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto"><PerfilPanel usuario={usuario} onActualizado={onUsuarioActualizado} /></motion.div>)}
          {vista === 'usuarios' && puedeAdministrar && (<motion.div key="usuarios" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><UsuariosPanel /></motion.div>)}
        </AnimatePresence>
      </div>
    </div>
  );
});
