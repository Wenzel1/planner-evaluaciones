'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Mensaje, TipoNotif } from '@/components/planificador/tipos';
import { haceCuanto } from '@/components/planificador/utilidades';

export const ESTILO_NOTIF: Record<TipoNotif, { chip: string; barra: string; borde: string; etiqueta: string }> = {
  exito:   { chip: 'bg-emerald-500/15 text-emerald-300', barra: 'bg-emerald-400', borde: 'border-emerald-500/30', etiqueta: 'Listo' },
  alerta:  { chip: 'bg-amber-500/15 text-amber-300', barra: 'bg-amber-400', borde: 'border-amber-500/30', etiqueta: 'Atención' },
  error:   { chip: 'bg-red-500/15 text-red-300', barra: 'bg-red-400', borde: 'border-red-500/30', etiqueta: 'Error' },
  envio:   { chip: 'bg-sky-500/15 text-sky-300', barra: 'bg-sky-400', borde: 'border-sky-500/30', etiqueta: 'Envío' },
  borrado: { chip: 'bg-rose-500/15 text-rose-300', barra: 'bg-rose-400', borde: 'border-rose-500/30', etiqueta: 'Eliminado' },
  mensaje: { chip: 'bg-violet-500/15 text-violet-300', barra: 'bg-violet-400', borde: 'border-violet-500/30', etiqueta: 'Mensaje' },
  info:    { chip: 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-a5b4fc)]', barra: 'bg-[color:var(--c-818cf8)]', borde: 'border-[color:var(--c-818cf8)]/30', etiqueta: 'Aviso' },
};
export function analizarNotificacion(mensaje: string): { emoji: string; texto: string; tipo: TipoNotif } {
  const m = String(mensaje || '').match(/^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic})️?)*)\s*/u);
  const emoji = m ? m[1] : '';
  const texto = m ? mensaje.slice(m[0].length) : mensaje;
  const e = emoji.replace(/️/g, '');
  let tipo: TipoNotif = 'info';
  if (/[✅🎉👍💾✨]/u.test(e) || /guardad|correctamente|generado|copiad/i.test(texto)) tipo = 'exito';
  if (/[📤📲📨📧]/u.test(e) || /enviad|enviando/i.test(texto)) tipo = 'envio';
  if (/[💬🗳🔔]/u.test(e)) tipo = 'mensaje';
  if (/🗑/u.test(e) || /eliminad|quitad|borrad/i.test(texto)) tipo = 'borrado';
  if (/⚠/u.test(e) || /revisa|atención|cuidado/i.test(texto)) tipo = 'alerta';
  if (/[❌🚫⛔]/u.test(e) || /^error|no se pudo|falló/i.test(texto)) tipo = 'error';
  return { emoji: emoji || '🔔', texto, tipo };
}

