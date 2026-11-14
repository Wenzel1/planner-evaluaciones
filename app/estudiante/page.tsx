'use client';
// Panel del estudiante (cuenta propia, rol ESTUDIANTE), con el mismo estilo del profesor:
// a la izquierda un menú lateral que se recoge solo (se abre al pasar el ratón); al centro el contenido;
// a la derecha, mitad y mitad, el Asistente de estudio y el chat de la sección.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, KeyRound, Plus, Hourglass, X, BookOpen, CalendarDays, Upload, Award, MessageSquare, MessagesSquare, Settings, Bot, Menu, GraduationCap } from 'lucide-react';
import PortalVista from '@/components/PortalVista';
import Avatar from '@/components/Avatar';
import ChatSeccion from '@/components/ChatSeccion';
import Selector from '@/components/Selector';
import Calendario from '@/components/estudiante/Calendario';
import Entregas from '@/components/estudiante/Entregas';
import Calificaciones from '@/components/estudiante/Calificaciones';
import Mensajes from '@/components/estudiante/Mensajes';
import Configuracion from '@/components/estudiante/Configuracion';
import Asistente from '@/components/estudiante/Asistente';
import { type Resumen, estadoEntrega } from '@/components/estudiante/comun';

type Pestana = 'clases' | 'entregas' | 'calendario' | 'notas' | 'mensajes' | 'chat' | 'config';
// 'chat' solo aparece en pantallas medianas y pequeñas (en las grandes el chat está siempre a la derecha)
const PESTANAS: { id: Pestana; texto: string; icono: any; soloPequena?: boolean }[] = [
  { id: 'clases', texto: 'Mis clases', icono: BookOpen }, { id: 'entregas', texto: 'Entregas', icono: Upload },
  { id: 'mensajes', texto: 'Mensajes', icono: MessageSquare }, { id: 'calendario', texto: 'Calendario', icono: CalendarDays },
  { id: 'notas', texto: 'Calificaciones', icono: Award }, { id: 'chat', texto: 'Chat de la sección', icono: MessagesSquare, soloPequena: true },
];
const TITULOS: Record<Pestana, string> = { clases: 'Mis clases', entregas: 'Entregas', calendario: 'Calendario', notas: 'Calificaciones', mensajes: 'Mensajes', chat: 'Chat de la sección', config: 'Configuración' };

interface Clase { id: string; estado: 'ACTIVO' | 'PENDIENTE' | 'INACTIVO'; profesor: string; materia: string | null; seccion: string; token: string | null }
interface Panel { cuenta: { id: string; nombre: string; email: string; avatarEn?: string | null }; clases: Clase[] }

