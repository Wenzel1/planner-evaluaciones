'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock, FileSearch, Globe, Lightbulb, Moon, PenTool, Search, Sun, UsersRound, X } from 'lucide-react';
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SeccionExamen } from '@/components/planificador/tipos';
import { aInputFechaHora, estadoVisibleEvaluacion, inputBase } from '@/components/planificador/utilidades';

export function Tooltip({ text, children, lado = 'arriba', alinear = 'centro' }: { text: string; children: React.ReactNode; lado?: 'arriba' | 'abajo'; alinear?: 'centro' | 'derecha' }) {
  const vertical = lado === 'abajo' ? 'top-full mt-2' : 'bottom-full mb-2';
  const horizontal = alinear === 'derecha' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div role="tooltip" className={`absolute ${vertical} ${horizontal} px-2 py-1 bg-[color:var(--c-0d0e14)] text-[color:var(--c-d8d8e2)] text-[10px] rounded-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-[color:var(--c-313248)]`}>{text}</div>
    </div>
  );
}

export function DatePicker({ value, onChange, minimo }: { value: Date; onChange: (date: Date) => void; minimo?: Date }) {
  const [isOpen, setIsOpen] = useState(false); const [viewDate, setViewDate] = useState(() => new Date(value)); const containerRef = useRef<HTMLDivElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 }); const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; const year = viewDate.getFullYear(); const month = viewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const updatePosition = useCallback(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 280) }); } }, []); useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]); useEffect(() => { if (!isOpen) return; const handle = () => updatePosition(); window.addEventListener('resize', handle); window.addEventListener('scroll', handle, true); return () => { window.removeEventListener('resize', handle); window.removeEventListener('scroll', handle, true); }; }, [isOpen, updatePosition]); useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []); useEffect(() => { setViewDate(new Date(value)); }, [value]); const diaMin = minimo ? new Date(minimo.getFullYear(), minimo.getMonth(), minimo.getDate()).getTime() : -Infinity; const esPasado = (day: number) => new Date(year, month, day).getTime() < diaMin; const selectDate = (day: number) => { if (esPasado(day)) return; let d = new Date(year, month, day, value.getHours(), value.getMinutes()); if (minimo && d.getTime() < minimo.getTime()) { d = new Date(minimo); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); } onChange(d); }; const formatDisplay = (d: Date) => d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }); const selectedDate = value; const dropdownContent = isOpen && (<motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}><div className="p-4"><div className="flex items-center justify-between mb-4"><motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} disabled={new Date(year, month, 0).getTime() < diaMin} onClick={() => setViewDate(new Date(year, month - 1, 1))} className="disabled:opacity-25 disabled:pointer-events-none p-1.5 text-[color:var(--c-7a7b8e)] hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></motion.button><span className="text-sm font-medium text-[color:var(--c-d0d0da)]">{months[month]} {year}</span><motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 text-[color:var(--c-7a7b8e)] hover:text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></motion.button></div><div className="grid grid-cols-7 gap-1 mb-2">{daysOfWeek.map(d => (<div key={d} className="text-center text-xs text-[color:var(--c-6a6b7e)] font-medium py-1">{d}</div>))}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }).map((_, i) => (<div key={`e-${i}`} />))}{Array.from({ length: daysInMonth }).map((_, i) => { const day = i + 1; const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year; const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year; const pasado = esPasado(day); return (<motion.button key={day} whileHover={pasado ? undefined : { scale: 1.1 }} whileTap={pasado ? undefined : { scale: 0.9 }} disabled={pasado} title={pasado ? 'Esta fecha ya pasó' : undefined} onClick={() => selectDate(day)} className={`w-full aspect-square rounded-lg text-sm font-medium transition-all ${pasado ? 'text-[color:var(--c-3e3f52)] line-through cursor-not-allowed' : isSelected ? 'bg-[color:var(--c-818cf8)] text-white shadow-lg shadow-black/20' : isToday ? 'bg-[color:var(--c-272839)] text-[color:var(--c-818cf8)] border border-[color:var(--c-818cf8)]/30' : 'text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] hover:text-[color:var(--c-d0d0da)]'}`}>{day}</motion.button>); })}</div></div><div className="px-4 py-2 border-t border-[color:var(--c-282a3f)]"><button onClick={() => { const now = new Date(); onChange(now); setViewDate(now); setIsOpen(false); }} className="w-full text-center text-xs text-[color:var(--c-7a7b8e)] hover:text-[color:var(--c-b0b0c4)] py-1 rounded-lg hover:bg-[color:var(--c-272839)] transition-colors">Hoy</button></div></motion.div>); return (<div ref={containerRef}><button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputBase} flex items-center justify-between text-left cursor-pointer`}><span className="text-[color:var(--c-d8d8e2)] text-sm truncate">{formatDisplay(value)}</span><Calendar className="w-4 h-4 text-[color:var(--c-818cf8)] flex-shrink-0 ml-2" /></button>{createPortal(dropdownContent, document.body)}</div>);
}
export function TimePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [isOpen, setIsOpen] = useState(false); const [selectedHour, setSelectedHour] = useState(() => { const h = value.getHours(); return h % 12 || 12; }); const [selectedAmPm, setSelectedAmPm] = useState<'am' | 'pm'>(() => value.getHours() >= 12 ? 'pm' : 'am'); const [selectedMinute, setSelectedMinute] = useState(() => value.getMinutes()); const containerRef = useRef<HTMLDivElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 }); const minutesOptions = Array.from({ length: 12 }, (_, i) => i * 5); const updatePosition = useCallback(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 260) }); } }, []); useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]); useEffect(() => { if (!isOpen) return; const handle = () => updatePosition(); window.addEventListener('resize', handle); window.addEventListener('scroll', handle, true); return () => { window.removeEventListener('resize', handle); window.removeEventListener('scroll', handle, true); }; }, [isOpen, updatePosition]); useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []); useEffect(() => { const hours = value.getHours(); setSelectedHour(hours % 12 || 12); setSelectedAmPm(hours >= 12 ? 'pm' : 'am'); setSelectedMinute(value.getMinutes()); }, [value]); const convertTo24h = (h: number, ampm: 'am' | 'pm') => { if (ampm === 'am') return h === 12 ? 0 : h; return h === 12 ? 12 : h + 12; }; const handleTimeChange = (h: number, m: number, ampm: 'am' | 'pm') => { setSelectedHour(h); setSelectedMinute(m); setSelectedAmPm(ampm); const hour24 = convertTo24h(h, ampm); const d = new Date(value); d.setHours(hour24); d.setMinutes(m); onChange(d); }; const formatDisplay = (d: Date) => { const hours = d.getHours(); const minutes = d.getMinutes(); const ampm = hours >= 12 ? 'pm' : 'am'; const hours12 = hours % 12 || 12; return `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`; }; const dropdownContent = isOpen && (<motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}><div className="p-5"><div className="flex items-center gap-3 mb-4"><Clock className="w-5 h-5 text-[color:var(--c-818cf8)] flex-shrink-0" /><span className="text-sm text-[color:var(--c-b0b0c4)] font-medium">Seleccionar hora</span></div><div className="flex items-center gap-3 justify-center"><select value={selectedHour} onChange={(e) => handleTimeChange(parseInt(e.target.value), selectedMinute, selectedAmPm)} className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg px-4 py-3 text-lg text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/40 cursor-pointer w-24 text-center font-medium">{Array.from({ length: 12 }, (_, i) => i + 1).map(h => (<option key={h} value={h} className="bg-[color:var(--c-1f2035)]">{h}</option>))}</select><span className="text-[color:var(--c-8a8b9e)] font-bold text-xl">:</span><select value={selectedMinute} onChange={(e) => handleTimeChange(selectedHour, parseInt(e.target.value), selectedAmPm)} className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg px-4 py-3 text-lg text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]/40 cursor-pointer w-24 text-center font-medium">{minutesOptions.map(i => (<option key={i} value={i} className="bg-[color:var(--c-1f2035)]">{String(i).padStart(2, '0')}</option>))}</select><select value={selectedAmPm} onChange={(e) => handleTimeChange(selectedHour, selectedMinute, e.target.value as 'am' | 'pm')} className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-lg px-4 py-3 text-lg text-[color:var(--c-818cf8)] outline-none focus:border-[color:var(--c-818cf8)]/40 cursor-pointer w-24 text-center font-bold"><option value="am" className="bg-[color:var(--c-1f2035)]">AM</option><option value="pm" className="bg-[color:var(--c-1f2035)]">PM</option></select></div></div><div className="px-5 py-3 border-t border-[color:var(--c-282a3f)]"><button onClick={() => { const now = new Date(); onChange(now); const h = now.getHours(); setSelectedHour(h % 12 || 12); setSelectedAmPm(h >= 12 ? 'pm' : 'am'); setSelectedMinute(now.getMinutes()); setIsOpen(false); }} className="w-full text-center text-sm text-[color:var(--c-7a7b8e)] hover:text-[color:var(--c-b0b0c4)] py-1.5 rounded-lg hover:bg-[color:var(--c-272839)] transition-colors">Ahora</button></div></motion.div>); return (<div ref={containerRef}><button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputBase} flex items-center justify-between text-left cursor-pointer`}><span className="text-[color:var(--c-d8d8e2)] text-sm truncate">{formatDisplay(value)}</span><Clock className="w-4 h-4 text-[color:var(--c-818cf8)]/60 flex-shrink-0 ml-2" /></button>{createPortal(dropdownContent, document.body)}</div>);
}

