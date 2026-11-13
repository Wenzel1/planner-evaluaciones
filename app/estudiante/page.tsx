'use client';
// Panel del estudiante (cuenta propia, rol ESTUDIANTE): sus clases, unirse con un código de clase
// y, de cada clase, todo lo que antes veía por su enlace personal (plan, recursos, notas, exámenes y entregas).
import { useEffect, useState } from 'react';
import { GraduationCap, LogOut, KeyRound, Plus, Hourglass, Sun, Moon, X, Home, BookOpen, CalendarDays, Upload, Award, MessageSquare, Settings } from 'lucide-react';
import PortalVista from '@/components/PortalVista';
import Avatar, { EditorAvatar } from '@/components/Avatar';
import Inicio from '@/components/estudiante/Inicio';
import Calendario from '@/components/estudiante/Calendario';
import Entregas from '@/components/estudiante/Entregas';
import Calificaciones from '@/components/estudiante/Calificaciones';
import Mensajes from '@/components/estudiante/Mensajes';
import Configuracion from '@/components/estudiante/Configuracion';
import { type Resumen, estadoEntrega } from '@/components/estudiante/comun';

type Pestana = 'inicio' | 'clases' | 'calendario' | 'entregas' | 'notas' | 'mensajes' | 'config';
const PESTANAS: { id: Pestana; texto: string; icono: any }[] = [
  { id: 'inicio', texto: 'Inicio', icono: Home }, { id: 'clases', texto: 'Mis clases', icono: BookOpen }, { id: 'calendario', texto: 'Calendario', icono: CalendarDays },
  { id: 'entregas', texto: 'Entregas', icono: Upload }, { id: 'notas', texto: 'Calificaciones', icono: Award }, { id: 'mensajes', texto: 'Mensajes', icono: MessageSquare },
  { id: 'config', texto: 'Configuración', icono: Settings },
];

interface Clase { id: string; estado: 'ACTIVO' | 'PENDIENTE' | 'INACTIVO'; profesor: string; materia: string | null; seccion: string; token: string | null }
interface Panel { cuenta: { id: string; nombre: string; email: string; avatarEn?: string | null }; clases: Clase[] }

