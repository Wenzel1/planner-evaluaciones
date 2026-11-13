'use client';

import { AlertCircle, Bell, CalendarDays, Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PanelRecordatorios from '@/components/PanelRecordatorios';
import { useRef, useState } from 'react';
import { ChoqueCalendario, SeccionExamen } from '@/components/planificador/tipos';
import { SelectorEstadoEvaluacion, VentanaFlotante } from '@/components/planificador/ui';
import { aInputFechaHora, duracionMin, estadoVisibleEvaluacion, limpiarTexto, medioEnvio } from '@/components/planificador/utilidades';

// ============================================
// CALENDARIO DE EVALUACIONES
// ============================================
// Colores por sección (clases completas para que Tailwind las detecte)
export const COLORES_SECCION: Record<string, { chip: string; punto: string; borde: string; texto: string }> = {
  A: { chip: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40', punto: 'bg-indigo-400', borde: 'border-indigo-400/50', texto: 'text-indigo-300' },
  B: { chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40', punto: 'bg-emerald-400', borde: 'border-emerald-400/50', texto: 'text-emerald-300' },
  C: { chip: 'bg-amber-500/20 text-amber-200 border-amber-400/40', punto: 'bg-amber-400', borde: 'border-amber-400/50', texto: 'text-amber-300' },
  D: { chip: 'bg-pink-500/20 text-pink-200 border-pink-400/40', punto: 'bg-pink-400', borde: 'border-pink-400/50', texto: 'text-pink-300' },
  E: { chip: 'bg-sky-500/20 text-sky-200 border-sky-400/40', punto: 'bg-sky-400', borde: 'border-sky-400/50', texto: 'text-sky-300' },
  F: { chip: 'bg-violet-500/20 text-violet-200 border-violet-400/40', punto: 'bg-violet-400', borde: 'border-violet-400/50', texto: 'text-violet-300' },
};
export const colorSeccion = (letra?: string) => COLORES_SECCION[(letra || 'A').toUpperCase()] || { chip: 'bg-slate-500/20 text-slate-200 border-slate-400/40', punto: 'bg-slate-400', borde: 'border-slate-400/50', texto: 'text-slate-300' };

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Clave de día en hora local: "2026-10-26"
export function claveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Lunes de la semana de esa fecha (clave)
export function claveSemana(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dia);
  return claveDia(x);
}
// 42 días (6 semanas, de lunes a domingo) que cubren el mes
export function diasDelMes(anio: number, mes: number): Date[] {
  const primero = new Date(anio, mes, 1);
  const inicio = new Date(primero);
  inicio.setDate(1 - ((primero.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}
// Choques por sección: 2+ evaluaciones el mismo día, o más de 2 en la misma semana (las canceladas no cuentan)
export function detectarChoques(lista: SeccionExamen[]): ChoqueCalendario[] {
  const porDia = new Map<string, SeccionExamen[]>();
  const porSemana = new Map<string, SeccionExamen[]>();
  for (const s of lista) {
    if (!s.fecha || String(s.estado || '').toUpperCase() === 'CANCELADA') continue;
    const f = new Date(s.fecha);
    if (isNaN(f.getTime())) continue;
    const sec = (s.grupoSeccion || 'A').toUpperCase();
    const kd = `${sec}|${claveDia(f)}`, ks = `${sec}|${claveSemana(f)}`;
    porDia.set(kd, [...(porDia.get(kd) || []), s]);
    porSemana.set(ks, [...(porSemana.get(ks) || []), s]);
  }
  const choques: ChoqueCalendario[] = [];
  porDia.forEach((evs, k) => { if (evs.length >= 2) { const [seccion, clave] = k.split('|'); choques.push({ tipo: 'dia', seccion, clave, evaluaciones: evs }); } });
  porSemana.forEach((evs, k) => { if (evs.length > 2) { const [seccion, clave] = k.split('|'); choques.push({ tipo: 'semana', seccion, clave, evaluaciones: evs }); } });
  return choques.sort((a, b) => a.clave.localeCompare(b.clave));
}

// ---------- Exportar a calendario (.ics) y Google Calendar ----------
export const pad2 = (n: number) => String(n).padStart(2, '0');
export function fechaIcs(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;
}
export function textoIcs(t: string): string {
  return String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
// Las líneas de un .ics no deben pasar de 75 caracteres: se parten con "salto + espacio"
export function plegarIcs(linea: string): string {
  if (linea.length <= 73) return linea;
  const partes: string[] = [];
  for (let i = 0; i < linea.length; i += 73) partes.push((i === 0 ? '' : ' ') + linea.slice(i, i + 73));
  return partes.join('\r\n');
}
export function tituloEvento(s: SeccionExamen, materia: string): string {
  return `${limpiarTexto(s.nombre)} · ${materia} (Sección ${(s.grupoSeccion || 'A').toUpperCase()})`;
}
export function detalleEvento(s: SeccionExamen): string {
  return [s.tipoActividad ? `Estrategia: ${s.tipoActividad}` : '', s.peso != null ? `Peso: ${s.peso}%` : '', s.enfoque ? `Enfoque: ${s.enfoque}` : ''].filter(Boolean).join('\n');
}
export function generarIcs(lista: SeccionExamen[], materia: string): string {
  const ahora = fechaIcs(new Date());
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planificador de Evaluaciones//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${textoIcs(`Evaluaciones - ${materia}`)}`,
  ];
  for (const s of lista) {
    if (!s.fecha || String(s.estado || '').toUpperCase() === 'CANCELADA') continue;
    const ini = new Date(s.fecha);
    if (isNaN(ini.getTime())) continue;
    const fin = new Date(ini.getTime() + duracionMin(s) * 60000);
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${textoIcs(s.id)}@planificador-evaluaciones`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${fechaIcs(ini)}`,
      `DTEND:${fechaIcs(fin)}`,
      `SUMMARY:${textoIcs(tituloEvento(s, materia))}`,
      `DESCRIPTION:${textoIcs(detalleEvento(s))}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Evaluación mañana', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegarIcs).join('\r\n') + '\r\n';
}
export function enlaceGoogleCalendar(s: SeccionExamen, materia: string): string | null {
  if (!s.fecha) return null;
  const ini = new Date(s.fecha);
  if (isNaN(ini.getTime())) return null;
  const fin = new Date(ini.getTime() + duracionMin(s) * 60000);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: tituloEvento(s, materia), dates: `${fechaIcs(ini)}/${fechaIcs(fin)}`, details: detalleEvento(s) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function CalendarioPanel({ secciones, materia, onCambiarFecha, onCambiarEstado, onIrAPlanificador, agregarNotificacion }: {
  secciones: SeccionExamen[]; materia: string;
  onCambiarFecha: (s: SeccionExamen, fecha: Date) => void;
  onCambiarEstado?: (s: SeccionExamen, estado: string, fecha?: Date) => Promise<boolean>;
  onIrAPlanificador: (s: SeccionExamen) => void;
  agregarNotificacion: (m: string) => void;
}) {
  const hoy = new Date();
  const [verRecordatorios, setVerRecordatorios] = useState(false);
  const [mesVista, setMesVista] = useState(() => ({ anio: hoy.getFullYear(), mes: hoy.getMonth() }));
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [verChoques, setVerChoques] = useState(false);

  const letras = Array.from(new Set(secciones.map(s => (s.grupoSeccion || 'A').toUpperCase()))).sort();
  const visibles = secciones.filter(s => !ocultas.includes((s.grupoSeccion || 'A').toUpperCase()));
  const conFecha = visibles.filter(s => s.fecha && !isNaN(new Date(s.fecha).getTime()));
  const sinFecha = visibles.filter(s => !s.fecha || isNaN(new Date(s.fecha).getTime()));
  const choques = detectarChoques(visibles);
  const diasConChoque = new Set(choques.filter(c => c.tipo === 'dia').map(c => c.clave));
  const semanasConChoque = new Set(choques.filter(c => c.tipo === 'semana').map(c => c.clave));

  const porDia = new Map<string, SeccionExamen[]>();
  for (const s of conFecha) {
    const k = claveDia(new Date(s.fecha as Date));
    porDia.set(k, [...(porDia.get(k) || []), s].sort((a, b) => new Date(a.fecha as Date).getTime() - new Date(b.fecha as Date).getTime()));
  }
  const dias = diasDelMes(mesVista.anio, mesVista.mes);
  const sel = secciones.find(s => s.id === selId) || null;
  const hoyClave = claveDia(hoy);

  const [direccionMes, setDireccionMes] = useState(0); // -1 = hacia atrás, 1 = hacia adelante (para la animación)
  const cambiarMes = (delta: number) => { setDireccionMes(delta); setMesVista(p => { const d = new Date(p.anio, p.mes + delta, 1); return { anio: d.getFullYear(), mes: d.getMonth() }; }); };
  const irHoy = () => { setDireccionMes((hoy.getFullYear() * 12 + hoy.getMonth()) >= (mesVista.anio * 12 + mesVista.mes) ? 1 : -1); setMesVista({ anio: hoy.getFullYear(), mes: hoy.getMonth() }); setDiaSel(hoyClave); };
  // Deslizar con el dedo (o el trackpad) sobre el calendario también cambia de mes
  const toqueX = useRef<number | null>(null);
  const esMovible = (s: SeccionExamen) => !['REALIZADA', 'CANCELADA'].includes(String(s.estado || '').toUpperCase());
  const horaTexto = (d: Date) => d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' });

  // Mueve la evaluación a otro día conservando su hora (8:00 si no tenía fecha)
  const moverADia = (id: string, dia: Date) => {
    const s = secciones.find(x => x.id === id);
    if (!s) return;
    if (!esMovible(s)) { agregarNotificacion('Las evaluaciones realizadas o canceladas no se pueden mover.'); return; }
    const base = s.fecha ? new Date(s.fecha) : null;
    const nueva = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), base ? base.getHours() : 8, base ? base.getMinutes() : 0);
    if (nueva.getTime() < Date.now()) { agregarNotificacion('⚠️ No puedes mover una evaluación a una fecha que ya pasó.'); return; }
    if (base && claveDia(base) === claveDia(nueva)) return;
    onCambiarFecha(s, nueva);
    setSelId(s.id); setDiaSel(claveDia(nueva));
  };

  const exportarIcs = () => {
    const lista = conFecha.filter(s => String(s.estado || '').toUpperCase() !== 'CANCELADA');
    if (lista.length === 0) { agregarNotificacion('No hay evaluaciones con fecha para exportar.'); return; }
    const blob = new Blob([generarIcs(lista, materia)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluaciones_${materia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40) || 'plan'}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    agregarNotificacion(`📅 Se descargó el calendario con ${lista.length} evaluación(es). Ábrelo para agregarlas a Google Calendar o al calendario del celular.`);
  };

  const listaLateral = diaSel
    ? (porDia.get(diaSel) || [])
    : conFecha.filter(s => new Date(s.fecha as Date).getTime() >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime())
        .sort((a, b) => new Date(a.fecha as Date).getTime() - new Date(b.fecha as Date).getTime()).slice(0, 8);

  const renderChip = (s: SeccionExamen, compacto = false) => {
    const c = colorSeccion(s.grupoSeccion);
    const est = estadoVisibleEvaluacion(s);
    const f = s.fecha ? new Date(s.fecha) : null;
    const movible = esMovible(s);
    const tachado = String(s.estado || '').toUpperCase() === 'CANCELADA';
    return (
      <div
        key={s.id}
        draggable={movible}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(s.id); }}
        onDragEnd={() => { setArrastrando(null); setDestino(null); }}
        onClick={(e) => { e.stopPropagation(); setSelId(s.id); if (f) setDiaSel(claveDia(f)); setNuevaFecha(''); }}
        title={`${limpiarTexto(s.nombre)} · Sección ${(s.grupoSeccion || 'A').toUpperCase()} · ${est.texto}${movible ? ' · Arrástrala para cambiar el día' : ''}`}
        className={`border rounded-md px-1.5 py-0.5 text-[10px] leading-tight cursor-pointer select-none transition-all ${c.chip} ${movible ? 'active:cursor-grabbing' : 'opacity-70'} ${selId === s.id ? 'ring-1 ring-white/60' : ''} ${arrastrando === s.id ? 'opacity-40' : ''}`}
      >
        <div className={`flex items-center gap-1 min-w-0 ${tachado ? 'line-through' : ''}`}>
          <span className="flex-shrink-0">{est.texto.split(' ')[0]}</span>
          {!compacto && f && <span className="flex-shrink-0 opacity-80">{horaTexto(f)}</span>}
          <span className="truncate font-medium">{limpiarTexto(s.nombre)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarDays className="w-6 h-6 text-[color:var(--c-818cf8)] flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">Calendario de evaluaciones</h2>
            <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{materia} · Arrastra una evaluación a otro día para cambiar su fecha</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button data-tutorial="cal-recordatorios" onClick={() => setVerRecordatorios(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/30 text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/20 transition-colors" title="Avisos automáticos a tus estudiantes antes de cada evaluación">
            <Bell className="w-4 h-4" />Recordatorios
          </button>
          <AnimatePresence>
            {verRecordatorios && (
              <VentanaFlotante onCerrar={() => setVerRecordatorios(false)} ancho="max-w-3xl">
                <PanelRecordatorios onCerrar={() => setVerRecordatorios(false)} notificar={agregarNotificacion} seccionActiva={(secciones[0]?.grupoSeccion || 'A').toUpperCase()} />
              </VentanaFlotante>
            )}
          </AnimatePresence>
          <button data-tutorial="cal-exportar" onClick={exportarIcs} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] text-[color:var(--c-c7d2fe)] hover:border-[color:var(--c-818cf8)]/50 hover:bg-[color:var(--c-818cf8)]/10 transition-colors" title="Descarga un archivo .ics para Google Calendar o el calendario del celular">
            <Download className="w-4 h-4" />Exportar calendario
          </button>
        </div>
      </div>

      {/* Navegación + filtros */}
      <div data-tutorial="cal-nav" className="flex flex-wrap items-center gap-2 bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-2">
        <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]" aria-label="Mes anterior"><ChevronLeft className="w-4 h-4" /></button>
        <span className="relative min-w-[150px] h-5 overflow-hidden text-center text-sm font-semibold text-[color:var(--c-e0e0ec)]"><AnimatePresence mode="popLayout" initial={false} custom={direccionMes}><motion.span key={`${mesVista.anio}-${mesVista.mes}`} custom={direccionMes} initial={{ y: direccionMes * 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: direccionMes * -14, opacity: 0 }} transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }} className="block">{MESES[mesVista.mes]} {mesVista.anio}</motion.span></AnimatePresence></span>
        <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]" aria-label="Mes siguiente"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={irHoy} className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--c-272839)] text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-2e2f42)]">Hoy</button>
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {letras.length === 0 && <span className="text-xs text-[color:var(--c-6a6b7e)] px-2">Sin evaluaciones todavía</span>}
          {letras.map(l => {
            const c = colorSeccion(l); const oculta = ocultas.includes(l);
            return (
              <button key={l} onClick={() => setOcultas(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l])}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${oculta ? 'border-[color:var(--c-313248)] text-[color:var(--c-6a6b7e)] line-through' : `${c.borde} ${c.texto} bg-white/5`}`}
                title={oculta ? `Mostrar sección ${l}` : `Ocultar sección ${l}`}>
                <span className={`w-2 h-2 rounded-full ${oculta ? 'bg-[color:var(--c-4a4b5e)]' : c.punto}`} />Sección {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Avisos de choques */}
      {choques.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 overflow-hidden">
          <button onClick={() => setVerChoques(v => !v)} className="w-full px-4 py-2.5 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-200">{choques.length} posible{choques.length === 1 ? '' : 's'} choque{choques.length === 1 ? '' : 's'} de fechas</span>
            <span className="text-xs text-red-300/80 hidden sm:inline">· misma sección con 2 evaluaciones el mismo día o más de 2 en una semana</span>
            <span className="ml-auto text-red-300">{verChoques ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          </button>
          {verChoques && (
            <ul className="px-4 pb-3 space-y-1.5">
              {choques.map((c, i) => {
                const [a, m, d] = c.clave.split('-').map(Number);
                const fecha = new Date(a, m - 1, d).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
                return (
                  <li key={i} className="text-xs text-red-100/90">
                    <strong>Sección {c.seccion}</strong> · {c.tipo === 'dia' ? `el ${fecha}` : `la semana del ${fecha}`}: {c.evaluaciones.map(e => limpiarTexto(e.nombre)).join(', ')}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Evaluaciones sin fecha: se pueden arrastrar al calendario */}
      {sinFecha.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[color:var(--c-8a8b9e)]">Sin fecha (arrástralas a un día):</span>
          {sinFecha.map(s => <div key={s.id} className="max-w-[220px]">{renderChip(s, true)}</div>)}
        </div>
      )}

      <div className="@container">
      <div className="grid @4xl:grid-cols-[1fr_300px] gap-4">
        {/* Cuadrícula del mes */}
        <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[color:var(--c-313248)]">
            {DIAS_SEMANA.map(d => <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">{d}</div>)}
          </div>
          <div data-tutorial="cal-grid" className="relative overflow-hidden"
            onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { if (toqueX.current == null) return; const dx = e.changedTouches[0].clientX - toqueX.current; toqueX.current = null; if (Math.abs(dx) > 60) cambiarMes(dx < 0 ? 1 : -1); }}>
          <AnimatePresence mode="popLayout" initial={false} custom={direccionMes}>
          <motion.div key={`${mesVista.anio}-${mesVista.mes}`} custom={direccionMes}
            initial={{ x: `${direccionMes * 100}%`, opacity: 0.4 }} animate={{ x: 0, opacity: 1 }} exit={{ x: `${direccionMes * -100}%`, opacity: 0.4 }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
            className="grid grid-cols-7">
            {dias.map((dia, i) => {
              const k = claveDia(dia);
              const delMes = dia.getMonth() === mesVista.mes;
              const evs = porDia.get(k) || [];
              const pasado = k < hoyClave;
              const choque = letras.some(l => diasConChoque.has(k) && evs.filter(e => (e.grupoSeccion || 'A').toUpperCase() === l && String(e.estado || '').toUpperCase() !== 'CANCELADA').length >= 2);
              const semanaCargada = i % 7 === 0 && Array.from(semanasConChoque).includes(k);
              const esDestino = destino === k;
              return (
                <div
                  key={k}
                  onClick={() => { setDiaSel(k === diaSel ? null : k); setSelId(null); }}
                  onDragOver={(e) => { if (!pasado) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (destino !== k) setDestino(k); } }}
                  onDragLeave={() => { if (destino === k) setDestino(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setDestino(null); setArrastrando(null); if (id) moverADia(id, dia); }}
                  className={`relative min-h-[64px] sm:min-h-[96px] p-1 sm:p-1.5 border-b border-r border-[color:var(--c-282a3f)] cursor-pointer transition-colors
                    ${(i + 1) % 7 === 0 ? 'border-r-0' : ''} ${delMes ? '' : 'bg-black/20'} ${pasado ? 'opacity-60' : ''}
                    ${diaSel === k ? 'bg-[color:var(--c-818cf8)]/10' : 'hover:bg-[color:var(--c-232438)]'} ${esDestino ? 'bg-[color:var(--c-818cf8)]/20 ring-2 ring-inset ring-[color:var(--c-818cf8)]' : ''}
                    ${choque ? 'ring-1 ring-inset ring-red-500/60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full ${k === hoyClave ? 'bg-[color:var(--c-818cf8)] text-white font-bold' : delMes ? 'text-[color:var(--c-c0c0cc)]' : 'text-[color:var(--c-5a5b6e)]'}`}>{dia.getDate()}</span>
                    {choque && <span className="text-[10px] text-red-300" title="Choque: 2 evaluaciones de la misma sección este día">⚠</span>}
                    {semanaCargada && !choque && <span className="text-[10px] text-amber-300" title="Semana con más de 2 evaluaciones en una sección">●</span>}
                  </div>
                  {/* En pantallas grandes: etiquetas; en el celular: puntos de color */}
                  <div className="hidden sm:flex flex-col gap-0.5">
                    {evs.slice(0, 3).map(s => renderChip(s))}
                    {evs.length > 3 && <span className="text-[10px] text-[color:var(--c-8a8b9e)] pl-1">+{evs.length - 3} más</span>}
                  </div>
                  <div className="flex sm:hidden flex-wrap gap-0.5">
                    {evs.map(s => <span key={s.id} className={`w-1.5 h-1.5 rounded-full ${colorSeccion(s.grupoSeccion).punto}`} />)}
                  </div>
                </div>
              );
            })}
          </motion.div>
          </AnimatePresence>
          </div>
        </div>

        {/* Panel lateral: detalle o lista del día / próximas */}
        <div className="space-y-3">
          {sel ? (() => {
            const c = colorSeccion(sel.grupoSeccion);
            const f = sel.fecha ? new Date(sel.fecha) : null;
            const google = enlaceGoogleCalendar(sel, materia);
            return (
              <div className={`bg-[color:var(--c-1d1e2e)] border ${c.borde} rounded-2xl p-4 space-y-3`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.punto}`} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">{limpiarTexto(sel.nombre)}</h3>
                    <p className="text-xs text-[color:var(--c-8a8b9e)]">Sección {(sel.grupoSeccion || 'A').toUpperCase()}</p>
                  </div>
                  <button onClick={() => setSelId(null)} className="p-1 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] rounded" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
                <div className="text-xs text-[color:var(--c-c0c0cc)] space-y-1">
                  <p>🗓️ {f ? f.toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : 'Sin fecha'}</p>
                  {sel.tipoActividad && <p>🎯 {sel.tipoActividad}</p>}
                  {sel.peso != null && <p>⚖️ Peso: {sel.peso}%</p>}
                  {sel.tiempoEstimadoMinutos ? <p>⏱️ {sel.tiempoEstimadoMinutos} min</p> : null}
                </div>
                <div className="flex items-center gap-2"><span className="text-xs text-[color:var(--c-8a8b9e)]">Estado:</span><SelectorEstadoEvaluacion seccion={sel} onCambiar={onCambiarEstado} /></div>
                {esMovible(sel) && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-[color:var(--c-8a8b9e)] block">Cambiar fecha y hora</label>
                    <div className="flex gap-2">
                      <input type="datetime-local" min={aInputFechaHora(new Date())} value={nuevaFecha || (f ? aInputFechaHora(f) : '')} onChange={(e) => setNuevaFecha(e.target.value)}
                        className="flex-1 min-w-0 bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg px-2 py-1.5 text-xs text-[color:var(--c-e0e0ec)] [color-scheme:dark]" />
                      <button disabled={!nuevaFecha} onClick={() => {
                        const d = new Date(nuevaFecha);
                        if (isNaN(d.getTime())) return;
                        if (d.getTime() < Date.now()) { agregarNotificacion('⚠️ La nueva fecha debe ser futura.'); return; }
                        onCambiarFecha(sel, d); setNuevaFecha(''); setDiaSel(claveDia(d)); setMesVista({ anio: d.getFullYear(), mes: d.getMonth() });
                      }} className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--c-818cf8)] text-white font-semibold disabled:opacity-40">Guardar</button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {google && <a href={google} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[color:var(--c-272839)] text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-2e2f42)]"><CalendarIcon className="w-3.5 h-3.5" />Google Calendar</a>}
                  <button onClick={() => onIrAPlanificador(sel)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[color:var(--c-272839)] text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-2e2f42)]"><ClipboardList className="w-3.5 h-3.5" />Ver en el planificador</button>
                </div>
              </div>
            );
          })() : null}

          <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-3">
              {diaSel ? (() => { const [a, m, d] = diaSel.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }); })() : 'Próximas evaluaciones'}
            </h3>
            {listaLateral.length === 0 ? (
              <p className="text-xs text-[color:var(--c-6a6b7e)]">{diaSel ? 'No hay evaluaciones este día.' : 'No hay evaluaciones próximas.'}</p>
            ) : (
              <div className="space-y-2">
                {listaLateral.map(s => {
                  const c = colorSeccion(s.grupoSeccion); const f = new Date(s.fecha as Date);
                  return (
                    <button key={s.id} onClick={() => { setSelId(s.id); setDiaSel(claveDia(f)); setNuevaFecha(''); }} className={`w-full text-left flex items-start gap-2 p-2 rounded-xl hover:bg-[color:var(--c-232438)] ${selId === s.id ? 'bg-[color:var(--c-232438)]' : ''}`}>
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${c.punto}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[color:var(--c-e0e0ec)] truncate">{limpiarTexto(s.nombre)}</p>
                        <p className="text-[11px] text-[color:var(--c-8a8b9e)]">{diaSel ? horaTexto(f) : f.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + horaTexto(f)} · Sec. {(s.grupoSeccion || 'A').toUpperCase()}</p>
                      </div>
                      <span className="text-[10px] flex-shrink-0">{estadoVisibleEvaluacion(s).texto.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {diaSel && <button onClick={() => setDiaSel(null)} className="mt-3 text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)]">Ver próximas evaluaciones</button>}
          </div>

          <p className="text-[11px] text-[color:var(--c-6a6b7e)] px-1">💡 Al cambiar la fecha de una evaluación, los recordatorios ({medioEnvio()}) se ajustan solos a la nueva fecha.</p>
        </div>
      </div>
      </div>
    </div>
  );
}