// Ancho de la pantalla (se actualiza al girar el celular o cambiar el tamaño de la ventana)
export function useAnchoPantalla(): number {
  const [ancho, setAncho] = useState<number>(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const actualizar = () => setAncho(window.innerWidth);
    actualizar();
    window.addEventListener('resize', actualizar);
    return () => window.removeEventListener('resize', actualizar);
  }, []);
  return ancho;
}

// Colores y textos por rol (la franja superior y las etiquetas cambian según quién entró)
export const TEMA_ROL: Record<'SUPERADMIN' | 'ADMIN' | 'USUARIO', { etiqueta: string; descripcion: string; barra: string; fondo: string; texto: string; borde: string }> = {
  SUPERADMIN: { etiqueta: 'MODO SUPERADMIN', descripcion: 'Administración del sistema', barra: 'from-fuchsia-600 via-fuchsia-500 to-purple-500', fondo: 'bg-fuchsia-500/10', texto: 'text-fuchsia-300', borde: 'border-fuchsia-500/30' },
  ADMIN: { etiqueta: 'MODO ADMINISTRADOR', descripcion: 'Supervisión de profesores', barra: 'from-indigo-600 via-indigo-500 to-blue-500', fondo: 'bg-indigo-500/10', texto: 'text-indigo-300', borde: 'border-indigo-500/30' },
  USUARIO: { etiqueta: 'MODO PROFESOR', descripcion: 'Tu espacio de trabajo', barra: 'from-emerald-600 via-emerald-500 to-teal-500', fondo: 'bg-emerald-500/10', texto: 'text-emerald-300', borde: 'border-emerald-500/30' },
};

