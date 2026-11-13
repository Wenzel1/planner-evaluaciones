import { type Examen } from '@/lib/examen';
import { type RubricaEval } from '@/lib/rubrica';

// ============================================
// TIPOS
// ============================================
export interface SeccionExamen {
  id: string; nombre: string; tipoPregunta: 'multiple_choice' | 'desarrollo' | 'codigo' | 'caso_practico';
  peso: number | null; cantidadPreguntas: number; contenidosEvaluados: string[];
  nivelBloom: 'recordar' | 'comprender' | 'aplicar' | 'analizar' | 'evaluar' | 'crear';
  tiempoEstimadoMinutos: number | null; tipoActividad?: string; descripcion?: string;
  cantidadGrupos?: number; personasPorGrupo?: number; orden?: number; enfoque?: string;
  fecha?: Date;
  // Sección/paralelo al que pertenece esta evaluación (A, B, C...). Por defecto 'A'.
  grupoSeccion?: string;
  // PROGRAMADA | REALIZADA | REPROGRAMADA | CANCELADA (se cambia con /api/evaluaciones/:id/estado)
  estado?: string;
  // Rúbrica propia de la evaluación (criterios × Excelente/Bueno/Regular/Deficiente)
  rubrica?: RubricaEval | null;
  // Examen en línea que el estudiante presenta en su página (se guarda aparte con /api/evaluaciones/:id/examen)
  examen?: Examen | null;
  // Portal del estudiante: recursos de estudio y apertura antes de tiempo
  recursos?: { titulo: string; url: string }[] | null;
  abiertaManual?: boolean;
  // Cuántos estudiantes marcaron "Ya me preparé" en su página (solo lectura)
  preparados?: number;
}
export interface CriterioRubrica {
  id: string; nombre: string; peso: number; descripcion: string;
  niveles?: NivelDesempeno[];
}
export interface NivelDesempeno {
  id: string;
  nombre: string;
  puntaje: number;
  descripcion: string;
}
export interface ComentarioAgente { id: string; tipo: 'sugerencia' | 'alerta' | 'info' | 'exito'; mensaje: string; timestamp: Date; }
export interface PlanificacionExamen {
  id: string; version: number; estado: 'borrador' | 'revision' | 'aprobado' | 'publicado';
  fechaExamen: Date; tipoExamen: 'teorico' | 'practico' | 'mixto' | 'proyecto' | 'oral';
  duracionMinutos: number; materia: string; secciones: SeccionExamen[];
  rubrica: CriterioRubrica[]; comentariosAgente: ComentarioAgente[];
}
// Acción que propone el agente (tarjeta con botón en el chat)
export interface AccionChat { id: string; tipo: string; datos: any; estado?: 'pendiente' | 'trabajando' | 'hecha' | 'descartada' | 'deshecha'; resultado?: string; automatica?: boolean }
export interface AvisoChat { tipo: string; texto: string; pedido: string; seccion?: string; urgente?: boolean }
export interface Mensaje { rol: 'agent' | 'user'; contenido: string; completo?: boolean; id: string; acciones?: AccionChat[]; streaming?: boolean; modelo?: string; respaldo?: boolean; aviso?: string; error?: boolean; dbId?: string; valoracion?: number; adjunto?: string; consultas?: string[]; fuentes?: { titulo: string; url: string }[] }
export interface PropuestaEvaluacion {
  evaluaciones: Array<{
    tipo?: string; materia: string; tipoActividad?: string; enfoque?: string;
    duracionMinutos?: number | null; peso?: number | null; cantidadGrupos?: number | null;
    personasPorGrupo?: number | null; fecha?: string; hora?: string; descripcion?: string;
    numero?: number; existenteId?: string | null; examenEnLinea?: boolean;
  }>;
}
export interface EvaluacionFormulario {
  materia: string; duracionMinutos: number | null; duracionUnidad: 'min' | 'hrs';
  peso: number | null; fecha: Date; tipoActividad: string; descripcion: string;
  cantidadGrupos: number | null; personasPorGrupo: number | null;
  editandoId: string | null; mostrarDescripcion: boolean; enfoque: string; descripcionTexto?: boolean;
  errores: ErroresEvaluacion;
  // Marca qué campos fueron autocompletados por el agente (IA). Mientras un campo esté marcado
  // como true, se omite la validación estricta de "palabras de la materia" para ese campo,
  // ya que el agente puede redactar con sinónimos que no están en la lista de palabras clave.
  // En cuanto el usuario edita manualmente ese campo, la bandera pasa a false y se vuelve a validar.
  origenAgente?: { materia?: boolean; tipoActividad?: boolean; descripcion?: boolean };
}

// ============================================
// VALIDACIÓN DE CONTENIDO — INGENIERÍA DE SOFTWARE
// ============================================

export interface ErroresEvaluacion {
  materia?: string;
  tipoActividad?: string;
  enfoque?: string;
  descripcion?: string;
}

