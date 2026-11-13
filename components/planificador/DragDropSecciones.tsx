'use client';

import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TarjetaEvaluacion } from '@/components/planificador/TarjetaEvaluacion';
import { SeccionExamen } from '@/components/planificador/tipos';
import { Tooltip, VentanaFlotante } from '@/components/planificador/ui';
import { EVAL_POR_ABRIR, esIdGuardado, limpiarTexto, medioEnvio, precargar } from '@/components/planificador/utilidades';
import dynamic from 'next/dynamic';

// Se descargan solo cuando se abren (la primera carga del Planificador queda mas liviana)
const EditorRecursos = dynamic(() => import('@/components/planificador/EditorRecursos').then(m => m.EditorRecursos));
const EditorRubrica = dynamic(() => import('@/components/planificador/EditorRubrica').then(m => m.EditorRubrica));
const EnviarPlanWhatsApp = dynamic(() => import('@/components/planificador/EnviarPlanWhatsApp').then(m => m.EnviarPlanWhatsApp));
const ModalNotas = dynamic(() => import('@/components/planificador/ModalNotas').then(m => m.ModalNotas));
const ModalExamen = dynamic(() => import('@/components/ModalExamen'));
const PanelEntregas = dynamic(() => import('@/components/PanelEntregas'));
const PanelRecordatorios = dynamic(() => import('@/components/PanelRecordatorios'));


