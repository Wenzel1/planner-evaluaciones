'use client';

import { conMateria, materiaAbierta } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bell, BellOff, BookOpen, Bot, Brain, CalendarDays, CheckCircle, ChevronDown, ClipboardCheck, ClipboardList, Copy, Download, ExternalLink, FileCheck, FileText, GraduationCap, History, Lightbulb, Lock, LockOpen, MessageCircle, MessageSquare, Mic, PanelLeftClose, Paperclip, Plus, Printer, RotateCcw, Scale, Search, Send, Settings, Sparkle, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, UserCheck, Users, Volume2, VolumeX, X } from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import DescripcionOrdenada from '@/components/DescripcionOrdenada';
import { type Examen, TIPOS_PREGUNTA, admiteExamenEnLinea } from '@/lib/examen';
import { aWav16k } from '@/lib/audioWav';
import { enlacesDeDescripcion } from '@/lib/herramientasEnlaces';
import { rubricaSugerida, textoPuntos, totalRubrica } from '@/lib/rubrica';
import { AccionChat, AvisoChat, Mensaje, PlanificacionExamen, SeccionExamen } from '@/components/planificador/tipos';
import { FrasePensando, Tooltip } from '@/components/planificador/ui';
import { buscarPorNombre, calcularFechasEvaluaciones, esIdGuardado, haceCuanto, heredado, limpiarTexto, medioEnvio, olvidarCache, pedirSugerenciasRecursos, porCorreo } from '@/components/planificador/utilidades';
import { TITULO_ACCION, textoVisible, ACCIONES_AUTOMATICAS, ACCIONES_SEGURAS, CLAVE_MODO_AUTO, FUERA_DE_APLICAR_TODO, VISTA_DE_AGENTE, NOMBRE_VISTA, TIPO_PREGUNTA, mensajeErrorAgente, formatMessage } from '@/components/planificador/agenteTextos';
import dynamic from 'next/dynamic';

// Se descargan solo cuando se abren (la primera carga del Planificador queda mas liviana)
const ModalExamen = dynamic(() => import('@/components/ModalExamen'));

