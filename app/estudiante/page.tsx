'use client';
// Panel del estudiante (cuenta propia, rol ESTUDIANTE), organizado igual que el del profesor:
// a la izquierda el Asistente de estudio (se puede ocultar); a la derecha una barra con las pestañas y su cuenta,
// y debajo el contenido. El chat de la sección va debajo de sus evaluaciones (y también en Mensajes).
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, KeyRound, Plus, Hourglass, X, BookOpen, CalendarDays, Upload, Award, MessageSquare, Settings, Bot, PanelLeftOpen, FolderOpen, ArrowRight, Inbox } from 'lucide-react';
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
import Materiales from '@/components/Materiales';
import { type Resumen, estadoEntrega } from '@/components/estudiante/comun';

type Pestana = 'clases' | 'entregas' | 'mensajes' | 'materiales' | 'calendario' | 'notas' | 'config';
const PESTANAS: { id: Pestana; texto: string; icono: any }[] = [
  { id: 'clases', texto: 'Mis clases', icono: BookOpen }, { id: 'entregas', texto: 'Entregas', icono: Upload },
  { id: 'mensajes', texto: 'Mensajes', icono: MessageSquare }, { id: 'materiales', texto: 'Materiales', icono: FolderOpen },
  { id: 'calendario', texto: 'Calendario', icono: CalendarDays }, { id: 'notas', texto: 'Calificaciones', icono: Award },
];

interface Clase { id: string; estado: 'ACTIVO' | 'PENDIENTE' | 'INACTIVO'; profesor: string; materia: string | null; seccion: string; token: string | null }
interface Panel { cuenta: { id: string; nombre: string; email: string; avatarEn?: string | null; avisosCorreo?: boolean }; clases: Clase[] }

