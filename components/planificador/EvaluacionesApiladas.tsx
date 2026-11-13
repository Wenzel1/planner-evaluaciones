'use client';

import { AlertCircle, ChevronDown, ChevronUp, FileSpreadsheet, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dispatch, SetStateAction } from 'react';
import EditorDescripcion, { tieneSecciones } from '@/components/EditorDescripcion';
import StreamInput from '@/components/StreamInput';
import StreamTextarea from '@/components/StreamTextarea';
import { EvaluacionFormulario } from '@/components/planificador/tipos';
import { DatePicker, EnfoqueCombobox, TimePicker, Tooltip } from '@/components/planificador/ui';
import { LIMITES, inputBase, labelBase, validarContenidoSE, validarEnfoque } from '@/components/planificador/utilidades';

export const smallInput = "w-full h-12 px-2.5 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] focus:border-[color:var(--c-818cf8)]/40 outline-none transition-all duration-200 font-['Inter'] text-center";
export const textareaBase = "w-full px-4 py-3 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] focus:border-[color:var(--c-818cf8)]/40 outline-none transition-all duration-200 font-['Inter'] resize-vertical custom-scrollbar";

// ============================================
// CÁLCULO AUTOMÁTICO DE GRUPOS
// ============================================
export function calcularDistribucionGrupos(totalEstudiantes: number, personasPorGrupo: number | null): { cantidadGrupos: number; sobrantes: number } {
  if (!personasPorGrupo || personasPorGrupo <= 0 || totalEstudiantes <= 0) {
    return { cantidadGrupos: 0, sobrantes: 0 };
  }
  const cantidadGrupos = Math.floor(totalEstudiantes / personasPorGrupo);
  const sobrantes = totalEstudiantes % personasPorGrupo;
  return { cantidadGrupos, sobrantes };
}

export function calcularPersonasPorGrupo(totalEstudiantes: number, cantidadGrupos: number | null): number {
  if (!cantidadGrupos || cantidadGrupos <= 0 || totalEstudiantes <= 0) return 0;
  return Math.ceil(totalEstudiantes / cantidadGrupos);
}