// Avisos emergentes: aparecen arriba a la derecha y se van solos a los 5 s (al pasar el mouse se quedan)
export function AvisosEmergentes({ notificaciones, setNotificaciones }: { notificaciones: { id: string; mensaje: string; timestamp: Date; leido: boolean }[]; setNotificaciones: any }) {
  const vistos = useRef<Set<string> | null>(null);
  const [avisos, setAvisos] = useState<{ id: string; mensaje: string }[]>([]);
  useEffect(() => {
    if (vistos.current === null) { vistos.current = new Set(notificaciones.map(n => n.id)); return; } // las que ya estaban al entrar no salen como aviso
    const nuevas = notificaciones.filter(n => !vistos.current!.has(n.id));
    if (nuevas.length === 0) return;
    nuevas.forEach(n => vistos.current!.add(n.id));
    setAvisos(prev => [...nuevas.reverse().map(n => ({ id: n.id, mensaje: n.mensaje })), ...prev].slice(0, 4));
  }, [notificaciones]);
  const cerrar = (id: string) => setAvisos(prev => prev.filter(a => a.id !== id));
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed z-[300] top-[72px] right-3 left-3 sm:left-auto sm:w-[380px] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {avisos.map(a => (
          <AvisoEmergente key={a.id} id={a.id} mensaje={a.mensaje} onCerrar={() => cerrar(a.id)} onLeer={() => { setNotificaciones((prev: any[]) => prev.map(n => (n.id === a.id ? { ...n, leido: true } : n))); cerrar(a.id); }} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
export function AvisoEmergente({ mensaje, onCerrar, onLeer }: { id: string; mensaje: string; onCerrar: () => void; onLeer: () => void }) {
  const { emoji, texto, tipo } = analizarNotificacion(mensaje);
  const est = ESTILO_NOTIF[tipo];
  const [pausado, setPausado] = useState(false);
  const DURACION = 5000;
  const restante = useRef(DURACION);
  const inicio = useRef(Date.now());
  useEffect(() => {
    if (pausado) { restante.current -= Date.now() - inicio.current; return; }
    inicio.current = Date.now();
    const t = setTimeout(onCerrar, Math.max(300, restante.current));
    return () => clearTimeout(t);
  }, [pausado]);
  return (
    <motion.div layout initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${est.borde} bg-[color:var(--c-1c1d2a)]/95 backdrop-blur-md shadow-2xl shadow-black/50`}>
      <div className="flex items-start gap-3 p-3 pr-2">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${est.chip}`}>{emoji}</span>
        <button type="button" onClick={onLeer} className="flex-1 min-w-0 text-left">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[color:var(--c-8a8b9e)]">{est.etiqueta}</p>
          <p className="text-sm text-[color:var(--c-e0e0ec)] leading-snug break-words">{texto}</p>
        </button>
        <button type="button" onClick={onCerrar} className="p-1 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)] rounded-md flex-shrink-0" aria-label="Cerrar aviso"><X className="w-4 h-4" /></button>
      </div>
      <motion.div className={`absolute bottom-0 left-0 h-[3px] ${est.barra} opacity-70`} initial={{ width: '100%' }} animate={{ width: pausado ? undefined : '0%' }} transition={{ duration: DURACION / 1000, ease: 'linear' }} />
    </motion.div>
  );
}

export function CampanitaNotificacionesFlotante({ notificaciones, setNotificaciones, campanaActiva, setCampanaActiva }: any) {
  const [mostrarPanel, setMostrarPanel] = useState(false); const panelRef = useRef<HTMLDivElement>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setMostrarPanel(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  useEffect(() => { if (!mostrarPanel) return; setAhora(Date.now()); const t = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(t); }, [mostrarPanel]);
  const noLeidas = notificaciones.filter((n: any) => !n.leido);
  const leidas = notificaciones.filter((n: any) => n.leido);
  // La campana "suena" cuando llega una nueva
  const [timbre, setTimbre] = useState(0);
  const cuantas = useRef(notificaciones.length);
  useEffect(() => { if (notificaciones.length > cuantas.current) setTimbre(t => t + 1); cuantas.current = notificaciones.length; }, [notificaciones.length]);
  const toggleNotificaciones = () => { setMostrarPanel(!mostrarPanel); if (!campanaActiva) setCampanaActiva(true); };
  const marcarTodas = () => setNotificaciones((prev: any[]) => prev.map(n => ({ ...n, leido: true })));
  const quitar = (id: string) => setNotificaciones((prev: any[]) => prev.filter(n => n.id !== id));

  const fila = (notif: any) => {
    const { emoji, texto, tipo } = analizarNotificacion(notif.mensaje);
    const est = ESTILO_NOTIF[tipo];
    return (
      <motion.div layout key={notif.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
        onClick={() => setNotificaciones((prev: any) => prev.map((n: any) => (n.id === notif.id ? { ...n, leido: true } : n)))}
        className={`group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${notif.leido ? 'hover:bg-[color:var(--c-232438)]' : 'bg-[color:var(--c-272839)]/70 hover:bg-[color:var(--c-2e2f42)]'}`}>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${est.chip} ${notif.leido ? 'opacity-60' : ''}`}>{emoji}</span>
        <div className="flex-1 min-w-0 pr-5">
          <p className={`text-[13px] leading-snug break-words ${notif.leido ? 'text-[color:var(--c-8a8b9e)]' : 'text-[color:var(--c-e0e0ec)]'}`}>{texto}</p>
          <p className="text-[10px] text-[color:var(--c-6a6b7e)] mt-1 flex items-center gap-1.5">
            {!notif.leido && <span className={`w-1.5 h-1.5 rounded-full ${est.barra}`} />}
            {est.etiqueta} · {haceCuanto(notif.timestamp, ahora)}
          </p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); quitar(notif.id); }} className="absolute top-2 right-2 p-1 rounded-md text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)] hover:bg-[color:var(--c-313248)] opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Quitar"><X className="w-3.5 h-3.5" /></button>
      </motion.div>
    );
  };

  return (
    <div className="relative" ref={panelRef} data-tutorial="notificaciones">
      <AvisosEmergentes notificaciones={notificaciones} setNotificaciones={setNotificaciones} />
      <button onClick={toggleNotificaciones} className={`p-2 rounded-lg transition-colors relative ${mostrarPanel ? 'text-[color:var(--c-818cf8)] bg-[color:var(--c-272839)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-272839)]'}`} aria-label="Notificaciones">
        <motion.span key={timbre} className="block" animate={timbre ? { rotate: [0, -18, 15, -10, 6, 0] } : {}} transition={{ duration: 0.6 }} style={{ transformOrigin: '50% 10%' }}>
          <Bell className="w-5 h-5" />
        </motion.span>
        {noLeidas.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold ring-2 ring-[color:var(--c-161722)]">
            {noLeidas.length > 9 ? '9+' : noLeidas.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {mostrarPanel && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[540px] flex flex-col overflow-hidden bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl shadow-black/60 z-50">
            <div className="px-4 py-3 border-b border-[color:var(--c-282a3f)] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[color:var(--c-818cf8)]" />
              <h3 className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Notificaciones</h3>
              {noLeidas.length > 0 && <span className="bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)] text-[10px] font-semibold px-2 py-0.5 rounded-full">{noLeidas.length} nueva{noLeidas.length === 1 ? '' : 's'}</span>}
              <div className="ml-auto flex items-center gap-1">
                {noLeidas.length > 0 && <button onClick={marcarTodas} className="text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)] px-2 py-1 rounded-lg hover:bg-[color:var(--c-272839)] transition-colors">Marcar leídas</button>}
                {notificaciones.length > 0 && <button onClick={() => setNotificaciones([])} className="text-[11px] text-[color:var(--c-8a8b9e)] hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">Limpiar</button>}
              </div>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar">
              {notificaciones.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-center">
                  <span className="w-12 h-12 rounded-2xl bg-[color:var(--c-272839)] flex items-center justify-center"><Bell className="w-5 h-5 text-[color:var(--c-6a6b7e)]" /></span>
                  <p className="text-sm text-[color:var(--c-b0b0c4)]">Todo al día</p>
                  <p className="text-xs text-[color:var(--c-6a6b7e)]">Aquí verás lo que pase en la app: guardados, envíos, opiniones…</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {noLeidas.length > 0 && <p key="t-nuevas" className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-wider font-semibold text-[color:var(--c-8a8b9e)]">Nuevas</p>}
                  {noLeidas.map(fila)}
                  {leidas.length > 0 && <p key="t-anteriores" className="px-2 pt-3 pb-1.5 text-[10px] uppercase tracking-wider font-semibold text-[color:var(--c-6a6b7e)]">Anteriores</p>}
                  {leidas.map(fila)}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