export default function PanelEstudiante() {
  const [datos, setDatos] = useState<Panel | null>(null);
  const [error, setError] = useState('');
  const [activa, setActiva] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [verUnirse, setVerUnirse] = useState(false);
  const [menuCuenta, setMenuCuenta] = useState(false);
  // Asistente: panel a la izquierda en computadora (se recuerda si lo ocultó); ventana completa en el teléfono
  const [asistente, setAsistente] = useState(true);
  const [asistenteMovil, setAsistenteMovil] = useState(false);
  // Chat de la sección que se muestra bajo las evaluaciones: el de la clase (y materia) elegida
  const [chatClave, setChatClave] = useState('');
  const contenido = useRef<HTMLDivElement>(null);
  // Pestañas del panel (se recuerda la última) y el resumen de todas sus clases
  const [pestana, setPestanaEstado] = useState<Pestana>('clases');
  const setPestana = (p: Pestana) => { setPestanaEstado(p); setMenuCuenta(false); try { localStorage.setItem('pestanaEstudiante', p); } catch { /* sin almacenamiento */ } contenido.current?.scrollTo({ top: 0 }); };
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
      if (localStorage.getItem('asistenteEstudiante') === 'oculto') setAsistente(false);
    } catch { /* sin almacenamiento */ }
    cargarResumen();
    const t = setInterval(cargarResumen, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (pestana !== 'clases') cargarResumen(); }, [pestana]);
  const mostrarAsistente = (v: boolean) => { setAsistente(v); try { localStorage.setItem('asistenteEstudiante', v ? 'visible' : 'oculto'); } catch { /* sin almacenamiento */ } };
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
  const estados = (resumen?.evaluaciones || []).map(e => estadoEntrega(e));
  const nPorEntregar = estados.filter(s => s === 'pendiente').length;
  const nAtrasadas = estados.filter(s => s === 'atrasada').length;
  const nPorCorregir = estados.filter(s => s === 'por_corregir').length;
  const nMensajes = (resumen?.evaluaciones || []).reduce((t, e) => t + e.mensajesNuevos, 0);
  const contador: Partial<Record<Pestana, number>> = resumen ? { entregas: nPorEntregar + nAtrasadas + nPorCorregir, mensajes: nMensajes } : {};
  const conClases = !!datos && aceptadas.length > 0;
  const nombre = datos?.cuenta.nombre || '';
  // Chat de la sección bajo las evaluaciones: el de la clase que está viendo
  const gruposClase = (resumen?.grupos || []).filter(g => g.claseId === activa);
  const grupoChat = gruposClase.find(g => g.clave === chatClave) || gruposClase[0] || null;

  return (
    <div className="h-screen flex overflow-hidden bg-[color:var(--c-161722)] text-[color:var(--c-b0b0c0)]">
      {/* ---------- Asistente de estudio (izquierda, computadora), como EvaPlanner en el profesor ---------- */}
      <AnimatePresence initial={false}>
        {conClases && asistente && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}
            className="hidden lg:block flex-shrink-0 border-r border-[color:var(--c-282a3f)] overflow-hidden">
            <div className="w-[420px] h-full"><Asistente datos={resumen} nombre={nombre} onOcultar={() => mostrarAsistente(false)} /></div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ---------- Derecha: barra de pestañas y contenido ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex-shrink-0 flex items-center gap-2 px-2 sm:px-4 py-2 sm:py-3 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)]">
          {conClases && !asistente && (
            <button type="button" onClick={() => mostrarAsistente(true)} title="Mostrar el asistente de estudio" aria-label="Mostrar el asistente de estudio" className="hidden lg:flex w-9 h-9 flex-shrink-0 items-center justify-center rounded-xl text-[color:var(--c-c7d2fe)] border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-818cf8)]/10 hover:bg-[color:var(--c-818cf8)]/20"><PanelLeftOpen className="w-4 h-4" /></button>
          )}
          {/* Pestañas (mismo estilo que las del profesor) */}
          <nav className="flex-1 min-w-0 flex items-center gap-1 md:gap-2 overflow-x-auto sin-barra">
            {conClases && PESTANAS.map(t => (
              <button key={t.id} type="button" onClick={() => setPestana(t.id)} title={t.texto} aria-label={t.texto} aria-current={pestana === t.id ? 'page' : undefined}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-2.5 xl:px-3.5 py-2 rounded-xl text-[13px] xl:text-sm font-medium whitespace-nowrap transition-colors duration-300 ${pestana === t.id ? 'text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-1d1e2e)]'}`}>
                {pestana === t.id && <motion.span layoutId="pestanaEstudiante" className="absolute inset-0 bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <t.icono className={`relative z-10 w-4 h-4 ${pestana === t.id ? 'text-[color:var(--c-818cf8)]' : ''}`} />
                <span className={`relative z-10 ${pestana === t.id ? '' : 'hidden md:inline'}`}>{t.texto}</span>
                {(contador[t.id] ?? 0) > 0 && <span className="relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{contador[t.id]}</span>}
              </button>
            ))}
            {!conClases && <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] px-2">Mi panel</p>}
          </nav>
          <button type="button" onClick={() => { setVerUnirse(true); setAviso(null); }} title="Unirme a una clase" aria-label="Unirme a una clase" className="h-9 px-2.5 flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-[color:var(--c-313248)] text-xs font-medium text-[color:var(--c-c0c0d0)] hover:border-[color:var(--c-414258)] hover:text-[color:var(--c-e0e0ec)]"><Plus className="w-4 h-4" /><span className="hidden md:inline">Unirme a una clase</span></button>
          <span className="w-px h-6 bg-[color:var(--c-313248)] flex-shrink-0" aria-hidden="true" />
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

        <div ref={contenido} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {(aviso || pendientes.length > 0 || error) && (
            <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-4 space-y-2">
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

          {/* ---------- Mis clases: pendientes, la clase elegida y el chat de su sección ---------- */}
          {conClases && pestana === 'clases' && (
            <motion.div key="clases" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 space-y-3">
                {/* Lo pendiente, en una línea (como la franja de entregas del profesor) */}
                {resumen && (
                  <button type="button" onClick={() => setPestana(nPorEntregar + nAtrasadas + nPorCorregir > 0 || !nMensajes ? 'entregas' : 'mensajes')} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] text-left hover:border-[color:var(--c-414258)] transition-colors">
                    <Inbox className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
                    <span className="flex-1 min-w-0 text-sm text-[color:var(--c-d0d0da)] truncate">
                      {nPorEntregar + nAtrasadas + nPorCorregir + nMensajes === 0 ? 'Estás al día: no tienes nada pendiente' : [
                        nAtrasadas ? `${nAtrasadas} entrega${nAtrasadas === 1 ? '' : 's'} atrasada${nAtrasadas === 1 ? '' : 's'}` : '',
                        nPorCorregir ? `${nPorCorregir} por corregir` : '',
                        nPorEntregar ? `${nPorEntregar} por entregar` : '',
                        nMensajes ? `${nMensajes} mensaje${nMensajes === 1 ? '' : 's'} nuevo${nMensajes === 1 ? '' : 's'}` : '',
                      ].filter(Boolean).join(' · ')}
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold text-[color:var(--c-a5b4fc)] flex items-center gap-1">Ver<ArrowRight className="w-3.5 h-3.5" /></span>
                  </button>
                )}
                {/* Clases (cuando tiene varias) */}
                {aceptadas.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto sin-barra">
                    {aceptadas.map(c => (
                      <button key={c.id} onClick={() => { setActiva(c.id); setAbrirEval(null); setChatClave(''); }} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${c.id === activa ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/45 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
                        {c.materia || 'Todas sus materias'} · Prof. {c.profesor.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {actual?.token && <PortalVista key={actual.token} token={actual.token} embebido abrir={abrirEval} cuenta={datos ? { id: datos.cuenta.id, avatarEn: datos.cuenta.avatarEn, nombre: datos.cuenta.nombre } : null} />}
              {/* Chat de la sección, debajo de las evaluaciones (como en el planificador del profesor) */}
              {grupoChat && (
                <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10 -mt-6 space-y-2">
                  {gruposClase.length > 1 && (
                    <Selector value={grupoChat.clave} onChange={(e) => setChatClave(e.target.value)} aria-label="Chat de qué materia" className="h-9 w-full sm:w-72 px-3 rounded-xl bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-d0d0da)]">
                      {gruposClase.map(g => <option key={g.clave} value={g.clave}>{g.materia} · Sección {g.seccion}</option>)}
                    </Selector>
                  )}
                  <ChatSeccion key={grupoChat.clave} modo="estudiante" alto="pantalla" api={`/api/portal/${encodeURIComponent(grupoChat.token)}/chat`} params={{ materiaId: grupoChat.materiaId }} titulo={`Chat de la Sección ${grupoChat.seccion}${gruposClase.length > 1 ? ` · ${grupoChat.materia}` : ''}`} />
                </div>
              )}
            </motion.div>
          )}

          {/* ---------- Las demás pestañas: todas sus clases juntas ---------- */}
          {datos && pestana !== 'clases' && (conClases || pestana === 'config') && (
            <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-6">
              <motion.div key={pestana} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                {pestana === 'config' ? (
                  <Configuracion cuenta={datos.cuenta} onCuenta={(c) => setDatos(d => (d ? { ...d, cuenta: { ...d.cuenta, ...c } } : d))}
                    clases={clases} onSalir={salirDeClase} onUnirse={() => { setVerUnirse(true); setAviso(null); }} />
                ) : !resumen ? (
                  <div className="flex items-center justify-center gap-3 py-24 text-sm text-[color:var(--c-9a9bb0)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando…</div>
                ) : pestana === 'calendario' ? <Calendario datos={resumen} onAbrir={abrirEnClase} />
                : pestana === 'entregas' ? <Entregas datos={resumen} onCambio={(id, en) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.id === id ? { ...e, entrega: en } : e)) } : r))} />
                : pestana === 'notas' ? <Calificaciones datos={resumen} onAbrir={abrirEnClase} />
                : pestana === 'mensajes' ? <Mensajes datos={resumen} onLeidos={(token) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.token === token ? { ...e, mensajesNuevos: 0 } : e)) } : r))} />
                : pestana === 'materiales' ? <Materiales modo="estudiante" grupos={resumen.grupos} />
                : null}
              </motion.div>
            </main>
          )}
        </div>
      </div>

      {/* ---------- Asistente en el teléfono (o si lo ocultó en la computadora) ---------- */}
      {conClases && (
        <button type="button" onClick={() => setAsistenteMovil(true)} className={`fixed bottom-5 right-5 z-40 h-12 pl-4 pr-5 rounded-full bg-[color:var(--c-818cf8)] text-white text-sm font-semibold shadow-xl items-center gap-2 ${pestana === 'mensajes' ? 'hidden' : 'flex lg:hidden'}`}><Bot className="w-5 h-5" />Asistente</button>
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
