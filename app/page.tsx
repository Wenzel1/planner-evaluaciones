// app/page.tsx - Pantalla principal del Planificador. Cada panel vive en components/planificador/

'use client';

import Tutorial, { marcarTutorialVisto, pasosDeVista, pasosTutorial, tutorialVisto } from '@/components/Tutorial';
import { apiEstudiantes } from '@/lib/api';
import { normalizarExamen } from '@/lib/examen';
import { normalizarRubrica } from '@/lib/rubrica';
import { useEffect, useRef, useState } from 'react';
import { AgentePanel } from '@/components/planificador/AgentePanel';
import { CambioPasswordObligatorio } from '@/components/planificador/Cuenta';
import { Dashboard } from '@/components/planificador/Dashboard';
import { PanelDerecho } from '@/components/planificador/PanelDerecho';
import { ConfigCliente, MateriaCorta, PanelDerechoHandle, PlanificacionExamen, PropuestaEvaluacion, SeccionExamen, UsuarioSesion } from '@/components/planificador/tipos';
import { BandaRol, useAnchoPantalla } from '@/components/planificador/ui';
import { CANAL, CONFIG_CLIENTE_DEFECTO, LIMITES, buscarPorNombre, planVisto } from '@/components/planificador/utilidades';
import dynamic from 'next/dynamic';

// Se descargan solo cuando se abren (la primera carga del Planificador queda mas liviana)
const BienvenidaProfesor = dynamic(() => import('@/components/BienvenidaProfesor'));


function aplicarConfig(c: ConfigCliente) { LIMITES.grupos = c.planificador.maxGrupos; LIMITES.personas = c.planificador.maxPersonasPorGrupo; }
const CLAVE_MATERIA = 'materiaActiva'; // última materia abierta en este navegador

// ============================================
// APP PRINCIPAL
// ============================================
export default function PlanificadorExamenes() {
  // ===== SESIÓN / ROLES =====
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [configSistema, setConfigSistema] = useState<ConfigCliente | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);
  const [sinMaterias, setSinMaterias] = useState(false); // profesor nuevo: primero elige su materia
  const aplicarYGuardarConfig = (c: ConfigCliente) => { aplicarConfig(c); setConfigSistema(c); };
  useEffect(() => {
    if (!usuario) return;
    fetch('/api/configuracion').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.canal === 'correo' || d?.canal === 'whatsapp') CANAL.valor = d.canal; return d; }).then(d => aplicarYGuardarConfig(d?.config ?? CONFIG_CLIENTE_DEFECTO)).catch(() => aplicarYGuardarConfig(CONFIG_CLIENTE_DEFECTO));
  }, [usuario?.id]);
  useEffect(() => {
    // Si la sesión expira mientras se usa la app, cualquier llamada a /api responde 401 → volver al login
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/login')) window.location.replace('/login?sesion=expirada');
      return res;
    };
    fetchOriginal('/api/auth/me').then(r => (r.ok ? r.json() : Promise.reject())).then((u: UsuarioSesion) => { setUsuario(u); setVistaActual(u.rol === 'USUARIO' ? 'planificacion' : 'estadisticas'); if (u.rol !== 'SUPERADMIN' && window.innerWidth >= 768) setAgenteExpandido(true); }).catch(() => { window.location.href = '/login'; });
    return () => { window.fetch = fetchOriginal; };
  }, []);
  const cerrarSesion = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.replace('/login'); } // replace: "atrás" no vuelve a la app cerrada
  };
  // Si el navegador muestra la app desde su memoria (bfcache) después de cerrar sesión, se vuelve a comprobar la sesión
  useEffect(() => {
    const alMostrar = (e: PageTransitionEvent) => { if (e.persisted) fetch('/api/auth/me').then(r => { if (!r.ok) window.location.replace('/login'); }).catch(() => {}); };
    window.addEventListener('pageshow', alMostrar);
    return () => window.removeEventListener('pageshow', alMostrar);
  }, []);
  // ===== FIN SESIÓN / ROLES =====
  // ===== INICIO CONEXIÓN BD =====