export default function PanelEstudiante() {
  const [datos, setDatos] = useState<Panel | null>(null);
  const [error, setError] = useState('');
  const [activa, setActiva] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [verUnirse, setVerUnirse] = useState(false);
  const [menuCuenta, setMenuCuenta] = useState(false);
  // Asistente: a la derecha en pantallas grandes; ventana completa en las pequeñas
  const [asistenteMovil, setAsistenteMovil] = useState(false);
  // Menú lateral: se abre al pasar el ratón (computadora) o con el botón ☰ (teléfono)
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  const temporizadorMenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abrirMenu = (v: boolean) => { if (temporizadorMenu.current) clearTimeout(temporizadorMenu.current); temporizadorMenu.current = setTimeout(() => setMenuAbierto(v), v ? 120 : 180); };
  // Chat de la sección: el de la clase (y materia) elegida
  const [chatClave, setChatClave] = useState('');
  const contenido = useRef<HTMLDivElement>(null);
  // Pestañas del panel (se recuerda la última) y el resumen de todas sus clases
  const [pestana, setPestanaEstado] = useState<Pestana>('clases');
  const setPestana = (p: Pestana) => { setPestanaEstado(p); setMenuCuenta(false); setMenuMovil(false); setMenuAbierto(false); try { localStorage.setItem('pestanaEstudiante', p); } catch { /* sin almacenamiento */ } contenido.current?.scrollTo({ top: 0 }); };
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abrirEval, setAbrirEval] = useState<{ materiaId?: string; evaluacionId: string } | null>(null);
  const cargarResumen = async () => {
    const r = await fetch('/api/estudiante/resumen', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setResumen(await r.json());
  };
  useEffect(() => {
    try {
      const p = localStorage.getItem('pestanaEstudiante') as Pestana | null;
      if (p && (PESTANAS.some(x => x.id === p) || p === 'config')) setPestanaEstado(p);
    } catch { /* sin almacenamiento */ }
    cargarResumen();
    const t = setInterval(cargarResumen, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (pestana !== 'clases') cargarResumen(); }, [pestana]);
  // En pantallas grandes el chat ya está a la derecha: la pestaña "Chat" no hace falta
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const revisar = () => { if (mq.matches) setPestanaEstado(p => (p === 'chat' ? 'clases' : p)); };
    revisar(); mq.addEventListener('change', revisar);
    return () => mq.removeEventListener('change', revisar);
  }, []);
  // Desde Calendario, Entregas o Calificaciones: abrir esa clase (y esa evaluación) en "Mis clases"
  const abrirEnClase = ({ claseId, evaluacionId, materiaId }: { claseId: string; materiaId?: string; evaluacionId: string }) => {
    setActiva(claseId);
    setAbrirEval(evaluacionId ? { materiaId, evaluacionId } : null);
    setPestana('clases');
  };
  const salirDeClase = async (claseId: string) => {
    const r = await fetch('/api/estudiante/salir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claseId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setAviso({ tipo: 'error', texto: d.error || 'No se pudo completar.' }); return; }
    await cargar(); await cargarResumen();
  };

  const cargar = async () => {
    try {
      const r = await fetch('/api/estudiante/panel', { cache: 'no-store' });
      if (r.status === 401) { window.location.replace('/login'); return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar tu panel.');
      setDatos(d);
      const activas = (d.clases as Clase[]).filter(c => c.token);
      setActiva(prev => (prev && activas.some(c => c.id === prev) ? prev : activas[0]?.id ?? null));
      return d as Panel;
    } catch (e: any) { setError(e.message); }
  };

  const unirse = async (c: string) => {
    const limpio = c.trim();
    if (!limpio) return;
    setUniendo(true); setAviso(null);
    try {
      const r = await fetch('/api/estudiante/unirse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: limpio }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo unir.');
      setAviso({ tipo: 'ok', texto: d.estado === 'PENDIENTE' ? `Listo: le pediste unirte a ${d.materia} (Sección ${d.seccion}). Tu profesor(a) ${d.profesor} debe aceptarte.` : `¡Te uniste a ${d.materia}, Sección ${d.seccion}!` });
      setCodigo(''); setVerUnirse(false);
      try { localStorage.removeItem('codigoClasePendiente'); } catch { /* sin almacenamiento */ }
      await cargar(); await cargarResumen();
    } catch (e: any) { setAviso({ tipo: 'error', texto: e.message }); }
    finally { setUniendo(false); }
  };

  useEffect(() => {
    // Si se registró con un código de clase (o abrió el enlace de invitación), se une sola al entrar
    cargar().then(() => {
      let pendiente = '';
      try { pendiente = localStorage.getItem('codigoClasePendiente') || ''; } catch { /* sin almacenamiento */ }
      if (pendiente) unirse(pendiente);
    });
    const t = setInterval(cargar, 60000); // por si el profesor lo acepta mientras tiene el panel abierto
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salir = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.replace('/login'); };

  const clases = datos?.clases || [];
  const aceptadas = clases.filter(c => c.token);
  const pendientes = clases.filter(c => c.estado === 'PENDIENTE');
  const actual = aceptadas.find(c => c.id === activa) || null;
  const contador: Partial<Record<Pestana, number>> = resumen ? {
    entregas: resumen.evaluaciones.filter(e => ['pendiente', 'atrasada', 'por_corregir'].includes(estadoEntrega(e) || '')).length,
    mensajes: resumen.evaluaciones.reduce((t, e) => t + e.mensajesNuevos, 0),
  } : {};
  const conClases = !!datos && aceptadas.length > 0;
  const nombre = datos?.cuenta.nombre || '';
  // Chat: por defecto el de la clase que está viendo
  const gruposChat = resumen?.grupos || [];
  const grupoChat = gruposChat.find(g => g.clave === chatClave) || gruposChat.find(g => g.claseId === activa) || gruposChat[0] || null;
  const chat = grupoChat ? (
    <ChatSeccion key={grupoChat.clave} modo="estudiante" alto="contenedor" plegable={false} api={`/api/portal/${encodeURIComponent(grupoChat.token)}/chat`}
      params={{ materiaId: grupoChat.materiaId }} titulo={`Chat de la Sección ${grupoChat.seccion}${gruposChat.length > 1 ? ` · ${grupoChat.materia}` : ''}`} />
  ) : null;
  const elegirChat = gruposChat.length > 1 && (
    <Selector value={grupoChat?.clave || ''} onChange={(e) => setChatClave(e.target.value)} aria-label="Chat de qué clase" className="h-9 w-full px-3 rounded-xl bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-d0d0da)]">
      {gruposChat.map(g => <option key={g.clave} value={g.clave}>{g.materia} · Sección {g.seccion}</option>)}
    </Selector>
  );
  // Elementos del menú lateral (con su contador)
  const itemsMenu = conClases ? PESTANAS : [];
  const botonMenu = (t: typeof PESTANAS[number], expandido: boolean) => (
    <button key={t.id} type="button" onClick={() => setPestana(t.id)} title={expandido ? undefined : t.texto} aria-label={t.texto} aria-current={pestana === t.id ? 'page' : undefined}
      className={`relative w-full h-11 flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-colors ${t.soloPequena ? 'xl:hidden' : ''} ${pestana === t.id ? 'text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20' : 'text-[color:var(--c-8a8b9e)] border border-transparent hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]'}`}>
      <t.icono className={`w-[18px] h-[18px] flex-shrink-0 ${pestana === t.id ? 'text-[color:var(--c-818cf8)]' : ''}`} />
      <span className={`whitespace-nowrap transition-opacity duration-150 ${expandido ? 'opacity-100' : 'opacity-0'}`}>{t.texto}</span>
      {(contador[t.id] ?? 0) > 0 && <span className={`min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ${expandido ? 'ml-auto' : 'absolute top-1 right-1'}`}>{contador[t.id]}</span>}
    </button>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[color:var(--c-161722)]">
      {/* ---------- Menú lateral (computadora): solo íconos; se despliega al pasar el ratón ---------- */}
      <div className="hidden md:block relative w-[68px] flex-shrink-0 z-40">
        <motion.nav onMouseEnter={() => abrirMenu(true)} onMouseLeave={() => abrirMenu(false)} onFocus={() => setMenuAbierto(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenuAbierto(false); }}
          initial={false} animate={{ width: menuAbierto ? 232 : 68 }} transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          className={`absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-[color:var(--c-282a3f)] bg-[color:var(--c-12131d)] ${menuAbierto ? 'shadow-2xl shadow-black/50' : ''}`}>
          <div className="h-14 flex-shrink-0 flex items-center gap-3 px-[14px] border-b border-[color:var(--c-282a3f)]">
            <span className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[color:var(--c-818cf8)]/20"><GraduationCap className="w-5 h-5 text-white" /></span>
            <span className={`min-w-0 transition-opacity duration-150 ${menuAbierto ? 'opacity-100' : 'opacity-0'}`}><span className="block text-sm font-semibold text-[color:var(--c-e0e0ec)] whitespace-nowrap">EvaPlanner</span><span className="block text-[10px] text-[color:var(--c-8a8b9e)] whitespace-nowrap">Estudiante</span></span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto sin-barra p-3 space-y-1">
            {itemsMenu.map(t => botonMenu(t, menuAbierto))}
            {conClases && <button type="button" onClick={() => { setMenuAbierto(false); setAsistenteMovil(true); }} title={menuAbierto ? undefined : 'Asistente de estudio'} aria-label="Asistente de estudio" className="xl:hidden w-full h-11 flex items-center gap-3 px-3 rounded-xl text-sm font-medium text-[color:var(--c-8a8b9e)] border border-transparent hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]"><Bot className="w-[18px] h-[18px] flex-shrink-0" /><span className={`whitespace-nowrap transition-opacity duration-150 ${menuAbierto ? 'opacity-100' : 'opacity-0'}`}>Asistente de estudio</span></button>}
          </div>
          <div className="p-3 border-t border-[color:var(--c-282a3f)] space-y-1">
            <button type="button" onClick={() => { setVerUnirse(true); setAviso(null); setMenuAbierto(false); }} title={menuAbierto ? undefined : 'Unirme a una clase'} aria-label="Unirme a una clase" className="w-full h-11 flex items-center gap-3 px-3 rounded-xl text-sm font-medium text-[color:var(--c-8a8b9e)] border border-transparent hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]">
              <Plus className="w-[18px] h-[18px] flex-shrink-0" /><span className={`whitespace-nowrap transition-opacity duration-150 ${menuAbierto ? 'opacity-100' : 'opacity-0'}`}>Unirme a una clase</span>
            </button>
            {botonMenu({ id: 'config', texto: 'Configuración', icono: Settings }, menuAbierto)}
          </div>
        </motion.nav>
      </div>

      {/* ---------- Menú en el teléfono ---------- */}
      <AnimatePresence>
        {menuMovil && (
          <>
            <motion.div key="fondo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="md:hidden fixed inset-0 z-[120] bg-black/60" onClick={() => setMenuMovil(false)} />
            <motion.nav key="menu" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', stiffness: 420, damping: 40 }} className="md:hidden fixed inset-y-0 left-0 z-[121] w-[248px] flex flex-col bg-[color:var(--c-161722)] border-r border-[color:var(--c-282a3f)]">
              <div className="h-14 flex items-center gap-3 px-4 border-b border-[color:var(--c-282a3f)]">
                <span className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)] flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></span>
                <span className="flex-1 text-sm font-semibold text-[color:var(--c-e0e0ec)]">EvaPlanner</span>
                <button type="button" onClick={() => setMenuMovil(false)} aria-label="Cerrar el menú" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)]"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {itemsMenu.map(t => botonMenu(t, true))}
                {conClases && <button type="button" onClick={() => { setMenuMovil(false); setAsistenteMovil(true); }} className="w-full h-11 flex items-center gap-3 px-3 rounded-xl text-sm font-medium text-[color:var(--c-8a8b9e)] border border-transparent hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]"><Bot className="w-[18px] h-[18px] flex-shrink-0" />Asistente de estudio</button>}
              </div>
              <div className="p-3 border-t border-[color:var(--c-282a3f)]">{botonMenu({ id: 'config', texto: 'Configuración', icono: Settings }, true)}</div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* ---------- Centro: barra superior y contenido (más la columna derecha) ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)]">
          <button type="button" onClick={() => setMenuMovil(true)} aria-label="Abrir el menú" className="md:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]"><Menu className="w-5 h-5" /></button>
          <h1 className="flex-1 min-w-0 flex items-center gap-2 text-[15px] font-semibold text-[color:var(--c-e0e0ec)]">
            {(() => { const I = conClases || pestana === 'config' ? (PESTANAS.find(t => t.id === pestana)?.icono || Settings) : BookOpen; return <span className="w-8 h-8 rounded-lg bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 flex items-center justify-center flex-shrink-0"><I className="w-4 h-4 text-[color:var(--c-818cf8)]" /></span>; })()}
            <span className="truncate">{conClases || pestana === 'config' ? TITULOS[pestana] : 'Mi panel'}</span>
          </h1>
          <button type="button" onClick={() => { setVerUnirse(true); setAviso(null); }} title="Unirme a una clase" aria-label="Unirme a una clase" className="md:hidden w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10"><Plus className="w-[18px] h-[18px]" /></button>
          {/* Cuenta: solo la foto, con su menú */}
          <div className="relative flex-shrink-0">
            <button type="button" onClick={() => setMenuCuenta(v => !v)} aria-expanded={menuCuenta} title={nombre ? `${nombre} · Mi cuenta` : 'Mi cuenta'} className={`p-1 rounded-full transition-colors ${menuCuenta || pestana === 'config' ? 'bg-[color:var(--c-818cf8)]/15' : 'hover:bg-[color:var(--c-1d1e2e)]'}`}>
              {datos ? <Avatar id={datos.cuenta.id} version={datos.cuenta.avatarEn} nombre={nombre} tamano={34} /> : <span className="block w-[34px] h-[34px] rounded-full bg-[color:var(--c-272839)]" />}
            </button>
            <AnimatePresence>
              {menuCuenta && datos && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuCuenta(false)} aria-hidden="true" />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} role="menu" className="absolute right-0 top-12 z-50 w-60 bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-xl shadow-2xl p-1.5">
                    <div className="px-3 py-2.5 border-b border-[color:var(--c-282a3f)] mb-1 flex items-center gap-3">
                      <Avatar id={datos.cuenta.id} version={datos.cuenta.avatarEn} nombre={nombre} tamano={40} />
                      <div className="min-w-0"><p className="text-sm font-medium text-[color:var(--c-e0e0ec)] truncate">{nombre}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{datos.cuenta.email}</p></div>
                    </div>
                    <button type="button" role="menuitem" onClick={() => setPestana('config')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><Settings className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Configuración</button>
                    <div className="h-px bg-[color:var(--c-282a3f)] my-1" />
                    <button type="button" role="menuitem" onClick={salir} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] text-red-300 hover:bg-red-500/10"><LogOut className="w-4 h-4" />Cerrar sesión</button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
        <div ref={contenido} className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
          {/* Clases (cuando tiene varias) */}
          {pestana === 'clases' && aceptadas.length > 1 && (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 flex gap-1.5 overflow-x-auto sin-barra">
              {aceptadas.map(c => (
                <button key={c.id} onClick={() => { setActiva(c.id); setAbrirEval(null); }} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${c.id === activa ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/45 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
                  {c.materia || 'Todas sus materias'} · Prof. {c.profesor.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
          {(aviso || pendientes.length > 0 || error) && (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-2">
              {aviso && (
                <div className={`px-4 py-2.5 rounded-xl text-sm flex items-start gap-2 ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'}`}>
                  <span className="flex-1">{aviso.texto}</span><button onClick={() => setAviso(null)} aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
              )}
              {pendientes.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
                  <Hourglass className="w-4 h-4 flex-shrink-0" />Esperando que {c.profesor} te acepte en {c.materia || 'su clase'}, Sección {c.seccion}.
                </div>
              ))}
              {error && <p className="text-sm text-red-300">{error}</p>}
            </div>
          )}
          {!datos && !error && <div className="flex items-center justify-center gap-3 mt-32 text-sm text-[color:var(--c-9a9bb0)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando tu panel…</div>}

          {/* Sin clases todavía: invitación a unirse */}
          {datos && !aceptadas.length && pestana !== 'config' && (
            <div className="max-w-md mx-auto mt-16 px-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center mb-4"><KeyRound className="w-7 h-7 text-[color:var(--c-a5b4fc)]" /></div>
              <h1 className="text-xl font-bold text-[color:var(--c-e0e0ec)]">{pendientes.length ? 'Tu solicitud está en camino' : 'Únete a tu primera clase'}</h1>
              <p className="text-sm text-[color:var(--c-9a9bb0)] mt-1.5">{pendientes.length ? 'Cuando tu profesor te acepte, aquí verás tu plan de evaluación, tus notas y tus entregas.' : 'Escribe el código que te dio tu profesor (por ejemplo ISW-A7K2).'}</p>
              <FormUnirse codigo={codigo} setCodigo={setCodigo} uniendo={uniendo} onUnirse={() => unirse(codigo)} />
            </div>
          )}

          {/* Mis clases: la clase elegida */}
          {conClases && pestana === 'clases' && actual?.token && <PortalVista key={actual.token} token={actual.token} embebido abrir={abrirEval} cuenta={datos ? { id: datos.cuenta.id, avatarEn: datos.cuenta.avatarEn, nombre: datos.cuenta.nombre } : null} />}

          {/* Las demás pestañas: todas sus clases juntas */}
          {datos && pestana !== 'clases' && (conClases || pestana === 'config') && (
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 xl:pb-6">
              <motion.div key={pestana} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
              {pestana === 'config' ? (
                <Configuracion cuenta={datos.cuenta} onCuenta={(c) => setDatos(d => (d ? { ...d, cuenta: { ...d.cuenta, ...c } } : d))}
                  clases={clases} onSalir={salirDeClase} onUnirse={() => { setVerUnirse(true); setAviso(null); }} />
              ) : !resumen ? (
                <div className="flex items-center justify-center gap-3 py-24 text-sm text-[color:var(--c-9a9bb0)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando…</div>
              ) : pestana === 'calendario' ? <Calendario datos={resumen} onAbrir={abrirEnClase} />
              : pestana === 'entregas' ? <Entregas datos={resumen} onCambio={(id, en) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.id === id ? { ...e, entrega: en } : e)) } : r))} />
              : pestana === 'notas' ? <Calificaciones datos={resumen} onAbrir={abrirEnClase} />
              : pestana === 'mensajes' ? <Mensajes datos={resumen} onLeidos={(id) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.id === id ? { ...e, mensajesNuevos: 0 } : e)) } : r))} />
              : pestana === 'chat' ? (
                <div className="flex flex-col gap-2 h-[calc(100dvh-56px-48px-96px)] xl:h-[calc(100dvh-56px-48px)] min-h-[420px]">{elegirChat}<div className="flex-1 min-h-0">{chat || <p className="text-sm text-[color:var(--c-8a8b9e)]">Aún no tienes un chat de sección.</p>}</div></div>
              ) : null}
              </motion.div>
            </main>
          )}
        </div>

        {/* ---------- Derecha (pantallas grandes): Asistente arriba y chat de la sección abajo ---------- */}
        {conClases && (
          <aside className="hidden xl:flex w-[420px] 2xl:w-[460px] flex-shrink-0 flex-col gap-3 p-3 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-12131d)]">
            <div className="flex-1 min-h-0 rounded-2xl border border-[color:var(--c-313248)] overflow-hidden"><Asistente datos={resumen} nombre={nombre} /></div>
            <div className="flex-1 min-h-0 flex flex-col gap-2">{elegirChat}<div className="flex-1 min-h-0">{chat || <div className="h-full rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] flex items-center justify-center text-xs text-[color:var(--c-8a8b9e)]">Cargando el chat…</div>}</div></div>
          </aside>
        )}
        </div>
      </div>

      {/* ---------- Asistente en pantallas medianas y pequeñas ---------- */}
      {conClases && (
        <button type="button" onClick={() => setAsistenteMovil(true)} className={`xl:hidden fixed bottom-5 right-5 z-40 ${pestana === 'mensajes' || pestana === 'chat' ? 'hidden' : ''} h-12 pl-4 pr-5 rounded-full bg-[color:var(--c-818cf8)] text-white text-sm font-semibold shadow-xl flex items-center gap-2`}><Bot className="w-5 h-5" />Asistente</button>
      )}
      <AnimatePresence>
        {asistenteMovil && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-[150] flex flex-col bg-[color:var(--c-161722)]">
            <div className="flex-1 min-h-0"><Asistente datos={resumen} nombre={nombre} onOcultar={() => setAsistenteMovil(false)} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {verUnirse && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setVerUnirse(false); }}>
          <div className="w-full max-w-sm bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1"><h2 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Unirme a una clase</h2><button onClick={() => setVerUnirse(false)} aria-label="Cerrar" className="p-1 text-[color:var(--c-8a8b9e)]"><X className="w-4 h-4" /></button></div>
            <p className="text-xs text-[color:var(--c-8a8b9e)]">Escribe el código de clase que te dio tu profesor.</p>
            <FormUnirse codigo={codigo} setCodigo={setCodigo} uniendo={uniendo} onUnirse={() => unirse(codigo)} />
            {aviso?.tipo === 'error' && <p className="text-xs text-red-300 mt-2">{aviso.texto}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function FormUnirse({ codigo, setCodigo, uniendo, onUnirse }: { codigo: string; setCodigo: (v: string) => void; uniendo: boolean; onUnirse: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onUnirse(); }} className="mt-4 flex gap-2">
      <input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 12))} placeholder="ISW-A7K2"
        className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-center text-base font-mono tracking-[0.15em] text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-4a4b5e)] outline-none focus:border-[color:var(--c-818cf8)]/60" />
      <button type="submit" disabled={uniendo || codigo.trim().length < 6} className="h-11 px-4 rounded-xl bg-[color:var(--c-818cf8)] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
        {uniendo ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Unirme'}
      </button>
    </form>
  );
}