export function BandaRol({ rol }: { rol: 'SUPERADMIN' | 'ADMIN' | 'USUARIO' }) {
  const tema = TEMA_ROL[rol];
  return (
    <div className={`flex-shrink-0 relative flex items-center justify-center gap-2 h-6 ${tema.fondo} border-b ${tema.borde}`}>
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${tema.barra}`} />
      <span className={`text-[10px] font-bold tracking-[0.2em] ${tema.texto}`}>{tema.etiqueta}</span>
      <span className="text-[10px] text-[color:var(--c-8a8b9e)] hidden sm:inline">· {tema.descripcion}</span>
    </div>
  );
}

export function SelectorEstadoEvaluacion({ seccion, onCambiar, alinear = 'izquierda', grande = false }: { seccion: SeccionExamen; onCambiar?: (s: SeccionExamen, estado: string, fecha?: Date) => Promise<boolean>; alinear?: 'izquierda' | 'derecha'; grande?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [reprogramando, setReprogramando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [errorFecha, setErrorFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const v = estadoVisibleEvaluacion(seccion);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setAbierto(false); setReprogramando(false); } };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);
  const elegir = async (estado: string, fecha?: Date) => {
    if (!onCambiar) return;
    setGuardando(true);
    const ok = await onCambiar(seccion, estado, fecha);
    setGuardando(false);
    if (ok) { setAbierto(false); setReprogramando(false); }
  };
  const opcion = 'w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[color:var(--c-272839)] text-[color:var(--c-d0d0da)] disabled:opacity-50';
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" disabled={!onCambiar} onClick={() => setAbierto(a => !a)} title="Cambiar el estado de la evaluación"
        className={`${grande ? 'text-xs font-medium px-2.5 py-1.5 rounded-lg' : 'text-[10px] font-semibold px-2 py-0.5 rounded-full'} border whitespace-nowrap transition-colors ${v.clase} ${onCambiar ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}>
        {guardando ? '...' : v.texto}
      </button>
      {abierto && (
        <div className={`absolute z-50 ${alinear === 'derecha' ? 'right-0' : 'left-0'} top-full mt-1 w-60 p-1.5 bg-[color:var(--c-1b1c2b)] border border-[color:var(--c-313248)] rounded-xl shadow-2xl`}>
          {!reprogramando ? (
            <>
              <button disabled={guardando} className={opcion} onClick={() => elegir('REALIZADA')}>✅ Marcar como realizada</button>
              <button disabled={guardando} className={opcion} onClick={() => { setReprogramando(true); setNuevaFecha(aInputFechaHora(new Date(Date.now() + 7 * 864e5))); }}>🔁 Reprogramar…</button>
              <button disabled={guardando} className={opcion} onClick={() => elegir('CANCELADA')}>⛔ Cancelar evaluación</button>
              {String(seccion.estado || 'PROGRAMADA').toUpperCase() !== 'PROGRAMADA' && (
                <button disabled={guardando} className={opcion} onClick={() => elegir('PROGRAMADA')}>🗓 Volver a programada</button>
              )}
            </>
          ) : (
            <div className="p-2 space-y-2">
              <label className="text-[11px] text-[color:var(--c-8a8b9e)] block">Nueva fecha y hora</label>
              <input type="datetime-local" value={nuevaFecha} min={aInputFechaHora(new Date())} onChange={(e) => setNuevaFecha(e.target.value)}
                className="w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2 py-1.5 text-xs text-[color:var(--c-e0e0ec)] [color-scheme:dark]" />
              {errorFecha ? <p className="text-[10px] text-red-300">{errorFecha}</p> : <p className="text-[10px] text-[color:var(--c-6a6b7e)]">Los recordatorios se enviarán de nuevo para la nueva fecha.</p>}
              <div className="flex gap-2">
                <button className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[color:var(--c-272839)] text-[color:var(--c-b0b0c4)]" onClick={() => setReprogramando(false)}>Volver</button>
                <button disabled={guardando || !nuevaFecha} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[color:var(--c-818cf8)] text-white font-semibold disabled:opacity-50"
                  onClick={() => { const d = new Date(nuevaFecha); if (isNaN(d.getTime()) || d.getTime() < Date.now()) { setErrorFecha('Elige una fecha y hora que no hayan pasado.'); return; } setErrorFecha(''); elegir('REPROGRAMADA', d); }}>Guardar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// VENTANA FLOTANTE (mismo estilo que Rúbrica, Recursos y Notas)
// ============================================
export function VentanaFlotante({ children, onCerrar, ancho = 'max-w-2xl' }: { children: React.ReactNode; onCerrar: () => void; ancho?: string }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow; };
  }, []);
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-[200] bg-[color:var(--c-0b0b12)]/75 flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16, ease: 'easeOut' }}
        className={`w-full ${ancho} max-h-[92vh] overflow-y-auto custom-scrollbar rounded-2xl shadow-2xl`}>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ============================================
// COMBOBOX ENFOQUE
// ============================================
export function EnfoqueCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false); const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const categorias = [
    { nombre: 'Tipo de Evaluación', color: 'text-blue-400', icon: ClipboardCheck, opciones: ['Teórico', 'Práctico', 'Mixto', 'Teórico-Práctico', 'Formativo', 'Sumativo'] },
    { nombre: 'Metodología', color: 'text-purple-400', icon: Lightbulb, opciones: ['Proyecto', 'Investigación', 'Aplicado', 'Experimental', 'ABP', 'Cooperativo', 'Aula invertida', 'Gamificación', 'Design Thinking'] },
    { nombre: 'Modalidad', color: 'text-emerald-400', icon: UsersRound, opciones: ['Colaborativo', 'Individual', 'Grupal', 'Taller', 'Seminario', 'Laboratorio', 'Trabajo de campo', 'Simulación'] },
    { nombre: 'Actividad', color: 'text-amber-400', icon: PenTool, opciones: ['Análisis de caso', 'Diseño', 'Desarrollo', 'Diagnóstico', 'Portafolio', 'Resolución de problemas', 'Role playing', 'Debate', 'Exposición', 'Ensayo', 'Demostración', 'Observación'] },
    { nombre: 'Forma', color: 'text-pink-400', icon: FileSearch, opciones: ['Escrito', 'Oral', 'Autoevaluación', 'Coevaluación', 'Heteroevaluación'] },
    { nombre: 'Alcance', color: 'text-cyan-400', icon: Globe, opciones: ['Interdisciplinario', 'Transversal', 'Complementario'] },
  ];
  const updatePosition = useCallback(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 360) }); } }, []);
  useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]);
  useEffect(() => { if (!isOpen) return; const handle = () => updatePosition(); window.addEventListener('resize', handle); window.addEventListener('scroll', handle, true); return () => { window.removeEventListener('resize', handle); window.removeEventListener('scroll', handle, true); }; }, [isOpen, updatePosition]);
  useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const filteredCategorias = categorias.map(cat => ({ ...cat, opciones: cat.opciones.filter(op => op.toLowerCase().includes(searchTerm.toLowerCase())) })).filter(cat => cat.opciones.length > 0);
  const handleSelect = (op: string) => { onChange(op); setSearchTerm(''); setIsOpen(false); };
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => { onChange(e.target.value); setSearchTerm(e.target.value); if (!isOpen) setIsOpen(true); };
  const dropdownContent = isOpen && (
    <motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
      <div className="p-3 border-b border-[color:var(--c-313248)]"><div className="flex items-center gap-2 px-3 py-2 bg-[color:var(--c-191a26)] rounded-lg border border-[color:var(--c-282a3f)]"><Search className="w-4 h-4 text-[color:var(--c-6a6b7e)] flex-shrink-0" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar enfoque..." className="flex-1 bg-transparent text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-4a4b5e)] outline-none" autoFocus />{searchTerm && <button onClick={() => { setSearchTerm(''); onChange(''); }} className="text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-9a9bae)]"><X className="w-3.5 h-3.5" /></button>}</div></div>
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
        {filteredCategorias.map((cat, catIdx) => (<div key={cat.nombre} className={catIdx > 0 ? 'mt-2' : ''}><div className="flex items-center gap-2 px-3 py-2"><cat.icon className={`w-4 h-4 ${cat.color}`} /><span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>{cat.nombre}</span><div className="flex-1 h-px bg-[color:var(--c-282a3f)]" /></div>
        <div className="flex flex-wrap gap-1.5 px-2 pb-2">
          {cat.opciones.map(op => (<motion.button key={op} type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSelect(op)} className={`px-3.5 py-2 text-sm rounded-lg border transition-all cursor-pointer ${value === op ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/30 text-[color:var(--c-818cf8)] font-medium' : 'bg-[color:var(--c-191a26)] border-[color:var(--c-282a3f)] text-[color:var(--c-9a9bae)] hover:border-[color:var(--c-414258)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-232430)]'}`}>{op}</motion.button>))}
        </div></div>))}
      </div>
    </motion.div>
  );
  return (<div ref={containerRef}><div className="relative"><input ref={inputRef} type="text" value={value} onChange={handleInputChange} onFocus={() => { setIsOpen(true); setSearchTerm(''); }} placeholder="Escribe o selecciona..." className={`${inputBase} pr-8`} /><button type="button" onClick={() => { setIsOpen(!isOpen); if (!isOpen) inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-818cf8)] transition-colors"><ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} /></button></div>{createPortal(dropdownContent, document.body)}</div>);
}