export default function PanelEstudiante() {
  const [datos, setDatos] = useState<Panel | null>(null);
  const [verPerfil, setVerPerfil] = useState(false);
  const [error, setError] = useState('');
  const [activa, setActiva] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [uniendo, setUniendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [verUnirse, setVerUnirse] = useState(false);
  const [claro, setClaro] = useState(false);
  // Pestañas del panel (se recuerda la última) y el resumen de todas sus clases
  const [pestana, setPestanaEstado] = useState<Pestana>('inicio');
  const setPestana = (p: Pestana) => { setPestanaEstado(p); try { localStorage.setItem('pestanaEstudiante', p); } catch { /* sin almacenamiento */ } window.scrollTo({ top: 0 }); };
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abrirEval, setAbrirEval] = useState<{ materiaId?: string; evaluacionId: string } | null>(null);
  const cargarResumen = async () => {
    const r = await fetch('/api/estudiante/resumen', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setResumen(await r.json());
  };
  useEffect(() => {
    try { const p = localStorage.getItem('pestanaEstudiante') as Pestana | null; if (p && PESTANAS.some(x => x.id === p)) setPestanaEstado(p); } catch { /* sin almacenamiento */ }
    cargarResumen();
    const t = setInterval(cargarResumen, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (pestana !== 'clases') cargarResumen(); }, [pestana]);
  // Desde Inicio, Calendario, Entregas o Calificaciones: abrir esa clase (y esa evaluación) en "Mis clases"
  const abrirEnClase = ({ claseId, materiaId, evaluacionId }: { claseId: string; materiaId?: string; evaluacionId: string }) => {
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
      await cargar();
    } catch (e: any) { setAviso({ tipo: 'error', texto: e.message }); }
    finally { setUniendo(false); }
  };

  useEffect(() => {
    setClaro(document.documentElement.classList.contains('claro'));
    // Si se registró con un código de clase (o abrió el enlace de invitación), se une sola al entrar
    cargar().then(() => {
      let pendiente = '';
      try { pendiente = localStorage.getItem('codigoClasePendiente') || ''; } catch { /* sin almacenamiento */ }
      if (pendiente) unirse(pendiente);
    });
    const t = setInterval(cargar, 60000); // por si el profesor lo acepta mientras tiene el panel abierto
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarTema = () => {
    const nuevo = !document.documentElement.classList.contains('claro');
    document.documentElement.classList.toggle('claro', nuevo);
    try { localStorage.setItem('tema', nuevo ? 'claro' : 'oscuro'); } catch { /* sin almacenamiento */ }
    setClaro(nuevo);
  };
  const salir = async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.replace('/login'); };

  const clases = datos?.clases || [];
  const aceptadas = clases.filter(c => c.token);
  const pendientes = clases.filter(c => c.estado === 'PENDIENTE');
  const actual = aceptadas.find(c => c.id === activa) || null;
  const contador: Partial<Record<Pestana, number>> = resumen ? {
    entregas: resumen.evaluaciones.filter(e => ['pendiente', 'atrasada', 'por_corregir'].includes(estadoEntrega(e) || '')).length,
    mensajes: resumen.evaluaciones.reduce((t, e) => t + e.mensajesNuevos, 0),
  } : {};

  return (
    <div className="min-h-screen bg-[color:var(--c-13141d)]">
      {/* Mi perfil: foto */}
      {verPerfil && datos && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setVerPerfil(false); }}>
          <div className="w-full max-w-md bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Mi perfil</p><button type="button" onClick={() => setVerPerfil(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)]"><X className="w-4 h-4" /></button></div>
            <EditorAvatar id={datos.cuenta.id} version={datos.cuenta.avatarEn} nombre={datos.cuenta.nombre} onCambio={(v) => setDatos(d => (d ? { ...d, cuenta: { ...d.cuenta, avatarEn: v } } : d))} />
            <div className="text-xs text-[color:var(--c-8a8b9e)] border-t border-[color:var(--c-282a3f)] pt-3"><p className="text-[color:var(--c-d0d0da)] font-medium">{datos.cuenta.nombre}</p><p>{datos.cuenta.email}</p></div>
          </div>
        </div>
      )}
      {/* Barra superior */}
      <header className="sticky top-0 z-40 bg-[color:var(--c-161722)]/95 backdrop-blur border-b border-[color:var(--c-282a3f)]">
        <div className="max-w-none mx-auto px-4 lg:px-10 2xl:px-16 h-14 flex items-center gap-3">
          {datos ? <button type="button" onClick={() => setPestana('config')} title="Mi perfil y configuración" className="rounded-full ring-2 ring-transparent hover:ring-[color:var(--c-818cf8)]/50 transition"><Avatar id={datos.cuenta.id} version={datos.cuenta.avatarEn} nombre={datos.cuenta.nombre} tamano={34} /></button>
            : <div className="w-8 h-8 rounded-lg bg-[color:var(--c-272839)] flex items-center justify-center"><GraduationCap className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></div>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">{datos?.cuenta.nombre || 'Mi panel'}</p>
            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Estudiante</p>
          </div>
          <button onClick={() => { setVerUnirse(true); setAviso(null); }} className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-[color:var(--c-818cf8)]/15 border border-[color:var(--c-818cf8)]/35 text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/25"><Plus className="w-4 h-4" />Unirme a una clase</button>
          <button onClick={() => { setVerUnirse(true); setAviso(null); }} aria-label="Unirme a una clase" className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/15"><Plus className="w-4 h-4" /></button>
          <button onClick={cambiarTema} aria-label={claro ? 'Modo oscuro' : 'Modo claro'} className="w-9 h-9 flex items-center justify-center rounded-xl text-[color:var(--c-8a8b9e)] hover:text-amber-300 hover:bg-[color:var(--c-1d1e2e)]">{claro ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}</button>
          <button onClick={salir} aria-label="Cerrar sesión" className="w-9 h-9 flex items-center justify-center rounded-xl text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10"><LogOut className="w-4 h-4" /></button>
        </div>
        {/* Pestañas del panel */}
        {aceptadas.length > 0 && (
          <nav className="max-w-none mx-auto px-2 sm:px-4 lg:px-10 2xl:px-16 flex gap-0.5 overflow-x-auto sin-barra border-t border-[color:var(--c-282a3f)]">
            {PESTANAS.map(t => (
              <button key={t.id} type="button" onClick={() => setPestana(t.id)} className={`relative shrink-0 h-11 px-3 flex items-center gap-1.5 text-[13px] font-medium transition-colors ${pestana === t.id ? 'text-[color:var(--c-e0e0ec)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
                <t.icono className={`w-4 h-4 ${pestana === t.id ? 'text-[color:var(--c-818cf8)]' : ''}`} />{t.texto}
                {(contador[t.id] ?? 0) > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{contador[t.id]}</span>}
                {pestana === t.id && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-[color:var(--c-818cf8)]" />}
              </button>
            ))}
          </nav>
        )}
        {/* Una pestaña por clase */}
        {pestana === 'clases' && aceptadas.length > 1 && (
          <div className="max-w-none mx-auto px-4 lg:px-10 2xl:px-16 pb-2 flex gap-1.5 overflow-x-auto">
            {aceptadas.map(c => (
              <button key={c.id} onClick={() => { setActiva(c.id); setAbrirEval(null); }} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${c.id === activa ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/45 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>
                {c.materia || 'Todas sus materias'} · Prof. {c.profesor.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </header>

      {aviso && (
        <div className={`mx-4 lg:mx-10 2xl:mx-16 mt-3 px-4 py-2.5 rounded-xl text-sm flex items-start gap-2 ${aviso.tipo === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'}`}>
          <span className="flex-1">{aviso.texto}</span><button onClick={() => setAviso(null)} aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
      )}
      {pendientes.length > 0 && (
        <div className="max-w-none mx-auto px-4 lg:px-10 2xl:px-16 mt-3 space-y-2">
          {pendientes.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200">
              <Hourglass className="w-4 h-4 flex-shrink-0" />Esperando que {c.profesor} te acepte en {c.materia || 'su clase'}, Sección {c.seccion}.
            </div>
          ))}
        </div>
      )}

      {error && <p className="max-w-none mx-auto px-4 lg:px-10 2xl:px-16 mt-6 text-sm text-red-300">{error}</p>}
      {!datos && !error && <div className="flex items-center justify-center gap-3 mt-32 text-sm text-[color:var(--c-9a9bb0)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando tu panel…</div>}

      {/* Sin clases todavía: invitación a unirse */}
      {datos && !aceptadas.length && (
        <div className="max-w-md mx-auto mt-16 px-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center mb-4"><KeyRound className="w-7 h-7 text-[color:var(--c-a5b4fc)]" /></div>
          <h1 className="text-xl font-bold text-[color:var(--c-e0e0ec)]">{pendientes.length ? 'Tu solicitud está en camino' : 'Únete a tu primera clase'}</h1>
          <p className="text-sm text-[color:var(--c-9a9bb0)] mt-1.5">{pendientes.length ? 'Cuando tu profesor te acepte, aquí verás tu plan de evaluación, tus notas y tus entregas.' : 'Escribe el código que te dio tu profesor (por ejemplo ISW-A7K2).'}</p>
          <FormUnirse codigo={codigo} setCodigo={setCodigo} uniendo={uniendo} onUnirse={() => unirse(codigo)} />
        </div>
      )}

      {/* Mis clases: la clase elegida (la misma vista que tenía su enlace personal) */}
      {pestana === 'clases' && actual?.token && <PortalVista key={actual.token} token={actual.token} embebido abrir={abrirEval} />}

      {/* Las demás pestañas: todas sus clases juntas */}
      {datos && aceptadas.length > 0 && pestana !== 'clases' && (
        <main className="max-w-none mx-auto px-4 lg:px-10 2xl:px-16 py-6 pb-16">
          {pestana === 'config' ? (
            <Configuracion cuenta={datos.cuenta} onCuenta={(c) => setDatos(d => (d ? { ...d, cuenta: { ...d.cuenta, ...c } } : d))} claro={claro} onTema={cambiarTema}
              clases={clases} onSalir={salirDeClase} onUnirse={() => { setVerUnirse(true); setAviso(null); }} />
          ) : !resumen ? (
            <div className="flex items-center justify-center gap-3 py-24 text-sm text-[color:var(--c-9a9bb0)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando…</div>
          ) : pestana === 'inicio' ? <Inicio datos={resumen} nombre={datos.cuenta.nombre} onAbrir={abrirEnClase} onIr={(p) => setPestana(p as Pestana)} />
          : pestana === 'calendario' ? <Calendario datos={resumen} onAbrir={abrirEnClase} />
          : pestana === 'entregas' ? <Entregas datos={resumen} onCambio={(id, en) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.id === id ? { ...e, entrega: en } : e)) } : r))} />
          : pestana === 'notas' ? <Calificaciones datos={resumen} onAbrir={abrirEnClase} />
          : pestana === 'mensajes' ? <Mensajes datos={resumen} onLeidos={(id) => setResumen(r => (r ? { ...r, evaluaciones: r.evaluaciones.map(e => (e.id === id ? { ...e, mensajesNuevos: 0 } : e)) } : r))} />
          : null}
        </main>
      )}

      {verUnirse && (
        <div className="fixed inset-0 z-[200] bg-[color:var(--c-0b0b12)]/75 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setVerUnirse(false); }}>
          <div className="w-full max-w-sm bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-2xl">
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