// ============================================
// CONFIGURACIÓN DEL SISTEMA (valores que usa el navegador)
// ============================================
export interface ConfigChat { activo: boolean; mensajeInactivo: string; webhookUrl: string; modelo: string; temperatura: number; maxTokens: number; ventanaMemoria: number; maxCaracteresMensaje: number; timeoutSegundos: number; instruccionesExtra: string }
export interface ConfigCliente { chat: ConfigChat; planificador: { maxGrupos: number; maxPersonasPorGrupo: number } }
export interface ConfigCompleta extends ConfigCliente { acceso: { registroAbierto: boolean; diasPapelera: number } }

// ============================================
// ESTUDIANTES PANEL (MEJORADO)
// ============================================
export interface Estudiante {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  grupo: string;
  estado: 'activo' | 'inactivo';
  promedio: number;
  asistencia: number;
  notasCargadas?: number; // cuántas evaluaciones tiene calificadas
  // Visitas a su página personal (/e/<token>)
  portalVisitas?: number;
  portalPrimeraVisita?: string | null;
  portalUltimaVisita?: string | null;
}

// ============================================
// OPINIONES DE LOS ESTUDIANTES SOBRE EL PLAN (desde su página personal)
// ============================================
export interface OpinionEstudiante { id: string; deAcuerdo: boolean; comentario: string | null; leida: boolean; fecha: string; estudiante: string; seccion: string; materia: string }

// ============================================
// OBSERVACIONES RECIBIDAS (lo que un administrador dejó sobre tu trabajo)
// ============================================
export interface ObservacionRecibida { id: string; evaluacionNombre: string | null; autorNombre: string; autorRol: string; mensaje: string; leida: boolean; createdAt: string; materia: { nombre: string } }
// ============================================
// CAMPANITA NOTIFICACIONES MEJORADA
// ============================================
// ============================================
// NOTIFICACIONES: campanita con lista + avisos emergentes
// ============================================
// El tipo se deduce del emoji con el que empieza el mensaje (así no hay que cambiar cada agregarNotificacion)
export type TipoNotif = 'exito' | 'alerta' | 'error' | 'envio' | 'borrado' | 'mensaje' | 'info';

export interface ChoqueCalendario { tipo: 'dia' | 'semana'; seccion: string; clave: string; evaluaciones: SeccionExamen[] }

// ============================================
// NOTAS DE UNA EVALUACIÓN (escala de 1 a 20, con o sin rúbrica)
// ============================================
export interface FilaNota { id: string; nombre: string; tieneTelefono: boolean; activo: boolean; puntaje: string; observaciones: string; detalle: (number | null)[]; verObs: boolean; guardado: string }
export interface VideoSugeridoUI { titulo: string; url: string; canal: string; duracionSeg: number; miniatura: string; vistas: number }
export interface PaginaSugeridaUI { titulo: string; url: string; descripcion: string }

// ============================================
// PANEL DERECHO (CONFIG Y NOTIFICACIONES MEJORADAS)
// ============================================
export type PanelDerechoHandle = { limpiarYScroll: () => void; notificar: (mensaje: string) => void; guardarAhora: () => Promise<void>; cambiarSeccion: (letra: string) => void; formulariosLibres: () => boolean; };
export type MateriaCorta = { id: string; nombre: string };
export interface UsuarioSesion { id: string; nombre: string; email: string; rol: 'SUPERADMIN' | 'ADMIN' | 'USUARIO'; debeCambiarPassword?: boolean; }
export interface PanelDerechoProps { onSeccionActivaCambia?: (letra: string) => void; chatAbierto?: boolean; onAbrirChat?: () => void; usuario?: UsuarioSesion | null; onLogout?: () => void; onUsuarioActualizado?: (u: UsuarioSesion) => void; onConfigActualizada?: (c: ConfigCliente) => void; datosCargados?: boolean; planificacion: PlanificacionExamen; setPlanificacion: React.Dispatch<React.SetStateAction<PlanificacionExamen>>; propuestaPendiente: PropuestaEvaluacion | null; aceptarPropuesta: () => void; setPropuestaPendiente: (p: PropuestaEvaluacion | null) => void; vistaInicial: 'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema' | 'calendario'; onCambiarVista: (v: 'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema' | 'calendario') => void; pdfUrl: string | null; setPdfUrl: (url: string | null) => void; pdfAbierto: boolean; setPdfAbierto: (abierto: boolean) => void; generarPDF: (secciones?: SeccionExamen[]) => Promise<string | null>; planificacionId: string | null; setPlanificacionId: (id: string | null) => void; materias?: MateriaCorta[]; materiaActivaId?: string | null; onAbrirMateria?: (id: string) => Promise<void>; onNuevaMateria?: (nombre: string) => Promise<void>; onTutorial?: () => void; }