// ============================================
// AGENTE PANEL (CON SCROLL MEJORADO)
// ============================================
// Mientras el agente piensa, la frase va cambiando para que se note que avanza
export function FrasePensando() {
  const FRASES = ['Leyendo tu plan…', 'Pensando…', 'Revisando los detalles…', 'Preparando la respuesta…'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(v => Math.min(v + 1, FRASES.length - 1)), 2200); return () => clearInterval(t); }, []);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="eva-brillo text-xs font-medium">{FRASES[i]}</motion.span>
    </AnimatePresence>
  );
}

// Selector de materia (cada materia tiene su propio plan). Cambiar de materia guarda lo pendiente y recarga.
// Modo claro / oscuro: se guarda en este navegador y se aplica a toda la app (y a la página del estudiante)
export function BotonTema() {
  const [claro, setClaro] = useState(false);
  useEffect(() => { setClaro(document.documentElement.classList.contains('claro')); }, []);
  const cambiar = () => {
    const html = document.documentElement;
    const nuevo = !html.classList.contains('claro');
    html.classList.add('cambiando-tema');
    html.classList.toggle('claro', nuevo);
    try { localStorage.setItem('tema', nuevo ? 'claro' : 'oscuro'); } catch { /* sin almacenamiento */ }
    setClaro(nuevo);
    setTimeout(() => html.classList.remove('cambiando-tema'), 400);
  };
  return (
    <Tooltip text={claro ? 'Modo oscuro' : 'Modo claro'} lado="abajo">
      <motion.button onClick={cambiar} data-tutorial="tema" aria-label={claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden text-[color:var(--c-8a8b9e)] hover:text-amber-300 hover:bg-[color:var(--c-1d1e2e)] transition-colors">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={claro ? 'luna' : 'sol'} initial={{ y: 14, rotate: -90, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -14, rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }} className="flex">
            {claro ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
}

// Lo que se ve mientras se descarga un panel que se carga bajo demanda
export function CargandoPanel() {
  return (
    <div className="py-16 flex items-center justify-center gap-3 text-sm text-[color:var(--c-8a8b9e)]">
      <span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)]/30 border-t-[color:var(--c-818cf8)] rounded-full animate-spin" />
      Cargando…
    </div>
  );
}