export function DragDropSecciones({ secciones, onReorder, onEdit, onDelete, agregarNotificacion, pdfUrl, pdfAbierto, setPdfAbierto, mostrarMenuEnvio, setMostrarMenuEnvio, scrollToTarjeta, planificacion, setPdfUrl, mensajeWhatsApp, setMensajeWhatsApp, enviarA, setEnviarA, filtroEnvio, setFiltroEnvio, generarPDF, selectedIds, onToggleSelect, seccionesPlan, profesor, seccionActiva = 'A', onCambiarEstado, onGuardarRubrica, onEstadoLocal, onGuardarRecursos, onExamenLocal }: any) {
  const [recursosDe, setRecursosDe] = useState<SeccionExamen | null>(null);
  const [rubricaDe, setRubricaDe] = useState<SeccionExamen | null>(null);
  const [notasDe, setNotasDe] = useState<SeccionExamen | null>(null);
  const [examenDe, setExamenDe] = useState<SeccionExamen | null>(null);
  const [recordatoriosDe, setRecordatoriosDe] = useState<SeccionExamen | null>(null);
  const [entregasDe, setEntregasDe] = useState<SeccionExamen | null>(null);
  // Vista previa del plan: SOLO las evaluaciones de la sección activa que están marcadas
  const listaPlan: SeccionExamen[] = Array.isArray(seccionesPlan) ? seccionesPlan : secciones;
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  const handleEnviarTarjeta = async (seccion: SeccionExamen) => {
    if (!generarPDF) return;
    try {
      setEnviandoId(seccion.id);
      const url = await generarPDF([seccion]);
      if (url) {
        setPdfAbierto(true);
        setMostrarMenuEnvio(true);
        if (agregarNotificacion) agregarNotificacion(`📤 Preparando envío de "${limpiarTexto(seccion.nombre)}".`);
      }
    } finally {
      setEnviandoId(null);
    }
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Agregar al inicio de DragDropSecciones, después de los otros useState:
  const handleCardClick = (seccionId: string) => { setExpandedId(expandedId === seccionId ? null : seccionId); };
  // Viene del calendario: abre la evaluación, la centra en pantalla y la resalta un momento
  useEffect(() => {
    const id = EVAL_POR_ABRIR.id;
    if (!id || !secciones.some((x: SeccionExamen) => x.id === id)) return;
    EVAL_POR_ABRIR.id = '';
    setExpandedId(id);
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-eval="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('eval-resaltada'); void el.offsetWidth; el.classList.add('eval-resaltada');
      setTimeout(() => el.classList.remove('eval-resaltada'), 2600);
    }, 380);
    return () => clearTimeout(t);
  }, [secciones]);
  const handleClosePdf = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); setPdfAbierto(false); setMostrarMenuEnvio(false); agregarNotificacion('🗑️ Plan eliminado.'); };

  // Acta de notas de la sección activa (lo arma el servidor con las notas guardadas)
  const [descargandoActa, setDescargandoActa] = useState(false);
  const descargarActa = async () => {
    const ids = secciones.map((s: SeccionExamen) => s.id).filter(esIdGuardado); // las que aún no se guardan no tienen notas
    if (!ids.length || descargandoActa) return;
    setDescargandoActa(true);
    try {
      const r = await fetch(`/api/acta?ids=${encodeURIComponent(ids.join(','))}`);
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'No se pudo generar el acta.'); }
      const nombre = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || `Acta_Seccion_${seccionActiva}.xlsx`;
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      agregarNotificacion(`📊 Acta de notas de la sección ${seccionActiva} descargada.`);
    } catch (e: any) { agregarNotificacion(`⚠️ ${e.message}`); }
    finally { setDescargandoActa(false); }
  };

  // Exporta las evaluaciones a un Excel con formato (hoja «Plan» y hoja «Detalle»); lo arma el servidor
  const [exportando, setExportando] = useState(false);
  const exportarExcel = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const evaluaciones = planificacion.secciones.map((s: SeccionExamen) => ({
        nombre: s.nombre, tipoActividad: s.tipoActividad, enfoque: s.enfoque, minutos: s.tiempoEstimadoMinutos, peso: s.peso,
        grupos: s.cantidadGrupos, personas: s.personasPorGrupo, fecha: s.fecha, estado: s.estado, seccion: s.grupoSeccion, descripcion: s.descripcion,
      }));
      const r = await fetch('/api/exportar/evaluaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materia: planificacion.materia, profesor, evaluaciones }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'No se pudo generar el Excel.'); }
      const nombre = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || 'Evaluaciones.xlsx';
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      agregarNotificacion('📊 Evaluaciones exportadas a Excel.');
    } catch (e: any) { agregarNotificacion(`⚠️ ${e.message}`); }
    finally { setExportando(false); }
  };

  return (
    <div className="space-y-2">
      {pdfUrl && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border border-[color:var(--c-818cf8)]/20 rounded-xl bg-[color:var(--c-1f2035)] overflow-hidden">
          <div onClick={() => setPdfAbierto(!pdfAbierto)} className="flex items-center justify-between p-4 bg-[color:var(--c-272839)]/80 border-b border-[color:var(--c-818cf8)]/10 cursor-pointer hover:bg-[color:var(--c-2e2f42)]/60 transition-colors select-none">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--c-818cf8)] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[color:var(--c-818cf8)]"></span></div>
              <FileText className="w-5 h-5 text-[color:var(--c-818cf8)]" />
              <div><div className="flex items-center gap-2"><h4 className="font-bold text-[color:var(--c-d0d0da)] text-sm">Plan de Acción Oficial</h4><span className="bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-818cf8)] text-[10px] px-2 py-0.5 rounded-full font-medium border border-[color:var(--c-818cf8)]/20">Generado</span></div><p className="text-xs text-[color:var(--c-8a8b9e)]">Clic para {pdfAbierto ? 'contraer' : 'ver'}</p></div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* DESCARGAR */}
              <a
                href={pdfUrl}
                download={`plan_evaluacion_${planificacion.materia || 'examen'}.pdf`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white font-medium text-xs rounded-lg transition-all shadow-md"
              >
                📥 Descargar
              </a>

              {/* ENVIAR — Click simple: nada. Mantener presionado 500ms: muestra ventana */}
              <Tooltip text={`Enviar por ${medioEnvio()}`}>
                <button
                  onMouseEnter={() => precargar(`/api/estudiantes?grupo=${encodeURIComponent(seccionActiva)}`)}
                  onTouchStart={() => precargar(`/api/estudiantes?grupo=${encodeURIComponent(seccionActiva)}`)}
                  onClick={() => setMostrarMenuEnvio(true)} // abre la ventana flotante de envío (igual que las demás ventanas)
                  aria-label={`Enviar el plan por ${medioEnvio()}`}
                  className={`p-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
                    mostrarMenuEnvio
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                      : 'text-[color:var(--c-8a8b9e)] hover:text-sky-400 hover:bg-sky-500/10 border-transparent'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </Tooltip>

              {/* ELIMINAR */}
              <Tooltip text="Eliminar PDF">
                <button
                  onClick={handleClosePdf}
                  className="p-1.5 hover:bg-rose-500/10 text-[color:var(--c-8a8b9e)] hover:text-rose-400 rounded-lg transition-all border border-transparent hover:border-rose-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
          <motion.div initial={false} animate={{ height: pdfAbierto ? "auto" : "0px", opacity: pdfAbierto ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.6 }} className="overflow-hidden bg-[color:var(--c-191a26)]">
            <div className="p-4">
              <AnimatePresence mode="wait">
                {(
                  <motion.div key="pdf" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="w-full h-[600px] overflow-y-auto border border-slate-200 rounded-xl bg-white text-slate-800 font-sans shadow-lg custom-scrollbar">
                    <div className="p-10 relative">
                      <div className="absolute top-10 right-10 text-[10px] uppercase tracking-widest font-bold text-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/20 px-3 py-1 rounded-md">Plan v1.0</div>
                      <div className="mb-8 border-b-2 border-[color:var(--c-1e3a8a)] pb-6"><span className="text-[11px] font-bold text-[color:var(--c-60a5fa)] uppercase tracking-widest">Plan de Acción</span><h2 className="text-3xl font-black text-[color:var(--c-1e3a8a)] mt-1">{planificacion.materia || 'Asignatura'}</h2><div className="flex gap-6 mt-3 text-xs text-slate-500"><p>👤 {profesor ? `Prof. ${profesor}` : 'Docente'}</p><p>📅 {planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir'}</p></div></div>
                      <div className="overflow-x-auto mb-8 rounded-xl border border-slate-200"><table className="w-full border-collapse text-left bg-white"><thead><tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500"><th className="p-4">Contenido</th><th className="p-4">Estrategia</th><th className="p-4 text-center">Peso</th><th className="p-4 text-center">Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">{listaPlan.map((sec: SeccionExamen, idx: number) => (<tr key={sec.id||idx}><td className="p-4 font-medium text-slate-700">{sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i,'')||'Sin Nombre'}</td><td className="p-4 text-slate-600">{sec.tipoActividad||'Desarrollo'}</td><td className="p-4 text-center font-bold text-[color:var(--c-1e3a8a)]">{sec.peso||0}%</td><td className="p-4 text-center text-slate-600">{sec.fecha ? new Date(sec.fecha).toLocaleDateString() : (planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : '—')}</td></tr>))}</tbody></table></div>
                      {listaPlan.some((s: SeccionExamen)=>s.descripcion)&&(<div className="mt-6 border-t-2 border-slate-200 pt-6"><h3 className="text-sm font-bold text-slate-700 uppercase mb-3">📋 Especificaciones</h3><div className="grid gap-4">{listaPlan.map((sec: SeccionExamen, i: number)=>{const n=sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i,'')||'Sin Nombre';return sec.descripcion?(<div key={sec.id||i} className="bg-slate-50 p-4 rounded-lg border border-slate-200"><div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-slate-400">#{i+1}</span><span className="font-semibold text-slate-700">{n}</span></div><p className="text-sm text-slate-600 whitespace-pre-wrap">{sec.descripcion}</p></div>):null})}</div></div>)}
                      <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8"><div><p className="text-xs text-slate-400 uppercase mb-1">{profesor ? `Prof. ${profesor}` : 'Docente'}</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Firma</p></div><div><p className="text-xs text-slate-400 uppercase mb-1">Coordinación Académica</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Sello</p></div></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}

      <Reorder.Group as="div" axis="y" values={secciones} onReorder={(nuevoOrden: SeccionExamen[]) => { onReorder(nuevoOrden); agregarNotificacion('🔄 Evaluaciones reordenadas.'); }} className="space-y-2">
        {secciones.map((seccion: SeccionExamen, index: number) => {
          const isSelected = Array.isArray(selectedIds) && selectedIds.includes(seccion.id);
          return (
            <TarjetaEvaluacion
              key={seccion.id}
              seccion={seccion}
              index={index}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
              expanded={expandedId === seccion.id}
              onToggleExpand={() => handleCardClick(seccion.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onEnviar={handleEnviarTarjeta}
              enviando={enviandoId === seccion.id}
              onCambiarEstado={onCambiarEstado}
              onRubrica={onGuardarRubrica ? setRubricaDe : undefined}
              onNotas={setNotasDe}
              onRecursos={onGuardarRecursos ? setRecursosDe : undefined}
              onExamen={onExamenLocal ? setExamenDe : undefined}
              onRecordatorios={(s: SeccionExamen) => esIdGuardado(s.id) ? setRecordatoriosDe(s) : agregarNotificacion('⏳ Guarda la evaluación primero para ver sus recordatorios.')}
              onEntregas={setEntregasDe}
            />
          );
        })}
      </Reorder.Group>
      <AnimatePresence>
        {rubricaDe && onGuardarRubrica && (
          <EditorRubrica key={rubricaDe.id} seccion={rubricaDe} onCerrar={() => setRubricaDe(null)} onGuardar={(r) => { onGuardarRubrica(rubricaDe, r); setRubricaDe(null); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mostrarMenuEnvio && (
          <VentanaFlotante onCerrar={() => setMostrarMenuEnvio(false)} ancho="max-w-xl">
            <EnviarPlanWhatsApp seccion={seccionActiva} lista={listaPlan} materia={planificacion.materia || 'Asignatura'} fechaExamen={planificacion.fechaExamen} onCerrar={() => setMostrarMenuEnvio(false)} agregarNotificacion={agregarNotificacion} />
          </VentanaFlotante>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {recursosDe && onGuardarRecursos && (
          <EditorRecursos key={recursosDe.id} seccion={recursosDe} materia={planificacion?.materia} onCerrar={() => setRecursosDe(null)} onGuardar={(r, abrir) => { onGuardarRecursos(recursosDe, r, abrir); setRecursosDe(null); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {examenDe && onExamenLocal && (
          <ModalExamen key={examenDe.id} evaluacion={examenDe} onCerrar={() => setExamenDe(null)} notificar={agregarNotificacion}
            onGuardado={(ex) => onExamenLocal(examenDe.id, ex)} />
        )}
        {entregasDe && (
          <VentanaFlotante key={`ent-${entregasDe.id}`} onCerrar={() => setEntregasDe(null)} ancho="max-w-3xl">
            <PanelEntregas evaluacionId={entregasDe.id} nombre={limpiarTexto(entregasDe.nombre)} onCerrar={() => setEntregasDe(null)} notificar={agregarNotificacion} />
          </VentanaFlotante>
        )}
        {recordatoriosDe && (
          <VentanaFlotante key={`rec-${recordatoriosDe.id}`} onCerrar={() => setRecordatoriosDe(null)} ancho="max-w-3xl">
            <PanelRecordatorios enfoque={recordatoriosDe.id} onCerrar={() => setRecordatoriosDe(null)} notificar={agregarNotificacion} seccionActiva={seccionActiva} />
          </VentanaFlotante>
        )}
        {notasDe && (
          <ModalNotas key={notasDe.id} seccion={notasDe} onCerrar={() => setNotasDe(null)} agregarNotificacion={agregarNotificacion} onEstadoCambiado={onEstadoLocal} />
        )}
      </AnimatePresence>
      <div className="space-y-2">
        {secciones.length === 0 && (<div className="text-center py-8 text-[color:var(--c-8a8b9e)] border border-dashed border-[color:var(--c-313248)] rounded-xl"><p className="text-sm">No hay evaluaciones</p></div>)}
      </div>
      
      <div className="flex justify-end gap-2 mt-4">
        <Tooltip text={`Acta de notas de la sección ${seccionActiva} en Excel`}>
          <button data-tutorial="acta" onClick={descargarActa} disabled={descargandoActa || !secciones.some((s: SeccionExamen) => esIdGuardado(s.id))} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium rounded-lg transition-all border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {descargandoActa ? <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />} Acta de notas
          </button>
        </Tooltip>
        <Tooltip text="Descarga todas las evaluaciones en Excel (resumen y detalle)">
          <button onClick={exportarExcel} disabled={secciones.length === 0 || exportando} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition-all border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {exportando ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Exportar a Excel
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
