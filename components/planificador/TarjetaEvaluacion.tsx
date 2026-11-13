'use client';

import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { Bell, CalendarDays, ChevronDown, ClipboardCheck, FileCheck, GraduationCap, GripVertical, Inbox, MoreVertical, Paperclip, Pencil, Trash2 } from 'lucide-react';
import DescripcionOrdenada from '@/components/DescripcionOrdenada';
import { admiteExamenEnLinea } from '@/lib/examen';
import { textoPuntos, totalRubrica } from '@/lib/rubrica';
import { useEffect, useRef, useState } from 'react';
import { SeccionExamen } from '@/components/planificador/tipos';
import { SelectorEstadoEvaluacion, Tooltip } from '@/components/planificador/ui';
import { esIdGuardado, limpiarTexto, precargar } from '@/components/planificador/utilidades';

// ============================================
// TARJETA DE EVALUACIÓN (draggable individual, fluida con Framer Motion)
// ============================================
export function TarjetaEvaluacion({ seccion, index, isSelected, onToggleSelect, expanded, onToggleExpand, onEdit, onDelete, onEnviar, enviando, onCambiarEstado, onRubrica, onNotas, onRecursos, onExamen, onRecordatorios, onEntregas }: {
  seccion: SeccionExamen; index: number; isSelected: boolean; onToggleSelect?: (id: string) => void;
  expanded: boolean; onToggleExpand: () => void; onEdit: (s: SeccionExamen) => void; onDelete: (id: string) => void;
  onEnviar: (s: SeccionExamen) => void; enviando: boolean; onCambiarEstado?: (s: SeccionExamen, estado: string, fecha?: Date) => Promise<boolean>;
  onRubrica?: (s: SeccionExamen) => void;
  onNotas?: (s: SeccionExamen) => void;
  onRecursos?: (s: SeccionExamen) => void;
  onExamen?: (s: SeccionExamen) => void;
  onRecordatorios?: (s: SeccionExamen) => void;
  onEntregas?: (s: SeccionExamen) => void;
}) {
  const dragControls = useDragControls();
  const nombreLimpio = limpiarTexto(seccion.nombre);
  // Menú "⋯": las acciones menos frecuentes quedan aquí para que la tarjeta se vea limpia
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent | TouchEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', fuera); document.addEventListener('touchstart', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('touchstart', fuera); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const cancelada = String(seccion.estado || '').toUpperCase() === 'CANCELADA';
  const tieneRubrica = !!seccion.rubrica?.criterios?.length;
  const nRecursos = seccion.recursos?.length || 0;
  const puedeExamen = !!onExamen && (!!seccion.examen || admiteExamenEnLinea(seccion.tipoActividad, seccion.enfoque, seccion.descripcion));
  const opciones = [
    onRubrica && { icono: ClipboardCheck, titulo: tieneRubrica ? 'Rúbrica' : 'Crear rúbrica', detalle: tieneRubrica ? `${textoPuntos(totalRubrica(seccion.rubrica))} pts · ver o editar` : 'Criterios y niveles de 20 puntos', hacer: () => onRubrica(seccion) },
    { icono: Pencil, titulo: 'Editar evaluación', detalle: 'Contenido, peso, fecha y descripción', hacer: () => onEdit(seccion) },
    puedeExamen && { icono: FileCheck, titulo: 'Examen en línea', detalle: seccion.examen ? `${seccion.examen.preguntas.length} preguntas · ver entregas` : 'Crear el examen que presentan en su página', hacer: () => onExamen!(seccion) },
    onRecordatorios && seccion.fecha && !['REALIZADA', 'CANCELADA'].includes(String(seccion.estado || '').toUpperCase()) && { icono: Bell, titulo: 'Recordatorios', detalle: 'Cuándo se avisa a los estudiantes · enviar ahora', hacer: () => onRecordatorios(seccion) },
    onEntregas && esIdGuardado(seccion.id) && !cancelada && { icono: Inbox, titulo: 'Entregas y mensajes', detalle: 'Quién entregó, abrir lo entregado y escribirles', hacer: () => onEntregas(seccion) },
    onNotas && !cancelada && { icono: GraduationCap, titulo: 'Planilla de notas', detalle: 'Calificar a toda la sección (exámenes presenciales, exposiciones…)', hacer: () => { precargar(`/api/evaluaciones/${encodeURIComponent(seccion.id)}/notas`); onNotas(seccion); } },
  ].filter(Boolean) as { icono: any; titulo: string; detalle: string; hacer: () => void }[];
  return (
    <Reorder.Item
      as="div"
      value={seccion}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{ scale: 1.03, boxShadow: '0 18px 40px rgba(0,0,0,0.45)', zIndex: 50, cursor: 'grabbing' }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      data-eval={seccion.id}
      className={`group bg-[color:var(--c-1f2035)] rounded-xl border border-[color:var(--c-313248)] hover:border-[color:var(--c-414258)] select-none relative ${menu ? 'z-30' : ''}`}
    >
      <div className="p-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-[color:var(--c-272839)] transition-all text-[color:var(--c-6a6b7e)] touch-none md:opacity-0 md:group-hover:opacity-100"
          title="Arrastra para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        {onToggleSelect ? (
          <Tooltip text={isSelected ? 'Incluida en el Plan de Acción (clic para quitarla)' : 'Fuera del Plan de Acción (clic para incluirla)'}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(seccion.id); }}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 border-2 transition-colors duration-150 ${isSelected ? 'bg-[color:var(--c-818cf8)] border-[color:var(--c-818cf8)] text-white' : 'bg-transparent border-[color:var(--c-4a4b5e)] text-[color:var(--c-8a8b9e)] hover:border-[color:var(--c-818cf8)]'}`}
            >
              {isSelected ? '✓' : index + 1}
            </button>
          </Tooltip>
        ) : (
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-[color:var(--c-272839)] ${isSelected ? 'text-[color:var(--c-c0c0d0)]' : 'text-[color:var(--c-5f6074)] line-through'}`} title={isSelected ? undefined : 'Fuera del Plan de Acción'}>{index + 1}</span>
        )}
        <div className="flex-1 min-w-[140px] cursor-pointer" onClick={onToggleExpand} title={expanded ? 'Ocultar detalle' : 'Ver detalle'}>
          <div className="flex items-center gap-2 min-w-0"><h4 className="text-sm text-[color:var(--c-e0e0ec)] font-medium truncate">{nombreLimpio}</h4></div>
          {/* Lo esencial a la vista: peso, fecha y estrategia. Lo demás, al expandir. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[color:var(--c-a0a1b5)]">
            {seccion.peso != null && <span className="font-semibold text-[color:var(--c-c7d2fe)]">{seccion.peso}%</span>}
            {seccion.fecha && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{new Date(seccion.fecha).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
            {seccion.tipoActividad && <span className="truncate max-w-[180px]">{seccion.tipoActividad}</span>}
            {/* Indicadores de lo que ya está listo */}
            {(tieneRubrica || seccion.examen) && (
              <span className="flex items-center gap-1.5 text-[color:var(--c-818cf8)]">
                {tieneRubrica && <span title="Tiene rúbrica"><ClipboardCheck className="w-3.5 h-3.5" /></span>}
                {seccion.examen && <span title="Tiene examen en línea"><FileCheck className="w-3.5 h-3.5" /></span>}
              </span>
            )}
            {(seccion.preparados ?? 0) > 0 && !['REALIZADA', 'CANCELADA'].includes(String(seccion.estado || '').toUpperCase()) && <span className="text-emerald-300" title="Marcaron «Ya me preparé» en su página">🙋 {seccion.preparados}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
          <SelectorEstadoEvaluacion seccion={seccion} onCambiar={onCambiarEstado} alinear="derecha" grande />
          {onRecursos && <Tooltip text={nRecursos ? `Recursos de estudio (${nRecursos})` : 'Recursos de estudio'}><button onClick={() => onRecursos(seccion)} aria-label="Recursos de estudio" className={`relative p-1.5 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-[color:var(--c-272839)] rounded-lg ${nRecursos ? 'text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)]'}`}><Paperclip className="w-4 h-4" />{nRecursos > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[color:var(--c-818cf8)] text-[9px] font-bold text-white flex items-center justify-center">{nRecursos}</span>}</button></Tooltip>}
          <Tooltip text={expanded ? 'Ocultar detalle' : 'Ver detalle'}><button onClick={onToggleExpand} aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'} aria-expanded={expanded}
            className={`p-1.5 rounded-lg transition-colors ${expanded ? 'text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/10' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-272839)]'}`}>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button></Tooltip>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(v => !v)} aria-label="Más opciones" aria-expanded={menu} title="Más opciones"
              className={`p-1.5 rounded-lg transition-colors ${menu ? 'text-[color:var(--c-e0e0ec)] bg-[color:var(--c-2c2d42)]' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]'}`}>
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-64 z-40 rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1b1c2b)] shadow-2xl shadow-black/50 p-1.5" role="menu">
                  {opciones.map(o => (
                    <button key={o.titulo} role="menuitem" onClick={() => { setMenu(false); o.hacer(); }} className="w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-[color:var(--c-272839)] transition-colors">
                      <o.icono className="w-4 h-4 mt-0.5 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
                      <span className="min-w-0"><span className="block text-[13px] text-[color:var(--c-e0e0ec)]">{o.titulo}</span><span className="block text-[11px] text-[color:var(--c-8a8b9e)] truncate">{o.detalle}</span></span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-[color:var(--c-2a2b3d)]" />
                  <button role="menuitem" onClick={() => { setMenu(false); onDelete(seccion.id); }} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left text-[13px] text-red-300 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />Eliminar evaluación
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <AnimatePresence>{expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[color:var(--c-313248)]">
          <div className="p-3 sm:pl-14 space-y-3">
            {/* Detalle que no hace falta ver siempre */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--c-a0a1b5)]">
              {seccion.enfoque && <span>📌 {seccion.enfoque}</span>}
              {seccion.tiempoEstimadoMinutos && <span>⏱️ {seccion.tiempoEstimadoMinutos} min</span>}
              {seccion.cantidadGrupos && <span>👥 {seccion.cantidadGrupos} grupos{seccion.personasPorGrupo ? ` de ${seccion.personasPorGrupo}` : ''}</span>}
              {seccion.fecha && <span>🕗 {new Date(seccion.fecha).toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</span>}
              {tieneRubrica && <span className="text-[color:var(--c-a5b4fc)]">📋 Rúbrica de {textoPuntos(totalRubrica(seccion.rubrica))} pts</span>}
            </div>
            {seccion.descripcion ? <DescripcionOrdenada texto={seccion.descripcion} /> : <p className="text-xs text-[color:var(--c-6a6b7e)]">Sin descripción. Puedes agregarla con «Editar evaluación» en el menú ⋯.</p>}
          </div>
        </motion.div>
      )}</AnimatePresence>
    </Reorder.Item>
  );
}