export function AgentePanel({ materias = [], onCambiarMateria, onCambiarSeccion, guardarAhora, formulariosLibres, planificacionId = null, seccionActiva = 'A', expandido, setExpandido, planificacion, setPlanificacion, setPropuestaPendiente, onAccept, setVistaPanel, setPdfUrl, setPdfAbierto, agregarNotificacion, generarPDF, limpiarYScroll, totalEstudiantes = 8, config, usuarioId, esMovil = false, anchoChat = 640, arrastrando = false, esSuperadmin = false }: any) {
  // Atajos del encabezado del chat: llevan al panel de la derecha (en el celular el chat se oculta para dejarlo ver)
  const irAPanel = (vista: string) => { setVistaPanel(vista); if (esMovil) setExpandido(false); };
  const [mensaje, setMensaje] = useState(''); 
  // Configuración del superadmin: dirección de n8n, tiempo máximo y lo que se le pide al modelo en cada mensaje
  const tiempoChat: number = (config?.chat?.timeoutSegundos ?? 60) * 1000;
  const configParaN8n = config ? { modelo: config.chat.modelo, temperatura: config.chat.temperatura, maxTokens: config.chat.maxTokens, ventanaMemoria: config.chat.ventanaMemoria, instruccionesExtra: config.chat.instruccionesExtra } : undefined;
  const [pensando, setPensando] = useState(false); 
  const [escribiendo, setEscribiendo] = useState(false); 
  const [historial, setHistorial] = useState<Mensaje[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null); 
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isChatStarted = historial.length > 0; 
  const [propuestaPendienteLocal, setPropuestaPendienteLocal] = useState<any>(null);
  // Chat nuevo: conversación guardada, botón detener, eventos de las tarjetas e historial
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const eventosRef = useRef<string[]>([]); // lo que el profesor hizo con las tarjetas: se le cuenta al agente en el próximo mensaje
  const [verHistorial, setVerHistorial] = useState(false);
  const [conversaciones, setConversaciones] = useState<{ id: string; titulo: string; fecha: string; mensajes: number }[] | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [adjunto, setAdjunto] = useState<{ nombre: string; texto: string; recortado?: boolean } | null>(null); // documento para el próximo mensaje
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const [leyendoId, setLeyendoId] = useState<string | null>(null);
  const [memorias, setMemorias] = useState<{ id: string; texto: string }[] | null>(null);
  // Deshacer: cómo revertir cada acción aplicada en esta sesión (por id de acción)
  const deshacerRef = useRef<Record<string, () => Promise<string>>>({});
  const aplicadasRef = useRef<Set<string>>(new Set()); // acciones ya aplicadas o en curso
  const [examenEditando, setExamenEditando] = useState<{ msgId: string; accion: AccionChat; seccion: SeccionExamen } | null>(null);
  // Modo automático: las acciones seguras se aplican solas (se recuerda en este navegador)
  // Apagado por defecto: al principio el profesor confirma cada tarjeta. Lo activa con el botón ✨ cuando ya confía en el agente (se recuerda)
  const [modoAuto, setModoAuto] = useState<boolean>(() => { try { return localStorage.getItem(CLAVE_MODO_AUTO) === '1'; } catch { return false; } });
  const modoAutoRef = useRef(modoAuto); modoAutoRef.current = modoAuto;
  const alternarModoAuto = () => { const v = !modoAuto; setModoAuto(v); try { localStorage.setItem(CLAVE_MODO_AUTO, v ? '1' : '0'); } catch { /* sin almacenamiento */ } agregarNotificacion?.(v ? '⚡ Modo automático activado: rúbricas, recursos, fechas, pesos y estados se aplicarán solos (con botón Deshacer).' : 'Modo automático desactivado: todo pedirá confirmación.'); };
  // Avisos del día (se muestran al abrir el chat vacío)
  const [avisos, setAvisos] = useState<AvisoChat[] | null>(null);
  useEffect(() => {
    if (!planificacionId) { setAvisos([]); return; }
    let vivo = true;
    fetch(`/api/chat/avisos?planificacionId=${encodeURIComponent(planificacionId)}`).then(r => (r.ok ? r.json() : { avisos: [] })).then(d => { if (vivo) setAvisos(Array.isArray(d.avisos) ? d.avisos : []); }).catch(() => { if (vivo) setAvisos([]); });
    return () => { vivo = false; };
  }, [planificacionId]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // El cuadro de texto crece con el contenido (hasta 160px)
  // El campo no crece: el texto se desplaza a lo ancho; si se agregó al final (dictado), se muestra el final
  useEffect(() => { const t = textareaRef.current; if (!t) return; if (t.selectionEnd >= t.value.length) t.scrollLeft = t.scrollWidth; }, [mensaje]);
  useEffect(() => { mensajeRef.current = mensaje; }, [mensaje]);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [nivelesMic, setNivelesMic] = useState<number[]>([]);
  const [segGrabando, setSegGrabando] = useState(0);
  const [silencioMic, setSilencioMic] = useState(0);
  const micDescartarRef = useRef(false);
  const micLimpiarRef = useRef<(() => void) | null>(null);
  const [autoEnviarVoz, setAutoEnviarVoz] = useState(() => { try { return localStorage.getItem('voz_autoenviar') === '1'; } catch { return false; } });
  const autoEnviarVozRef = useRef(autoEnviarVoz); autoEnviarVozRef.current = autoEnviarVoz;
  const mensajeRef = useRef('');

  // Considera "abajo" si el usuario está a menos de 100px del final del chat
  const comprobarSiEstaAbajo = () => {
    const el = chatContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  const handleChatScroll = () => {
    isAtBottomRef.current = comprobarSiEstaAbajo();
  };

  // Solo hace autoscroll si el usuario ya estaba abajo (o si se fuerza, ej. al enviar un mensaje)
  const scrollToBottom = (forzar = false) => {
    if (forzar) isAtBottomRef.current = true;
    if (isAtBottomRef.current) {
      const el = chatContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  };

  
  useEffect(() => { if (!escribiendo) scrollToBottom(); }, [historial.length, pensando]);
  useEffect(() => { if (escribiendo) scrollToBottom(); }, [escribiendo, historial]);
  // NOTA: scrollToBottom ahora respeta si el usuario se desplazó hacia arriba (ver comprobarSiEstaAbajo),
  // por lo que estos efectos ya no lo arrastran forzosamente hacia abajo mientras lee mensajes anteriores.
  
  const esConfirmacionGuardado = (msg: string): boolean => {
    // Se usan límites de palabra (\b) para evitar falsos positivos y para reconocer tanto el
    // infinitivo ("guardar") como el imperativo ("guarda") u otras formas coloquiales de afirmar.
    const palabras = [
      'sí','si','ya','va','vale','ok','okay','oka','listo','lista','hazlo','procede','adelante',
      'guarda','guárdalo','guardalo','guárdala','guardala','guardar','guárdame esto','confirmo',
      'confirmar','confirmado','acepto','aceptar','aceptado','apruebo','aprobado','correcto',
      'exacto','perfecto','excelente','genial','buena','buenisimo','buenísimo','de acuerdo','claro',
      'por supuesto','esta bien','está bien','así está bien','asi esta bien','me gusta','se ve bien',
      'dale','sale','afirmativo'
    ];
    const msgLower = msg.toLowerCase().trim();
    return palabras.some(p => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(msgLower));
  };

  const esNegacion = (msg: string): boolean => {
    const msgLower = msg.toLowerCase().trim();
    const palabrasNegativas = ['no quiero','no quiera','no generar','no crees','no hagas','cancelar','cancela','cancel','rechazar','rechaza','rechazo','descartar','descarta','no guardar','no guardes','olvida','olvídalo','olvidalo','mejor no'];
    return palabrasNegativas.some(p => msgLower.includes(p));
  };

  const guardarEvaluacionesDirecto = async (propuesta: any = propuestaPendienteLocal) => {
    if (!propuesta || !propuesta.evaluaciones) return { success: false, mensaje: 'No hay evaluaciones para guardar.' };
    const totalEvals = propuesta.evaluaciones.length;
    const sonCuatro = totalEvals === 4;
    const fechaBase = new Date();
    const fechas = calcularFechasEvaluaciones(fechaBase, totalEvals);
    let fechasCorregidas = 0;
    const nuevasSecciones: SeccionExamen[] = propuesta.evaluaciones.map((p: any, idx: number) => {
      let fechaExamen = fechas[idx] || new Date();
      if (p.fecha && p.hora) fechaExamen = new Date(`${p.fecha}T${p.hora}:00`);
      else if (p.fecha) fechaExamen = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha)) ? `${p.fecha}T08:00:00` : p.fecha);
      // Fecha pasada (o inválida) en una evaluación nueva: se mueve a una fecha futura en vez de guardarla atrás
      const viejaFecha = p.existenteId ? planificacion.secciones.find((x: SeccionExamen) => x.id === p.existenteId)?.fecha : null;
      const igualQueAntes = viejaFecha && Math.abs(new Date(viejaFecha).getTime() - fechaExamen.getTime()) < 60000;
      if ((isNaN(fechaExamen.getTime()) || fechaExamen.getTime() < Date.now()) && !igualQueAntes) {
        const f = new Date(); f.setDate(f.getDate() + 7 + idx * 14); f.setHours(8, 0, 0, 0); fechaExamen = f;
        fechasCorregidas++;
      }
      return { id: `eval${idx+1}-${Date.now()}`, nombre: `${p.tipo || `Evaluación ${idx+1}`}: ${limpiarTexto(p.materia)}`, tipoPregunta: 'desarrollo', peso: p.peso ?? null, cantidadPreguntas: 1, contenidosEvaluados: [], nivelBloom: 'aplicar', tiempoEstimadoMinutos: p.duracionMinutos ?? null, tipoActividad: p.tipoActividad || undefined, descripcion: p.descripcion || '', cantidadGrupos: p.cantidadGrupos ?? undefined, personasPorGrupo: p.personasPorGrupo ?? undefined, enfoque: p.enfoque || undefined, fecha: fechaExamen };
    });
    // Las evaluaciones del chat se guardan en la sección que está abierta en el planificador
    nuevasSecciones.forEach(n => { n.grupoSeccion = seccionActiva; });
    setPlanificacion((prev: PlanificacionExamen) => {
      let secciones = [...prev.secciones];
      let enSeccion = secciones.filter(s => (s.grupoSeccion || 'A') === seccionActiva).length;
      nuevasSecciones.forEach((nueva, idx) => {
        const idEditar = propuesta.evaluaciones[idx]?.existenteId;
        const indiceExistente = idEditar ? secciones.findIndex(s => s.id === idEditar) : -1;
        if (indiceExistente === -1) { enSeccion++; nueva.nombre = `Evaluación ${enSeccion}: ${limpiarTexto(nueva.nombre)}`; }
        if (indiceExistente !== -1) {
          // Ya existe una evaluación con ese mismo número/tipo → se actualiza en su lugar (edición)
          const vieja = secciones[indiceExistente];
          // Otro tema → empieza sin los recursos/rúbrica/examen de la anterior
          secciones[indiceExistente] = { ...nueva, id: vieja.id, grupoSeccion: vieja.grupoSeccion, ...heredado(vieja, nueva.nombre), abiertaManual: vieja.abiertaManual } as SeccionExamen;
        } else {
          secciones = [...secciones, nueva];
        }
      });
      return { ...prev, secciones };
    });
    setPropuestaPendiente(null);
    let pdfGenerado = false;
    // ✅ DESPUÉS (la solución):
    // El PDF del plan se genera en segundo plano: las evaluaciones quedan guardadas al instante sin esperarlo
    if (sonCuatro && generarPDF) {
      pdfGenerado = true;
      generarPDF(nuevasSecciones)
        .then((url: string | null) => { if (url) agregarNotificacion?.('📄 Plan de acción generado automáticamente.'); })
        .catch((error: unknown) => console.error('Error generando PDF:', error));
    }
    setPropuestaPendienteLocal(null);
    if (limpiarYScroll) limpiarYScroll();
    if (fechasCorregidas) agregarNotificacion?.(`📅 ${fechasCorregidas === 1 ? 'Una fecha propuesta ya había pasado: se movió' : `${fechasCorregidas} fechas propuestas ya habían pasado: se movieron`} a una fecha futura. Puedes ajustarla.`);
    return { success: true, totalEvals, sonCuatro, pdfGenerado, mensaje: sonCuatro ? `✅ ¡Excelente! Se han guardado las ${totalEvals} evaluaciones y generado el Plan de Acción en PDF automáticamente. Puedes descargarlo en la sección "Planificador".` : `✅ ¡Excelente! Se han guardado las ${totalEvals} evaluaciones correctamente.` };
  };

  const cancelarPropuesta = () => {
    if (propuestaPendienteLocal) { setPropuestaPendienteLocal(null); setPropuestaPendiente(null); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: '✅ Propuesta descartada. Los formularios se han limpiado.', completo: true, id: `agent-${Date.now()}` }]); }
  };

  // =========================================================================================
  // CHAT NUEVO: el agente responde en tiempo real desde /api/chat (ya no pasa por n8n) y propone
  // acciones como tarjetas con botón. Nada cambia en el plan hasta que el profesor confirma.
  // =========================================================================================
  const evaluacionesActivas = (): SeccionExamen[] => planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva);
  const armarContexto = () => {
    const otras: Record<string, number> = {};
    planificacion.secciones.forEach((s: SeccionExamen) => { const l = (s.grupoSeccion || 'A').toUpperCase(); otras[l] = (otras[l] || 0) + 1; });
    return {
      materia: planificacion.materia, seccion: seccionActiva, otrasSecciones: otras,
      evaluaciones: evaluacionesActivas().map((s: SeccionExamen) => ({
        id: s.id, nombre: limpiarTexto(s.nombre), tipoActividad: s.tipoActividad, enfoque: s.enfoque, peso: s.peso,
        fecha: s.fecha ? new Date(s.fecha).toISOString() : null, duracion: s.tiempoEstimadoMinutos, estado: s.estado,
        personasPorGrupo: s.personasPorGrupo, cantidadGrupos: s.cantidadGrupos, tieneRubrica: !!s.rubrica?.criterios?.length,
        recursos: s.recursos?.length || 0, preparados: s.preparados || 0,
        examen: s.examen ? `${s.examen.preguntas.length} preguntas, ${s.examen.tipo}` : null,
      })),
    };
  };
  const propuestaDeAccion = (a: AccionChat) => ({
    evaluaciones: (a.datos?.evaluaciones || []).map((e: any) => ({
      numero: e.numero, existenteId: evaluacionesActivas()[e.numero - 1]?.id ?? null, examenEnLinea: e.examenEnLinea,
      tipo: `Evaluación ${e.numero}`, materia: e.nombre, tipoActividad: e.tipoActividad, enfoque: e.enfoque, duracionMinutos: e.duracionMinutos,
      peso: e.peso, cantidadGrupos: e.cantidadGrupos, personasPorGrupo: e.personasPorGrupo, fecha: e.fecha, hora: e.hora, descripcion: e.descripcion,
    })),
  });
  const marcarAccion = (msgId: string, accId: string, cambio: Partial<AccionChat>) =>
    setHistorial(prev => prev.map(m => (m.id === msgId ? { ...m, acciones: (m.acciones || []).map(a => (a.id === accId ? { ...a, ...cambio } : a)) } : m)));

  const ejecutarAccion = async (msgId: string, a: AccionChat, modo: 'aplicar' | 'ajustar' = 'aplicar') => {
    // Nunca dos veces la misma acción (ej. "Aplicar todo" y el modo automático a la vez)
    if (modo === 'aplicar') { if (aplicadasRef.current.has(a.id)) return; aplicadasRef.current.add(a.id); }
    marcarAccion(msgId, a.id, { estado: 'trabajando', resultado: undefined, ...(a.automatica ? { automatica: true } : {}) });
    let deshacer: (() => Promise<string>) | null = null;
    // Foto antes del cambio. Deshacer devuelve SOLO lo que tocó esta acción: ciertos campos de ciertas evaluaciones
    // (ids + campos) y/o quita las evaluaciones nuevas que agregó (quitarNuevas). Lo demás que hayas cambiado después se respeta.
    const foto = (letra: string, etiqueta: string, op: { ids?: string[]; campos?: (keyof SeccionExamen)[]; quitarNuevas?: boolean }) => {
      const antes = new Map<string, SeccionExamen>(planificacion.secciones.map((x: SeccionExamen) => [x.id, { ...x }]));
      return async () => {
        setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones
          .filter(x => !op.quitarNuevas || (x.grupoSeccion || 'A').toUpperCase() !== letra || antes.has(x.id))
          .map(x => {
            if (!op.ids?.includes(x.id) || !antes.has(x.id)) return x;
            const viejo = antes.get(x.id) as SeccionExamen;
            if (!op.campos) return { ...viejo, estado: x.estado };
            const r: any = { ...x }; for (const c of op.campos) r[c] = (viejo as any)[c]; return r;
          }) }));
        return etiqueta;
      };
    };
    try {
      const evs = evaluacionesActivas();
      const ev = (n: number) => { const s = evs[n - 1]; if (!s) throw new Error(`No existe la evaluación #${n} en la Sección ${seccionActiva}.`); return s; };
      // Para lo que se guarda directo en la base de datos (examen, notas, estado) la evaluación tiene que existir allí:
      // si es recién creada, primero se guarda el plan y se espera a que tenga su id definitivo.
      const evGuardada = async (n: number): Promise<SeccionExamen> => {
        let s = ev(n);
        if (esIdGuardado(s.id)) return s;
        await guardarAhora?.();
        for (let i = 0; i < 20 && !esIdGuardado(s.id); i++) {
          await new Promise(res => setTimeout(res, 100));
          s = (planRef.current.secciones as SeccionExamen[]).filter(x => (x.grupoSeccion || 'A') === seccionActiva)[n - 1] ?? s;
        }
        if (!esIdGuardado(s.id)) throw new Error('Esa evaluación todavía se está guardando. Espera a que diga "Guardado" y vuelve a intentarlo.');
        return s;
      };
      const cambiar = (id: string, cambio: Partial<SeccionExamen>) => setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.map(x => (x.id === id ? { ...x, ...cambio } : x)) }));
      let resultado = '';
      switch (a.tipo) {
        case 'proponer_evaluaciones': {
          const excl: number[] = a.datos?.excluidas || [];
          if (excl.length) a = { ...a, datos: { ...a.datos, evaluaciones: (a.datos?.evaluaciones || []).filter((_: any, i: number) => !excl.includes(i)) } };
          if (!(a.datos?.evaluaciones || []).length) throw new Error('Marca al menos una evaluación para guardar.');
          const prop = propuestaDeAccion(a);
          const nuevasSinLugar = prop.evaluaciones.filter((e: any) => !e.existenteId).length;
          if (modo !== 'ajustar' && evs.length + nuevasSinLugar > 6) throw new Error(`Máximo 6 evaluaciones por sección: ya hay ${evs.length}. Desmarca ${evs.length + nuevasSinLugar - 6} o pídele que reemplace una existente.`);
          if (modo === 'ajustar') {
            setPropuestaPendienteLocal(prop); setPropuestaPendiente(prop); setVistaPanel('planificacion'); if (esMovil) setExpandido(false);
            marcarAccion(msgId, a.id, { estado: 'pendiente', resultado: undefined });
            return; // sigue pendiente: se guarda desde los formularios o con "Guardar en el planificador"
          } else {
            deshacer = foto(seccionActiva, 'Evaluaciones devueltas a como estaban', { quitarNuevas: true, ids: (a.datos?.evaluaciones || []).map((e: any) => evs[e.numero - 1]?.id).filter(Boolean) });
            const r = await guardarEvaluacionesDirecto(prop);
            if (!r.success) throw new Error(r.mensaje);
            resultado = `${r.totalEvals} evaluación(es) guardadas en la Sección ${seccionActiva}${r.pdfGenerado ? ' y plan de acción generado' : ''}`;
            if (modoAutoRef.current) setTimeout(() => prepararNuevas(prop), 250);
            if (modoAutoRef.current) setTimeout(async () => {
              const m = historialRef.current.find(x => x.id === msgId);
              for (const x of (m?.acciones || []).filter(x => x.id !== a.id && (x.estado || 'pendiente') === 'pendiente' && ACCIONES_SEGURAS.includes(x.tipo))) {
                await ejecutarRef.current(msgId, { ...x, automatica: true });
                await new Promise(res => setTimeout(res, 80));
              }
            }, 150);
            setVistaPanel('planificacion');
          }
          break;
        }
        case 'crear_rubrica': {
          const s = ev(a.datos.evaluacion);
          deshacer = foto(seccionActiva, 'Rúbrica quitada', { ids: [s.id], campos: ['rubrica'] }); const rub = rubricaSugerida(s);
          cambiar(s.id, { rubrica: rub });
          resultado = `Rúbrica de ${textoPuntos(totalRubrica(rub))} pts creada para «${limpiarTexto(s.nombre)}» (edítala con 📋 en la tarjeta)`;
          break;
        }
        case 'buscar_recursos': {
          const s = ev(a.datos.evaluacion);
          deshacer = foto(seccionActiva, 'Recursos devueltos a como estaban', { ids: [s.id], campos: ['recursos'] });
          const d = await pedirSugerenciasRecursos(s, planificacion.materia);
          const nuevos = [...d.videos.slice(0, 2), ...d.paginas.slice(0, 2)].map(x => ({ titulo: x.titulo, url: x.url }));
          if (!nuevos.length) throw new Error(d.avisos[0] || 'No se encontraron recursos para ese tema.');
          const actuales = s.recursos || [];
          cambiar(s.id, { recursos: [...actuales, ...nuevos.filter(n => !actuales.some(x => x.url === n.url))].slice(0, 10) });
          resultado = `${nuevos.length} recurso(s) agregados a «${limpiarTexto(s.nombre)}»`;
          break;
        }
        case 'reprogramar': {
          const s = ev(a.datos.evaluacion);
          deshacer = foto(seccionActiva, 'Fecha devuelta a la anterior', { ids: [s.id], campos: ['fecha'] });
          const horaActual = s.fecha ? `${String(new Date(s.fecha).getHours()).padStart(2, '0')}:${String(new Date(s.fecha).getMinutes()).padStart(2, '0')}` : '08:00';
          const f = new Date(`${a.datos.fecha}T${a.datos.hora || horaActual}:00`);
          if (isNaN(f.getTime())) throw new Error('La fecha propuesta no es válida.');
          if (f.getTime() < Date.now()) throw new Error('Esa fecha ya pasó: pídele al agente una fecha futura.');
          cambiar(s.id, { fecha: f });
          resultado = `«${limpiarTexto(s.nombre)}» movida al ${f.toLocaleString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
          break;
        }
        case 'ajustar_pesos': {
          const mapa = new Map<string, number>();
          for (const p of a.datos.pesos || []) mapa.set(ev(p.evaluacion).id, p.peso);
          deshacer = foto(seccionActiva, 'Pesos devueltos a los anteriores', { ids: [...mapa.keys()], campos: ['peso'] });
          setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.map(x => (mapa.has(x.id) ? { ...x, peso: mapa.get(x.id)! } : x)) }));
          const total = evs.reduce((t, s) => t + (mapa.has(s.id) ? mapa.get(s.id)! : Number(s.peso) || 0), 0);
          resultado = `Pesos actualizados: la Sección ${seccionActiva} suma ${total}%`;
          break;
        }
        case 'generar_plan_accion': {
          if (!generarPDF) throw new Error('No disponible.');
          const url = await generarPDF();
          if (!url) throw new Error('No se pudo generar el PDF. Revisa que haya evaluaciones marcadas.');
          setVistaPanel('planificacion');
          resultado = 'Plan de acción generado (lo ves en el Planificador)';
          break;
        }
        case 'copiar_plan': {
          const { desde, hacia, dias, reemplazar } = a.datos;
          if (!reemplazar) deshacer = foto(hacia, `Se quitaron las copias de la Sección ${hacia}`, { quitarNuevas: true });
          const origen = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A').toUpperCase() === desde);
          if (!origen.length) throw new Error(`La Sección ${desde} no tiene evaluaciones.`);
          const enDestino = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A').toUpperCase() === hacia);
          if (reemplazar && enDestino.length && !window.confirm(`Se borrarán las ${enDestino.length} evaluación(es) de la Sección ${hacia} y se pondrán las copias. ¿Continuar?`)) throw new Error('Cancelado.');
          const base = Date.now();
          const copias: SeccionExamen[] = origen.map((s: SeccionExamen, i: number) => {
            const { estado: _e, preparados: _p, ...resto } = s;
            return { ...resto, id: `copia${hacia}-${base}-${i}`, grupoSeccion: hacia, fecha: s.fecha ? new Date(new Date(s.fecha).getTime() + (Number(dias) || 0) * 86400000) : undefined };
          });
          setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: [...(reemplazar ? prev.secciones.filter(s => (s.grupoSeccion || 'A').toUpperCase() !== hacia) : prev.secciones), ...copias].map((s, idx) => ({ ...s, orden: idx })) }));
          resultado = `${copias.length} evaluación(es) copiadas de la Sección ${desde} a la ${hacia}${dias ? ` (${dias > 0 ? '+' : ''}${dias} días)` : ''}`;
          break;
        }
        case 'cambiar_estado': {
          const s = await evGuardada(a.datos.evaluacion);
          const estadoAntes = String(s.estado || 'PROGRAMADA').toUpperCase() === 'REPROGRAMADA' ? 'PROGRAMADA' : String(s.estado || 'PROGRAMADA').toUpperCase();
          deshacer = async () => {
            const rr = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: estadoAntes }) });
            if (!rr.ok) throw new Error('No se pudo devolver el estado.');
            cambiar(s.id, { estado: estadoAntes });
            return `«${limpiarTexto(s.nombre)}» volvió a ${estadoAntes.toLowerCase()}`;
          };
          const r = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: a.datos.estado }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'No se pudo cambiar el estado.');
          cambiar(s.id, { estado: d.estado || a.datos.estado, ...(d.fecha ? { fecha: new Date(d.fecha) } : {}) });
          resultado = `«${limpiarTexto(s.nombre)}» marcada como ${String(a.datos.estado).toLowerCase()}`;
          break;
        }
        case 'mensaje_estudiantes': {
          const r = await fetch('/api/whatsapp/mensaje', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...a.datos, seccion: seccionActiva, planificacionId }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
          resultado = `Enviando por ${medioEnvio()} a ${d.total} estudiante(s)${d.sinTelefono?.length ? ` (${d.sinTelefono.length} sin ${porCorreo() ? 'correo' : 'teléfono'})` : ''}`;
          break;
        }
        case 'recordar_preferencia': {
          const r = await fetch('/api/chat/memoria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: a.datos.texto }) });
          if (!r.ok) throw new Error('No se pudo guardar.');
          const dm = await r.json().catch(() => ({}));
          if (dm.memoria?.id) deshacer = async () => { await fetch(`/api/chat/memoria?id=${encodeURIComponent(dm.memoria.id)}`, { method: 'DELETE' }); setMemorias(null); return 'Ya no lo recordaré'; };
          setMemorias(null);
          resultado = 'Lo recordaré en las próximas conversaciones';
          break;
        }
        case 'navegar': {
          if (a.datos.seccion) { seccionPorAgente.current = true; onCambiarSeccion?.(a.datos.seccion); }
          setVistaPanel(VISTA_DE_AGENTE[a.datos.vista] || 'planificacion');
          if (esMovil) setExpandido(false);
          resultado = `Abrí ${NOMBRE_VISTA[a.datos.vista] || a.datos.vista}${a.datos.seccion ? ` · Sección ${a.datos.seccion}` : ''}`;
          break;
        }
        case 'agregar_estudiantes': {
          const sec = a.datos.seccion || seccionActiva;
          const filas: any[] = a.datos.estudiantes || [];
          const fallidos: any[] = []; const errores: string[] = []; let ok = 0; const creados: string[] = [];
          for (const e of filas) {
            try {
              const r = await fetch('/api/estudiantes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: e.nombre, email: e.email, telefono: String(e.telefono || '').replace(/[\s().-]/g, ''), grupo: sec, materiaId: materiaAbierta.id || undefined }) });
              const d = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error(d.error || 'No se pudo agregar.');
              ok++; if (d.id) creados.push(d.id);
            } catch (err: any) { fallidos.push(e); errores.push(`${e.nombre}: ${err.message}`); }
          }
          if (ok) { olvidarCache('/api/estudiantes'); window.dispatchEvent(new Event('estudiantes-cambiaron')); }
          if (fallidos.length) {
            // Quedan en la tarjeta solo los que fallaron, para corregirlos y volver a intentar
            marcarAccion(msgId, a.id, { datos: { ...a.datos, estudiantes: fallidos } });
            if (ok) eventosRef.current.push(`se agregaron ${ok} estudiante(s) a la sección ${sec}`);
            throw new Error(`${ok ? `Se agregaron ${ok}. ` : ''}Corrige y vuelve a intentar: ${errores.slice(0, 3).join(' · ')}`);
          }
          resultado = `${ok} estudiante(s) agregados a la Sección ${sec}`;
          deshacer = async () => {
            for (const id of creados) await fetch(`/api/estudiantes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            olvidarCache('/api/estudiantes'); window.dispatchEvent(new Event('estudiantes-cambiaron'));
            return `Se quitaron los ${creados.length} estudiante(s) agregados`;
          };
          break;
        }
        case 'modificar_estudiantes': {
          const r = await fetch(conMateria('/api/estudiantes'));
          const lista: any[] = await r.json().catch(() => []);
          if (!r.ok || !Array.isArray(lista)) throw new Error('No se pudo leer la lista de estudiantes.');
          const encontrados: any[] = []; const faltan: string[] = []; const dudas: string[] = [];
          for (const n of a.datos.nombres || []) { const e = buscarPorNombre(lista, n); if (e === 'varios') dudas.push(n); else if (!e) faltan.push(n); else if (!encontrados.includes(e)) encontrados.push(e); }
          if (!encontrados.length) throw new Error(`No encontré a ${[...faltan, ...dudas].join(', ')}${dudas.length ? ' (hay varios con ese nombre: escribe el nombre completo)' : ''}.`);
          const errores: string[] = [];
          for (const e of encontrados) {
            const estado = a.datos.accion === 'retirar' ? 'INACTIVO' : a.datos.accion === 'reactivar' ? 'ACTIVO' : String(e.estado || 'ACTIVO').toUpperCase();
            const grupo = a.datos.accion === 'mover' ? a.datos.seccion : e.grupo;
            const rr = await fetch('/api/estudiantes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, nombre: e.nombre, email: e.email, telefono: e.telefono, grupo, estado }) });
            if (!rr.ok) { const d = await rr.json().catch(() => ({})); errores.push(`${e.nombre}: ${d.error || 'error'}`); }
          }
          olvidarCache('/api/estudiantes'); window.dispatchEvent(new Event('estudiantes-cambiaron'));
          const hechos = encontrados.length - errores.length;
          deshacer = async () => {
            for (const e of encontrados) await fetch('/api/estudiantes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, nombre: e.nombre, email: e.email, telefono: e.telefono, grupo: e.grupo, estado: String(e.estado || 'ACTIVO').toUpperCase() }) });
            olvidarCache('/api/estudiantes'); window.dispatchEvent(new Event('estudiantes-cambiaron'));
            return 'Los estudiantes volvieron a como estaban';
          };
          const verbo = a.datos.accion === 'mover' ? `movido(s) a la Sección ${a.datos.seccion}` : a.datos.accion === 'retirar' ? 'retirado(s)' : 'reactivado(s)';
          if (!hechos) throw new Error(errores.join(' · '));
          resultado = `${hechos} estudiante(s) ${verbo}${faltan.length || dudas.length ? `; no encontré a ${[...faltan, ...dudas].join(', ')}` : ''}${errores.length ? `; ${errores.length} con error` : ''}`;
          break;
        }
        case 'cargar_notas': {
          const s = await evGuardada(a.datos.evaluacion);
          const r = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/notas`);
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'No se pudieron leer los estudiantes de esa evaluación.');
          const alumnos: any[] = d.estudiantes || [];
          const notas: any[] = []; const faltan: string[] = [];
          for (const x of a.datos.notas || []) {
            const e = buscarPorNombre(alumnos, x.nombre);
            if (!e || e === 'varios') { faltan.push(x.nombre); continue; }
            const igual = e.puntaje != null && Number(e.puntaje) === Number(x.nota);
            // Se conserva lo que ya tenía (observación y rúbrica) salvo que la nota cambie
            notas.push({ estudianteId: e.id, puntaje: x.nota, observaciones: x.observacion || e.observaciones || '', detalle: igual ? e.detalle : null });
          }
          if (!notas.length) throw new Error(`No encontré en la Sección ${s.grupoSeccion || seccionActiva} a: ${faltan.join(', ')}.`);
          const rr = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/notas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notas }) });
          const dd = await rr.json().catch(() => ({}));
          if (!rr.ok) throw new Error(dd.error || 'No se pudieron guardar las notas.');
          if (dd.estado) cambiar(s.id, { estado: dd.estado });
          olvidarCache('/api/estudiantes');
          const notasAntes = notas.map(n => { const e = alumnos.find(x => x.id === n.estudianteId); return { estudianteId: n.estudianteId, puntaje: e?.puntaje ?? null, observaciones: e?.observaciones || '', detalle: e?.detalle ?? null }; });
          const estadoAntes = String(s.estado || 'PROGRAMADA').toUpperCase();
          if (!a.datos.enviar) deshacer = async () => {
            const ru = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/notas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notas: notasAntes }) });
            if (!ru.ok) throw new Error('No se pudieron devolver las notas.');
            if (estadoAntes !== 'REALIZADA' && dd.estado === 'REALIZADA') {
              const vuelta = estadoAntes === 'REPROGRAMADA' ? 'PROGRAMADA' : estadoAntes;
              await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/estado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: vuelta }) });
              cambiar(s.id, { estado: vuelta });
            }
            olvidarCache('/api/estudiantes');
            return 'Las notas volvieron a como estaban';
          };
          let enviadas = '';
          if (a.datos.enviar) {
            const re = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/notas/enviar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudianteIds: notas.map(n => n.estudianteId) }) });
            const de = await re.json().catch(() => ({}));
            enviadas = re.ok ? ` y enviadas por ${medioEnvio()} a ${de.total}` : ` (no se enviaron: ${de.error || 'error'})`;
          }
          resultado = `${dd.guardadas ?? notas.length} nota(s) guardadas en «${limpiarTexto(s.nombre)}»${enviadas}${faltan.length ? `; no encontré a ${faltan.join(', ')}` : ''}`;
          break;
        }
        case 'recordatorios': {
          if (a.datos.accion === 'programar') {
            const enviarEn = new Date(`${a.datos.fecha}T${a.datos.hora}:00-04:00`);
            const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'programar', seccion: seccionActiva, texto: a.datos.texto, enviarEn: enviarEn.toISOString(), incluirEnlace: true }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'No se pudo programar.');
            deshacer = async () => { await fetch(`/api/recordatorios?programado=${encodeURIComponent(d.programado.id)}`, { method: 'DELETE' }); return 'Mensaje programado cancelado'; };
            resultado = `Mensaje programado para la Sección ${seccionActiva} el ${enviarEn.toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}`;
            break;
          }
          const s = await evGuardada(a.datos.evaluacion);
          if (a.datos.accion === 'enviar_ahora') {
            const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar', evaluacionId: s.id }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
            resultado = `Recordatorio de «${limpiarTexto(s.nombre)}» enviado a ${d.total} estudiante(s)`;
            break;
          }
          const apagar = a.datos.accion === 'apagar';
          const poner = async (v: boolean) => { const r = await fetch('/api/recordatorios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacion: { id: s.id, apagada: v } }) }); if (!r.ok) throw new Error('No se pudo cambiar.'); };
          await poner(apagar);
          deshacer = async () => { await poner(!apagar); return apagar ? 'Recordatorios encendidos de nuevo' : 'Recordatorios apagados de nuevo'; };
          resultado = apagar ? `«${limpiarTexto(s.nombre)}» ya no enviará recordatorios automáticos` : `«${limpiarTexto(s.nombre)}» volverá a enviar recordatorios automáticos`;
          break;
        }
        case 'abrir_en_portal': {
          const s = ev(a.datos.evaluacion);
          deshacer = foto(seccionActiva, 'Vuelve a abrirse sola 7 días antes', { ids: [s.id], campos: ['abiertaManual'] });
          cambiar(s.id, { abiertaManual: !!a.datos.abrir });
          resultado = a.datos.abrir ? `«${limpiarTexto(s.nombre)}» ya se ve completa en la página de los estudiantes` : `«${limpiarTexto(s.nombre)}» se abrirá sola 7 días antes de su fecha`;
          break;
        }
        case 'enviar_plan': {
          const r = await fetch(conMateria(`/api/estudiantes?grupo=${encodeURIComponent(seccionActiva)}&estado=ACTIVO`));
          let lista: any[] = await r.json().catch(() => []);
          if (!r.ok || !Array.isArray(lista)) throw new Error('No se pudo leer la lista de estudiantes.');
          if (a.datos.soloSinAbrir) lista = lista.filter(e => !(e.portalVisitas > 0));
          if (!lista.length) throw new Error(a.datos.soloSinAbrir ? 'Todos los estudiantes ya abrieron su página.' : `No hay estudiantes activos en la Sección ${seccionActiva}.`);
          const rr = await fetch('/api/whatsapp/enviar-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seccion: seccionActiva, estudianteIds: lista.map(e => e.id), materia: planificacion.materia }) });
          const d = await rr.json().catch(() => ({}));
          if (!rr.ok) throw new Error(d.error || 'No se pudo enviar.');
          resultado = `Enviando el enlace del plan a ${d.total} estudiante(s)${d.sinTelefono?.length ? ` (${d.sinTelefono.length} sin teléfono)` : ''}`;
          break;
        }
        case 'eliminar_evaluaciones': {
          const quitar = (a.datos.evaluaciones || []).map((n: number) => ev(n));
          const ids = new Set(quitar.map((s: SeccionExamen) => s.id));
          const copias = quitar.map((s: SeccionExamen) => ({ ...s }));
          deshacer = async () => {
            await guardarAhora?.(); // espera a que el borrado llegue a la base de datos (y a la papelera)
            const rp = await fetch('/api/papelera'); const dp = await rp.json().catch(() => ({}));
            const items: any[] = (dp.items || []).filter((it: any) => it.tipo === 'EVALUACION');
            const nuevos: SeccionExamen[] = [];
            for (const c of copias) {
              const it = items.find(x => x.nombre === c.nombre && !nuevos.some(n => (n as any)._papelera === x.id));
              if (!it) continue;
              const rr = await fetch(`/api/papelera/${encodeURIComponent(it.id)}/restaurar`, { method: 'POST' });
              const dr = await rr.json().catch(() => ({}));
              if (rr.ok && dr.id) nuevos.push({ ...c, id: dr.id, _papelera: it.id } as any);
            }
            if (!nuevos.length) throw new Error('No las encontré en la Papelera: restáuralas desde ahí.');
            setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: [...prev.secciones, ...nuevos.map(({ _papelera, ...x }: any) => x)] }));
            return `${nuevos.length} evaluación(es) restauradas con sus notas`;
          };
          setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.filter(x => !ids.has(x.id)) }));
          resultado = `${quitar.length} evaluación(es) eliminadas (están en la Papelera con sus notas)`;
          break;
        }
        case 'crear_examen': {
          const s = await evGuardada(a.datos.evaluacion);
          const anterior = s.examen ?? null;
          const r = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/examen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar', examen: a.datos.examen }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'No se pudo adjuntar el examen.');
          cambiar(s.id, { examen: d.examen });
          deshacer = async () => {
            const rr = await fetch(`/api/evaluaciones/${encodeURIComponent(s.id)}/examen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar', examen: anterior }) });
            if (!rr.ok) throw new Error('No se pudo quitar el examen.');
            cambiar(s.id, { examen: anterior });
            return anterior ? 'Se dejó el examen anterior' : 'Examen quitado de la evaluación';
          };
          resultado = `Examen de ${d.examen.preguntas.length} preguntas adjuntado a «${limpiarTexto(s.nombre)}» (los estudiantes lo verán bloqueado hasta la fecha)`;
          break;
        }
        case 'cambiar_materia': {
          if (!onCambiarMateria) throw new Error('No disponible.');
          resultado = await onCambiarMateria(a.datos.nombre, !!a.datos.crear);
          break;
        }
        default: throw new Error('Acción desconocida.');
      }
      if (deshacer) deshacerRef.current[a.id] = deshacer;
      marcarAccion(msgId, a.id, { estado: 'hecha', resultado });
      eventosRef.current.push(`${ACCIONES_AUTOMATICAS.includes(a.tipo) || a.automatica ? 'se aplicó solo (modo automático)' : 'el profesor aplicó tu propuesta'}: ${resultado}`);
      if (!ACCIONES_AUTOMATICAS.includes(a.tipo)) agregarNotificacion?.(`${a.automatica ? '⚡' : '✅'} ${resultado}${/[.!?…]$/.test(resultado) ? '' : '.'}`);
    } catch (e: any) {
      aplicadasRef.current.delete(a.id); // falló: se puede volver a intentar
      marcarAccion(msgId, a.id, { estado: 'pendiente', resultado: `⚠ ${e?.message || 'No se pudo aplicar.'}` });
    }
  };
  // Siempre la versión más reciente (con el plan actualizado), para aplicar varias seguidas
  const ejecutarRef = useRef(ejecutarAccion); ejecutarRef.current = ejecutarAccion;
  const historialRef = useRef(historial); historialRef.current = historial;
  const planRef = useRef(planificacion); planRef.current = planificacion;
  const enviarRef = useRef<(m: string) => void>(() => {});
  // Evaluaciones recién guardadas desde una propuesta: se les buscan recursos y, a las teóricas, el agente les prepara el examen
  const prepararNuevas = async (prop: any) => {
    const propuestas: any[] = prop?.evaluaciones || [];
    const nombres = propuestas.map((e: any) => limpiarTexto(e.materia).toLowerCase());
    const activas = (planRef.current.secciones as SeccionExamen[]).filter(s => (s.grupoSeccion || 'A') === seccionActiva);
    const nuevas = activas.map((s, i) => ({ s, numero: i + 1 })).filter(({ s }) => nombres.includes(limpiarTexto(s.nombre).toLowerCase()));
    if (!nuevas.length) return;
    let conRecursos = 0;
    // A cada evaluación nueva: videos y páginas sugeridas (si no tenía recursos) + el enlace oficial de cada herramienta que nombra
    for (const { s } of nuevas) {
      const herramientas = enlacesDeDescripcion(s.descripcion || '');
      let sugeridos: { titulo: string; url: string }[] = [];
      if (!s.recursos?.length) {
        try {
          const d = await pedirSugerenciasRecursos(s, planRef.current.materia);
          sugeridos = [...d.videos.slice(0, 2), ...d.paginas.slice(0, 2)].map(x => ({ titulo: x.titulo, url: x.url }));
        } catch { /* sin sugerencias: se pueden buscar después con 📎 */ }
      }
      const actuales = s.recursos || [];
      const nuevos = [...sugeridos, ...herramientas].filter(n => !actuales.some(x => x.url === n.url));
      if (nuevos.length) {
        const lista = [...actuales, ...nuevos].filter((x, i, arr) => arr.findIndex(y => y.url === x.url) === i).slice(0, 10);
        setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.map(x => (x.id === s.id ? { ...x, recursos: lista } : x)) }));
        conRecursos++;
      }
    }
    if (conRecursos) agregarNotificacion?.(`⚡ Recursos agregados a ${conRecursos} evaluación(es) nueva(s).`);
    const teoricas = nuevas.filter(({ s }) => {
      if (s.examen) return false;
      const marcada = propuestas.find(e => limpiarTexto(e.materia).toLowerCase() === limpiarTexto(s.nombre).toLowerCase())?.examenEnLinea;
      return typeof marcada === 'boolean' ? marcada && admiteExamenEnLinea(s.tipoActividad, s.enfoque, s.descripcion) : admiteExamenEnLinea(s.tipoActividad, s.enfoque, s.descripcion);
    });
    if (teoricas.length) enviarRef.current(`Prepárame el examen en línea de ${teoricas.map(({ s, numero }) => `la #${numero} («${limpiarTexto(s.nombre)}»)`).join(' y ')}.`);
  };
  const aplicarTodo = async (msg: Mensaje) => {
    const lista = (msg.acciones || []).filter(a => (a.estado || 'pendiente') === 'pendiente' && !FUERA_DE_APLICAR_TODO.includes(a.tipo));
    // Primero las que crean evaluaciones, para que las demás (rúbricas, recursos…) ya las encuentren
    lista.sort((x, y) => (x.tipo === 'proponer_evaluaciones' ? -1 : 0) - (y.tipo === 'proponer_evaluaciones' ? -1 : 0));
    for (const a of lista) {
      await ejecutarRef.current(msg.id, a);
      await new Promise(r => setTimeout(r, 80)); // deja que la pantalla se actualice antes de la siguiente
    }
  };
  const deshacerAccion = async (msgId: string, a: AccionChat) => {
    const f = deshacerRef.current[a.id]; if (!f) return;
    marcarAccion(msgId, a.id, { estado: 'trabajando' });
    try {
      const r = await f();
      delete deshacerRef.current[a.id];
      marcarAccion(msgId, a.id, { estado: 'deshecha', resultado: r });
      eventosRef.current.push(`el profesor deshizo: ${TITULO_ACCION[a.tipo] || a.tipo}`);
      agregarNotificacion?.(`↩️ ${r}.`);
    } catch (e: any) { marcarAccion(msgId, a.id, { estado: 'hecha', resultado: `⚠ ${e?.message || 'No se pudo deshacer.'}` }); }
  };
  const descartarAccion = (msgId: string, a: AccionChat) => {
    marcarAccion(msgId, a.id, { estado: 'descartada' });
    // Descartar una propuesta también limpia los formularios donde se había cargado
    if (a.tipo === 'proponer_evaluaciones') { setPropuestaPendienteLocal(null); setPropuestaPendiente(null); limpiarYScroll?.(); }
    eventosRef.current.push(`el profesor descartó tu propuesta (${TITULO_ACCION[a.tipo] || a.tipo})`);
  };

  // Confirmaciones escritas ("sí", "guárdalo", "dale"): solo si el mensaje es corto, para no confundir "sí, pero cambia la 2"
  const esConfirmacionCorta = (msg: string) => msg.trim().split(/\s+/).length <= 3 && esConfirmacionGuardado(msg) && !esNegacion(msg);
  // Un "sí" corto guarda la propuesta SOLO si lo último que dijo el agente fue esa propuesta y no hizo otra pregunta
  // (si preguntó "¿creo también las rúbricas?", el "sí" es la respuesta a eso y va al agente).
  const propuestaEsLoUltimo = () => {
    const ultimo = [...historialRef.current].reverse().find(m => m.rol === 'agent');
    const tienePropuesta = !!ultimo?.acciones?.some(a => a.tipo === 'proponer_evaluaciones' && (a.estado ?? 'pendiente') === 'pendiente');
    return tienePropuesta && !String(ultimo?.contenido || '').includes('?');
  };

  enviarRef.current = (m: string) => { handleSend(m); };
  const handleSend = async (overrideMsg?: string, opciones: { regenerar?: boolean; modo?: 'revision' } = {}) => {
    const adj = opciones.regenerar ? null : adjunto;
    const msg = ((overrideMsg ?? mensaje).trim() || (adj ? `Revisa el documento «${adj.nombre}» y dime cómo lo usarías para planificar las evaluaciones.` : '')).trim();
    if (!msg || pensando || escribiendo || subiendoAdjunto) return;
    if (!opciones.regenerar) setHistorial(prev => [...prev, { rol: 'user', contenido: msg, completo: true, id: `user-${Date.now()}`, adjunto: adj?.nombre }]);
    if (adj) setAdjunto(null);
    setMensaje('');
    scrollToBottom(true);
    if (!opciones.regenerar && !opciones.modo) {
      // "Borra la evaluación 2" ya no se intercepta aquí: lo resuelve el agente con eliminar_evaluaciones (tarjeta con confirmación)
      if (propuestaPendienteLocal && propuestaEsLoUltimo() && esNegacion(msg) && msg.split(/\s+/).length <= 4) {
        setHistorial(prev => prev.map(m => ({ ...m, acciones: m.acciones?.map(a => (a.tipo === 'proponer_evaluaciones' && (a.estado ?? 'pendiente') === 'pendiente' ? { ...a, estado: 'descartada' as const } : a)) })));
        cancelarPropuesta(); return;
      }
      if (propuestaPendienteLocal && propuestaEsLoUltimo() && esConfirmacionCorta(msg)) {
        const r = await guardarEvaluacionesDirecto();
        setHistorial(prev => [...prev.map(m => ({ ...m, acciones: m.acciones?.map(a => (a.tipo === 'proponer_evaluaciones' && (a.estado ?? 'pendiente') === 'pendiente' ? { ...a, estado: 'hecha' as const, resultado: 'Guardada' } : a)) })), { rol: 'agent', contenido: r.success ? r.mensaje : '⚠️ ' + r.mensaje, completo: true, id: `agent-${Date.now()}` }]);
        if (r.success) { eventosRef.current.push('el profesor guardó tu propuesta de evaluaciones'); setVistaPanel('planificacion'); }
        return;
      }
    }
    if (config && !config.chat.activo) { setHistorial(prev => [...prev, { rol: 'agent', contenido: '⏸️ ' + config.chat.mensajeInactivo, completo: true, id: `agent-${Date.now()}` }]); return; }
    if (config && msg.length > config.chat.maxCaracteresMensaje) { setHistorial(prev => [...prev, { rol: 'agent', contenido: `✂️ Tu mensaje tiene ${msg.length} caracteres y el máximo permitido es ${config.chat.maxCaracteresMensaje}. Acórtalo e inténtalo de nuevo.`, completo: true, id: `agent-${Date.now()}` }]); return; }

    const idAgente = `agent-${Date.now()}`;
    let creado = false;
    let traePropuesta = false; // si el mensaje propone evaluaciones, lo automático espera a que se guarden
    const asegurarMensaje = () => {
      if (creado) return;
      creado = true; setPensando(false); setEscribiendo(true);
      setHistorial(prev => [...prev, { rol: 'agent', contenido: '', completo: false, streaming: true, id: idAgente, acciones: [] }]);
    };
    const actualizar = (f: (m: Mensaje) => Mensaje) => setHistorial(prev => prev.map(m => (m.id === idAgente ? f(m) : m)));
    setPensando(true);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const limite = setTimeout(() => ctrl.abort('tiempo'), Math.max(30, Number(config?.chat?.timeoutSegundos) || 90) * 1000);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ mensaje: msg, conversacionId, planificacionId, contexto: armarContexto(), eventos: eventosRef.current, regenerar: !!opciones.regenerar, modo: opciones.modo, modoAuto, adjunto: adj ? { nombre: adj.nombre, texto: adj.texto } : undefined }),
      });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || (r.status === 504 ? 'El servidor tardó demasiado (más de 60 s). Intenta de nuevo.' : `El agente no pudo responder (código ${r.status}). Si se repite, revisa en Vercel → Logs la línea que empieza con [Chat].`));
      }
      eventosRef.current = [];
      const lector = r.body.getReader(); const dec = new TextDecoder(); let resto = '';
      const procesar = (linea: string) => {
        if (!linea.trim()) return;
        let ev: any; try { ev = JSON.parse(linea); } catch { return; }
        if (ev.t === 'inicio' && ev.conversacionId) setConversacionId(ev.conversacionId);
        else if (ev.t === 'modelo') { asegurarMensaje(); actualizar(m => ({ ...m, modelo: ev.v, respaldo: !!ev.respaldo })); }
        else if (ev.t === 'texto') { asegurarMensaje(); actualizar(m => ({ ...m, contenido: m.contenido + ev.v })); scrollToBottom(); }
        else if (ev.t === 'texto_reset') { asegurarMensaje(); actualizar(m => ({ ...m, contenido: String(ev.v || '') })); }
        else if (ev.t === 'accion' && ev.accion) {
          asegurarMensaje(); actualizar(m => ({ ...m, acciones: [...(m.acciones || []), { ...ev.accion, estado: 'pendiente' }] }));
          if (ev.accion.tipo === 'proponer_evaluaciones') {
            traePropuesta = true;
            const prop = propuestaDeAccion(ev.accion);
            setPropuestaPendienteLocal(prop); // para que "sí" escrito también la guarde
            // La propuesta queda en el chat: los formularios solo se abren con «Ver y ajustar en formularios»
          }
          const sola = ACCIONES_AUTOMATICAS.includes(ev.accion.tipo) || (modoAutoRef.current && !traePropuesta && ACCIONES_SEGURAS.includes(ev.accion.tipo));
          if (sola) { const acc = { ...ev.accion, estado: 'pendiente' as const, automatica: true }; setTimeout(() => ejecutarAccion(idAgente, acc), 60); }
          scrollToBottom();
        }
        else if (ev.t === 'aviso') { asegurarMensaje(); actualizar(m => ({ ...m, aviso: ev.v })); }
        else if (ev.t === 'fuentes') { asegurarMensaje(); actualizar(m => ({ ...m, fuentes: Array.isArray(ev.v) ? ev.v.slice(0, 5) : [] })); }
        else if (ev.t === 'consulta') { asegurarMensaje(); actualizar(m => ({ ...m, consultas: [...(m.consultas || []), ...(Array.isArray(ev.v) ? ev.v : [String(ev.v)])] })); }
        else if (ev.t === 'fin') { asegurarMensaje(); actualizar(m => ({ ...m, completo: true, streaming: false, dbId: ev.mensajeId })); }
        else if (ev.t === 'error') throw new Error(ev.mensaje || 'El agente no pudo responder.');
      };
      while (true) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        let i: number;
        while ((i = resto.indexOf('\n')) >= 0) { procesar(resto.slice(0, i)); resto = resto.slice(i + 1); }
      }
      procesar(resto);
      if (!creado) throw new Error('El agente no respondió nada. Intenta de nuevo.');
      actualizar(m => ({ ...m, completo: true, streaming: false }));
    } catch (error: any) {
      const detenido = ctrl.signal.aborted && ctrl.signal.reason !== 'tiempo';
      const texto = detenido ? '' : ctrl.signal.reason === 'tiempo' ? '⏳ El agente tardó demasiado en responder. Intenta de nuevo.' : (error instanceof TypeError ? mensajeErrorAgente(error) : `⚠️ ${error?.message || 'El agente no pudo responder.'}`);
      if (creado) actualizar(m => ({ ...m, completo: true, streaming: false, aviso: detenido ? 'Respuesta detenida.' : texto }));
      else if (!detenido) setHistorial(prev => [...prev, { rol: 'agent', contenido: texto, completo: true, error: true, id: `error-${Date.now()}` }]);
    } finally {
      clearTimeout(limite); abortRef.current = null; setPensando(false); setEscribiendo(false);
    }
  };
  const detener = () => abortRef.current?.abort('usuario');
  const revisarPlan = () => handleSend(`Revisa mi plan de la Sección ${seccionActiva} y ponle nota`, { modo: 'revision' });
  const [agradecidoId, setAgradecidoId] = useState<string | null>(null);
  const valorar = (m: Mensaje, v: 1 | -1) => {
    const nuevo = m.valoracion === v ? 0 : v;
    if (nuevo) { setAgradecidoId(m.id); setTimeout(() => setAgradecidoId(x => (x === m.id ? null : x)), 3000); }
    setHistorial(prev => prev.map(x => (x.id === m.id ? { ...x, valoracion: nuevo || undefined } : x)));
    if (m.dbId) fetch(`/api/chat/mensajes/${encodeURIComponent(m.dbId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valoracion: nuevo }) }).catch(() => {});
  };
  // Leer en voz alta con la voz del navegador (en español)
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* sin voz */ } }, []);
  const leerEnVoz = (m: Mensaje) => {
    const sy = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!sy) { agregarNotificacion?.('⚠️ Tu navegador no puede leer en voz alta.'); return; }
    if (leyendoId === m.id) { sy.cancel(); setLeyendoId(null); return; }
    sy.cancel();
    const texto = m.contenido.replace(/[#*_`>|]/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/^\s*-\s+/gm, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ', ');
    const u = new SpeechSynthesisUtterance(texto);
    const voces = sy.getVoices();
    const voz = voces.find(v => /es[-_](VE|419|MX|US|CO|AR)/i.test(v.lang)) || voces.find(v => /^es/i.test(v.lang));
    if (voz) u.voice = voz;
    u.lang = voz?.lang || 'es-ES'; u.rate = 1.05;
    u.onend = () => setLeyendoId(id => (id === m.id ? null : id)); u.onerror = u.onend;
    setLeyendoId(m.id); sy.speak(u);
  };
  const cargarMemorias = async () => { try { const r = await fetch('/api/chat/memoria'); setMemorias(r.ok ? await r.json() : []); } catch { setMemorias([]); } };
  const olvidarMemoria = async (id: string) => { setMemorias(prev => (prev || []).filter(m => m.id !== id)); await fetch(`/api/chat/memoria?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); };
  // Preguntas generadas: imprimir (o guardar como PDF), copiar o descargar
  const textoPreguntas = (a: AccionChat, conRespuestas: boolean) => {
    const letras = 'abcdef';
    return `${a.datos.tema}\n\n` + (a.datos.preguntas || []).map((q: any, i: number) => `${i + 1}. [${TIPO_PREGUNTA[q.tipo] || q.tipo}${q.puntos ? ` · ${q.puntos} pts` : ''}] ${q.enunciado}` + (q.opciones?.length ? '\n' + q.opciones.map((o: string, k: number) => `   ${letras[k]}) ${o}`).join('\n') : '') + (conRespuestas ? `\n   ✔ ${q.respuesta}` : '')).join('\n\n');
  };
  const imprimirPreguntas = (a: AccionChat) => {
    const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const letras = 'abcdef';
    const items = (conResp: boolean) => (a.datos.preguntas || []).map((q: any, i: number) => `<li><p><b>${esc(q.enunciado)}</b> <small>(${esc(TIPO_PREGUNTA[q.tipo] || q.tipo)}${q.puntos ? ` · ${q.puntos} pts` : ''})</small></p>${q.opciones?.length ? `<ol type="a">${q.opciones.map((o: string) => `<li>${esc(o)}</li>`).join('')}</ol>` : conResp ? '' : '<div class="linea"></div><div class="linea"></div>'}${conResp ? `<p class="resp">✔ ${esc(q.respuesta)}</p>` : ''}</li>`).join('');
    const w = window.open('', '_blank');
    if (!w) { agregarNotificacion?.('⚠️ El navegador bloqueó la ventana. Permite ventanas emergentes.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.datos.tema)}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#1e293b}h1{color:#1e3a8a;font-size:22px}h2{margin-top:40px;color:#1e3a8a;font-size:18px;page-break-before:always}li{margin:0 0 14px}small{color:#64748b}.linea{border-bottom:1px solid #cbd5e1;height:26px}.resp{color:#047857}.cab{display:flex;gap:24px;color:#475569;font-size:13px;margin-bottom:20px}</style></head><body><h1>${esc(a.datos.tema)}</h1><div class="cab"><span>${esc(planificacion.materia || '')}</span><span>Sección ${esc(seccionActiva)}</span><span>Nombre: ________________________</span></div><ol>${items(false)}</ol><h2>Hoja de respuestas (profesor)</h2><ol>${items(true)}</ol><script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  };
  const descargarPreguntas = (a: AccionChat) => {
    const blob = new Blob(['\uFEFF' + textoPreguntas(a, true)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `preguntas_${String(a.datos.tema || 'examen').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40)}.txt`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const regenerar = () => {
    const ultimoUsuario = [...historial].reverse().find(m => m.rol === 'user');
    if (!ultimoUsuario || pensando || escribiendo) return;
    setHistorial(prev => { const iA = prev.map(m => m.rol).lastIndexOf('agent'); const iU = prev.map(m => m.rol).lastIndexOf('user'); return iA > iU ? prev.slice(0, iA) : prev; });
    handleSend(ultimoUsuario.contenido, { regenerar: true });
  };
  const copiar = async (texto: string, id: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiadoId(id); setTimeout(() => setCopiadoId(c => (c === id ? null : c)), 1500); } catch { /* sin permiso de portapapeles */ }
  };

  // --- Conversaciones guardadas ---
  const cargarConversaciones = async () => {
    cargarMemorias();
    try { const r = await fetch(`/api/chat/conversaciones${planificacionId ? `?planificacionId=${encodeURIComponent(planificacionId)}` : ''}`); setConversaciones(r.ok ? await r.json() : []); } catch { setConversaciones([]); }
  };
  const abrirConversacion = async (id: string) => {
    try {
      const r = await fetch(`/api/chat/conversaciones/${encodeURIComponent(id)}`); const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConversacionId(id); setPropuestaPendienteLocal(null); eventosRef.current = []; setVerHistorial(false);
      setHistorial((d.mensajes || []).map((m: any) => ({
        id: m.id, rol: m.rol === 'USER' ? 'user' : 'agent', completo: true, modelo: m.modelo || undefined,
        contenido: m.rol === 'USER' ? String(m.contenido).replace(/^\(En la app, desde tu último mensaje:[\s\S]*?\)\n\n/, '').replace(/\n\n\[Documento adjunto «[^»]*»\][\s\S]*$/, '') : m.contenido,
        adjunto: m.rol === 'USER' ? (String(m.contenido).match(/\[Documento adjunto «([^»]*)»\]/)?.[1] || undefined) : undefined,
        dbId: m.rol === 'AGENT' ? m.id : undefined, valoracion: m.valoracion ?? undefined, respaldo: !!m.respaldo,
        acciones: Array.isArray(m.acciones) ? m.acciones.map((a: any) => ({ ...a, estado: 'pendiente' })) : undefined,
      })));
      setTimeout(() => scrollToBottom(true), 50);
    } catch { agregarNotificacion?.('⚠️ No se pudo abrir la conversación.'); }
  };
  const nuevaConversacion = () => {
    abortRef.current?.abort('usuario');
    setConversacionId(null); setHistorial([]); setPropuestaPendienteLocal(null); eventosRef.current = []; setVerHistorial(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };
  // Cada sección tiene su propia conversación: al cambiar de sección se guarda la actual y, al volver,
  // se reabre la que tenía. Si la sección no tenía, empieza una nueva. No cambia si lo hizo el agente o si está respondiendo.
  const claveChats = `chatPorSeccion:${planificacionId || 'sin-plan'}`;
  const leerChats = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(claveChats) || '{}'); } catch { return {}; } };
  const guardarChat = (seccion: string, id: string | null) => { try { const m = leerChats(); if (id) m[seccion] = id; else delete m[seccion]; localStorage.setItem(claveChats, JSON.stringify(m)); } catch { /* sin almacenamiento */ } };
  const seccionPorAgente = useRef(false);
  const seccionAnterior = useRef(seccionActiva);
  useEffect(() => { if (conversacionId) guardarChat(seccionActiva, conversacionId); }, [conversacionId]);
  useEffect(() => {
    const anterior = seccionAnterior.current;
    if (anterior === seccionActiva) return;
    seccionAnterior.current = seccionActiva;
    if (seccionPorAgente.current) { seccionPorAgente.current = false; return; }
    if (pensando || escribiendo) return;
    if (conversacionId) guardarChat(anterior, conversacionId);
    const previa = leerChats()[seccionActiva];
    if (previa && previa !== conversacionId) {
      abrirConversacion(previa);
      agregarNotificacion?.(`💬 Volviste a la conversación de la Sección ${seccionActiva}.`);
    } else if (!previa && historial.length) {
      nuevaConversacion();
      agregarNotificacion?.(`💬 Nueva conversación para la Sección ${seccionActiva}.`);
    }
  }, [seccionActiva]);
  const borrarConversacion = async (id: string) => {
    await fetch(`/api/chat/conversaciones/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    setConversaciones(prev => (prev || []).filter(c => c.id !== id));
    // Si era la conversación guardada de alguna sección, se olvida
    try { const m = leerChats(); for (const k of Object.keys(m)) if (m[k] === id) delete m[k]; localStorage.setItem(claveChats, JSON.stringify(m)); } catch { /* sin almacenamiento */ }
    if (id === conversacionId) nuevaConversacion();
  };

  // --- Sugerencias rápidas según lo que pasa en el plan ---
  const sugerencias = (() => {
    const evs = evaluacionesActivas();
    const s: { texto: string; icono: any; accion?: () => void }[] = [];
    if (totalEstudiantes === 0) s.push({ texto: 'Crear 12 estudiantes de prueba (sin correo) para practicar', icono: Users, accion: async () => {
      const r = await fetch('/api/estudiantes/prueba', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId: materiaAbierta.id || undefined, cantidad: 12, grupo: seccionActiva }) }).catch(() => null);
      const d = await r?.json().catch(() => ({})) ?? {};
      if (!r?.ok) { agregarNotificacion?.(`⚠️ ${d.error || 'No se pudieron crear.'}`); return; }
      window.dispatchEvent(new Event('estudiantes-cambiaron'));
      agregarNotificacion?.(`🧪 ${d.creados} estudiantes de prueba creados en la Sección ${seccionActiva}. No reciben correos; para probarlos, agrégate tú con tu correo.`);
    } });
    if (evs.length === 0) {
      s.push({ texto: 'Crea un plan completo de 4 evaluaciones', icono: Sparkles });
      s.push({ texto: 'Propón una evaluación práctica en grupos', icono: Users });
      s.push({ texto: '¿Qué estrategias de evaluación me recomiendas?', icono: Lightbulb });
      return s;
    }
    s.push({ texto: 'Revisa mi plan y ponle nota', icono: ClipboardCheck, accion: revisarPlan });
    const suma = evs.reduce((t, e) => t + (Number(e.peso) || 0), 0);
    if (suma !== 100) s.push({ texto: `Ajusta los pesos para que sumen 100% (ahora ${suma}%)`, icono: Scale });
    const fechas = evs.filter(e => e.fecha).map(e => new Date(e.fecha as any).toDateString());
    if (evs.some(e => !e.fecha) || new Set(fechas).size < fechas.length) s.push({ texto: 'Revisa las fechas y evita choques', icono: CalendarDays });
    const futuras = evs.filter(e => e.fecha && new Date(e.fecha as any).getTime() > Date.now() && String(e.estado || '').toUpperCase() !== 'CANCELADA');
    if (futuras.some(e => !e.rubrica?.criterios?.length)) s.push({ texto: 'Crea las rúbricas que faltan', icono: ClipboardCheck });
    if (futuras.some(e => !e.recursos?.length)) s.push({ texto: 'Busca recursos para la próxima evaluación', icono: Search });
    if (evs.some(e => String(e.estado || '').toUpperCase() === 'REALIZADA')) s.push({ texto: `¿Cómo va la Sección ${seccionActiva}? ¿Quién está en riesgo?`, icono: BarChart3 });
    s.push({ texto: 'Hazme 10 preguntas de examen para la próxima evaluación', icono: FileText });
    s.push({ texto: 'Genera el plan de acción', icono: FileText });
    return s.slice(0, 5);
  })();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter') { e.preventDefault(); if (!e.shiftKey) handleSend(); } };

  // Micrófono: barras de volumen en vivo, se detiene solo tras 5 s de silencio (después de hablar),
  // Esc o la X cancelan sin transcribir, y opcionalmente envía el mensaje apenas termina de transcribir.
  const detenerMic = (descartar = false) => {
    micDescartarRef.current = descartar;
    const r = mediaRecorderRef.current;
    if (r && r.state === 'recording') r.stop(); else micLimpiarRef.current?.();
    setIsRecording(false);
  };
  const handleMicClick = async () => {
    if (isRecording) { detenerMic(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mediaRecorder = new MediaRecorder(stream); audioChunksRef.current = []; micDescartarRef.current = false;
      const Ctx: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      const actx = Ctx ? new Ctx() : null;
      let raf = 0; const inicio = Date.now(); let ultimaVoz = 0; let hablo = false; let pintado = 0;
      if (actx) {
        const analizador = actx.createAnalyser(); analizador.fftSize = 1024;
        actx.createMediaStreamSource(stream).connect(analizador);
        const datos = new Uint8Array(analizador.fftSize);
        let ruido = 0.008; // ruido de fondo, se ajusta solo
        const medir = () => {
          if (mediaRecorder.state !== 'recording') return;
          analizador.getByteTimeDomainData(datos);
          let suma = 0; for (let k = 0; k < datos.length; k++) { const v = (datos[k] - 128) / 128; suma += v * v; }
          const rms = Math.sqrt(suma / datos.length);
          const ahora = Date.now();
          if (rms > Math.max(0.018, ruido * 2.5)) { ultimaVoz = ahora; hablo = true; } else ruido = ruido * 0.97 + rms * 0.03;
          if (ahora - pintado > 70) {
            pintado = ahora;
            setNivelesMic(p => [...p.slice(-27), Math.min(1, rms * 7)]);
            setSegGrabando(Math.floor((ahora - inicio) / 1000));
            setSilencioMic(hablo ? Math.floor((ahora - ultimaVoz) / 1000) : 0);
          }
          if (hablo && ahora - ultimaVoz > 5000) { detenerMic(); return; }
          if (!hablo && ahora - inicio > 12000) { agregarNotificacion?.('🎙️ No te escuché. Revisa que el micrófono esté activo e intenta de nuevo.'); detenerMic(true); return; }
          raf = requestAnimationFrame(medir);
        };
        raf = requestAnimationFrame(medir);
      }
      micLimpiarRef.current = () => { cancelAnimationFrame(raf); actx?.close?.().catch(() => {}); stream.getTracks().forEach(t => t.stop()); setNivelesMic([]); setSegGrabando(0); setSilencioMic(0); micLimpiarRef.current = null; };
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        micLimpiarRef.current?.();
        if (micDescartarRef.current) { audioChunksRef.current = []; textareaRef.current?.focus(); return; }
        setTranscribiendo(true);
        const grabado = new Blob(audioChunksRef.current, { type: (mediaRecorder.mimeType || 'audio/webm').split(';')[0] });
        // Se envía en WAV (lo aceptan todos los servicios de transcripción); si el navegador no puede convertirlo, va el original
        const wav = await aWav16k(grabado);
        const audioBlob = wav && wav.size < 4 * 1024 * 1024 ? wav : grabado;
        const formData = new FormData(); formData.append('file', audioBlob, wav && audioBlob === wav ? 'audio.wav' : 'audio.webm');
        let enviarYa = '';
        try {
          const res = await fetch('/api/chat/voz', { method: 'POST', body: formData }); const data = await res.json();
          if (data.text) {
            const texto = String(data.text).trim();
            if (autoEnviarVozRef.current && !mensajeRef.current.trim()) enviarYa = texto;
            else setMensaje(prev => prev ? prev + ' ' + texto : texto);
          } else agregarNotificacion?.(`⚠️ ${data.error || 'No se pudo transcribir.'}`);
        }
        catch { agregarNotificacion?.('⚠️ No se pudo transcribir el audio.'); } finally { setTranscribiendo(false); textareaRef.current?.focus(); }
        if (enviarYa) handleSend(enviarYa);
      };
      mediaRecorder.start(250); mediaRecorderRef.current = mediaRecorder; setIsRecording(true);
      setTimeout(() => { if (mediaRecorder.state === 'recording') detenerMic(); }, 120000); // máximo 2 minutos
    } catch { agregarNotificacion?.('⚠️ No se pudo acceder al micrófono. Revisa el permiso del navegador (ícono del candado junto a la dirección).'); }
  };
  useEffect(() => {
    if (!isRecording) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); detenerMic(true); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [isRecording]);
  useEffect(() => () => { micLimpiarRef.current?.(); }, []);

  const chatInactivo = !!config && !config.chat.activo;
  const ocupado = pensando || escribiendo || transcribiendo;
  const estadoTexto = chatInactivo ? 'Desactivado' : pensando ? 'Pensando…' : escribiendo ? 'Escribiendo…' : isRecording ? 'Escuchando…' : transcribiendo ? 'Transcribiendo…' : 'En línea';
  const limiteCaracteres: number = config?.chat?.maxCaracteresMensaje ?? 2000;

  // Documento adjunto (PDF, Word, .txt, .md, .csv): se lee y se manda con el próximo mensaje
  const adjuntarArchivo = async (archivo?: File) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!archivo) return;
    const ext = (archivo.name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md', 'csv'].includes(ext)) { agregarNotificacion?.('📎 Puedo leer PDF, Word (.docx), .txt, .md o .csv.'); return; }
    if (archivo.size > 4 * 1024 * 1024 && ext !== 'txt' && ext !== 'md' && ext !== 'csv') { agregarNotificacion?.(`📎 El archivo pesa ${(archivo.size / 1048576).toFixed(1).replace('.', ',')} MB y el máximo es 4 MB. Comprímelo (por ejemplo en ilovepdf.com) o copia el texto en el chat.`); return; }
    setSubiendoAdjunto(true);
    try {
      if (['txt', 'md', 'csv'].includes(ext)) {
        const texto = (await archivo.text()).trim();
        if (!texto) throw new Error('El archivo está vacío.');
        setAdjunto({ nombre: archivo.name, texto: texto.slice(0, 15000), recortado: texto.length > 15000 });
      } else {
        const fd = new FormData(); fd.append('file', archivo, archivo.name);
        const r = await fetch('/api/chat/archivo', { method: 'POST', body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || (r.status === 413 ? 'El archivo es muy pesado para subirlo (máximo 4 MB).' : 'No se pudo leer el archivo.'));
        setAdjunto({ nombre: d.nombre, texto: d.texto, recortado: d.recortado });
      }
      textareaRef.current?.focus();
    } catch (e: any) { agregarNotificacion?.(`📎 ${e?.message || 'No se pudo leer el archivo.'}`); } finally { setSubiendoAdjunto(false); }
  };

  // --- Tarjeta de una acción propuesta por el agente ---
  const renderAccion = (msg: Mensaje, a: AccionChat) => {
    const estado = a.estado || 'pendiente';
    const hecha = estado === 'hecha'; const descartada = estado === 'descartada'; const trabajando = estado === 'trabajando';
    const evs = evaluacionesActivas();
    const nombreEv = (n: number) => (evs[n - 1] ? `«${limpiarTexto(evs[n - 1].nombre)}»` : `#${n}`);
    const marco = `mt-3 rounded-2xl border overflow-hidden transition-colors ${hecha ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : descartada || estado === 'deshecha' ? 'border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)] opacity-60' : 'border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-1d1e33)]'}`;
    const botones = (principal: string, extra?: React.ReactNode) => !hecha && !descartada && estado !== 'deshecha' && (
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 border-t border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)]/60">
        <button type="button" disabled={trabajando} onClick={() => ejecutarAccion(msg.id, a)} className="h-8 px-3.5 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
          {trabajando ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}{trabajando ? 'Aplicando…' : principal}
        </button>
        {extra}
        <button type="button" disabled={trabajando} onClick={() => descartarAccion(msg.id, a)} className="h-8 px-3 rounded-lg text-xs text-[color:var(--c-8a8b9e)] hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50">Descartar</button>
        {a.resultado && <span className="w-full text-[11px] text-amber-300">{a.resultado}</span>}
      </div>
    );
    const deshecha = estado === 'deshecha';
    const puedeDeshacer = hecha && !!deshacerRef.current[a.id];
    const pie = (hecha || descartada || deshecha) && (
      <div className={`px-3.5 py-2 text-[11px] border-t border-[color:var(--c-2a2b3d)] flex items-center gap-1.5 ${hecha ? 'text-emerald-300' : 'text-[color:var(--c-7a7b90)]'}`}>
        {hecha ? <>{a.automatica ? <Sparkles className="w-3.5 h-3.5 text-amber-300" /> : <CheckCircle className="w-3.5 h-3.5" />}<span className="flex-1">{a.automatica ? 'Aplicado solo · ' : ''}{a.resultado || 'Aplicado'}</span></> : deshecha ? <><RotateCcw className="w-3.5 h-3.5" />{a.resultado || 'Deshecho'}</> : 'Descartada'}
        {puedeDeshacer && <button type="button" onClick={() => deshacerAccion(msg.id, a)} className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[color:var(--c-c0c0d0)] hover:text-[color:var(--c-blanco)] hover:bg-[color:var(--c-272839)]"><RotateCcw className="w-3 h-3" />Deshacer</button>}
      </div>
    );
    if (a.tipo === 'proponer_evaluaciones') {
      const lista: any[] = a.datos?.evaluaciones || [];
      const excluidas: number[] = a.datos?.excluidas || [];
      const elegidas = lista.filter((_, i) => !excluidas.includes(i));
      const pendiente = !hecha && !descartada && estado !== 'deshecha';
      const alternar = (i: number) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, excluidas: excluidas.includes(i) ? excluidas.filter(x => x !== i) : [...excluidas, i] } });
      const suma = elegidas.reduce((t, e) => t + (Number(e.peso) || 0), 0);
      const otras = evs.filter((_, i) => !elegidas.some(e => e.numero === i + 1)).reduce((t, e) => t + (Number(e.peso) || 0), 0);
      return (
        <div key={a.id} className={marco}>
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <ClipboardList className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Propuesta · {lista.length} evaluación{lista.length === 1 ? '' : 'es'}</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Sección {seccionActiva}</span>
            <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${suma + otras === 100 ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`} title="Suma de pesos de la sección con esta propuesta">{suma + otras}%</span>
          </div>
          <div className="divide-y divide-[color:var(--c-2a2b3d)] border-t border-[color:var(--c-2a2b3d)]">
            {lista.map((e, i) => (
              <details key={i} className={`group transition-opacity ${pendiente && excluidas.includes(i) ? 'opacity-45' : ''}`}>
                <summary className="list-none cursor-pointer px-3.5 py-2.5 flex items-start gap-3 hover:bg-[color:var(--c-232438)]/60">
                  {pendiente && lista.length > 1 ? (
                    <input type="checkbox" checked={!excluidas.includes(i)} onClick={(ev) => ev.stopPropagation()} onChange={() => alternar(i)}
                      title={excluidas.includes(i) ? 'No se guardará: márcala para incluirla' : 'Se guardará: desmárcala para dejarla fuera'}
                      aria-label={`Guardar «${e.nombre}»`} className="mt-1 w-4 h-4 accent-[color:var(--c-818cf8)] cursor-pointer flex-shrink-0" />
                  ) : null}
                  <span className="w-6 h-6 rounded-lg bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-a5b4fc)] text-[11px] font-bold flex items-center justify-center flex-shrink-0">{e.numero}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-[color:var(--c-e0e0ec)] font-medium leading-snug">{e.nombre}</span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {e.tipoActividad && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)] border border-[color:var(--c-818cf8)]/20">{e.tipoActividad}</span>}
                      {e.enfoque && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-[color:var(--c-272839)] text-[color:var(--c-b0b0c4)] border border-[color:var(--c-313248)]">{e.enfoque}</span>}
                      {e.examenEnLinea && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">Examen en línea</span>}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[color:var(--c-8a8b9e)] mt-1">
                      <span>📅 {e.fecha ? new Date(`${e.fecha}T${e.hora || '08:00'}:00`).toLocaleString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'sin fecha'}</span>
                      {e.duracionMinutos ? <span>⏱️ {e.duracionMinutos} min</span> : null}
                      <span>👥 {(e.personasPorGrupo ?? 1) > 1 ? `${e.cantidadGrupos ? `${e.cantidadGrupos} grupos de ` : 'grupos de '}${e.personasPorGrupo}` : 'Individual'}</span>
                    </span>
                  </span>
                  <span className="text-sm font-bold text-[color:var(--c-a5b4fc)]">{e.peso ?? '–'}%</span>
                  <ChevronDown className="w-4 h-4 text-[color:var(--c-6a6b7e)] group-open:rotate-180 transition-transform mt-0.5" />
                </summary>
                {e.descripcion && <div className="px-3.5 pb-3 sm:pl-[50px]"><DescripcionOrdenada texto={e.descripcion} compacta /></div>}
              </details>
            ))}
          </div>
          {botones(lista.length > 1 && excluidas.length ? (elegidas.length ? `Guardar ${elegidas.length} de ${lista.length}` : 'Marca al menos una') : 'Guardar en el planificador', <button type="button" disabled={trabajando || !elegidas.length} onClick={() => ejecutarAccion(msg.id, a, 'ajustar')} title="La propuesta está en los formularios del planificador: ahí puedes cambiar lo que quieras y guardar" className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] text-xs font-medium hover:text-[color:var(--c-blanco)] disabled:opacity-50">Ver y ajustar en formularios</button>)}
          {pie}
        </div>
      );
    }
    if (a.tipo === 'generar_preguntas') {
      const preguntas: any[] = a.datos?.preguntas || [];
      const ver = !!a.datos?.verRespuestas;
      const total = preguntas.reduce((t, q) => t + (Number(q.puntos) || 0), 0);
      return (
        <div key={a.id} className="mt-3 rounded-2xl border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-1d1e33)] overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">{preguntas.length} preguntas · {a.datos?.tema}</span>
            {total > 0 && <span className="text-[11px] text-[color:var(--c-8a8b9e)]">{textoPuntos(total)} pts</span>}
            <button type="button" onClick={() => marcarAccion(msg.id, a.id, { datos: { ...a.datos, verRespuestas: !ver } })} className="ml-auto text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)]">{ver ? 'Ocultar respuestas' : 'Ver respuestas'}</button>
          </div>
          <ol className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-[color:var(--c-2a2b3d)] border-t border-[color:var(--c-2a2b3d)]">
            {preguntas.map((q, i) => (
              <li key={i} className="px-3.5 py-2.5 text-[13px] text-[color:var(--c-d0d0da)]">
                <div className="flex gap-2"><span className="text-[color:var(--c-6a6b7e)] w-5 flex-shrink-0">{i + 1}.</span><span className="flex-1">{q.enunciado}</span><span className="text-[10px] text-[color:var(--c-8a8b9e)] whitespace-nowrap">{TIPO_PREGUNTA[q.tipo] || q.tipo}{q.puntos ? ` · ${textoPuntos(q.puntos)}` : ''}</span></div>
                {q.opciones?.length > 0 && <ul className="mt-1 ml-7 space-y-0.5 text-[12px] text-[color:var(--c-a8a9bc)]">{q.opciones.map((o: string, k: number) => <li key={k}>{'abcdef'[k]}) {o}</li>)}</ul>}
                {ver && <p className="mt-1 ml-7 text-[12px] text-emerald-300">✔ {q.respuesta}</p>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 border-t border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)]/60">
            <button type="button" onClick={() => imprimirPreguntas(a)} className="h-8 px-3.5 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />Imprimir o guardar PDF</button>
            <button type="button" onClick={() => copiar(textoPreguntas(a, true), a.id)} className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] text-xs font-medium hover:text-[color:var(--c-blanco)] flex items-center gap-1.5">{copiadoId === a.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}Copiar</button>
            <button type="button" onClick={() => descargarPreguntas(a)} className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] text-xs font-medium hover:text-[color:var(--c-blanco)] flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />.txt</button>
          </div>
        </div>
      );
    }
    if (a.tipo === 'mensaje_estudiantes') {
      const dest = a.datos?.destinatarios === 'riesgo' ? 'Estudiantes en riesgo' : a.datos?.destinatarios === 'nombres' ? (a.datos?.nombres || []).join(', ') : `Toda la Sección ${seccionActiva}`;
      return (
        <div key={a.id} className={marco}>
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <MessageCircle className="w-4 h-4 text-emerald-300" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">{porCorreo() ? 'Mensaje para estudiantes' : 'WhatsApp para estudiantes'}</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">Para: {dest}</span>
          </div>
          <div className="px-3.5 pb-3 space-y-2">
            <textarea value={a.datos?.texto || ''} disabled={hecha || descartada || trabajando} onChange={(e) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, texto: e.target.value.slice(0, 1200) } })} rows={4} className="w-full bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2 text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-y disabled:opacity-70" />
            <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--c-8a8b9e)]">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={a.datos?.incluirEnlace !== false} disabled={hecha || descartada} onChange={(e) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, incluirEnlace: e.target.checked } })} className="w-3.5 h-3.5 accent-[color:var(--c-818cf8)]" />Agregar el enlace a su página</label>
              <span>{'{nombre}'} se cambia por el de cada uno</span>
            </div>
          </div>
          {botones(`Enviar por ${medioEnvio()}`)}
          {pie}
        </div>
      );
    }
    if (a.tipo === 'agregar_estudiantes') {
      const filas: any[] = a.datos?.estudiantes || [];
      const editable = !hecha && !descartada && !trabajando;
      const cambiarFila = (i: number, campo: string, valor: string) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, estudiantes: filas.map((f, k) => (k === i ? { ...f, [campo]: valor } : f)) } });
      const quitarFila = (i: number) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, estudiantes: filas.filter((_, k) => k !== i) } });
      const celda = 'w-full min-w-0 bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-lg px-2 py-1.5 text-[12px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 disabled:opacity-70';
      return (
        <div key={a.id} className={marco}>
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Agregar {filas.length} estudiante{filas.length === 1 ? '' : 's'}</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Sección {a.datos?.seccion || seccionActiva}</span>
          </div>
          <div className="px-3.5 pb-3 space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
            {filas.map((f, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_1.3fr_1fr_auto] gap-1.5 items-center">
                <input value={f.nombre || ''} disabled={!editable} onChange={(e) => cambiarFila(i, 'nombre', e.target.value)} placeholder="Nombre" className={celda} />
                <input value={f.email || ''} disabled={!editable} onChange={(e) => cambiarFila(i, 'email', e.target.value)} placeholder="correo@…" className={`${celda} ${!f.email ? 'border-amber-500/40' : ''}`} />
                <input value={f.telefono || ''} disabled={!editable} onChange={(e) => cambiarFila(i, 'telefono', e.target.value)} placeholder="0412… (opcional)" className={`${celda} ${!f.telefono && !porCorreo() ? 'border-amber-500/40' : ''}`} />
                {editable ? <button type="button" onClick={() => quitarFila(i)} aria-label="Quitar" className="p-1 text-[color:var(--c-6a6b7e)] hover:text-red-300"><X className="w-3.5 h-3.5" /></button> : <span />}
              </div>
            ))}
            {editable && filas.some(f => !f.email || (!f.telefono && !porCorreo())) && <p className="text-[11px] text-amber-300 pt-1">{porCorreo() ? 'Completa el correo que falta (marcado en amarillo).' : 'Completa el correo y el teléfono que faltan (marcados en amarillo).'}</p>}
          </div>
          {filas.length > 0 && botones('Agregar estudiantes')}
          {pie}
        </div>
      );
    }
    if (a.tipo === 'cargar_notas') {
      const notas: any[] = a.datos?.notas || [];
      const editable = !hecha && !descartada && !trabajando;
      const cambiarNota = (i: number, valor: string) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, notas: notas.map((n, k) => (k === i ? { ...n, nota: valor === '' ? '' : Math.max(0, Math.min(20, Number(valor.replace(',', '.')) || 0)) } : n)) } });
      const prom = notas.length ? notas.reduce((t, n) => t + (Number(n.nota) || 0), 0) / notas.length : 0;
      return (
        <div key={a.id} className={marco}>
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <GraduationCap className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Notas de {nombreEv(a.datos?.evaluacion)}</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">{notas.length} · promedio {prom.toFixed(1)} · {notas.filter(n => Number(n.nota) >= 10).length} aprobados</span>
          </div>
          <div className="px-3.5 pb-3 space-y-0.5 max-h-72 overflow-y-auto custom-scrollbar">
            {notas.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] py-0.5">
                <span className="flex-1 truncate text-[color:var(--c-d0d0da)]" title={n.observacion || undefined}>{n.nombre}{n.observacion ? ' 💬' : ''}</span>
                <input value={n.nota} disabled={!editable} onChange={(e) => cambiarNota(i, e.target.value)} inputMode="decimal" className={`w-14 text-right bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-md px-1.5 py-1 font-semibold outline-none focus:border-[color:var(--c-818cf8)]/60 disabled:opacity-80 ${Number(n.nota) >= 10 ? 'text-emerald-300' : 'text-red-300'}`} />
              </div>
            ))}
          </div>
          <label className="px-3.5 pb-2 flex items-center gap-1.5 text-[11px] text-[color:var(--c-8a8b9e)] cursor-pointer">
            <input type="checkbox" checked={!!a.datos?.enviar} disabled={!editable} onChange={(e) => marcarAccion(msg.id, a.id, { datos: { ...a.datos, enviar: e.target.checked } })} className="w-3.5 h-3.5 accent-[color:var(--c-818cf8)]" />Enviar a cada estudiante su nota por {medioEnvio()}
          </label>
          {botones('Guardar notas')}
          {pie}
        </div>
      );
    }
    if (a.tipo === 'crear_examen') {
      const ex: Examen = a.datos?.examen;
      const ver = !!a.datos?.verRespuestas;
      if (!ex) return null;
      return (
        <div key={a.id} className={marco}>
          <div className="px-3.5 py-2.5 flex items-center gap-2 flex-wrap">
            <FileCheck className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
            <span className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Examen en línea · {nombreEv(a.datos?.evaluacion)}</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">{ex.preguntas.length} preguntas · {ex.duracionMin} min · {ex.modoCorreccion === 'automatica' ? 'corrección automática' : ex.modoCorreccion === 'profesor' ? 'corriges tú' : 'la IA sugiere, tú publicas'}</span>
            <button type="button" onClick={() => marcarAccion(msg.id, a.id, { datos: { ...a.datos, verRespuestas: !ver } })} className="ml-auto text-[11px] text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)]">{ver ? 'Ocultar respuestas' : 'Ver respuestas'}</button>
          </div>
          {ex.instrucciones && <p className="px-3.5 pb-2 text-[12px] text-[color:var(--c-a8a9bc)] italic">{ex.instrucciones}</p>}
          <ol className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-[color:var(--c-2a2b3d)] border-t border-[color:var(--c-2a2b3d)]">
            {ex.preguntas.map((q, i) => (
              <li key={q.id} className="px-3.5 py-2.5 text-[13px] text-[color:var(--c-d0d0da)]">
                <div className="flex gap-2"><span className="text-[color:var(--c-6a6b7e)] w-5 flex-shrink-0">{i + 1}.</span><span className="flex-1">{q.enunciado}</span><span className="text-[10px] text-[color:var(--c-8a8b9e)] whitespace-nowrap">{TIPOS_PREGUNTA[q.tipo]} · {textoPuntos(q.puntos)} pts</span></div>
                {q.tipo === 'seleccion' && <ul className="mt-1 ml-7 space-y-0.5 text-[12px]">{(q.opciones || []).map((o, k) => <li key={k} className={ver && k === q.correcta ? 'text-emerald-300 font-medium' : 'text-[color:var(--c-a8a9bc)]'}>{'abcdef'[k]}) {o}{ver && k === q.correcta ? ' ✔' : ''}</li>)}</ul>}
                {q.tipo === 'vf' && ver && <p className="mt-1 ml-7 text-[12px] text-emerald-300">✔ {q.correcta === 1 ? 'Verdadero' : 'Falso'}</p>}
                {(q.tipo === 'desarrollo' || q.tipo === 'informe') && ver && q.esperado && <p className="mt-1 ml-7 text-[12px] text-emerald-300">Se espera: {q.esperado}</p>}
              </li>
            ))}
          </ol>
          {botones('Adjuntar a la evaluación', <button type="button" disabled={trabajando} onClick={() => { const s = evs[(a.datos?.evaluacion || 1) - 1]; if (!s) { marcarAccion(msg.id, a.id, { resultado: `⚠ No existe la evaluación #${a.datos?.evaluacion} en la Sección ${seccionActiva}.` }); return; } setExamenEditando({ msgId: msg.id, accion: a, seccion: s }); }} className="h-8 px-3 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] text-xs font-medium hover:text-[color:var(--c-blanco)] disabled:opacity-50">Editar antes de adjuntar</button>)}
          {pie}
        </div>
      );
    }
    if (a.tipo === 'navegar') {
      return (
        <div key={a.id} className="mt-2 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-[color:var(--c-818cf8)]/25 bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)]">
          <ExternalLink className="w-3 h-3" />{hecha ? (a.resultado || 'Listo') : <button type="button" onClick={() => ejecutarAccion(msg.id, a)} className="hover:text-[color:var(--c-blanco)]">Ir a {NOMBRE_VISTA[a.datos?.vista] || a.datos?.vista}{a.datos?.seccion ? ` · Sección ${a.datos.seccion}` : ''}</button>}
        </div>
      );
    }
    const info: Record<string, { icono: any; titulo: string; detalle: string; boton: string }> = {
      crear_rubrica: { icono: ClipboardCheck, titulo: 'Crear rúbrica', detalle: `Rúbrica sugerida de 20 puntos para ${nombreEv(a.datos?.evaluacion)}`, boton: 'Crear rúbrica' },
      buscar_recursos: { icono: Search, titulo: 'Buscar recursos', detalle: `Videos de YouTube y páginas comprobadas para ${nombreEv(a.datos?.evaluacion)}`, boton: 'Buscar y agregar' },
      reprogramar: { icono: CalendarDays, titulo: 'Cambiar fecha', detalle: `${nombreEv(a.datos?.evaluacion)} → ${a.datos?.fecha ? new Date(`${a.datos.fecha}T${a.datos.hora || '08:00'}:00`).toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'short', ...(a.datos.hora ? { hour: 'numeric', minute: '2-digit' } : {}) }) : ''}${a.datos?.motivo ? ` · ${a.datos.motivo}` : ''}`, boton: 'Mover' },
      ajustar_pesos: { icono: Scale, titulo: 'Ajustar pesos', detalle: (a.datos?.pesos || []).map((p: any) => hecha ? `${nombreEv(p.evaluacion)}: ${p.peso}%` : `${nombreEv(p.evaluacion)}: ${evs[p.evaluacion - 1]?.peso ?? '–'}% → ${p.peso}%`).join(' · '), boton: 'Aplicar pesos' },
      generar_plan_accion: { icono: FileText, titulo: 'Plan de acción', detalle: `Generar el PDF de la Sección ${seccionActiva}`, boton: 'Generar PDF' },
      copiar_plan: { icono: Copy, titulo: 'Copiar plan entre secciones', detalle: `Sección ${a.datos?.desde} → Sección ${a.datos?.hacia}${a.datos?.dias ? ` · fechas ${a.datos.dias > 0 ? '+' : ''}${a.datos.dias} días` : ' · mismas fechas'}${a.datos?.reemplazar ? ' · reemplaza lo que tenga' : ''}`, boton: 'Copiar' },
      cambiar_estado: { icono: CheckCircle, titulo: 'Cambiar estado', detalle: `${nombreEv(a.datos?.evaluacion)} → ${String(a.datos?.estado || '').toLowerCase()}`, boton: 'Confirmar' },
      recordar_preferencia: { icono: Brain, titulo: 'Recordar para la próxima', detalle: a.datos?.texto || '', boton: 'Recordar' },
      modificar_estudiantes: { icono: UserCheck, titulo: a.datos?.accion === 'mover' ? `Mover a la Sección ${a.datos?.seccion}` : a.datos?.accion === 'retirar' ? 'Retirar estudiantes' : 'Reactivar estudiantes', detalle: (a.datos?.nombres || []).join(', ') + (a.datos?.accion === 'retirar' ? ' · quedan inactivos (no reciben mensajes); sus notas se conservan' : ''), boton: a.datos?.accion === 'mover' ? 'Mover' : a.datos?.accion === 'retirar' ? 'Retirar' : 'Reactivar' },
      abrir_en_portal: { icono: a.datos?.abrir ? LockOpen : Lock, titulo: a.datos?.abrir ? 'Abrir en la página de estudiantes' : 'Cerrar en la página de estudiantes', detalle: `${nombreEv(a.datos?.evaluacion)} ${a.datos?.abrir ? '→ verán descripción, recursos y rúbrica desde ya' : '→ se abrirá sola 7 días antes'}`, boton: a.datos?.abrir ? 'Abrir' : 'Cerrar' },
      enviar_plan: { icono: Send, titulo: `Enviar el plan por ${medioEnvio()}`, detalle: `Enlace a su página personal · Sección ${seccionActiva}${a.datos?.soloSinAbrir ? ' · solo a quienes no la han abierto' : ' · a todos los activos'}`, boton: 'Enviar' },
      recordatorios: a.datos?.accion === 'programar'
        ? { icono: Bell, titulo: 'Programar mensaje', detalle: `Sección ${seccionActiva} · ${a.datos?.fecha ? new Date(`${a.datos.fecha}T${a.datos.hora || '07:00'}:00-04:00`).toLocaleString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : ''} · «${String(a.datos?.texto || '').slice(0, 140)}»`, boton: 'Programar' }
        : { icono: a.datos?.accion === 'apagar' ? BellOff : Bell, titulo: a.datos?.accion === 'apagar' ? 'Apagar recordatorios' : a.datos?.accion === 'encender' ? 'Encender recordatorios' : `Enviar recordatorio por ${medioEnvio()}`, detalle: `${nombreEv(a.datos?.evaluacion)}${a.datos?.accion === 'enviar_ahora' ? ` · a toda la Sección ${seccionActiva}` : ''}`, boton: a.datos?.accion === 'enviar_ahora' ? 'Enviar' : 'Confirmar' },
      eliminar_evaluaciones: { icono: Trash2, titulo: 'Eliminar evaluaciones', detalle: `${(a.datos?.evaluaciones || []).map((n: number) => nombreEv(n)).join(', ')} · quedan en la Papelera con sus notas`, boton: 'Eliminar' },
      cambiar_materia: { icono: BookOpen, titulo: a.datos?.crear ? 'Abrir o crear materia' : 'Cambiar de materia', detalle: `«${a.datos?.nombre}»${(materias as any[]).length ? ` · tus materias: ${(materias as any[]).map((m: any) => m.nombre).join(', ')}` : ''}`, boton: 'Abrir' },
    };
    const d = info[a.tipo];
    if (!d) return null;
    const Icono = d.icono;
    return (
      <div key={a.id} className={marco}>
        <div className="px-3.5 py-3 flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><Icono className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-[color:var(--c-e0e0ec)]">{d.titulo}</span><span className="block text-[12px] text-[color:var(--c-a8a9bc)] mt-0.5 leading-snug">{d.detalle}</span></span>
        </div>
        {botones(d.boton)}
        {pie}
      </div>
    );
  };

  const ultimoAgenteId = [...historial].reverse().find(m => m.rol === 'agent')?.id;

  return (
    <motion.div animate={esMovil ? { x: expandido ? 0 : '-100%' } : { width: expandido ? anchoChat : 0, opacity: expandido ? 1 : 0 }} data-tutorial="agente" transition={{ duration: arrastrando ? 0 : 0.4, ease: [0.25, 0.1, 0.25, 1] }} className={esMovil ? 'fixed inset-0 z-50 border-r border-[color:var(--c-282a3f)] flex flex-col bg-[color:var(--c-191a26)] overflow-hidden' : 'relative border-r border-[color:var(--c-282a3f)] flex flex-col self-stretch min-h-0 max-h-full flex-shrink-0 bg-[color:var(--c-191a26)] overflow-hidden'} style={esMovil ? { height: '100dvh', pointerEvents: expandido ? 'auto' : 'none' } : { minWidth: expandido ? anchoChat : 0 }} aria-hidden={!expandido}>
      {examenEditando && (
        <ModalExamen key={examenEditando.accion.id} evaluacion={examenEditando.seccion} inicial={examenEditando.accion.datos?.examen} notificar={agregarNotificacion}
          onCerrar={() => setExamenEditando(null)}
          onGuardado={(ex) => {
            const { msgId, accion, seccion } = examenEditando;
            setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.map(x => (x.id === seccion.id ? { ...x, examen: ex } : x)) }));
            aplicadasRef.current.add(accion.id);
            marcarAccion(msgId, accion.id, { estado: 'hecha', resultado: ex ? `Examen de ${ex.preguntas.length} preguntas adjuntado a «${limpiarTexto(seccion.nombre)}» (editado por ti)` : 'Examen quitado' });
            eventosRef.current.push(ex ? `el profesor editó y adjuntó el examen de «${limpiarTexto(seccion.nombre)}»` : 'el profesor quitó el examen');
          }} />
      )}
      {/* Encabezado */}
      <div className="flex-shrink-0 px-3 sm:px-5 py-3.5 border-b border-[color:var(--c-282a3f)] flex items-center gap-3 bg-gradient-to-r from-[color:var(--c-191a26)] to-[color:var(--c-1f2035)] relative">
        <div className="relative"><div className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] flex items-center justify-center shadow-lg shadow-[color:var(--c-818cf8)]/30"><Bot className="w-5 h-5 text-[color:var(--c-blanco)]" /></div><div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[color:var(--c-191a26)] flex items-center justify-center ${chatInactivo ? 'bg-[color:var(--c-6a6b7e)]' : ocupado ? 'bg-amber-400' : 'bg-emerald-400'}`}><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /></div></div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[color:var(--c-d0d0da)] font-['Inter'] flex items-center gap-2 flex-wrap">EvaPlanner<span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">IA</span></h2>
          <p className="text-xs text-[color:var(--c-8a8b9e)] flex items-center gap-1.5 truncate"><span className={`w-1.5 h-1.5 rounded-full inline-block ${chatInactivo ? 'bg-[color:var(--c-6a6b7e)]' : ocupado ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>{estadoTexto}<span className="text-[color:var(--c-5f6074)]">· Sección {seccionActiva}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <div data-tutorial="chat-herramientas" className="flex items-center gap-0.5 p-1 bg-[color:var(--c-161722)]/80 border border-[color:var(--c-282a3f)] rounded-xl">
            <Tooltip text={modoAuto ? 'Modo automático: activado (las acciones seguras se aplican solas)' : 'Modo automático: desactivado (todo pide confirmación)'} lado="abajo"><button onClick={alternarModoAuto} aria-label="Modo automático" aria-pressed={modoAuto} className={`p-2 rounded-lg transition-colors ${modoAuto ? 'text-amber-300 bg-amber-400/15' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15'}`}><Sparkles className="w-4 h-4" /></button></Tooltip>
            <Tooltip text="Revisar mi plan (nota y mejoras)" lado="abajo"><button onClick={revisarPlan} disabled={ocupado || chatInactivo || evaluacionesActivas().length === 0} aria-label="Revisar mi plan" className="p-2 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15 rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent"><ClipboardCheck className="w-4 h-4" /></button></Tooltip>
            <Tooltip text="Nueva conversación" lado="abajo"><button onClick={nuevaConversacion} aria-label="Nueva conversación" className="p-2 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button></Tooltip>
            <Tooltip text="Conversaciones anteriores" lado="abajo"><button onClick={() => { const abrir = !verHistorial; setVerHistorial(abrir); if (abrir) cargarConversaciones(); }} aria-label="Conversaciones anteriores" className={`p-2 rounded-lg transition-colors ${verHistorial ? 'text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/15' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15'}`}><History className="w-4 h-4" /></button></Tooltip>
            {esSuperadmin && (<Tooltip text="Configuración del agente" lado="abajo"><button onClick={() => irAPanel('sistema')} aria-label="Configuración del agente" className="p-2 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15 rounded-lg transition-colors"><Settings className="w-4 h-4" /></button></Tooltip>)}
            {/* Solo el superadmin lo necesita: no tiene la pestaña Planificador (los profesores ya la tienen arriba) */}
            {esSuperadmin && <Tooltip text="Planificador de evaluaciones" lado="abajo"><button onClick={() => irAPanel('planificacion')} aria-label="Planificador de evaluaciones" className="p-2 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/15 rounded-lg transition-colors"><ClipboardList className="w-4 h-4" /></button></Tooltip>}
          </div>
          <Tooltip text={esMovil ? 'Ocultar chat' : 'Ocultar chat (Ctrl+B)'} lado="abajo" alinear="derecha"><motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={() => setExpandido(false)} aria-label="Ocultar el chat" className="group/ocultar w-9 h-9 flex items-center justify-center rounded-xl border border-[color:var(--c-818cf8)]/25 bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-a5b4fc)] hover:text-white hover:border-[color:var(--c-818cf8)]/60 hover:from-[color:var(--c-818cf8)]/40 hover:to-[color:var(--c-6366f1)]/25 hover:shadow-lg hover:shadow-[color:var(--c-818cf8)]/25 transition-all"><PanelLeftClose className="w-[18px] h-[18px] transition-transform duration-200 group-hover/ocultar:-translate-x-0.5" /></motion.button></Tooltip>
        </div>
        {/* Historial de conversaciones */}
        <AnimatePresence>
          {verHistorial && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute right-3 top-full mt-2 z-30 w-[320px] max-w-[calc(100%-24px)] max-h-[60vh] overflow-y-auto custom-scrollbar bg-[color:var(--c-1c1d2a)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl p-2">
              <button type="button" onClick={nuevaConversacion} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10"><Plus className="w-4 h-4" />Nueva conversación</button>
              {memorias && memorias.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] font-semibold flex items-center gap-1.5"><Brain className="w-3 h-3" />Lo que recuerdo de ti</p>
                  {memorias.map(m => (
                    <div key={m.id} className="group flex items-start gap-2 px-3 py-1.5 rounded-lg hover:bg-[color:var(--c-232438)]">
                      <span className="flex-1 text-[12px] text-[color:var(--c-b0b0c4)]">{m.texto}</span>
                      <button type="button" onClick={() => olvidarMemoria(m.id)} className="p-0.5 text-[color:var(--c-6a6b7e)] hover:text-red-300 opacity-0 group-hover:opacity-100" aria-label="Olvidar"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)] font-semibold">Anteriores</p>
              {conversaciones === null && <p className="px-3 py-4 text-xs text-[color:var(--c-8a8b9e)]">Cargando…</p>}
              {conversaciones?.length === 0 && <p className="px-3 py-4 text-xs text-[color:var(--c-8a8b9e)]">Todavía no hay conversaciones guardadas.</p>}
              {conversaciones?.map(c => (
                <div key={c.id} className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ${c.id === conversacionId ? 'bg-[color:var(--c-818cf8)]/10' : 'hover:bg-[color:var(--c-232438)]'}`} onClick={() => abrirConversacion(c.id)}>
                  <MessageSquare className="w-3.5 h-3.5 text-[color:var(--c-6a6b7e)] flex-shrink-0" />
                  <span className="flex-1 min-w-0"><span className="block text-[13px] text-[color:var(--c-d0d0da)] truncate">{c.titulo}</span><span className="block text-[10px] text-[color:var(--c-6a6b7e)]">{haceCuanto(c.fecha, Date.now())} · {c.mensajes} mensajes</span></span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); borrarConversacion(c.id); }} className="p-1 rounded-md text-[color:var(--c-6a6b7e)] hover:text-red-300 opacity-0 group-hover:opacity-100" aria-label="Borrar conversación"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mensajes */}
      {!isChatStarted ? (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-5 py-6 custom-scrollbar">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center w-full max-w-md">
            <div className="w-20 h-20 rounded-full bg-[color:var(--c-818cf8)]/15 flex items-center justify-center border-2 border-[color:var(--c-818cf8)]/30 mb-5 shadow-2xl shadow-[color:var(--c-818cf8)]/20"><Sparkle className="w-9 h-9 text-[color:var(--c-818cf8)]" /></div>
            {avisos && avisos.length > 0 && (
              <div className="w-full mb-6 text-left">
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--c-8a8b9e)] font-semibold mb-2 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />Pendientes de hoy</p>
                <div className="space-y-1.5">
                  {avisos.map((av, i) => (
                    <button key={i} type="button" disabled={chatInactivo} onClick={() => { if (av.seccion && av.seccion !== seccionActiva) { seccionPorAgente.current = true; onCambiarSeccion?.(av.seccion); } handleSend(av.pedido); }} className={`w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl border text-[13px] transition-colors disabled:opacity-50 ${av.urgente ? 'bg-amber-500/[0.07] border-amber-500/30 hover:border-amber-400/60' : 'bg-[color:var(--c-1f2035)] border-[color:var(--c-313248)] hover:border-[color:var(--c-818cf8)]/50'}`}>
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${av.urgente ? 'bg-amber-400' : 'bg-[color:var(--c-818cf8)]'}`} />
                      <span className="flex-1 min-w-0"><span className="block text-[color:var(--c-d0d0da)]">{av.texto}</span><span className="block text-[11px] text-[color:var(--c-a5b4fc)] mt-0.5">{av.pedido} →</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <h1 className="text-xl font-bold text-[color:var(--c-d0d0da)] font-['Inter'] mb-1.5">¿Qué evaluamos hoy?</h1>
            <p className="text-sm text-[color:var(--c-8a8b9e)] font-['Inter'] mb-5">Veo tu plan de la Sección {seccionActiva}: puedo crear evaluaciones, rúbricas, buscar recursos, mover fechas o revisar cómo va el grupo.</p>
            <div className="grid gap-2 w-full">
              {sugerencias.map((s, i) => { const I = s.icono; return (
                <button key={i} type="button" disabled={chatInactivo} onClick={() => (s.accion ? s.accion() : handleSend(s.texto))} className="flex items-center gap-3 text-left px-4 py-3 rounded-xl bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] hover:border-[color:var(--c-818cf8)]/50 hover:bg-[color:var(--c-232438)] text-sm text-[color:var(--c-d0d0da)] transition-colors disabled:opacity-50">
                  <I className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />{s.texto}
                </button>
              ); })}
            </div>
          </motion.div>
        </div>
      ) : (
        <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-5 space-y-5 custom-scrollbar">
          {historial.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${msg.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.rol === 'agent' ? (
                <div className="group/msg flex items-start gap-3 w-full max-w-[94%]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md ${msg.streaming ? 'eva-anillo' : ''} ${msg.error ? 'bg-amber-500/20' : 'bg-[color:var(--c-818cf8)] shadow-[color:var(--c-818cf8)]/20'}`}><Bot className={`w-4 h-4 ${msg.error ? 'text-amber-300' : 'text-[color:var(--c-blanco)]'}`} /></div>
                  <div className="flex-1 min-w-0 text-[15px] text-[color:var(--c-c0c0cc)] leading-relaxed pt-0.5 font-['Inter']">
                    {msg.contenido && textoVisible(msg) && <div className="break-words"><span dangerouslySetInnerHTML={{ __html: formatMessage(textoVisible(msg)) }} />{msg.streaming && <span className="eva-escribe" aria-label="Escribiendo"><i /><i /><i /></span>}</div>}
                    {!msg.contenido && msg.streaming && !(msg.acciones?.length) && <span className="eva-brillo text-sm">Pensando…</span>}
                    {msg.consultas?.length ? (
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        {msg.consultas.map((c, i) => <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[color:var(--c-232438)] border border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)]"><Search className="w-3 h-3" />{/^(preparando|corrigiendo|aplicando|cuadrando|buscando)/.test(c) ? c.charAt(0).toUpperCase() + c.slice(1) : `Revisé ${c}`}</span>)}
                      </div>
                    ) : null}
                    {msg.fuentes?.length ? (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-[color:var(--c-8a8b9e)]">Temas actuales según:</span>
                        {msg.fuentes.map((f, i) => <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[color:var(--c-1e2a3a)] border border-[color:var(--c-2c4a66)] text-[color:var(--c-93c5fd)] hover:text-[color:var(--c-blanco)] hover:border-[color:var(--c-60a5fa)] max-w-[200px]"><ExternalLink className="w-3 h-3 flex-shrink-0" /><span className="truncate">{f.titulo}</span></a>)}
                      </div>
                    ) : null}
                    {msg.acciones?.map(a => renderAccion(msg, a))}
                    {(() => {
                      const pendientes = (msg.acciones || []).filter(a => (a.estado || 'pendiente') === 'pendiente' && !FUERA_DE_APLICAR_TODO.includes(a.tipo));
                      return pendientes.length >= 2 && !msg.streaming ? (
                        <button type="button" onClick={() => aplicarTodo(msg)} className="mt-3 w-full h-10 rounded-xl bg-[color:var(--c-818cf8)] hover:from-[color:var(--c-6366f1)] hover:to-[color:var(--c-4f46e5)] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[color:var(--c-818cf8)]/20">
                          <CheckCircle className="w-4 h-4" />Aplicar todo ({pendientes.length})
                        </button>
                      ) : null;
                    })()}
                    {msg.aviso && <p className="mt-2 text-[11px] text-amber-300">{msg.aviso}</p>}
                    {msg.completo && !msg.error && (
                      <div className={`mt-1.5 flex items-center gap-1 transition-opacity ${msg.id === ultimoAgenteId || msg.valoracion || leyendoId === msg.id ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}>
                        {msg.contenido && <Tooltip text={copiadoId === msg.id ? '¡Copiado!' : 'Copiar'}><button type="button" onClick={() => copiar(msg.contenido, msg.id)} className="p-1.5 rounded-md text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-232438)]">{copiadoId === msg.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}</button></Tooltip>}
                        {msg.id === ultimoAgenteId && <Tooltip text="Responder de nuevo"><button type="button" onClick={regenerar} disabled={ocupado} className="p-1.5 rounded-md text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-232438)] disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5" /></button></Tooltip>}
                        {msg.contenido && <Tooltip text={leyendoId === msg.id ? 'Detener lectura' : 'Leer en voz alta'}><button type="button" onClick={() => leerEnVoz(msg)} className={`p-1.5 rounded-md hover:bg-[color:var(--c-232438)] ${leyendoId === msg.id ? 'text-[color:var(--c-a5b4fc)]' : 'text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-c7d2fe)]'}`}>{leyendoId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}</button></Tooltip>}
                        <Tooltip text="Buena respuesta (EvaPlanner repetirá este estilo)"><button type="button" onClick={() => valorar(msg, 1)} className={`p-1.5 rounded-md hover:bg-[color:var(--c-232438)] ${msg.valoracion === 1 ? 'text-emerald-300' : 'text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-c7d2fe)]'}`}><ThumbsUp className="w-3.5 h-3.5" /></button></Tooltip>
                        <Tooltip text="Mala respuesta (EvaPlanner evitará este estilo)"><button type="button" onClick={() => valorar(msg, -1)} className={`p-1.5 rounded-md hover:bg-[color:var(--c-232438)] ${msg.valoracion === -1 ? 'text-red-300' : 'text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-c7d2fe)]'}`}><ThumbsDown className="w-3.5 h-3.5" /></button></Tooltip>
                        {agradecidoId === msg.id ? <span className="text-[10px] text-emerald-300 ml-1">¡Gracias! Lo tendré en cuenta en mis próximas respuestas</span>
                          : msg.modelo && <span className="text-[10px] text-[color:var(--c-5f6074)] ml-1">{msg.respaldo ? 'respaldo · ' : ''}{msg.modelo}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] px-4 py-2.5 bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-d8d8e2)] rounded-2xl rounded-br-md text-[15px] leading-relaxed font-['Inter'] border border-[color:var(--c-818cf8)]/20">{msg.adjunto && <span className="flex items-center gap-1.5 mb-1.5 text-[12px] text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/15 rounded-lg px-2 py-1 w-fit"><Paperclip className="w-3.5 h-3.5" />{msg.adjunto}</span>}<span className="whitespace-pre-wrap break-words">{msg.contenido}</span></div>
              )}
            </motion.div>
          ))}
          {pensando && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 justify-start">
              <div className="eva-anillo w-8 h-8 rounded-lg bg-[color:var(--c-818cf8)] flex items-center justify-center flex-shrink-0 shadow-md shadow-[color:var(--c-818cf8)]/20"><Bot className="w-4 h-4 text-[color:var(--c-blanco)]" /></div>
              <div className="px-4 py-2.5 bg-[color:var(--c-1f2035)] rounded-2xl rounded-tl-md border border-[color:var(--c-313248)] flex items-center gap-2.5 mt-0.5"><span className="eva-escribe !ml-0" aria-hidden="true"><i /><i /><i /></span><FrasePensando /></div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Entrada */}
      <div className="flex-shrink-0 px-3 sm:px-5 pt-2 pb-3 sm:pb-4 border-t border-[color:var(--c-282a3f)] bg-gradient-to-t from-[color:var(--c-161722)] to-transparent">
        {isChatStarted && !ocupado && !chatInactivo && sugerencias.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
            {sugerencias.map((s, i) => { const I = s.icono; return (
              <button key={i} type="button" onClick={() => (s.accion ? s.accion() : handleSend(s.texto))} className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] text-xs text-[color:var(--c-b0b0c4)] hover:text-[color:var(--c-blanco)] hover:border-[color:var(--c-818cf8)]/50 transition-colors"><I className="w-3.5 h-3.5 text-[color:var(--c-a5b4fc)]" />{s.texto}</button>
            ); })}
          </div>
        )}
        {(adjunto || subiendoAdjunto) && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/30 text-xs text-[color:var(--c-c7d2fe)]">
            {subiendoAdjunto ? <span className="w-3.5 h-3.5 border-2 border-[color:var(--c-a5b4fc)]/40 border-t-[color:var(--c-a5b4fc)] rounded-full animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            <span className="truncate flex-1">{subiendoAdjunto ? 'Leyendo el documento…' : `${adjunto!.nombre} · ${adjunto!.texto.length.toLocaleString('es-VE')} caracteres${adjunto!.recortado ? ' (recortado)' : ''}`}</span>
            {adjunto && <button type="button" onClick={() => setAdjunto(null)} className="p-0.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]" aria-label="Quitar documento"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}
        <div className="relative" data-tutorial="chat-entrada">
          <div className={`@container relative flex items-end gap-1.5 bg-[color:var(--c-1f2035)] border rounded-2xl px-2 py-1.5 transition-colors shadow-lg shadow-black/20 ${isRecording ? 'border-[color:var(--c-8b5cf6)]/60 shadow-[color:var(--c-8b5cf6)]/10' : 'border-[color:var(--c-313248)] focus-within:border-[color:var(--c-818cf8)]/60'}`}>
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar documento" title="Adjuntar documento: programa de la materia, guía… (PDF, Word, .txt)" className="w-10 h-10 flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-272839)] rounded-xl transition-colors flex-shrink-0 self-end"><Paperclip className="w-5 h-5" /></button>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.csv,.md" onChange={(e) => adjuntarArchivo(e.target.files?.[0])} />
            <Tooltip text={isRecording ? 'Terminar y transcribir' : 'Hablar (se detiene solo tras 5 s de silencio)'}><button type="button" onClick={handleMicClick} disabled={transcribiendo || pensando || escribiendo || chatInactivo} aria-label={isRecording ? 'Terminar grabación' : 'Hablar'} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors flex-shrink-0 self-end ${isRecording ? 'text-[color:var(--c-ddd6fe)] bg-[color:var(--c-8b5cf6)]/20 ring-1 ring-[color:var(--c-8b5cf6)]/50 hover:bg-[color:var(--c-8b5cf6)]/30' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-272839)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>{transcribiendo ? (<div className="w-5 h-5 border-2 border-[color:var(--c-818cf8)]/30 border-t-[color:var(--c-a5b4fc)] rounded-full animate-spin"></div>) : isRecording ? (<div className="w-3.5 h-3.5 bg-[color:var(--c-a78bfa)] rounded-[3px]"></div>) : (<Mic className="w-5 h-5" />)}</button></Tooltip>
            <div className="flex-1 min-w-0 relative self-stretch flex items-end"><textarea ref={textareaRef} value={mensaje} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMensaje(e.target.value)} onKeyDown={handleKeyDown} placeholder={chatInactivo ? 'El asistente está desactivado' : transcribiendo ? 'Transcribiendo tu audio…' : 'Pídele algo a EvaPlanner…'} rows={1} wrap="off" disabled={chatInactivo} className="block w-full h-10 bg-transparent text-[15px] leading-[22px] text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] outline-none resize-none py-[9px] font-['Inter'] whitespace-pre overflow-x-auto overflow-y-hidden sin-barra disabled:opacity-60" />
              {isRecording && (
                <div className="absolute inset-0 flex items-center gap-2.5 bg-[color:var(--c-1f2035)] rounded-lg" role="status" aria-live="polite">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--c-a78bfa)] animate-pulse flex-shrink-0" />
                  <span className="text-xs tabular-nums text-[color:var(--c-c4b5fd)] w-8 flex-shrink-0">{Math.floor(segGrabando / 60)}:{String(segGrabando % 60).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0 h-8 flex items-center gap-[3px] overflow-hidden" aria-hidden="true">
                    {[...Array(Math.max(0, 28 - nivelesMic.length)).fill(0), ...nivelesMic].map((v, k) => <span key={k} className="w-[3px] flex-shrink-0 rounded-full bg-[color:var(--c-818cf8)] transition-[height] duration-75" style={{ height: `${Math.max(3, Math.round(v * 28))}px`, opacity: 0.35 + v * 0.65 }} />)}
                  </div>
                  <span className="hidden @md:inline text-[11px] text-[color:var(--c-8a8b9e)] whitespace-nowrap">{silencioMic >= 2 ? `Se detiene en ${Math.max(1, 5 - silencioMic)} s…` : segGrabando < 2 ? 'Habla, te escucho…' : 'Te escucho…'}</span>
                  <Tooltip text={autoEnviarVoz ? 'Al terminar se envía solo (clic para solo escribirlo)' : 'Al terminar solo se escribe (clic para enviarlo solo)'}><button type="button" onClick={() => { const v = !autoEnviarVoz; setAutoEnviarVoz(v); try { localStorage.setItem('voz_autoenviar', v ? '1' : '0'); } catch {} }} className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${autoEnviarVoz ? 'text-[color:var(--c-c7d2fe)] border-[color:var(--c-818cf8)]/50 bg-[color:var(--c-818cf8)]/15' : 'text-[color:var(--c-8a8b9e)] border-[color:var(--c-313248)] hover:text-[color:var(--c-c7d2fe)]'}`}>{autoEnviarVoz ? 'Enviar solo ✓' : 'Enviar solo'}</button></Tooltip>
                  <Tooltip text="Cancelar sin transcribir (Esc)"><button type="button" onClick={() => detenerMic(true)} aria-label="Cancelar grabación" className="flex-shrink-0 p-1 rounded-md text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button></Tooltip>
                </div>
              )}
            </div>
            {pensando || escribiendo ? (
              <Tooltip text="Detener"><button type="button" onClick={detener} aria-label="Detener respuesta" className="w-10 h-10 flex items-center justify-center rounded-xl bg-[color:var(--c-272839)] text-[color:var(--c-c7d2fe)] hover:bg-red-500/20 hover:text-red-300 transition-colors flex-shrink-0 self-end"><Square className="w-4 h-4 fill-current" /></button></Tooltip>
            ) : (
              <button type="button" onClick={() => handleSend()} disabled={(!mensaje.trim() && !adjunto) || chatInactivo || subiendoAdjunto} aria-label="Enviar" className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0 self-end ${(mensaje.trim() || adjunto) && !subiendoAdjunto ? 'bg-[color:var(--c-818cf8)] text-white hover:shadow-lg hover:shadow-[color:var(--c-818cf8)]/30 shadow-md' : 'bg-[color:var(--c-272839)] text-[color:var(--c-5a5b6e)] cursor-not-allowed'}`}><Send className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