// ============================================
// EVALUACIONES APILADAS (CON STREAMING EN CAMPOS)
// ============================================
export function EvaluacionesApiladas({ evaluacion1, setEvaluacion1, guardarEvaluacion1, limpiarEvaluacion1, evaluacion2, setEvaluacion2, guardarEvaluacion2, limpiarEvaluacion2, evaluacion3, setEvaluacion3, guardarEvaluacion3, limpiarEvaluacion3, evaluacion4, setEvaluacion4, guardarEvaluacion4, limpiarEvaluacion4, numEvaluaciones, setNumEvaluaciones, justFilled1, justFilled2, justFilled3, justFilled4, totalEstudiantes = 8 }: any) {

  const renderFormulario = (ev: EvaluacionFormulario, setEv: Dispatch<SetStateAction<EvaluacionFormulario>>, guardar: () => void, limpiar: () => void, titulo: string, index: number, isGlowing: boolean) => {

    const validarCampoAlBlur = (campo: 'materia' | 'tipoActividad' | 'enfoque' | 'descripcion', valor: string) => {
    if (!valor.trim()) {
      setEv(prev => ({ ...prev, errores: { ...prev.errores, [campo]: undefined } }));
      return;
    }
    if (campo === 'enfoque') {
      const r = validarEnfoque(valor);
      setEv(prev => ({ ...prev, errores: { ...prev.errores, [campo]: r.valido ? undefined : r.error } }));
    } else {
      // Si el contenido de este campo todavía proviene del agente (no editado manualmente
      // por el usuario), se omite la validación de palabras clave de la materia, ya que el
      // agente puede usar sinónimos que no están en la lista y bloquearía el guardado sin motivo.
      if (ev.origenAgente?.[campo as 'materia' | 'tipoActividad' | 'descripcion']) {
        setEv(prev => ({ ...prev, errores: { ...prev.errores, [campo]: undefined } }));
        return;
      }
      // materia, tipoActividad y descripcion usan validación de SE
      const r = validarContenidoSE(valor);
      setEv(prev => ({ ...prev, errores: { ...prev.errores, [campo]: r.valido ? undefined : r.error } }));
    }
  };

  const limpiarError = (campo: 'materia' | 'tipoActividad' | 'descripcion') => {
    setEv((prev: EvaluacionFormulario) => ({ ...prev, errores: { ...prev.errores, [campo]: undefined } }));
  };

  const tieneErrores = ev.errores && Object.values(ev.errores).some(e => e);

  return (
    <motion.div
      key={titulo}
      initial={{ opacity: 0, height: 0, y: 10 }}
      animate={{
        opacity: 1, height: 'auto', y: 0,
        borderColor: tieneErrores ? '#f87171' : isGlowing ? '#4f8bf0' : '#313248',
        boxShadow: tieneErrores ? '0 0 12px -3px rgba(248,113,113,0.3)' : isGlowing ? '0 0 15px -3px rgba(129,140,248,0.4)' : '0 0 0 0 rgba(0,0,0,0)'
      }}
      exit={{ opacity: 0, height: 0, y: -10 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="bg-[color:var(--c-1d1e2e)] border rounded-2xl shadow-xl overflow-hidden p-5 space-y-2.5"
    >
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[color:var(--c-313248)]">
        <FileSpreadsheet className="w-4 h-4 text-[color:var(--c-818cf8)]" />
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)]">{titulo}</h3>
        {tieneErrores && (
          <span className="ml-2 flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" /> Corrige los errores
          </span>
        )}
        {index > 1 && (
          <button onClick={() => { limpiar(); setNumEvaluaciones((prev: number) => prev - 1); }} className="ml-auto p-1 text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ---- CAMPO MATERIA (con validación SE) ---- */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) validarCampoAlBlur('materia', ev.materia); }}
        >
          <label className={`${labelBase} ${ev.errores?.materia ? 'text-red-400' : ''}`}>Contenido</label>
          <StreamInput
            value={ev.materia}
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, materia: val, errores: {...prev.errores, materia: undefined}, origenAgente: {...prev.origenAgente, materia: false}})); }}
            placeholder="Ej: Arquitectura de Microservicios"
            className={`${inputBase} ${ev.errores?.materia ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
          />
          <AnimatePresence>
            {ev.errores?.materia && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-[11px] mt-1 flex items-start gap-1 leading-relaxed">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{ev.errores.materia}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ---- CAMPO TIPO ACTIVIDAD (validación ligera) ---- */}
        <div
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) validarCampoAlBlur('tipoActividad', ev.tipoActividad); }}
        >
          <label className={`${labelBase} ${ev.errores?.tipoActividad ? 'text-red-400' : ''}`}>Estrategia</label>
          <StreamInput
            value={ev.tipoActividad}
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, tipoActividad: val, errores: {...prev.errores, tipoActividad: undefined}, origenAgente: {...prev.origenAgente, tipoActividad: false}})); }}
            placeholder="Ej: Proyecto integrador, Taller..."
            className={`${inputBase} ${ev.errores?.tipoActividad ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
          />
          <AnimatePresence>
            {ev.errores?.tipoActividad && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-[11px] mt-1 flex items-start gap-1 leading-relaxed">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{ev.errores.tipoActividad}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ---- CAMPOS NUMÉRICOS (sin validación SE, solo números) ---- */}
      <div className="flex gap-2 items-end flex-wrap">
                <div
          className="w-[180px] flex-shrink-0"
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) validarCampoAlBlur('enfoque', ev.enfoque); }}
        >
          <label className={`${labelBase} ${ev.errores?.enfoque ? 'text-red-400' : ''}`}>Enfoque/actividad</label>
                    <EnfoqueCombobox value={ev.enfoque} onChange={(v: string) => {
            const esIndividual = v.toLowerCase() === 'individual';
            setEv(prev => ({
              ...prev,
              enfoque: v,
              errores: {...prev.errores, enfoque: undefined},
              // Auto-calcular si es individual
              cantidadGrupos: esIndividual ? totalEstudiantes : prev.cantidadGrupos,
              personasPorGrupo: esIndividual ? 1 : prev.personasPorGrupo,
            }));
          }} />
          <AnimatePresence>
            {ev.errores?.enfoque && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-[10px] mt-1 flex items-start gap-1 leading-tight">
                <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
                <span>{ev.errores.enfoque}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="w-[120px] flex-shrink-0">
          <label className={`${labelBase} text-center`}>Duración</label>
          <div className="flex">
            <input type="number" value={ev.duracionMinutos ?? ''} onChange={(e) => setEv({...ev, duracionMinutos: e.target.value ? parseInt(e.target.value) : null})} className="flex-1 min-w-0 h-12 px-2.5 bg-[color:var(--c-1f2035)] border border-r-0 border-[color:var(--c-313248)] rounded-l-xl text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] focus:border-[color:var(--c-818cf8)]/40 outline-none transition-all duration-200 font-['Inter'] text-center" placeholder="0" />
            <select value={ev.duracionUnidad || 'min'} onChange={(e) => setEv({...ev, duracionUnidad: e.target.value as 'min' | 'hrs'})} className="w-[48px] h-12 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-r-xl text-[11px] font-bold text-[color:var(--c-818cf8)] text-center outline-none cursor-pointer appearance-none">
              <option value="min" className="bg-[color:var(--c-1f2035)]">min</option>
              <option value="hrs" className="bg-[color:var(--c-1f2035)]">hrs</option>
            </select>
          </div>
        </div>
        <div className="w-[88px] flex-shrink-0"><label className={`${labelBase} text-center`}>Pond.</label><div className="relative"><input type="number" min={0} max={100} value={ev.peso ?? ''} onChange={(e) => { const v = e.target.value ? Math.min(100, Math.max(0, parseInt(e.target.value))) : null; setEv({...ev, peso: v}); }} className={`${smallInput} pr-9`} placeholder="0" /><span className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none"><span className="text-[11px] font-bold text-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/10 px-1.5 py-0.5 rounded-md">%</span></span></div></div>
                <div className="w-[72px] flex-shrink-0">
          <label className={`${labelBase} text-center`}>Grupos</label>
          <input
            type="number"
            min={0}
            max={LIMITES.grupos}
            value={ev.cantidadGrupos ?? ''}
            onChange={(e) => {
              const grupos = e.target.value ? Math.min(LIMITES.grupos, Math.max(0, parseInt(e.target.value))) : null;
              const personas = grupos ? calcularPersonasPorGrupo(totalEstudiantes, grupos) : null;
              setEv({...ev, cantidadGrupos: grupos, personasPorGrupo: personas});
            }}
            className={smallInput}
            placeholder="#"
          />
        </div>
        <div className="w-[88px] flex-shrink-0">
          <label className={`${labelBase} text-center`}>Pers/Grupo</label>
          <input
            type="number"
            min={0}
            max={LIMITES.personas}
            value={ev.personasPorGrupo ?? ''}
            onChange={(e) => {
              const personas = e.target.value ? Math.min(LIMITES.personas, Math.max(0, parseInt(e.target.value))) : null;
              const { cantidadGrupos } = calcularDistribucionGrupos(totalEstudiantes, personas);
              setEv({...ev, personasPorGrupo: personas, cantidadGrupos: cantidadGrupos || null});
            }}
            className={smallInput}
            placeholder="#"
          />
        </div>
        <div className="flex-shrink-0 flex items-end">
          <div className="px-2 py-2.5 bg-[color:var(--c-818cf8)]/8 border border-[color:var(--c-818cf8)]/15 rounded-lg text-[10px] text-[color:var(--c-818cf8)] font-medium leading-tight whitespace-nowrap">
            <Users className="w-3 h-3 mx-auto mb-0.5" />
            {totalEstudiantes} est.
            {ev.cantidadGrupos && ev.personasPorGrupo && ev.cantidadGrupos > 0 && (
              <span className="block text-[color:var(--c-b0b0c4)] mt-0.5">
                {ev.cantidadGrupos}×{ev.personasPorGrupo}
                {(() => {
                  const cubiertos = ev.cantidadGrupos * ev.personasPorGrupo;
                  const sobrantes = totalEstudiantes - cubiertos;
                  return sobrantes > 0 ? ` +${sobrantes}` : '';
                })()}
              </span>
            )}
            {ev.enfoque?.toLowerCase() === 'individual' && (
              <span className="block text-amber-400 mt-0.5">Individual</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 w-[296px] max-w-full">
          <label className={labelBase}>Fecha y hora</label>
          <div className="flex gap-2">
            <div className="w-[166px]"><DatePicker value={ev.fecha} minimo={new Date()} onChange={(d: Date) => setEv({...ev, fecha: d})} /></div>
            <div className="w-[122px]"><TimePicker value={ev.fecha} onChange={(d: Date) => setEv({...ev, fecha: d})} /></div>
          </div>
        </div>
      </div>

      {/* ---- DESCRIPCIÓN (con validación SE) ---- */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setEv({...ev, mostrarDescripcion: !ev.mostrarDescripcion})}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${ev.mostrarDescripcion ? 'bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-818cf8)] border-[color:var(--c-818cf8)]/30' : 'bg-[color:var(--c-272839)] text-[color:var(--c-b0b0c4)] border-[color:var(--c-313248)] hover:bg-[color:var(--c-313248)]'}`}
        >
          {ev.mostrarDescripcion ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar Descripción</> : <><ChevronDown className="w-3.5 h-3.5" /> Mostrar Descripción</>}
        </button>
      </div>
      {/*
        IMPORTANTE: el campo de Descripción se mantiene SIEMPRE montado (no se desmonta con
        mostrarDescripcion) para que el componente StreamTextarea no reinicie su animación de
        escritura cada vez que el usuario oculta y vuelve a mostrar el campo. Solo se anima
        la altura/opacidad para ocultarlo visualmente.
      */}
      <motion.div
        initial={false}
        animate={{ height: ev.mostrarDescripcion ? 'auto' : 0, opacity: ev.mostrarDescripcion ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
        aria-hidden={!ev.mostrarDescripcion}
      >
        <div
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) validarCampoAlBlur('descripcion', ev.descripcion || ''); }}
        >
          {/* Por partes (Objetivo, Actividad, Herramientas…) cuando la descripción las tiene; o el texto completo */}
          {tieneSecciones(ev.descripcion || '') && (
            <div className="flex justify-end mt-2">
              <button type="button" onClick={() => setEv((prev: EvaluacionFormulario) => ({ ...prev, descripcionTexto: !prev.descripcionTexto }))} className="text-[11px] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)]">
                {ev.descripcionTexto ? '▦ Ver por partes' : '¶ Ver como texto completo'}
              </button>
            </div>
          )}
          {tieneSecciones(ev.descripcion || '') && !ev.descripcionTexto ? (
            <EditorDescripcion value={ev.descripcion || ''} onChange={(val: string) => setEv((prev: EvaluacionFormulario) => ({...prev, descripcion: val, errores: {...prev.errores, descripcion: undefined}, origenAgente: {...prev.origenAgente, descripcion: false}}))} />
          ) : (
          <StreamTextarea
            value={ev.descripcion ?? ''}
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, descripcion: val, errores: {...prev.errores, descripcion: undefined}, origenAgente: {...prev.origenAgente, descripcion: false}})); }}
            placeholder="Descripción detallada de la evaluación. Puedes usar secciones: OBJETIVO: … ACTIVIDAD: … HERRAMIENTAS: … ENTREGABLES: … CRITERIOS DE EVALUACIÓN: …"
            className={`${textareaBase} min-h-[200px] mt-2 ${ev.errores?.descripcion ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
          />
          )}
          <AnimatePresence>
            {ev.errores?.descripcion && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-red-400 text-[11px] mt-1 flex items-start gap-1 leading-relaxed">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{ev.errores.descripcion}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ---- BOTONES ---- */}
      <div className="flex justify-end gap-2 pt-1">
        <Tooltip text="Limpiar formulario">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={limpiar} className="flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--c-272839)] hover:bg-[color:var(--c-313248)] rounded-lg text-xs text-[color:var(--c-b0b0c4)] transition-all font-medium"><Trash2 className="w-3.5 h-3.5" />Limpiar</motion.button>
        </Tooltip>
        <Tooltip text={tieneErrores ? 'Corrige los errores primero' : 'Guardar (Ctrl+S)'}>
          <motion.button
            whileHover={{ scale: tieneErrores ? 1 : 1.02 }}
            whileTap={{ scale: tieneErrores ? 1 : 0.98 }}
            onClick={guardar}
            disabled={tieneErrores}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md ${
              tieneErrores
                ? 'bg-[color:var(--c-313248)] text-[color:var(--c-5a5b6e)] cursor-not-allowed shadow-none'
                : 'bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white shadow-md'
            }`}
          >
            <Save className="w-3.5 h-3.5" />Guardar
          </motion.button>
        </Tooltip>
      </div>
    </motion.div>
  );
};

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {renderFormulario(evaluacion1, setEvaluacion1, guardarEvaluacion1, limpiarEvaluacion1, "Evaluación 1", 1, justFilled1)}
        {numEvaluaciones >= 2 && renderFormulario(evaluacion2, setEvaluacion2, guardarEvaluacion2, limpiarEvaluacion2, "Evaluación 2", 2, justFilled2)}
        {numEvaluaciones >= 3 && renderFormulario(evaluacion3, setEvaluacion3, guardarEvaluacion3, limpiarEvaluacion3, "Evaluación 3", 3, justFilled3)}
        {numEvaluaciones >= 4 && renderFormulario(evaluacion4, setEvaluacion4, guardarEvaluacion4, limpiarEvaluacion4, "Evaluación 4", 4, justFilled4)}
      </AnimatePresence>

      {numEvaluaciones < 4 && (
        <motion.button 
          whileHover={{ scale: 1.01 }} 
          whileTap={{ scale: 0.99 }} 
          onClick={() => setNumEvaluaciones((prev: number) => prev + 1)}
          className="w-full py-4 border border-dashed border-[color:var(--c-313248)] rounded-2xl text-sm text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-1f2035)] hover:text-[color:var(--c-818cf8)] hover:border-[color:var(--c-818cf8)]/50 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" /> Agregar Evaluación {numEvaluaciones + 1}
        </motion.button>
      )}
    </div>
  );
}