const [planificacionId, setPlanificacionId] = useState<string | null>(null);
const [materias, setMaterias] = useState<MateriaCorta[]>([]);
const [materiaActivaId, setMateriaActivaId] = useState<string | null>(null);
// Cambiar de materia: se guarda lo pendiente, se recuerda la elección y se recarga (así nada del plan anterior se mezcla)
const abrirMateria = async (id: string) => {
  try { await panelDerechoRef.current?.guardarAhora(); } catch { /* si falla el guardado, igual se cambia */ }
  try { localStorage.setItem(CLAVE_MATERIA, id); } catch { /* sin almacenamiento */ }
  // Se marca en la cuenta como la última abierta (así el teléfono y la computadora abren la misma)
  await fetch('/api/materias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, abrir: true }) }).catch(() => {});
  window.location.reload();
};
const crearMateria = async (nombre: string, secciones: string[] = ['A']) => {
  const r = await fetch('/api/materias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.slice(0, 120), codigo: `MAT-${Date.now()}`, secciones }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error(d.error || 'No se pudo crear la materia.');
  await abrirMateria(d.id);
};
// Para el agente: abre una materia por nombre (o la crea si se pidió)
const cambiarMateriaPorNombre = async (nombre: string, crear: boolean): Promise<string> => {
  const m = buscarPorNombre<MateriaCorta>(materias, nombre);
  if (m === 'varios') throw new Error(`Hay varias materias parecidas a «${nombre}». Escribe el nombre completo.`);
  if (m) { if (m.id === materiaActivaId) return `«${m.nombre}» ya es la materia abierta`; await abrirMateria(m.id); return `Abriendo «${m.nombre}»…`; }
  if (!crear) throw new Error(`No tienes una materia llamada «${nombre}».${materias.length ? ` Tus materias: ${materias.map(x => x.nombre).join(', ')}.` : ''}`);
  await crearMateria(nombre);
  return `Creando la materia «${nombre}»…`;
};
// ===== FIN CONEXIÓN BD =====
  // El chat empieza abierto en computador y cerrado en celular
  // El chat empieza cerrado; al cargar la sesión se abre para todos menos el superadmin (y nunca solo en el celular)
  const [agenteExpandido, setAgenteExpandido] = useState<boolean>(false);
  const anchoPantalla = useAnchoPantalla();
  const esMovil = anchoPantalla < 768;
  // Ancho del chat: el profesor lo ajusta arrastrando la barra divisora (se recuerda en este navegador)
  const [anchoElegido, setAnchoElegido] = useState<number | null>(null);
  useEffect(() => { try { const n = Number(localStorage.getItem('anchoChat')); if (n > 0) setAnchoElegido(n); } catch {} }, []);
  const [arrastrando, setArrastrando] = useState(false);
  const maxChat = Math.max(360, Math.min(1000, Math.round(anchoPantalla * 0.7)));
  const anchoChat = Math.min(maxChat, Math.max(340, anchoElegido ?? Math.min(640, Math.round(anchoPantalla * 0.45))));
  const empezarArrastre = (e: React.PointerEvent) => {
    e.preventDefault();
    setArrastrando(true);
    let ultimo = anchoChat;
    const mover = (ev: PointerEvent) => { ultimo = Math.min(maxChat, Math.max(340, Math.round(ev.clientX))); setAnchoElegido(ultimo); };
    const soltar = () => {
      setArrastrando(false);
      try { localStorage.setItem('anchoChat', String(ultimo)); } catch {}
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar);
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };
  const [propuestaPendiente, setPropuestaPendiente] = useState<PropuestaEvaluacion | null>(null);
  const [seccionPlanificador, setSeccionPlanificador] = useState<string>('A'); // sección (A, B, C...) abierta en el planificador
  const [vistaActual, setVistaActual] = useState<'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema' | 'calendario'>('estadisticas');
  const [planificacion, setPlanificacion] = useState<PlanificacionExamen>({ id: '1', version: 1, estado: 'borrador', fechaExamen: new Date(), tipoExamen: 'mixto', duracionMinutos: 0, materia: 'Ing Software', secciones: [], rubrica: [], comentariosAgente: [{ id: 'c1', tipo: 'info', mensaje: 'Sube un archivo o escribe en el chat para comenzar la planificación.', timestamp: new Date() }] });
    // CARGAR EVALUACIONES DESDE LA BD AL REFRESCAR
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        // 1. Buscar si ya existe una materia
        const pedir = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };
        let materias: any[] = [];
        for (let intento = 0; ; intento++) {
          try { materias = await pedir('/api/materias'); break; }
          catch (e) { if (intento >= 2) throw e; await new Promise(res => setTimeout(res, 1500 * (intento + 1))); }
        }
        if (!Array.isArray(materias) || materias.length === 0) { setSinMaterias(true); setDatosCargados(true); return; } // Primera vez: elige su materia en la bienvenida
        setMaterias(materias.map((m: any) => ({ id: m.id, nombre: m.nombre })).sort((a: MateriaCorta, b: MateriaCorta) => a.nombre.localeCompare(b.nombre)));

        // 2. Buscar la materia "Ing Software" o usar la primera
        // Se abre la materia con actividad más reciente (antes se buscaba una llamada 'Ing Software')
        // La materia que se abre es la última usada en la cuenta (abierta o editada), así la computadora y el teléfono muestran la misma
        const t = (x: any) => (x ? new Date(x).getTime() || 0 : 0);
        const actividadDe = (m: any) => Math.max(t(m.updatedAt), t(m.planificaciones?.[0]?.updatedAt), t(m.planificaciones?.[0]?.createdAt), t(m.createdAt));
        const materiaActual = [...materias].sort((a: any, b: any) => actividadDe(b) - actividadDe(a))[0];
        try { localStorage.setItem(CLAVE_MATERIA, materiaActual.id); } catch { /* sin almacenamiento */ }
        setMateriaActivaId(materiaActual.id);
        // Materia nueva, todavía sin plan: se muestra con su nombre (el primer guardado crea su plan)
        setPlanificacion(prev => ({ ...prev, materia: materiaActual.nombre || prev.materia, secciones: [] }));
        
        // 3. Buscar las planificaciones de esa materia
        const planes = await pedir(`/api/planificaciones?materiaId=${materiaActual.id}`);
        
        if (Array.isArray(planes) && planes.length > 0) {
          const ultimoPlan = planes[0];
          planVisto.en = ultimoPlan.updatedAt || null; // para no pisar cambios hechos en otra ventana
          
          // 4. Guardar el ID para futuras actualizaciones
          setPlanificacionId(ultimoPlan.id);
          
          // 5. Mapear los datos de la BD al formato del frontend
          setPlanificacion(prev => ({
            ...prev,
            materia: typeof ultimoPlan.materia === 'string' 
              ? ultimoPlan.materia 
              : ultimoPlan.materia?.nombre || prev.materia,
            estado: ultimoPlan.estado.toLowerCase() as any,
            tipoExamen: ultimoPlan.tipoExamen.toLowerCase() as any,
            fechaExamen: new Date(ultimoPlan.fechaExamen),
            duracionMinutos: ultimoPlan.duracionMinutos || 0,
            secciones: (ultimoPlan.evaluaciones || []).map((ev: any) => ({
              id: ev.id,
              nombre: ev.nombre,
              tipoPregunta: ev.tipoPregunta.toLowerCase(),
              peso: ev.peso,
              cantidadPreguntas: ev.cantidadPreguntas || 0,
              contenidosEvaluados: ev.contenidosEvaluados || [],
              nivelBloom: ev.nivelBloom.toLowerCase(),
              tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos,
              tipoActividad: ev.tipoActividad || undefined,
              descripcion: ev.descripcion || '',
              cantidadGrupos: ev.cantidadGrupos ?? undefined,
              personasPorGrupo: ev.personasPorGrupo ?? undefined,
              orden: ev.orden ?? undefined,
              enfoque: ev.enfoque || undefined,
              fecha: ev.fecha ? new Date(ev.fecha) : undefined,
              grupoSeccion: ev.grupoSeccion || 'A',
              estado: ev.estado || 'PROGRAMADA',
              rubrica: normalizarRubrica(ev.rubrica),
              examen: normalizarExamen(ev.examen),
              recursos: Array.isArray(ev.recursos) ? ev.recursos : null,
              abiertaManual: !!ev.abiertaManual,
              preparados: ev._count?.preparaciones ?? 0,
            })),
            rubrica: (ultimoPlan.rubrica || []).map((crit: any) => ({
              id: crit.id,
              nombre: crit.nombre,
              peso: crit.peso,
              descripcion: crit.descripcion || '',
              niveles: (crit.niveles || []).map((niv: any) => ({
                id: niv.id,
                nombre: niv.nombre,
                puntaje: niv.puntaje,
                descripcion: niv.descripcion || '',
              })),
            })),
          }));
        }
        setDatosCargados(true); // desde aquí los cambios del plan se guardan solos
      } catch (error) {
        // No se pudo leer el plan guardado: el guardado automático queda apagado para no crear una materia duplicada
        // ni pisar el plan real con uno vacío. Se avisa y basta con recargar.
        console.error('No se pudo cargar el plan:', error);
        setTimeout(() => agregarNotificacion('⚠️ No se pudo cargar tu plan guardado (problema de conexión). Recarga la página antes de hacer cambios: hasta entonces no se guardará nada.'), 800);
      }
    };
    
    cargarDatosIniciales();
  }, []); // El array vacío significa: "Ejecutar SOLO al cargar la página"
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfAbierto, setPdfAbierto] = useState(false);

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setAgenteExpandido(prev => !prev); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);

  // El chat y el resto de la pantalla usan las mismas notificaciones (las del panel derecho)
  const agregarNotificacion = (mensaje: string) => { if (panelDerechoRef.current) panelDerechoRef.current.notificar(mensaje); else console.log('📢 Notificación:', mensaje); };

  const generarPDF = async (secciones?: SeccionExamen[]): Promise<string | null> => {
    const seccionesParaPDF = secciones || planificacion.secciones;
    if (seccionesParaPDF.length === 0) { alert('No hay evaluaciones guardadas'); return null; }
    try { const response = await fetch('/api/plan-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ examenData: { seccion: seccionesParaPDF[0]?.grupoSeccion || null, profesor: usuario?.nombre || '', fechaExamen: planificacion.fechaExamen.toISOString(), materia: planificacion.materia || 'Asignatura', tipoExamen: planificacion.tipoExamen || 'mixto', duracionMinutos: planificacion.duracionMinutos || 0, secciones: seccionesParaPDF.map(sec => ({ nombre: sec.nombre, tipoActividad: sec.tipoActividad, tiempoEstimadoMinutos: sec.tiempoEstimadoMinutos, peso: sec.peso, cantidadGrupos: sec.cantidadGrupos, personasPorGrupo: sec.personasPorGrupo, descripcion: sec.descripcion, enfoque: sec.enfoque, nivelBloom: sec.nivelBloom, fecha: sec.fecha, rubrica: sec.rubrica ?? null })) } }) }); if (!response.ok || !(response.headers.get('content-type') || '').includes('pdf')) throw new Error('Error al generar PDF'); const blob = await response.blob(); const url = URL.createObjectURL(blob); setPdfUrl(url); setPdfAbierto(false); agregarNotificacion('📄 Plan de acción generado correctamente.'); return url; } catch (error) { console.error('Error al generar el PDF (se usará el plan visual local):', error); return null; }
  };

  const aceptarPropuesta = async () => { return { success: true }; };
  const panelDerechoRef = useRef<PanelDerechoHandle | null>(null);

  const [totalEstudiantesGlobal, setTotalEstudiantesGlobal] = useState(8);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await apiEstudiantes.listar();
        if (Array.isArray(data) && data.length > 0) setTotalEstudiantesGlobal(data.length);
      } catch {}
    };
    cargar();
  }, []);

  // Tutorial: se abre solo la primera vez que el profesor entra (en este navegador); "Omitir" o "Terminar" lo marcan como visto
  const [tutorialAbierto, setTutorialAbierto] = useState(false);
  const puedeVerTutorial = !!usuario && !usuario.debeCambiarPassword && usuario.rol !== 'SUPERADMIN';
  const abrirTutorial = () => { setVistaActual('planificacion'); if (!esMovil) setAgenteExpandido(true); setTutorialAbierto(true); };
  useEffect(() => {
    if (!puedeVerTutorial || !configSistema || !usuario || tutorialVisto(usuario.id) || sinMaterias) return;
    const t = setTimeout(abrirTutorial, 1200); // deja que la pantalla termine de cargar
    return () => clearTimeout(t);
  }, [puedeVerTutorial, !!configSistema, usuario?.id, sinMaterias]); // eslint-disable-line react-hooks/exhaustive-deps
  const cerrarTutorial = () => { setTutorialAbierto(false); if (usuario) marcarTutorialVisto(usuario.id); };
  // La primera vez que entra a Calendario, Estudiantes, Dashboard o Papelera: un recorrido corto de esa pestaña
  const [tourVista, setTourVista] = useState<string | null>(null);
  useEffect(() => {
    if (!usuario || tutorialAbierto || !tutorialVisto(usuario.id) || !pasosDeVista(vistaActual).length) return;
    const clave = `tutorialVista:${usuario.id}:${vistaActual}`;
    try { if (localStorage.getItem(clave)) return; } catch { return; }
    const t = setTimeout(() => setTourVista(vistaActual), 700);
    return () => clearTimeout(t);
  }, [vistaActual, tutorialAbierto, usuario?.id]);
  const cerrarTourVista = () => { if (usuario && tourVista) { try { localStorage.setItem(`tutorialVista:${usuario.id}:${tourVista}`, '1'); } catch { /* sin almacenamiento */ } } setTourVista(null); };

  // Hasta saber quién entró no se dibuja la interfaz (evita que las pestañas "salten" al cargar)
  if (!usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--c-161722)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[color:var(--c-313248)] border-t-[color:var(--c-818cf8)] rounded-full animate-spin" />
          <p className="text-xs text-[color:var(--c-8a8b9e)]">Cargando tu espacio de trabajo...</p>
        </div>
      </div>
    );
  }

  // Entró con una clave temporal: no puede usar el sistema hasta elegir una nueva
  if (usuario.debeCambiarPassword) return <CambioPasswordObligatorio usuario={usuario} onLogout={cerrarSesion} />;
  if (!configSistema) return (<div className="flex h-screen items-center justify-center bg-[color:var(--c-161722)]"><div className="w-8 h-8 border-2 border-[color:var(--c-313248)] border-t-[color:var(--c-818cf8)] rounded-full animate-spin" /></div>);

  return (
    <div className="fixed inset-0 flex flex-col bg-[color:var(--c-161722)] text-[color:var(--c-b0b0c0)] overflow-hidden">
      <style>{` @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); * { font-family: 'Inter', system-ui, -apple-system, sans-serif; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #414258; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } body { scrollbar-width: thin; scrollbar-color: #313248 #161722; } @media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } } `}</style>
      <BandaRol rol={usuario.rol} />
      {sinMaterias && usuario && usuario.rol !== 'SUPERADMIN' && (
        <BienvenidaProfesor nombre={usuario.nombre} onCrear={(m, secciones) => crearMateria(m, secciones)} />
      )}
      {tutorialAbierto && (
        <Tutorial pasos={pasosTutorial(usuario.nombre, esMovil)} onTerminar={cerrarTutorial}
          alCambiarPaso={(p) => { const delChat = ['agente', 'divisor', 'chat-herramientas', 'chat-entrada'].includes(p.objetivo || ''); if (p.objetivo && !delChat && !['notificaciones', 'tema', 'pestanas', 'ayuda'].includes(p.objetivo)) setVistaActual('planificacion'); if (delChat && !esMovil) setAgenteExpandido(true); }} />
      )}
      {tourVista && !tutorialAbierto && (
        <Tutorial key={tourVista} pasos={pasosDeVista(tourVista)} onTerminar={cerrarTourVista} etiquetaInicio="Siguiente" />
      )}
      <div className="flex-1 flex overflow-hidden min-h-0 h-full">
                <AgentePanel materias={materias} onCambiarMateria={cambiarMateriaPorNombre} onCambiarSeccion={(l: string) => panelDerechoRef.current?.cambiarSeccion(l)} guardarAhora={() => panelDerechoRef.current?.guardarAhora()} formulariosLibres={() => panelDerechoRef.current?.formulariosLibres() ?? true} planificacionId={planificacionId} seccionActiva={seccionPlanificador} expandido={agenteExpandido} setExpandido={setAgenteExpandido} planificacion={planificacion} setPlanificacion={setPlanificacion} setPropuestaPendiente={setPropuestaPendiente} onAccept={aceptarPropuesta} setVistaPanel={setVistaActual} setPdfUrl={setPdfUrl} setPdfAbierto={setPdfAbierto} agregarNotificacion={agregarNotificacion} generarPDF={generarPDF} limpiarYScroll={() => { if (panelDerechoRef.current?.limpiarYScroll) panelDerechoRef.current.limpiarYScroll(); }} totalEstudiantes={totalEstudiantesGlobal} config={configSistema} usuarioId={usuario.id} esMovil={esMovil} anchoChat={anchoChat} arrastrando={arrastrando} esSuperadmin={usuario.rol === 'SUPERADMIN'} />
        {!esMovil && agenteExpandido && (
          <div data-tutorial="divisor" role="separator" aria-orientation="vertical" aria-label="Arrastra para cambiar el ancho del chat" title="Arrastra para cambiar el ancho del chat (doble clic: tamaño normal)"
            onPointerDown={empezarArrastre}
            onDoubleClick={() => { setAnchoElegido(null); try { localStorage.removeItem('anchoChat'); } catch {} }}
            className={`group relative w-1.5 -mx-[3px] z-20 flex-shrink-0 cursor-col-resize self-stretch ${arrastrando ? 'bg-indigo-500/60' : 'hover:bg-indigo-500/40'} transition-colors`}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1 rounded-full bg-[color:var(--c-3a3d5c)] group-hover:bg-indigo-400" />
          </div>
        )}
        <PanelDerecho 
          onSeccionActivaCambia={setSeccionPlanificador}
          chatAbierto={agenteExpandido}
          onAbrirChat={() => setAgenteExpandido(true)}
          usuario={usuario}
          onLogout={cerrarSesion}
          onUsuarioActualizado={setUsuario}
          onConfigActualizada={aplicarYGuardarConfig}
          datosCargados={datosCargados}
          ref={panelDerechoRef} 
          planificacion={planificacion} 
          setPlanificacion={setPlanificacion} 
          propuestaPendiente={propuestaPendiente} 
          aceptarPropuesta={aceptarPropuesta} 
          setPropuestaPendiente={setPropuestaPendiente} 
          vistaInicial={vistaActual} 
          onCambiarVista={setVistaActual} 
          pdfUrl={pdfUrl} 
          setPdfUrl={setPdfUrl} 
          pdfAbierto={pdfAbierto} 
          setPdfAbierto={setPdfAbierto} 
          generarPDF={generarPDF}
          planificacionId={planificacionId}
          setPlanificacionId={setPlanificacionId}
          materias={materias}
          materiaActivaId={materiaActivaId}
          onAbrirMateria={abrirMateria}
          onNuevaMateria={crearMateria}
          onTutorial={puedeVerTutorial ? abrirTutorial : undefined}
        />
      </div>
    </div>
  );
}