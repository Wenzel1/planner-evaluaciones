// app/page.tsx - Versión final con streaming, config funcional y mejoras visuales

'use client';

import { useState, useEffect, useRef, useCallback, ChangeEvent, useImperativeHandle, forwardRef, Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Plus, BookOpen, Brain, Target,
  MessageSquare, Bell, ChevronDown, ChevronUp,
  Trash2, Save, Send, Eye,
  BarChart3, ClipboardList, Sparkles,
  Layers, Activity, BookMarked,
  MessageSquareMore, CalendarDays, ChevronLeft,
  ChevronRight, LogOut, Copy, RotateCcw,
  Maximize2, Minimize2, CornerDownLeft, FileText,
  Users, Paperclip, Menu, PanelLeft, PanelRight, Pencil,
  Settings, X, CheckCircle, AlertCircle, Info, Phone, User, Users as UsersIcon,
  Volume2, VolumeX, Clock as ClockIcon, Calendar as CalendarIcon,
  GripVertical, TrendingUp, TrendingDown, PieChart, Award,
  GripHorizontal, Mail, GraduationCap, BarChart, Filter, Search,
  MoreVertical, Star, StarOff, Clock as ClockIcon2, FileCheck,
  Bot, MessageCircle, Mic, Sparkle, Gift, Clock as ClockIcon3,
  LayoutGrid, List, Grid3x3, PanelTop, FileSpreadsheet,
  Beaker, FlaskConical, Lightbulb, PenTool, Mic2, ScrollText,
  UsersRound, UserCheck, FileSearch, Layout, Puzzle, Gamepad2,
  Presentation, Handshake, Globe, Scale, BookType, ClipboardCheck,
  MessageCircleQuestion, Eye as EyeIcon, Speech, Download
} from 'lucide-react';

// Agregar esto debajo de los imports de lucide-react
import { apiEstudiantes, apiPlanificaciones } from '@/lib/api'; 
import StreamInput from "@/components/StreamInput";
import StreamTextarea from "@/components/StreamTextarea";

// ============================================
// TIPOS
// ============================================
interface SeccionExamen {
  id: string; nombre: string; tipoPregunta: 'multiple_choice' | 'desarrollo' | 'codigo' | 'caso_practico';
  peso: number | null; cantidadPreguntas: number; contenidosEvaluados: string[];
  nivelBloom: 'recordar' | 'comprender' | 'aplicar' | 'analizar' | 'evaluar' | 'crear';
  tiempoEstimadoMinutos: number | null; tipoActividad?: string; descripcion?: string;
  cantidadGrupos?: number; personasPorGrupo?: number; orden?: number; enfoque?: string;
  fecha?: Date;
}
interface CriterioRubrica {
  id: string; nombre: string; peso: number; descripcion: string;
  niveles?: NivelDesempeno[];
}
interface NivelDesempeno {
  id: string;
  nombre: string;
  puntaje: number;
  descripcion: string;
}
interface ComentarioAgente { id: string; tipo: 'sugerencia' | 'alerta' | 'info' | 'exito'; mensaje: string; timestamp: Date; }
interface PlanificacionExamen {
  id: string; version: number; estado: 'borrador' | 'revision' | 'aprobado' | 'publicado';
  fechaExamen: Date; tipoExamen: 'teorico' | 'practico' | 'mixto' | 'proyecto' | 'oral';
  duracionMinutos: number; materia: string; secciones: SeccionExamen[];
  rubrica: CriterioRubrica[]; comentariosAgente: ComentarioAgente[];
}
interface Mensaje { rol: 'agent' | 'user'; contenido: string; completo?: boolean; id: string; }
interface PropuestaEvaluacion {
  evaluaciones: Array<{
    tipo?: string; materia: string; tipoActividad?: string; enfoque?: string;
    duracionMinutos?: number | null; peso?: number | null; cantidadGrupos?: number | null;
    personasPorGrupo?: number | null; fecha?: string; hora?: string; descripcion?: string;
  }>;
}
interface EvaluacionFormulario {
  materia: string; duracionMinutos: number | null; duracionUnidad: 'min' | 'hrs';
  peso: number | null; fecha: Date; tipoActividad: string; descripcion: string;
  cantidadGrupos: number | null; personasPorGrupo: number | null;
  editandoId: string | null; mostrarDescripcion: boolean; enfoque: string;
  errores: ErroresEvaluacion;
}

// ============================================
// CONSTANTES DE ESTILOS
// ============================================
const inputBase = "w-full h-12 px-4 bg-[#1f2035] border border-[#313248] rounded-xl text-sm text-[#d8d8e2] placeholder-[#6a6b7e] focus:border-[#818cf8]/40 outline-none transition-all duration-200 font-['Inter']";
const smallInput = "w-full h-12 px-2.5 bg-[#1f2035] border border-[#313248] rounded-xl text-sm text-[#d8d8e2] placeholder-[#6a6b7e] focus:border-[#818cf8]/40 outline-none transition-all duration-200 font-['Inter'] text-center";
const textareaBase = "w-full px-4 py-3 bg-[#1f2035] border border-[#313248] rounded-xl text-sm text-[#d8d8e2] placeholder-[#6a6b7e] focus:border-[#818cf8]/40 outline-none transition-all duration-200 font-['Inter'] resize-vertical custom-scrollbar";
const labelBase = "text-[11px] text-[#b0b0c4] block mb-1 font-medium";

// ============================================
// VALIDACIÓN DE CONTENIDO — INGENIERÍA DE SOFTWARE
// ============================================

interface ErroresEvaluacion {
  materia?: string;
  tipoActividad?: string;
  enfoque?: string;
  descripcion?: string;
}

const KEYWORDS_SE = {
  fuerte: [
    // --- Tus palabras originales ---
    'microservicio','microservicios','monolitico','monolítico','hexagonal','clean architecture',
    'cqrs','event sourcing','event-driven','serverless','soa','patron','patrón',
    'patrones de diseño','singleton','factory','observer','strategy','decorator','adapter',
    'facade','command','mvc','mvvm','mvp','gof','solid','dry','kiss','yagni',
    'scrum','kanban','agil','ágil','waterfall','cascada','safe','xp','devops',
    'ci/cd','continuous integration','continuous delivery','tdd','bdd','unit testing',
    'pruebas unitarias','pruebas de integracion','pruebas de integración','e2e','testing',
    'test automatizado','cobertura de codigo','cobertura de código','mock','stub',
    'docker','kubernetes','k8s','contenedor','contenedores','orchestration','orquestacion',
    'aws','azure','gcp','cloud','nube','iaas','paas','saas','terraform','ansible',
    'infrastructure as code','rest','restful','graphql','api','endpoint','swagger','openapi',
    'grpc','websocket','sql','nosql','mongodb','postgresql','mysql','redis','elasticsearch',
    'newsql','base de datos','migracion','migración','orm','entity framework',
    'seguridad de software','autenticacion','autenticación','autorizacion','autorización',
    'oauth','jwt','xss','csrf','sql injection','cifrado','encriptacion',
    'encriptación','devsecops','domain driven design','ddd','bounded context',
    'contexto delimitado','agregado','value object','evento de dominio',
    'refactoring','codigo limpio','código limpio','clean code','deuda tecnica',
    'deuda técnica','technical debt','code smell','code review','pair programming',
    'pull request','git','github','gitlab','bitbucket','branching','merge','rebase',
    'observabilidad','monitoreo','logging','tracing','metricas','métricas','prometheus',
    'grafana','elk','datadog','sistema distribuido','mensajeria','mensajería',
    'kafka','rabbitmq','broker','cola de mensajes','event bus','saga','compensacion',
    'java','python','javascript','typescript','c#','csharp','go','golang','rust',
    'node','nodejs','react','angular','vue','spring','django','flask','express',
    '.net','dotnet','rails','laravel','requisito','requerimiento','caso de uso',
    'user story','historia de usuario','backlog','sprint','milestone','epic',
    'uml','diagrama de clase','diagrama de secuencia','diagrama de componente',
    'wireframe','prototipo','mockup','calidad de software','iso 25010',
    'metrica de software','métrica de software','sonarqube','linting','code quality',
    'inteligencia artificial','machine learning','deep learning','llm','copilot',
    'code generation','ia aplicada','desarrollo de software','ingenieria de software',
    'ingeniería de software','arquitectura de software','programacion','programación','arquitectonico','arquitecto',

    // --- Primer lote de IA ---
    'rag','retrieval-augmented generation','prompting','prompt engineering','ingenieria de prompts',
    'ingeniería de prompts','embeddings','embedding','token','tokens','fine-tuning',
    'fine tuning','ajuste fino','pipeline','pipelines','agente ia','agente autónomo',
    'agente autonomo','orquestacion de contenedores','orquestación de contenedores',

    // --- NUEVAS ADICIONES ACTUALES (Fuerte - IA Avanzada, Datos y Patrones) ---
    'agentic workflow','multi-agente','multi-agent','langchain','langgraph','llamaindex',
    'vector database','base de datos vectorial','chromadb','pinecone','qdrant',
    'slm','small language model','guardrails','llmops','mlops','funcion lambda',
    'función lambda','edge computing','bff','backend for frontend','idp',
    'internal developer platform','platform engineering','ingenieria de plataformas',
    'ingeniería de plataformas','zero trust','jwt validation','keycloak','auth0'
  ],
  medio: [
    // --- Tus palabras originales ---
    'software','desarrollo','codigo','código','aplicacion','aplicación','sistema',
    'plataforma','framework','libreria','librería','backend','frontend','fullstack',
    'deploy','despliegue','produccion','producción','servidor','cliente','tabla',
    'consulta','funcion','función','clase','objeto','metodo','método','variable',
    'interfaz','herencia','polimorfismo','abstraccion','abstracción','encapsulamiento',
    'compilador','interprete','intérprete','algoritmo','estructura de datos',
    'html','css','json','xml','yaml','http','tcp','udp','responsive','componente',
    'estado','propiedad','debug','depuracion','depuración','performance','rendimiento',
    'escalabilidad','mantenibilidad','modularidad','acoplamiento','cohesion','cohesión',
    'repositorio','modulo','módulo','paquete','dependencia','iteracion','iteración',
    'incremento','entrega','release','version','versión','documentacion','documentación',
    'especificacion','especificación','protocolo','estandar','estándar',
    'desarrollador','programador','ingeniero','qa','tester','analista','tech lead',
    'arquitectura','diseño','implementacion','implementación','integracion','integración',
    'web','base de datos','servidor','nube','contenedor','despliegue','agente',
    'middleware','asincrono','asíncrono',

    // --- NUEVAS ADICIONES ACTUALES (Medio - Herramientas, Infraestructura y Prácticas) ---
    'nextjs','svelte','bun','deno','vitest','playwright','cypress',
    'supabase','firebase','prisma','drizzle','github actions','argocd',
    'cloud native','serverless function','api gateway','webina','webassembly',
    'wasm','hot-reloading','telemetria','telemetría','open-telemetry','otel',
    'ci/cd pipeline','mocking','data pipeline','etl'
  ],
  debil: [
    // --- Tus palabras originales ---
    'tecnologia','tecnología','digital','informatica','informática','computacion',
    'computación','proceso','flujo','diagrama','herramienta','recurso','proyecto',
    'equipo','planificacion','planificación','evaluacion','evaluación','analisis',
    'análisis','solucion','solución','problema','criterio','objetivo','competencia',
    'habilidad','conocimiento','aprendizaje','documentar','presentar','explicar',
    'demostrar','argumentar','gestion','gestión','modelo','estructura','etapa',

    // --- NUEVAS ADICIONES ACTUALES (Débil - Conceptos blandos / operativos modernos) ---
    'roadmap','stack','entorno','ambiente','metodologia','metodología',
    'entregable','feedback','retroalimentacion','retroalimentación','colaboracion',
    'colaboración','automatizar'
  ]
};

const TERMINOS_BLOQUEADOS = [
  // --- Tus palabras originales ---
  'cocina','receta','futbol','fútbol','deporte','baloncesto','beisbol','béisbol',
  'musica','música','guitarra','piano','cantar','cancion','canción','pintura',
  'escultura','museo','galeria','galería','medicina','enfermeria','enfermería',
  'cirugia','cirugía','diagnostico médico','paciente','derecho','juicio','abogado',
  'tribunal','constitucion','constitución','contabilidad','impuesto','facturacion',
  'facturación','contable','marketing','publicidad','venta','comercial','cocinar',
  'hornear','comida','restaurante','jardineria','jardinería','jardin','jardín',
  'conducir','coche','carro','mecanica automotriz','moda','ropa','vestido',
  'peluqueria','peluquería','fotografia','fotografía','videojuego','viaje','turismo',
  'hotel','vuelo','idioma','gramatica','gramática','traduccion','traducción',
  'biologia','biología','historia','geografia','geografía','filosofia','filosofía',
  'psicologia','psicología','sociologia','sociología','antropologia','antropología',
  'politica','política','economia','economía','fisica','física','quimica','química',

  // --- NUEVAS ADICIONES MASIVAS ---
  // Deportes, Ocio y Entretenimiento (Ampliación)
  'deportes','entrenamiento','gimnasio','gym','fitness','crossfit','atletismo','tenis',
  'padel','pádel','natacion','natación','maraton','maratón','cine','pelicula',
  'película','serie','series','netflix','actor','actriz','teatro','concierto',
  'festival','anime','manga','literatura','novela','poesia','poesía',

  // Gastronomía, Alimentos y Estilo de Vida
  'restaurantes','chef','ingrediente','ingredientes','almuerzo','cena','desayuno',
  'postre','bebida','vino','cerveza','cafe','café','dieta','nutricion','nutrición',
  'mascota','mascotas','perro','gato','veterinaria','boda','matrimonio','fiesta',

  // Salud, Bienestar y Anatomía (Ampliación)
  'medico','médico','salud','enfermedad','síntoma','sintoma','clinica','clínica',
  'hospital','terapia','psicologo','psicólogo','medicamento','pastilla','farmacia',
  'anatomia','anatomía','dentista','odontologia','odontología','nutricionista',

  // Negocios Tradicionales, Finanzas Personales e Inmobiliaria
  'ventas','negocio','negocios','tienda','comercio','finanzas','banco','bancos',
  'credito','crédito','prestamo','préstamo','criptomoneda','bitcoin','trading',
  'inversion','inversión','bolsa','acciones','inmobiliaria','casa','alquiler',
  'renta','apartamento','terreno',

  // Leyes, Sector Público y Religión
  'ley','leyes','legal','juez','fiscal','policia','policía','delito','crimen',
  'gobierno','estado','elecciones','partido','ciudadano','religion','religión',
  'iglesia','dios','fe','espiritualidad',

  // Viajes, Geografía y Logística (Ampliación)
  'viajes','vacaciones','aeropuerto','pasaje','equipaje','crucero','playa',
  'montaña','maleta','mapa','pais','país','ciudad','continente','transporte',
  'autobus','autobús','tren','camion','camión','mudanza',

  // Ciencias Naturales y Humanidades (Ampliación)
  'matematicas','matemáticas','algebra','álgebra','geometria','geometría',
  'astronomia','astronomía','planeta','estrella','universo','nasa','arqueologia',
  'arqueología','sociologo','sociólogo','literario','idiomas',

  // Oficios Tradicionales y Hogar
  'carpinteria','carpintería','plomeria','plomería','electricista','construccion',
  'construcción','arquitecto','albañil','limpieza','mueble','decoracion',
  'decoración','bricolaje',

  // Estética, Cuidado Personal y Textil (Ampliación)
  'maquillaje','cosmetica','cosmética','perfume','estetica','estética','barberia',
  'barbería','diseño de modas','calzado','zapatos',

  // Temas Infantiles y Educación Básica
  'juguete','juguetes','colegio','escuela','kinder','guarderia','guardería',
  'bebe','bebé','niño','niña','paternidad','maternidad'
];


function validarContenidoSE(texto: string): { valido: boolean; error: string; puntuacion: number } {
  if (!texto || texto.trim().length < 5) {
    return { valido: false, error: 'El contenido debe tener al menos 5 caracteres.', puntuacion: 0 };
  }

  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Solo números
  if (/^\d+$/.test(texto.trim())) {
    return { valido: false, error: 'No se permiten solo números. Ingresa un tema de Ingeniería de Software.', puntuacion: 0 };
  }

  // Caracteres aleatorios cortos
  if (/^[a-zA-Z0-9\s]{1,12}$/.test(texto.trim())) {
    return { valido: false, error: 'El contenido es demasiado corto o no parece un tema válido de Ingeniería de Software.', puntuacion: 0 };
  }

  // Términos bloqueados
  for (const termino of TERMINOS_BLOQUEADOS) {
    const t = termino.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (textoLower.includes(t)) {
      return {
        valido: false,
        error: `"${termino}" no es un tema válido de Ingeniería de Software. Solo se permiten contenidos relacionados con desarrollo, arquitectura, metodologías ágiles, testing, DevOps, bases de datos, APIs, seguridad, calidad de código, etc.`,
        puntuacion: 0,
      };
    }
  }

  // Calcular puntuación
  let puntuacion = 0;

  for (const kw of KEYWORDS_SE.fuerte) {
    if (textoLower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) puntuacion += 3;
  }
  for (const kw of KEYWORDS_SE.medio) {
    if (textoLower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) puntuacion += 2;
  }
  for (const kw of KEYWORDS_SE.debil) {
    if (textoLower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) puntuacion += 1;
  }

  if (puntuacion < 3) {
    return {
      valido: false,
      error: 'Este contenido no parece relacionado con Ingeniería de Software. Temas válidos: arquitectura, patrones de diseño, metodologías ágiles, testing, DevOps, CI/CD, bases de datos, APIs, seguridad, calidad de código, lenguajes de programación, frameworks, etc.',
      puntuacion,
    };
  }

  return { valido: true, error: '', puntuacion };
}

// Valida que el enfoque sea exactamente uno de la lista permitida
function validarEnfoque(texto: string): { valido: boolean; error: string } {
  if (!texto || texto.trim().length === 0) {
    return { valido: true, error: '' }; // Vacío lo permite (se llena después)
  }

  const ENFOQUES_VALIDOS = [
    'Colaborativo','Individual','Grupal','Aplicado','Teórico','Teórico-Práctico',
    'Práctico','Mixto','Formativo','Sumativo','Proyecto','Investigación','Experimental',
    'ABP','Cooperativo','Aula invertida','Gamificación','Design Thinking','Taller',
    'Seminario','Laboratorio','Trabajo de campo','Simulación','Análisis de caso',
    'Diseño','Desarrollo','Diagnóstico','Portafolio','Resolución de problemas',
    'Role playing','Debate','Exposición','Ensayo','Demostración','Observación',
    'Escrito','Oral','Autoevaluación','Coevaluación','Heteroevaluación',
    'Interdisciplinario','Transversal',
    // Variantes sin acento (por si el usuario escribe sin tilde)
    'Teorico','Teorico-Practico','Practico','Investigacion','Resolucion de problemas',
    'Autoevaluacion','Coevaluacion','Heteroevaluacion','Aula invertida',
  ];

  const textoNorm = texto.trim();

  // Búsqueda exacta (case insensitive)
  const encontrado = ENFOQUES_VALIDOS.some(
    e => e.toLowerCase() === textoNorm.toLowerCase()
  );

  if (!encontrado) {
    return {
      valido: false,
      error: `"${textoNorm}" no es un enfoque válido. Selecciona uno de la lista desplegable (Ej: Colaborativo, ABP, Práctico, Análisis de caso...).`,
    };
  }

  return { valido: true, error: '' };
}

// Validación ligera para tipoActividad (solo bloquea lo obvio, no requiere keywords SE)
function validarTipoActividad(texto: string): { valido: boolean; error: string } {
  if (!texto || texto.trim().length < 3) {
    return { valido: false, error: 'Mínimo 3 caracteres.' };
  }
  const textoLower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const termino of TERMINOS_BLOQUEADOS) {
    const t = termino.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (textoLower.includes(t)) {
      return { valido: false, error: `"${termino}" no es una estrategia válida para evaluación de Ingeniería de Software.` };
    }
  }
  if (/^\d+$/.test(texto.trim())) {
    return { valido: false, error: 'No se permiten solo números.' };
  }
  return { valido: true, error: '' };
}

function Tooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0d0e14] text-[#d8d8e2] text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-[#313248]">{text}</div>
    </div>
  );
}

function limpiarTexto(texto: string): string {
  if (!texto) return ''; let clean = texto;
  while (/^Evaluaci[oó]n\s+\d+\s*:\s*/i.test(clean)) { clean = clean.replace(/^Evaluaci[oó]n\s+\d+\s*:\s*/i, ''); }
  return clean.replace(/\*\*/g, '').replace(/\*/g, '').trim();
}
function limpiarBloqueJSON(texto: string): string { return texto.replace(/```json\s*[\s\S]*?\s*```/gi, '').trim(); }
function extraerJSONDelTexto(texto: string): any {
  if (!texto) return null;
  const match = texto.match(/```json\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    try { const p = JSON.parse(match[1].trim()); if (p && p.evaluaciones) return p; } catch { return null; }
  }
  const apertura = texto.indexOf('{'); const cierre = texto.lastIndexOf('}');
  if (apertura !== -1 && cierre !== -1 && cierre > apertura) {
    try { const p = JSON.parse(texto.substring(apertura, cierre + 1)); if (p && p.evaluaciones) return p; } catch { return null; }
  }
  return null;
}
const formatMessage = (text: string) => {
  if (!text) return ''; const t = limpiarBloqueJSON(text);
  return t.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#e0e0e8] font-semibold">$1</strong>')
    .replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')
    .replace(/^\- (.*$)/gm, '<div class="flex gap-2 ml-2 my-0.5"><span class="text-[#818cf8]">•</span><span>$1</span></div>')
    .replace(/^\* (.*$)/gm, '<div class="flex gap-2 ml-2 my-0.5"><span class="text-[#818cf8]">•</span><span>$1</span></div>')
    .replace(/^### (.*$)/gm, '<h4 class="text-[#c0c0d0] font-semibold mt-4 mb-1">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="text-[#d0d0d8] font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="text-[#e0e0e8] font-bold mt-5 mb-3">$1</h2>')
    .replace(/^---$/gm, '<hr class="border-[#313248] my-4"/>');
};

// TypewriterText con soporte para auto-scroll
function TypewriterText({ text, onComplete, onUpdate }: { text: string; onComplete?: () => void; onUpdate?: () => void }) {
  const [d, setD] = useState(''); const [c, setC] = useState(0); const [i, setI] = useState(false); const r = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => { if (!text) { onComplete?.(); return; } const t = limpiarBloqueJSON(text); setD(''); setC(0); setI(false); r.current = setInterval(() => { setC(p => { if (p >= t.length) { if (r.current) clearInterval(r.current); setI(true); setTimeout(() => onComplete?.(), 0); return p; } else { onUpdate?.(); return p + 1; } }); }, 1); return () => { if (r.current) clearInterval(r.current); }; }, [text, onComplete, onUpdate]);
  useEffect(() => { if (!text) return; const t = limpiarBloqueJSON(text); setD(formatMessage(t.slice(0, c))); }, [c, text]);
  if (!text) return null;
  return (<span className="inline leading-relaxed"><span dangerouslySetInnerHTML={{ __html: d }} />{!i && (<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }} className="inline-block w-[2.5px] h-[1.2em] bg-[#818cf8] rounded-full ml-[1px] align-text-bottom" />)}</span>);
}

function DatePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [isOpen, setIsOpen] = useState(false); const [viewDate, setViewDate] = useState(() => new Date(value)); const containerRef = useRef<HTMLDivElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 }); const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; const year = viewDate.getFullYear(); const month = viewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const updatePosition = useCallback(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 280) }); } }, []); useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]); useEffect(() => { if (!isOpen) return; const handle = () => updatePosition(); window.addEventListener('resize', handle); window.addEventListener('scroll', handle, true); return () => { window.removeEventListener('resize', handle); window.removeEventListener('scroll', handle, true); }; }, [isOpen, updatePosition]); useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []); useEffect(() => { setViewDate(new Date(value)); }, [value]); const selectDate = (day: number) => { const d = new Date(year, month, day, value.getHours(), value.getMinutes()); onChange(d); }; const formatDisplay = (d: Date) => d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }); const selectedDate = value; const dropdownContent = isOpen && (<motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}><div className="p-4"><div className="flex items-center justify-between mb-4"><motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 text-[#7a7b8e] hover:text-[#b0b0c4] hover:bg-[#272839] rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></motion.button><span className="text-sm font-medium text-[#d0d0da]">{months[month]} {year}</span><motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 text-[#7a7b8e] hover:text-[#b0b0c4] hover:bg-[#272839] rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></motion.button></div><div className="grid grid-cols-7 gap-1 mb-2">{daysOfWeek.map(d => (<div key={d} className="text-center text-xs text-[#6a6b7e] font-medium py-1">{d}</div>))}</div><div className="grid grid-cols-7 gap-1">{Array.from({ length: firstDay }).map((_, i) => (<div key={`e-${i}`} />))}{Array.from({ length: daysInMonth }).map((_, i) => { const day = i + 1; const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year; const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year; return (<motion.button key={day} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => selectDate(day)} className={`w-full aspect-square rounded-lg text-sm font-medium transition-all ${isSelected ? 'bg-[#818cf8] text-white shadow-lg shadow-indigo-500/20' : isToday ? 'bg-[#272839] text-[#818cf8] border border-[#818cf8]/30' : 'text-[#b0b0c4] hover:bg-[#272839] hover:text-[#d0d0da]'}`}>{day}</motion.button>); })}</div></div><div className="px-4 py-2 border-t border-[#282a3f]"><button onClick={() => { const now = new Date(); onChange(now); setViewDate(now); setIsOpen(false); }} className="w-full text-center text-xs text-[#7a7b8e] hover:text-[#b0b0c4] py-1 rounded-lg hover:bg-[#272839] transition-colors">Hoy</button></div></motion.div>); return (<div ref={containerRef}><button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputBase} flex items-center justify-between text-left cursor-pointer`}><span className="text-[#d8d8e2] text-sm truncate">{formatDisplay(value)}</span><Calendar className="w-4 h-4 text-[#818cf8] flex-shrink-0 ml-2" /></button>{createPortal(dropdownContent, document.body)}</div>);
}
function TimePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [isOpen, setIsOpen] = useState(false); const [selectedHour, setSelectedHour] = useState(() => { const h = value.getHours(); return h % 12 || 12; }); const [selectedAmPm, setSelectedAmPm] = useState<'am' | 'pm'>(() => value.getHours() >= 12 ? 'pm' : 'am'); const [selectedMinute, setSelectedMinute] = useState(() => value.getMinutes()); const containerRef = useRef<HTMLDivElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 }); const minutesOptions = Array.from({ length: 12 }, (_, i) => i * 5); const updatePosition = useCallback(() => { if (containerRef.current) { const rect = containerRef.current.getBoundingClientRect(); setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 260) }); } }, []); useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]); useEffect(() => { if (!isOpen) return; const handle = () => updatePosition(); window.addEventListener('resize', handle); window.addEventListener('scroll', handle, true); return () => { window.removeEventListener('resize', handle); window.removeEventListener('scroll', handle, true); }; }, [isOpen, updatePosition]); useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []); useEffect(() => { const hours = value.getHours(); setSelectedHour(hours % 12 || 12); setSelectedAmPm(hours >= 12 ? 'pm' : 'am'); setSelectedMinute(value.getMinutes()); }, [value]); const convertTo24h = (h: number, ampm: 'am' | 'pm') => { if (ampm === 'am') return h === 12 ? 0 : h; return h === 12 ? 12 : h + 12; }; const handleTimeChange = (h: number, m: number, ampm: 'am' | 'pm') => { setSelectedHour(h); setSelectedMinute(m); setSelectedAmPm(ampm); const hour24 = convertTo24h(h, ampm); const d = new Date(value); d.setHours(hour24); d.setMinutes(m); onChange(d); }; const formatDisplay = (d: Date) => { const hours = d.getHours(); const minutes = d.getMinutes(); const ampm = hours >= 12 ? 'pm' : 'am'; const hours12 = hours % 12 || 12; return `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`; }; const dropdownContent = isOpen && (<motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}><div className="p-5"><div className="flex items-center gap-3 mb-4"><Clock className="w-5 h-5 text-[#818cf8] flex-shrink-0" /><span className="text-sm text-[#b0b0c4] font-medium">Seleccionar hora</span></div><div className="flex items-center gap-3 justify-center"><select value={selectedHour} onChange={(e) => handleTimeChange(parseInt(e.target.value), selectedMinute, selectedAmPm)} className="bg-[#191a26] border border-[#282a3f] rounded-lg px-4 py-3 text-lg text-[#d8d8e2] outline-none focus:border-[#818cf8]/40 cursor-pointer w-24 text-center font-medium">{Array.from({ length: 12 }, (_, i) => i + 1).map(h => (<option key={h} value={h} className="bg-[#1f2035]">{h}</option>))}</select><span className="text-[#8a8b9e] font-bold text-xl">:</span><select value={selectedMinute} onChange={(e) => handleTimeChange(selectedHour, parseInt(e.target.value), selectedAmPm)} className="bg-[#191a26] border border-[#282a3f] rounded-lg px-4 py-3 text-lg text-[#d8d8e2] outline-none focus:border-[#818cf8]/40 cursor-pointer w-24 text-center font-medium">{minutesOptions.map(i => (<option key={i} value={i} className="bg-[#1f2035]">{String(i).padStart(2, '0')}</option>))}</select><select value={selectedAmPm} onChange={(e) => handleTimeChange(selectedHour, selectedMinute, e.target.value as 'am' | 'pm')} className="bg-[#191a26] border border-[#282a3f] rounded-lg px-4 py-3 text-lg text-[#818cf8] outline-none focus:border-[#818cf8]/40 cursor-pointer w-24 text-center font-bold"><option value="am" className="bg-[#1f2035]">AM</option><option value="pm" className="bg-[#1f2035]">PM</option></select></div></div><div className="px-5 py-3 border-t border-[#282a3f]"><button onClick={() => { const now = new Date(); onChange(now); const h = now.getHours(); setSelectedHour(h % 12 || 12); setSelectedAmPm(h >= 12 ? 'pm' : 'am'); setSelectedMinute(now.getMinutes()); setIsOpen(false); }} className="w-full text-center text-sm text-[#7a7b8e] hover:text-[#b0b0c4] py-1.5 rounded-lg hover:bg-[#272839] transition-colors">Ahora</button></div></motion.div>); return (<div ref={containerRef}><button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputBase} flex items-center justify-between text-left cursor-pointer`}><span className="text-[#d8d8e2] text-sm truncate">{formatDisplay(value)}</span><Clock className="w-4 h-4 text-[#818cf8]/60 flex-shrink-0 ml-2" /></button>{createPortal(dropdownContent, document.body)}</div>);
}


// ============================================
// FUNCIÓN PARA CALCULAR FECHAS (2 SEMANAS DE DIFERENCIA)
// ============================================
function calcularFechasEvaluaciones(fechaBase: Date, totalEvaluaciones: number): Date[] {
  const fechas: Date[] = [];
  for (let i = 0; i < totalEvaluaciones; i++) {
    const fecha = new Date(fechaBase);
    fecha.setDate(fecha.getDate() + (i * 14));
    fechas.push(fecha);
  }
  return fechas;
}

// ============================================
// CÁLCULO AUTOMÁTICO DE GRUPOS
// ============================================
function calcularDistribucionGrupos(totalEstudiantes: number, personasPorGrupo: number | null): { cantidadGrupos: number; sobrantes: number } {
  if (!personasPorGrupo || personasPorGrupo <= 0 || totalEstudiantes <= 0) {
    return { cantidadGrupos: 0, sobrantes: 0 };
  }
  const cantidadGrupos = Math.floor(totalEstudiantes / personasPorGrupo);
  const sobrantes = totalEstudiantes % personasPorGrupo;
  return { cantidadGrupos, sobrantes };
}

function calcularPersonasPorGrupo(totalEstudiantes: number, cantidadGrupos: number | null): number {
  if (!cantidadGrupos || cantidadGrupos <= 0 || totalEstudiantes <= 0) return 0;
  return Math.ceil(totalEstudiantes / cantidadGrupos);
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ planificacion }: { planificacion: PlanificacionExamen }) {
  const totalEvaluaciones = planificacion.secciones.length;
  const pesoTotal = planificacion.secciones.reduce((acc, sec) => acc + (sec.peso || 0), 0);
  const promedioPeso = totalEvaluaciones > 0 ? (pesoTotal / totalEvaluaciones).toFixed(1) : 0;
  const evaluacionesConDescripcion = planificacion.secciones.filter(s => s.descripcion).length;
  const porcentajeCompletado = totalEvaluaciones > 0 ? Math.round((evaluacionesConDescripcion / totalEvaluaciones) * 100) : 0;
  const evaluacion1 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 1') || s.nombre?.toLowerCase().includes('evaluacion 1'));
  const evaluacion2 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 2') || s.nombre?.toLowerCase().includes('evaluacion 2'));
  const evaluacion3 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 3') || s.nombre?.toLowerCase().includes('evaluacion 3'));
  const evaluacion4 = planificacion.secciones.filter(s => s.nombre?.toLowerCase().includes('evaluación 4') || s.nombre?.toLowerCase().includes('evaluacion 4'));
  const nivelesBloom = ['recordar', 'comprender', 'aplicar', 'analizar', 'evaluar', 'crear'];
  const distribucionBloom = nivelesBloom.map(nivel => ({ nivel, count: planificacion.secciones.filter(s => s.nivelBloom === nivel).length }));
  const bloomDominante = [...distribucionBloom].sort((a, b) => b.count - a.count)[0];
  const tiempoTotal = planificacion.secciones.reduce((acc, sec) => acc + (sec.tiempoEstimadoMinutos || 0), 0);
  const statsCards = [
    { titulo: 'Total Evaluaciones', valor: totalEvaluaciones, icono: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', borde: 'border-blue-500/20' },
    { titulo: 'Peso Promedio', valor: `${promedioPeso}%`, icono: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
    { titulo: 'Tiempo Total', valor: `${tiempoTotal} min`, icono: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', borde: 'border-amber-500/20' },
    { titulo: 'Completado', valor: `${porcentajeCompletado}%`, icono: CheckCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', borde: 'border-purple-500/20' }
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold text-[#d0d0da] flex items-center gap-3"><BarChart3 className="w-6 h-6 text-[#818cf8]" />Dashboard</h2><p className="text-sm text-[#8a8b9e] mt-1">Resumen para {planificacion.materia || 'la asignatura'}</p></div><div className="flex items-center gap-2 text-xs text-[#8a8b9e]"><Calendar className="w-4 h-4" /><span>{new Date().toLocaleDateString()}</span></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{statsCards.map((stat, index) => (<motion.div key={stat.titulo} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, duration: 0.3 }} className={`bg-[#1f2035] border ${stat.borde} rounded-xl p-4 shadow-lg`}><div className="flex items-center justify-between"><div><p className="text-xs text-[#8a8b9e] font-medium">{stat.titulo}</p><p className="text-2xl font-bold text-[#d0d0da] mt-1">{stat.valor}</p></div><div className={`${stat.bg} p-3 rounded-xl`}><stat.icono className={`w-5 h-5 ${stat.color}`} /></div></div></motion.div>))}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.3 }} className="bg-[#1f2035] border border-[#313248] rounded-xl p-5"><h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2 mb-4"><PieChart className="w-4 h-4 text-[#818cf8]" />Distribución por Tipo</h3><div className="space-y-3">{[{l:'Evaluación 1',d:evaluacion1,c:'bg-blue-500'},{l:'Evaluación 2',d:evaluacion2,c:'bg-emerald-500'},{l:'Evaluación 3',d:evaluacion3,c:'bg-purple-500'},{l:'Evaluación 4',d:evaluacion4,c:'bg-pink-500'}].map(e=>(<div key={e.l}><div className="flex justify-between text-xs text-[#b0b0c4] mb-1"><span>{e.l}</span><span>{e.d.length} eval.</span></div><div className="w-full h-2 bg-[#313248] rounded-full overflow-hidden"><div className={`h-full ${e.c} rounded-full transition-all duration-500`} style={{ width: totalEvaluaciones > 0 ? `${(e.d.length / totalEvaluaciones) * 100}%` : '0%' }} /></div></div>))}</div></motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.3 }} className="bg-[#1f2035] border border-[#313248] rounded-xl p-5"><h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-[#818cf8]" />Niveles Bloom</h3><div className="space-y-1.5">{distribucionBloom.map((item, idx) => (<div key={item.nivel}><div className="flex justify-between text-xs text-[#b0b0c4] mb-0.5"><span className="capitalize">{item.nivel}</span><span>{item.count}</span></div><div className="w-full h-1.5 bg-[#313248] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${['bg-red-500','bg-orange-500','bg-yellow-500','bg-green-500','bg-blue-500','bg-purple-500'][idx]}`} style={{ width: totalEvaluaciones > 0 ? `${(item.count / totalEvaluaciones) * 100}%` : '0%' }} /></div></div>))}</div></motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.3 }} className="bg-[#1f2035] border border-[#313248] rounded-xl p-5"><h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-[#818cf8]" />Detalle</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-[#8a8b9e] border-b border-[#313248]"><th className="pb-2 font-medium">#</th><th className="pb-2 font-medium">Evaluación</th><th className="pb-2 font-medium">Peso</th><th className="pb-2 font-medium">Tiempo</th><th className="pb-2 font-medium">Bloom</th><th className="pb-2 font-medium">Estado</th></tr></thead><tbody className="divide-y divide-[#313248]">{planificacion.secciones.map((sec, idx) => (<tr key={sec.id} className="hover:bg-[#272839]/50 transition-colors"><td className="py-2 text-[#8a8b9e] text-xs">{idx + 1}</td><td className="py-2 text-[#d0d0da] font-medium">{limpiarTexto(sec.nombre)}</td><td className="py-2 text-[#b0b0c4]">{sec.peso || 0}%</td><td className="py-2 text-[#b0b0c4]">{sec.tiempoEstimadoMinutos || '?'} min</td><td className="py-2"><span className="capitalize text-xs text-[#b0b0c4]">{sec.nivelBloom || '-'}</span></td><td className="py-2">{sec.descripcion ? <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span> : <span className="text-amber-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />Sin desc</span>}</td></tr>))}{planificacion.secciones.length === 0 && (<tr><td colSpan={6} className="py-4 text-center text-[#8a8b9e]">No hay evaluaciones</td></tr>)}</tbody></table></div></motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.3 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-4 flex items-center gap-3"><div className="bg-blue-500/10 p-2 rounded-lg"><BookOpen className="w-5 h-5 text-blue-400" /></div><div><p className="text-xs text-[#8a8b9e]">Asignatura</p><p className="text-sm font-semibold text-[#d0d0da]">{planificacion.materia || 'Sin asignar'}</p></div></div>
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-4 flex items-center gap-3"><div className="bg-emerald-500/10 p-2 rounded-lg"><Brain className="w-5 h-5 text-emerald-400" /></div><div><p className="text-xs text-[#8a8b9e]">Bloom Dominante</p><p className="text-sm font-semibold text-[#d0d0da] capitalize">{bloomDominante && bloomDominante.count > 0 ? bloomDominante.nivel : 'Sin datos'}</p></div></div>
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-4 flex items-center gap-3"><div className="bg-purple-500/10 p-2 rounded-lg"><Award className="w-5 h-5 text-purple-400" /></div><div><p className="text-xs text-[#8a8b9e]">Estado</p><p className="text-sm font-semibold text-[#d0d0da] capitalize">{totalEvaluaciones > 0 ? 'En progreso' : 'Sin eval.'}</p></div></div>
      </motion.div>
    </div>
  );
}

// ============================================
// ESTUDIANTES PANEL (MEJORADO)
// ============================================
interface Estudiante {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  grupo: string;
  estado: 'activo' | 'inactivo';
  promedio: number;
  asistencia: number;
}

const estudiantesIniciales: Estudiante[] = [
 
];

function EstudiantesPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('todos');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cargando, setCargando] = useState(true);
  
  // Estados para Agregar
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoGrupo, setNuevoGrupo] = useState('A');
  const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({});

  // Estados para Editar
  const [editando, setEditando] = useState<Estudiante | null>(null);
  const [erroresEdit, setErroresEdit] = useState<Record<string, string>>({});

  // Validaciones en tiempo real
      const validarCampo = (campo: string, valor: string) => {
    let error = '';
    if (campo === 'nombre' && (!valor || valor.trim().length < 3)) {
      error = 'Mínimo 3 caracteres.';
    }
    if (campo === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!valor || !emailRegex.test(valor)) error = 'Correo no válido (ej: juan@correo.com).';
    }
    if (campo === 'telefono') {
      // 1. Solo permite números
      const soloNumeros = /^[0-9]+$/;
      if (!valor || !soloNumeros.test(valor)) {
        error = 'Solo se permiten números.';
      } 
      // 2. Validar que sea un formato de teléfono venezolano válido
      else {
        const numLimpio = valor.replace(/\s/g, ''); // Quita espacios si los hay
        
        // Celulares: 0412, 0414, 0416, 0424, 0426 (11 dígitos)
        const esCelularValido = /^04(12|14|16|24|26)\d{7}$/.test(numLimpio);
        
        // Fijos: 02XX (10 dígitos)
        const esFijoValido = /^02\d{8}$/.test(numLimpio);

        if (!esCelularValido && !esFijoValido) {
          error = 'Teléfono no válido. Ej: 04121234567 o 02123456789';
        }
      }
    }
    return error;
  };

  const validarFormularioCompleto = (nombre: string, email: string, telefono: string) => {
    const err: Record<string, string> = {};
    const eNombre = validarCampo('nombre', nombre);
    const eEmail = validarCampo('email', email);
    const eTel = validarCampo('telefono', telefono);
    if (eNombre) err.nombre = eNombre;
    if (eEmail) err.email = eEmail;
    if (eTel) err.telefono = eTel;
    return err;
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await apiEstudiantes.listar();
        const mapeados = data.map((e: any) => ({ ...e, estado: e.estado.toLowerCase() }));
        setEstudiantes(mapeados);
      } catch (error) {
        console.error("Error cargando estudiantes", error);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const recargarEstudiantes = async () => {
    const data = await apiEstudiantes.listar();
    setEstudiantes(data.map((e: any) => ({ ...e, estado: e.estado.toLowerCase() })));
  };

  const filteredEstudiantes = estudiantes.filter(e => {
    const matchSearch = e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase()) || e.telefono.includes(searchTerm);
    const matchFilter = filter === 'todos' || e.estado === filter;
    return matchSearch && matchFilter;
  });

  const totalEstudiantes = estudiantes.length;
  const totalActivos = estudiantes.filter(e => e.estado === 'activo').length;
  const promedioGeneral = totalEstudiantes > 0 ? Math.round(estudiantes.reduce((acc, e) => acc + e.promedio, 0) / totalEstudiantes) : 0;
  const asistenciaGeneral = totalEstudiantes > 0 ? Math.round(estudiantes.reduce((acc, e) => acc + e.asistencia, 0) / totalEstudiantes) : 0;
  const grupos = [...new Set(estudiantes.map(e => e.grupo))];

  const agregarEstudiante = async () => {
    const errores = validarFormularioCompleto(nuevoNombre, nuevoEmail, nuevoTelefono);
    setErroresNuevo(errores);
    if (Object.keys(errores).length > 0) return;

    try {
      await apiEstudiantes.crear({ nombre: nuevoNombre, email: nuevoEmail, telefono: nuevoTelefono, grupo: nuevoGrupo });
      setNuevoNombre(''); setNuevoEmail(''); setNuevoTelefono(''); setNuevoGrupo('A'); setErroresNuevo({});
      setShowAddModal(false);
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const actualizarEstudiante = async () => {
    if (!editando) return;
    const errores = validarFormularioCompleto(editando.nombre, editando.email, editando.telefono);
    setErroresEdit(errores);
    if (Object.keys(errores).length > 0) return;

    try {
      await apiEstudiantes.editar({
        id: editando.id, nombre: editando.nombre, email: editando.email,
        telefono: editando.telefono, grupo: editando.grupo, estado: editando.estado
      });
      setEditando(null); setErroresEdit({});
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const eliminarEstudiante = async (id: string) => {
    try {
      await apiEstudiantes.eliminar(id);
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (cargando) return <div className="text-center text-[#8a8b9e] py-10">Cargando estudiantes...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#d0d0da] flex items-center gap-3"><Users className="w-6 h-6 text-[#818cf8]" />Gestión de Estudiantes</h2>
          <p className="text-sm text-[#8a8b9e] mt-1">{totalEstudiantes} estudiantes en {grupos.length} grupos</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md"><Plus className="w-4 h-4" /> Agregar estudiante</motion.button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-[#1f2035] border border-[#313248] rounded-xl p-3"><div className="flex items-center gap-3"><Search className="w-4 h-4 text-[#8a8b9e]" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-transparent text-[#d8d8e2] placeholder-[#6a6b7e] outline-none text-sm" /></div></div>
        <div className="flex items-center gap-2 bg-[#1f2035] border border-[#313248] rounded-xl px-3 py-2"><Filter className="w-4 h-4 text-[#8a8b9e]" /><select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-transparent text-[#d8d8e2] text-sm outline-none"><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-3 text-center"><p className="text-xs text-[#8a8b9e]">Total</p><p className="text-lg font-bold text-[#d0d0da]">{totalEstudiantes}</p></div>
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-3 text-center"><p className="text-xs text-[#8a8b9e]">Activos</p><p className="text-lg font-bold text-emerald-400">{totalActivos}</p></div>
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-3 text-center"><p className="text-xs text-[#8a8b9e]">Promedio</p><p className="text-lg font-bold text-[#818cf8]">{promedioGeneral}%</p></div>
        <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-3 text-center"><p className="text-xs text-[#8a8b9e]">Asistencia</p><p className="text-lg font-bold text-blue-400">{asistenciaGeneral}%</p></div>
      </div>

      <div className="bg-[#1f2035] border border-[#313248] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[#8a8b9e] border-b border-[#313248] bg-[#191a26]"><th className="py-3 px-4 font-medium">Nombre</th><th className="py-3 px-4 font-medium">Correo</th><th className="py-3 px-4 font-medium">Teléfono</th><th className="py-3 px-4 font-medium">Grupo</th><th className="py-3 px-4 font-medium">Estado</th><th className="py-3 px-4 font-medium text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-[#313248]">
              {filteredEstudiantes.map(est => (
                <tr key={est.id} className="hover:bg-[#272839]/50 transition-colors">
                  <td className="py-3 px-4 text-[#d0d0da] font-medium">{est.nombre}</td>
                  <td className="py-3 px-4 text-[#b0b0c4]">{est.email}</td>
                  <td className="py-3 px-4 text-[#b0b0c4]">{est.telefono}</td>
                  <td className="py-3 px-4"><span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#818cf8]/10 text-[#818cf8] border border-[#818cf8]/20">{est.grupo}</span></td>
                  <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${est.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}><span className={`w-1.5 h-1.5 rounded-full ${est.estado === 'activo' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>{est.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip text="Editar"><button onClick={() => { setEditando({...est}); setErroresEdit({}); }} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#818cf8]/10 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button></Tooltip>
                      <Tooltip text="Eliminar"><button onClick={() => eliminarEstudiante(est.id)} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button></Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEstudiantes.length === 0 && (<tr><td colSpan={6} className="py-8 text-center text-[#8a8b9e]">No hay estudiantes registrados</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL AGREGAR CON VALIDACIONES */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-[#d0d0da] flex items-center gap-2"><User className="w-5 h-5 text-[#818cf8]" />Nuevo estudiante</h3><button onClick={() => setShowAddModal(false)} className="p-1.5 text-[#8a8b9e] hover:text-[#d0d0da] hover:bg-[#272839] rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <div><label className={labelBase}>Nombre completo</label><input type="text" value={nuevoNombre} onChange={(e) => { setNuevoNombre(e.target.value); setErroresNuevo(p => ({...p, nombre: validarCampo('nombre', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.nombre ? 'border-red-500/50' : ''}`} placeholder="Ej: Juan Pérez" />{erroresNuevo.nombre && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.nombre}</p>}</div>
                <div><label className={labelBase}>Correo electrónico</label><input type="email" value={nuevoEmail} onChange={(e) => { setNuevoEmail(e.target.value); setErroresNuevo(p => ({...p, email: validarCampo('email', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.email ? 'border-red-500/50' : ''}`} placeholder="juan@email.com" />{erroresNuevo.email && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.email}</p>}</div>
                <div><label className={labelBase}>Teléfono</label><input type="number" inputMode="numeric" value={nuevoTelefono} onChange={(e) => { setNuevoTelefono(e.target.value); setErroresNuevo(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.telefono ? 'border-red-500/50' : ''}`} placeholder="0412-1234567" />{erroresNuevo.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.telefono}</p>}</div>
                <div><label className={labelBase}>Grupo</label><select value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)} className={inputBase}><option value="A">Grupo A</option><option value="B">Grupo B</option><option value="C">Grupo C</option><option value="D">Grupo D</option></select></div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#272839] hover:bg-[#313248] rounded-xl transition-colors">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={agregarEstudiante} className="px-5 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL EDITAR CON VALIDACIONES */}
      <AnimatePresence>
        {editando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditando(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-[#d0d0da] flex items-center gap-2"><Pencil className="w-5 h-5 text-[#818cf8]" />Editar estudiante</h3><button onClick={() => setEditando(null)} className="p-1.5 text-[#8a8b9e] hover:text-[#d0d0da] hover:bg-[#272839] rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <div><label className={labelBase}>Nombre completo</label><input type="text" value={editando.nombre} onChange={(e) => { setEditando({...editando, nombre: e.target.value}); setErroresEdit(p => ({...p, nombre: validarCampo('nombre', e.target.value)})); }} className={`${inputBase} ${erroresEdit.nombre ? 'border-red-500/50' : ''}`} />{erroresEdit.nombre && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.nombre}</p>}</div>
                <div><label className={labelBase}>Correo electrónico</label><input type="email" value={editando.email} onChange={(e) => { setEditando({...editando, email: e.target.value}); setErroresEdit(p => ({...p, email: validarCampo('email', e.target.value)})); }} className={`${inputBase} ${erroresEdit.email ? 'border-red-500/50' : ''}`} />{erroresEdit.email && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.email}</p>}</div>
                <div><label className={labelBase}>Teléfono</label><input type="number" inputMode="numeric" value={editando.telefono} onChange={(e) => { setEditando({...editando, telefono: e.target.value}); setErroresEdit(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresEdit.telefono ? 'border-red-500/50' : ''}`} />{erroresEdit.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.telefono}</p>}</div>
                <div><label className={labelBase}>Grupo</label><select value={editando.grupo} onChange={(e) => setEditando({...editando, grupo: e.target.value})} className={inputBase}><option value="A">Grupo A</option><option value="B">Grupo B</option><option value="C">Grupo C</option><option value="D">Grupo D</option></select></div>
                <div><label className={labelBase}>Estado</label><select value={editando.estado} onChange={(e) => setEditando({...editando, estado: e.target.value as any})} className={inputBase}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#272839] hover:bg-[#313248] rounded-xl transition-colors">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={actualizarEstudiante} className="px-5 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Actualizar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// ============================================
// NUEVA PESTAÑA DE RÚBRICA MEJORADA
// ============================================
const nivelesDefecto: NivelDesempeno[] = [
  { id: 'n1', nombre: 'Excelente', puntaje: 4, descripcion: 'Demuestra dominio excepcional del criterio, superando ampliamente los objetivos.' },
  { id: 'n2', nombre: 'Bueno', puntaje: 3, descripcion: 'Cumple completamente con los requisitos del criterio de manera satisfactoria.' },
  { id: 'n3', nombre: 'Regular', puntaje: 2, descripcion: 'Cumple parcialmente con los requisitos, presenta algunas deficiencias.' },
  { id: 'n4', nombre: 'Deficiente', puntaje: 1, descripcion: 'No cumple con los requisitos mínimos del criterio.' },
];

function RubricaPanel({ planificacion, setPlanificacion }: { planificacion: PlanificacionExamen; setPlanificacion: React.Dispatch<React.SetStateAction<PlanificacionExamen>> }) {
  const [showCriterioModal, setShowCriterioModal] = useState(false);
  const [editingCriterio, setEditingCriterio] = useState<CriterioRubrica | null>(null);
  const [criterioNombre, setCriterioNombre] = useState('');
  const [criterioDescripcion, setCriterioDescripcion] = useState('');
  const [criterioPeso, setCriterioPeso] = useState(0);
  const [criterioNiveles, setCriterioNiveles] = useState<NivelDesempeno[]>([...nivelesDefecto]);
  const [showPreview, setShowPreview] = useState(false);

  const pesoTotal = planificacion.rubrica.reduce((acc, c) => acc + (c.peso || 0), 0);
  const pesoCorrecto = pesoTotal === 100;

  const abrirModalNuevo = () => {
    setEditingCriterio(null);
    setCriterioNombre('');
    setCriterioDescripcion('');
    setCriterioPeso(0);
    setCriterioNiveles([...nivelesDefecto]);
    setShowCriterioModal(true);
  };

  const abrirModalEditar = (criterio: CriterioRubrica) => {
    setEditingCriterio(criterio);
    setCriterioNombre(criterio.nombre);
    setCriterioDescripcion(criterio.descripcion);
    setCriterioPeso(criterio.peso);
    setCriterioNiveles(criterio.niveles ? [...criterio.niveles] : [...nivelesDefecto]);
    setShowCriterioModal(true);
  };

  const guardarCriterio = () => {
    if (!criterioNombre.trim()) {
      alert('El nombre del criterio es obligatorio.');
      return;
    }
    if (criterioPeso <= 0) {
      alert('El peso debe ser mayor a 0.');
      return;
    }

    const nuevoCriterio: CriterioRubrica = {
      id: editingCriterio ? editingCriterio.id : `crit-${Date.now()}`,
      nombre: criterioNombre.trim(),
      descripcion: criterioDescripcion.trim(),
      peso: criterioPeso,
      niveles: criterioNiveles,
    };

    if (editingCriterio) {
      setPlanificacion(prev => ({
        ...prev,
        rubrica: prev.rubrica.map(c => c.id === editingCriterio.id ? nuevoCriterio : c)
      }));
    } else {
      setPlanificacion(prev => ({
        ...prev,
        rubrica: [...prev.rubrica, nuevoCriterio]
      }));
    }
    setShowCriterioModal(false);
  };

  const eliminarCriterio = (id: string) => {
    setPlanificacion(prev => ({
      ...prev,
      rubrica: prev.rubrica.filter(c => c.id !== id)
    }));
  };

  const generarEjemplo = () => {
    setPlanificacion(prev => ({
      ...prev,
      rubrica: [
        { id: `crit-1`, nombre: 'Calidad del Contenido', peso: 35, descripcion: 'Evalúa la profundidad, precisión y relevancia del contenido presentado.', niveles: [...nivelesDefecto] },
        { id: `crit-2`, nombre: 'Estructura y Organización', peso: 25, descripcion: 'Mide la claridad, coherencia y lógica en la organización de las ideas.', niveles: [...nivelesDefecto] },
        { id: `crit-3`, nombre: 'Presentación y Comunicación', peso: 20, descripcion: 'Valora la calidad de la exposición oral, apoyo visual y lenguaje utilizado.', niveles: [...nivelesDefecto] },
        { id: `crit-4`, nombre: 'Trabajo en Equipo', peso: 20, descripcion: 'Evalúa la colaboración, distribución de tareas y sinergia del grupo.', niveles: [...nivelesDefecto] },
      ]
    }));
  };

  const limpiarRubrica = () => {
    setPlanificacion(prev => ({ ...prev, rubrica: [] }));
  };

  const exportarRubricaCSV = () => {
    const headers = ["Criterio", "Descripcion", "Peso (%)", ...nivelesDefecto.map(n => `${n.nombre} (${n.puntaje}pts)`)];
    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const rows = planificacion.rubrica.map(c => [
      escapeCSV(c.nombre),
      escapeCSV(c.descripcion),
      c.peso,
      ...nivelesDefecto.map(n => escapeCSV((c.niveles || nivelesDefecto).find(nv => nv.id === n.id)?.descripcion || ''))
    ].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "rubrica.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#d0d0da] flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-[#818cf8]" />
            Diseño de Rúbrica
          </h2>
          <p className="text-sm text-[#8a8b9e] mt-1">
            {planificacion.rubrica.length} criterios · Peso total: {pesoTotal}%
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tooltip text="Generar rúbrica de ejemplo">
            <button onClick={generarEjemplo} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg transition-all border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Ejemplo
            </button>
          </Tooltip>
          <Tooltip text="Ver vista previa">
            <button onClick={() => setShowPreview(!showPreview)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${showPreview ? 'bg-[#818cf8]/10 text-[#818cf8] border-[#818cf8]/30' : 'bg-[#272839] text-[#b0b0c4] border-[#313248]'}`}>
              <EyeIcon className="w-3.5 h-3.5" /> Vista previa
            </button>
          </Tooltip>
          <Tooltip text="Exportar a CSV">
            <button onClick={exportarRubricaCSV} disabled={planificacion.rubrica.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition-all border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </Tooltip>
          <Tooltip text="Limpiar rúbrica">
            <button onClick={limpiarRubrica} disabled={planificacion.rubrica.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-all border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          </Tooltip>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={abrirModalNuevo}
            className="flex items-center gap-2 px-4 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md"
          >
            <Plus className="w-4 h-4" /> Agregar criterio
          </motion.button>
        </div>
      </div>

      {/* Barra de progreso del peso total */}
      <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8a8b9e] font-medium">Peso total de la rúbrica</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pesoCorrecto ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {pesoTotal}% {pesoCorrecto ? '✓' : `(falta ${100 - pesoTotal}%)`}
          </span>
        </div>
        <div className="w-full h-2.5 bg-[#313248] rounded-full overflow-hidden">
          <motion.div 
            className={`h-full rounded-full ${pesoCorrecto ? 'bg-emerald-500' : pesoTotal > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
            animate={{ width: `${Math.min(pesoTotal, 100)}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        </div>
      </div>

      {/* Lista de criterios */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {planificacion.rubrica.map((criterio, idx) => (
            <motion.div 
              key={criterio.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="bg-[#1f2035] border border-[#313248] rounded-xl p-4 hover:border-[#414258] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#272839] flex items-center justify-center text-sm text-[#818cf8] font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-[#d0d0da]">{criterio.nombre}</h4>
                    <span className="text-xs bg-[#818cf8]/10 text-[#818cf8] px-2 py-0.5 rounded-full font-medium">
                      {criterio.peso}%
                    </span>
                  </div>
                  <p className="text-xs text-[#8a8b9e] line-clamp-2">{criterio.descripcion || 'Sin descripción'}</p>
                  {/* Barra de peso individual */}
                  <div className="mt-2 w-full h-1.5 bg-[#313248] rounded-full overflow-hidden">
                    <div className="h-full bg-[#818cf8]/60 rounded-full" style={{ width: `${criterio.peso}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip text="Editar criterio">
                    <button onClick={() => abrirModalEditar(criterio)} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </Tooltip>
                  <Tooltip text="Eliminar criterio">
                    <button onClick={() => eliminarCriterio(criterio.id)} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {planificacion.rubrica.length === 0 && (
          <div className="text-center py-12 text-[#8a8b9e] border border-dashed border-[#313248] rounded-xl">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay criterios definidos. Crea una rúbrica o genera un ejemplo.</p>
          </div>
        )}
      </div>

      {/* Vista previa de la rúbrica como matriz */}
      <AnimatePresence>
        {showPreview && planificacion.rubrica.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#1f2035] border border-[#313248] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#313248] bg-[#191a26]">
                <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2">
                  <EyeIcon className="w-4 h-4 text-[#818cf8]" /> Vista previa de la rúbrica
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1a1b2e]">
                      <th className="p-3 text-left text-xs font-medium text-[#8a8b9e] border-b border-[#313248]">Criterio</th>
                      <th className="p-3 text-left text-xs font-medium text-[#8a8b9e] border-b border-[#313248]">Peso</th>
                      {(planificacion.rubrica[0]?.niveles || nivelesDefecto).map(nivel => (
                        <th key={nivel.id} className="p-3 text-center text-xs font-medium text-[#8a8b9e] border-b border-[#313248]">
                          {nivel.nombre}<br/>
                          <span className="text-[#818cf8]">{nivel.puntaje} pts</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#313248]">
                    {planificacion.rubrica.map(criterio => (
                      <tr key={criterio.id} className="hover:bg-[#272839]/50">
                        <td className="p-3 text-[#d0d0da] font-medium">{criterio.nombre}</td>
                        <td className="p-3 text-[#818cf8] font-bold">{criterio.peso}%</td>
                        {(criterio.niveles || nivelesDefecto).map(nivel => (
                          <td key={nivel.id} className="p-3 text-xs text-[#b0b0c4] text-center max-w-[200px]">
                            {nivel.descripcion}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para agregar/editar criterio */}
      <AnimatePresence>
        {showCriterioModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCriterioModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-[#d0d0da] flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-[#818cf8]" />
                  {editingCriterio ? 'Editar criterio' : 'Nuevo criterio'}
                </h3>
                <button onClick={() => setShowCriterioModal(false)} className="p-1.5 text-[#8a8b9e] hover:text-[#d0d0da] hover:bg-[#272839] rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelBase}>Nombre del criterio</label>
                  <input type="text" value={criterioNombre} onChange={(e) => setCriterioNombre(e.target.value)} className={inputBase} placeholder="Ej: Calidad del contenido" />
                </div>
                <div>
                  <label className={labelBase}>Descripción</label>
                  <textarea value={criterioDescripcion} onChange={(e) => setCriterioDescripcion(e.target.value)} className={`${textareaBase} min-h-[80px]`} placeholder="Describe qué evalúa este criterio..." rows={3} />
                </div>
                <div>
                  <label className={labelBase}>Peso (%)</label>
                  <input type="number" value={criterioPeso} onChange={(e) => setCriterioPeso(parseInt(e.target.value) || 0)} className={smallInput} placeholder="0" min="0" max="100" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCriterioModal(false)} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#272839] hover:bg-[#313248] rounded-xl transition-colors">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={guardarCriterio} className="px-5 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md flex items-center gap-2">
                  <Save className="w-4 h-4" /> {editingCriterio ? 'Actualizar' : 'Guardar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// CAMPANITA NOTIFICACIONES MEJORADA
// ============================================
function CampanitaNotificacionesFlotante({ notificaciones, setNotificaciones, campanaActiva, setCampanaActiva }: any) {
  const [mostrarPanel, setMostrarPanel] = useState(false); const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setMostrarPanel(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const notificacionesNoLeidas = notificaciones.filter((n: any) => !n.leido).length;
  const toggleNotificaciones = () => { setMostrarPanel(!mostrarPanel); if (!campanaActiva) { setCampanaActiva(true); setNotificaciones((prev: any) => [{ id: `notif-${Date.now()}`, mensaje: '🔔 Notificaciones activadas', timestamp: new Date(), leido: false }, ...prev]); } };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={toggleNotificaciones} className="p-2 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg transition-colors relative">
        <Bell className="w-5 h-5" />
        {notificacionesNoLeidas > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {notificacionesNoLeidas}
          </span>
        )}
      </button>
      <AnimatePresence>
        {mostrarPanel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-0 mt-2 w-[420px] max-h-[500px] overflow-hidden bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl shadow-black/60 z-50"
          >
            <div className="p-4 border-b border-[#282a3f] bg-[#191a26] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#818cf8]" />
                Notificaciones
                {notificacionesNoLeidas > 0 && (
                  <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full">
                    {notificacionesNoLeidas} nuevas
                  </span>
                )}
              </h3>
              <button
                onClick={() => setNotificaciones([])}
                className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 rounded-lg transition-colors"
              >
                Limpiar todas
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
              {notificaciones.length === 0 ? (
                <div className="py-10 text-center text-[#8a8b9e] text-sm">No hay notificaciones</div>
              ) : (
                notificaciones.map((notif: any) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                      notif.leido
                        ? 'bg-[#191a26] border-[#282a3f] opacity-70'
                        : 'bg-[#272839] border-[#818cf8]/20 hover:bg-[#2e2f42]'
                    }`}
                    onClick={() =>
                      setNotificaciones((prev: any) =>
                        prev.map((n: any) => (n.id === notif.id ? { ...n, leido: true } : n))
                      )
                    }
                  >
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        notif.leido ? 'bg-[#5a5b6e]' : 'bg-[#818cf8]'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notif.leido ? 'text-[#8a8b9e]' : 'text-[#d0d0da]'}`}>
                          {notif.mensaje}
                        </p>
                        <p className="text-[10px] text-[#6a6b7e] mt-1">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// DRAG AND DROP SECCIONES
// ============================================
function DragDropSecciones({ secciones, onReorder, onEdit, onDelete, agregarNotificacion, pdfUrl, pdfAbierto, setPdfAbierto, mostrarMenuEnvio, setMostrarMenuEnvio, scrollToTarjeta, planificacion, setPdfUrl, mensajeWhatsApp, setMensajeWhatsApp, enviarA, setEnviarA, filtroEnvio, setFiltroEnvio }: any) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Agregar al inicio de DragDropSecciones, después de los otros useState:
  const [sendPressTimer, setSendPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const handleDragStart = (e: React.DragEvent, index: number) => { e.stopPropagation(); setDragIndex(index); setIsDragging(true); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); };
  const handleDragEnd = () => { setIsDragging(false); setDragIndex(null); setHoverIndex(null); };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isDragging) return; setHoverIndex(index); };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => { e.preventDefault(); e.stopPropagation(); const dragIndexValue = parseInt(e.dataTransfer.getData('text/plain')); if (isNaN(dragIndexValue) || dragIndexValue === dropIndex) { handleDragEnd(); return; } const nuevoOrden = [...secciones]; const [removed] = nuevoOrden.splice(dragIndexValue, 1); nuevoOrden.splice(dropIndex, 0, removed); onReorder(nuevoOrden); agregarNotificacion('🔄 Evaluaciones reordenadas.'); handleDragEnd(); };
  const handleCardClick = (seccionId: string) => { if (!isDragging) setExpandedId(expandedId === seccionId ? null : seccionId); };
  const handleClosePdf = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(null); setPdfAbierto(false); setMostrarMenuEnvio(false); agregarNotificacion('🗑️ Plan eliminado.'); };

  const exportToCSV = () => {
    const headers = ["Nombre", "Actividad", "Enfoque", "Duracion (min)", "Peso (%)", "Grupos", "Pers/Grupo", "Fecha", "Descripcion"];
    const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
    const rows = planificacion.secciones.map((s: SeccionExamen) => [
      escapeCSV(limpiarTexto(s.nombre)), escapeCSV(s.tipoActividad || ''), escapeCSV(s.enfoque || ''),
      s.tiempoEstimadoMinutos || 0, s.peso || 0, s.cantidadGrupos || 0, s.personasPorGrupo || 0,
      s.fecha ? new Date(s.fecha).toLocaleDateString() : '', escapeCSV(s.descripcion || '')
    ].join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `evaluaciones_${planificacion.materia || 'asignatura'}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    agregarNotificacion('📊 Evaluaciones exportadas a CSV correctamente.');
  };

  return (
    <div className="space-y-2">
      {pdfUrl && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border border-[#818cf8]/20 rounded-xl bg-[#1f2035] overflow-hidden">
          <div onClick={() => setPdfAbierto(!pdfAbierto)} className="flex items-center justify-between p-4 bg-[#272839]/80 border-b border-[#818cf8]/10 cursor-pointer hover:bg-[#2e2f42]/60 transition-colors select-none">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#818cf8] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[#818cf8]"></span></div>
              <FileText className="w-5 h-5 text-[#818cf8]" />
              <div><div className="flex items-center gap-2"><h4 className="font-bold text-[#d0d0da] text-sm">Plan de Acción Oficial</h4><span className="bg-[#818cf8]/10 text-[#818cf8] text-[10px] px-2 py-0.5 rounded-full font-medium border border-[#818cf8]/20">Generado</span></div><p className="text-xs text-[#8a8b9e]">Clic para {pdfAbierto ? 'contraer' : 'ver'}</p></div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* DESCARGAR */}
              <a
                href={pdfUrl}
                download={`plan_evaluacion_${planificacion.materia || 'examen'}.pdf`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#818cf8] hover:bg-[#6366f1] text-white font-medium text-xs rounded-lg transition-all shadow-md"
              >
                📥 Descargar
              </a>

              {/* ENVIAR — Click simple: nada. Mantener presionado 500ms: muestra ventana */}
              <Tooltip text="Mantén presionado para enviar">
                <button
                  onMouseDown={() => {
                    setSendPressTimer(setTimeout(() => {
                      setIsLongPressing(true);
                      if (pdfAbierto) setMostrarMenuEnvio(true);
                      else {
                        setPdfAbierto(true);
                        setTimeout(() => setMostrarMenuEnvio(true), 300);
                      }
                    }, 500));
                  }}
                  onMouseUp={() => {
                    if (sendPressTimer) { clearTimeout(sendPressTimer); setSendPressTimer(null); }
                    // Click simple → no hace nada (queda vacío como pediste)
                    setTimeout(() => setIsLongPressing(false), 100);
                  }}
                  onMouseLeave={() => {
                    if (sendPressTimer) { clearTimeout(sendPressTimer); setSendPressTimer(null); }
                    setIsLongPressing(false);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setSendPressTimer(setTimeout(() => {
                      setIsLongPressing(true);
                      if (pdfAbierto) setMostrarMenuEnvio(true);
                      else {
                        setPdfAbierto(true);
                        setTimeout(() => setMostrarMenuEnvio(true), 300);
                      }
                    }, 500));
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (sendPressTimer) { clearTimeout(sendPressTimer); setSendPressTimer(null); }
                    setTimeout(() => setIsLongPressing(false), 100);
                  }}
                  className={`p-1.5 rounded-lg border transition-all duration-200 ${
                    mostrarMenuEnvio
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                      : isLongPressing
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 scale-110'
                        : 'text-[#8a8b9e] hover:text-sky-400 border-transparent active:scale-95'
                  }`}
                >
                  <Send className={`w-4 h-4 transition-transform ${isLongPressing ? 'scale-110' : ''}`} />
                </button>
              </Tooltip>

              {/* ELIMINAR */}
              <Tooltip text="Eliminar PDF">
                <button
                  onClick={handleClosePdf}
                  className="p-1.5 hover:bg-rose-500/10 text-[#8a8b9e] hover:text-rose-400 rounded-lg transition-all border border-transparent hover:border-rose-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>
          <motion.div initial={false} animate={{ height: pdfAbierto ? "auto" : "0px", opacity: pdfAbierto ? 1 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.6 }} className="overflow-hidden bg-[#191a26]">
            <div className="p-4">
              <AnimatePresence mode="wait">
                {mostrarMenuEnvio ? (
                  <motion.div key="envio" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.2 }} className="w-full rounded-xl border border-[#818cf8]/20 bg-[#1f2035] p-6 text-[#d0d0da] min-h-[300px] flex flex-col justify-center">
                    <div className="text-center mb-6"><div className="w-16 h-16 bg-[#818cf8]/15 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-[#818cf8]/30"><Send className="w-7 h-7 text-[#818cf8]" /></div><h3 className="text-xl font-bold text-white mb-1">📤 Enviar Plan</h3><p className="text-sm text-[#8a8b9e]">Configura destinatarios</p></div>
                    <div className="max-w-lg mx-auto w-full space-y-4">
                      <div><label className="text-xs font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-2">Mensaje</label><textarea value={mensajeWhatsApp} onChange={(e) => setMensajeWhatsApp(e.target.value)} placeholder="Mensaje personalizado..." className={`${textareaBase} min-h-[70px]`} rows={2} /></div>
                      <div><label className="text-xs font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-2">Destinatario</label><div className="grid grid-cols-2 gap-3"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setEnviarA('profesor'); setFiltroEnvio(null); }} className={`p-3 rounded-xl border text-sm font-medium transition-all ${enviarA === 'profesor' ? 'bg-[#818cf8] border-[#818cf8] text-white' : 'bg-[#272839] border-[#313248] text-[#b0b0c4]'}`}><User className="w-4 h-4 inline mr-2" />Profesor</motion.button><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setEnviarA('estudiantes'); setFiltroEnvio(null); }} className={`p-3 rounded-xl border text-sm font-medium transition-all ${enviarA === 'estudiantes' ? 'bg-[#818cf8] border-[#818cf8] text-white' : 'bg-[#272839] border-[#313248] text-[#b0b0c4]'}`}><UsersIcon className="w-4 h-4 inline mr-2" />Estudiantes</motion.button></div></div>
                      {enviarA === 'estudiantes' && (<div className="grid grid-cols-2 gap-3"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setFiltroEnvio('todos')} className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${filtroEnvio === 'todos' ? 'bg-[#818cf8] border-[#818cf8] text-white' : 'bg-[#272839] border-[#313248] text-[#b0b0c4]'}`}>📢 Todos</motion.button><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setFiltroEnvio('seleccionar')} className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${filtroEnvio === 'seleccionar' ? 'bg-[#818cf8] border-[#818cf8] text-white' : 'bg-[#272839] border-[#313248] text-[#b0b0c4]'}`}>🔍 Seleccionar</motion.button></div>)}
                      {(enviarA === 'profesor' || filtroEnvio) && (<div className="bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl p-3"><div className="flex items-center gap-2 text-[#b0b0c4] text-sm"><CheckCircle className="w-4 h-4 text-[#818cf8]" /><span>Enviar a: <strong className="text-white">{enviarA === 'profesor' ? 'Profesor' : `Estudiantes (${filtroEnvio === 'todos' ? 'todos' : 'lista'})`}</strong></span></div></div>)}
                      {(enviarA === 'profesor' || filtroEnvio) && (<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { alert('✅ Enviado'); agregarNotificacion('📤 Plan enviado.'); setMostrarMenuEnvio(false); setPdfAbierto(false); }} className="w-full py-3 bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white font-semibold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2"><Send className="w-4 h-4" />Enviar</motion.button>)}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="pdf" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="w-full h-[600px] overflow-y-auto border border-slate-200 rounded-xl bg-white text-slate-800 font-sans shadow-lg custom-scrollbar">
                    <div className="p-10 relative">
                      <div className="absolute top-10 right-10 text-[10px] uppercase tracking-widest font-bold text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20 px-3 py-1 rounded-md">Plan v1.0</div>
                      <div className="mb-8 border-b-2 border-[#1e3a8a] pb-6"><span className="text-[11px] font-bold text-[#60a5fa] uppercase tracking-widest">Plan de Acción</span><h2 className="text-3xl font-black text-[#1e3a8a] mt-1">{planificacion.materia || 'Asignatura'}</h2><div className="flex gap-6 mt-3 text-xs text-slate-500"><p>👤 Prof. Dianella Stuch</p><p>📅 {planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir'}</p></div></div>
                      <div className="overflow-x-auto mb-8 rounded-xl border border-slate-200"><table className="w-full border-collapse text-left bg-white"><thead><tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500"><th className="p-4">Contenido</th><th className="p-4">Estrategia</th><th className="p-4 text-center">Peso</th><th className="p-4 text-center">Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">{planificacion.secciones.map((sec: SeccionExamen, idx: number) => (<tr key={sec.id||idx}><td className="p-4 font-medium text-slate-700">{sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i,'')||'Sin Nombre'}</td><td className="p-4 text-slate-600">{sec.tipoActividad||'Desarrollo'}</td><td className="p-4 text-center font-bold text-[#1e3a8a]">{sec.peso||0}%</td><td className="p-4 text-center text-slate-600">{sec.fecha ? new Date(sec.fecha).toLocaleDateString() : (planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : '—')}</td></tr>))}</tbody></table></div>
                      {planificacion.secciones.some((s: SeccionExamen)=>s.descripcion)&&(<div className="mt-6 border-t-2 border-slate-200 pt-6"><h3 className="text-sm font-bold text-slate-700 uppercase mb-3">📋 Especificaciones</h3><div className="grid gap-4">{planificacion.secciones.map((sec: SeccionExamen, i: number)=>{const n=sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i,'')||'Sin Nombre';return sec.descripcion?(<div key={sec.id||i} className="bg-slate-50 p-4 rounded-lg border border-slate-200"><div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-slate-400">#{i+1}</span><span className="font-semibold text-slate-700">{n}</span></div><p className="text-sm text-slate-600 whitespace-pre-wrap">{sec.descripcion}</p></div>):null})}</div></div>)}
                      <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8"><div><p className="text-xs text-slate-400 uppercase mb-1">Prof. Dianella Stuch</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Firma</p></div><div><p className="text-xs text-slate-400 uppercase mb-1">Coordinación Académica</p><div className="border-b border-slate-400 w-3/4"></div><p className="text-[10px] text-slate-400 mt-1">Sello</p></div></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {secciones.map((seccion: SeccionExamen, index: number) => {
            const isDraggingItem = dragIndex === index; const isHoveringItem = hoverIndex === index && isDragging; const nombreLimpio = limpiarTexto(seccion.nombre);
            return (
              <motion.div key={seccion.id} layout initial={{ opacity: 0, y: -20 }} animate={{ opacity: isDraggingItem ? 0.4 : 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={`bg-[#1f2035] rounded-xl border transition-all select-none ${isDraggingItem ? 'border-[#818cf8] shadow-2xl scale-[1.02] z-50' : isHoveringItem ? 'border-[#818cf8]/50 border-dashed bg-[#818cf8]/5' : 'border-[#313248] hover:border-[#414258]'}`}>
                <div className="p-3 flex items-center gap-3">
                  <div draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnd={handleDragEnd} className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-[#272839] transition-colors text-[#6a6b7e]" onClick={(e) => e.stopPropagation()}><GripVertical className="w-4 h-4" /></div>
                  <div className="w-6 h-6 rounded-full bg-[#272839] flex items-center justify-center text-xs text-[#8a8b9e] font-medium flex-shrink-0">{index + 1}</div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleCardClick(seccion.id)}>
                    <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#818cf8] flex-shrink-0" /><h4 className="text-sm text-[#d0d0da] font-medium truncate">{nombreLimpio}</h4></div>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-[#b0b0c4]">
                      {seccion.peso != null && <span>{seccion.peso}%</span>}
                      {seccion.tipoActividad && <span>🎯 {seccion.tipoActividad}</span>}
                      {seccion.enfoque && <span>📌 {seccion.enfoque}</span>}
                      {seccion.tiempoEstimadoMinutos && <span>⏱️ {seccion.tiempoEstimadoMinutos} min</span>}
                      {seccion.cantidadGrupos && <span>👥 {seccion.cantidadGrupos} grupos</span>}
                      {seccion.fecha && <span>📅 {new Date(seccion.fecha).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Tooltip text="Ver Detalle"><button onClick={() => handleCardClick(seccion.id)} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg">{expandedId === seccion.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button></Tooltip>
                    <Tooltip text="Editar"><button onClick={() => onEdit(seccion)} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg"><Pencil className="w-4 h-4" /></button></Tooltip>
                    <Tooltip text="Eliminar"><button onClick={() => { onDelete(seccion.id); }} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></Tooltip>
                  </div>
                </div>
                <AnimatePresence>{expandedId === seccion.id && seccion.descripcion && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#313248]"><div className="p-3 pl-14 text-sm text-[#c0c0cc] whitespace-pre-wrap">{seccion.descripcion}</div></motion.div>)}</AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {secciones.length === 0 && (<div className="text-center py-8 text-[#8a8b9e] border border-dashed border-[#313248] rounded-xl"><p className="text-sm">No hay evaluaciones</p></div>)}
      </div>
      
      <div className="flex justify-end mt-4">
        <Tooltip text="Exportar a Excel/CSV">
          <button onClick={exportToCSV} disabled={secciones.length === 0} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition-all border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

// ============================================
// COMBOBOX ENFOQUE
// ============================================
function EnfoqueCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    <motion.div ref={dropdownRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="fixed z-[9999] bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
      <div className="p-3 border-b border-[#313248]"><div className="flex items-center gap-2 px-3 py-2 bg-[#191a26] rounded-lg border border-[#282a3f]"><Search className="w-4 h-4 text-[#6a6b7e] flex-shrink-0" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar enfoque..." className="flex-1 bg-transparent text-sm text-[#d8d8e2] placeholder-[#4a4b5e] outline-none" autoFocus />{searchTerm && <button onClick={() => { setSearchTerm(''); onChange(''); }} className="text-[#6a6b7e] hover:text-[#9a9bae]"><X className="w-3.5 h-3.5" /></button>}</div></div>
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
        {filteredCategorias.map((cat, catIdx) => (<div key={cat.nombre} className={catIdx > 0 ? 'mt-2' : ''}><div className="flex items-center gap-2 px-3 py-2"><cat.icon className={`w-4 h-4 ${cat.color}`} /><span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>{cat.nombre}</span><div className="flex-1 h-px bg-[#282a3f]" /></div>
        <div className="flex flex-wrap gap-1.5 px-2 pb-2">
          {cat.opciones.map(op => (<motion.button key={op} type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => handleSelect(op)} className={`px-3.5 py-2 text-sm rounded-lg border transition-all cursor-pointer ${value === op ? 'bg-[#818cf8]/15 border-[#818cf8]/30 text-[#818cf8] font-medium' : 'bg-[#191a26] border-[#282a3f] text-[#9a9bae] hover:border-[#414258] hover:text-[#d0d0da] hover:bg-[#232430]'}`}>{op}</motion.button>))}
        </div></div>))}
      </div>
    </motion.div>
  );
  return (<div ref={containerRef}><div className="relative"><input ref={inputRef} type="text" value={value} onChange={handleInputChange} onFocus={() => { setIsOpen(true); setSearchTerm(''); }} placeholder="Escribe o selecciona..." className={`${inputBase} pr-8`} /><button type="button" onClick={() => { setIsOpen(!isOpen); if (!isOpen) inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6a6b7e] hover:text-[#818cf8] transition-colors"><ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} /></button></div>{createPortal(dropdownContent, document.body)}</div>);
}

// ============================================
// EVALUACIONES APILADAS (CON STREAMING EN CAMPOS)
// ============================================
function EvaluacionesApiladas({ evaluacion1, setEvaluacion1, guardarEvaluacion1, limpiarEvaluacion1, evaluacion2, setEvaluacion2, guardarEvaluacion2, limpiarEvaluacion2, evaluacion3, setEvaluacion3, guardarEvaluacion3, limpiarEvaluacion3, evaluacion4, setEvaluacion4, guardarEvaluacion4, limpiarEvaluacion4, numEvaluaciones, setNumEvaluaciones, justFilled1, justFilled2, justFilled3, justFilled4, totalEstudiantes = 8 }: any) {

  // Hook para efecto de streaming en inputs
  function useStreamingValue(target: string, isActive: boolean, speed = 15) {
    const [displayed, setDisplayed] = useState('');
    const indexRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
      if (!isActive) {
        setDisplayed(target);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      indexRef.current = 0;
      setDisplayed('');
      intervalRef.current = setInterval(() => {
        if (indexRef.current < target.length) {
          setDisplayed(target.slice(0, indexRef.current + 1));
          indexRef.current++;
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, speed);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [target, isActive, speed]);
    return displayed;
  }
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
        borderColor: tieneErrores ? '#f87171' : isGlowing ? '#818cf8' : '#313248',
        boxShadow: tieneErrores ? '0 0 12px -3px rgba(248,113,113,0.3)' : isGlowing ? '0 0 15px -3px rgba(129,140,248,0.4)' : '0 0 0 0 rgba(0,0,0,0)'
      }}
      exit={{ opacity: 0, height: 0, y: -10 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="bg-[#1d1e2e] border rounded-2xl shadow-xl overflow-hidden p-5 space-y-2.5"
    >
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#313248]">
        <FileSpreadsheet className="w-4 h-4 text-[#818cf8]" />
        <h3 className="text-sm font-semibold text-[#d0d0da]">{titulo}</h3>
        {tieneErrores && (
          <span className="ml-2 flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" /> Corrige los errores
          </span>
        )}
        {index > 1 && (
          <button onClick={() => { limpiar(); setNumEvaluaciones((prev: number) => prev - 1); }} className="ml-auto p-1 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
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
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, materia: val, errores: {...prev.errores, materia: undefined}})); }}
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
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, tipoActividad: val, errores: {...prev.errores, tipoActividad: undefined}})); }}
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
            <input type="number" value={ev.duracionMinutos ?? ''} onChange={(e) => setEv({...ev, duracionMinutos: e.target.value ? parseInt(e.target.value) : null})} className="flex-1 min-w-0 h-12 px-2.5 bg-[#1f2035] border border-r-0 border-[#313248] rounded-l-xl text-sm text-[#d8d8e2] placeholder-[#6a6b7e] focus:border-[#818cf8]/40 outline-none transition-all duration-200 font-['Inter'] text-center" placeholder="0" />
            <select value={ev.duracionUnidad || 'min'} onChange={(e) => setEv({...ev, duracionUnidad: e.target.value as 'min' | 'hrs'})} className="w-[48px] h-12 bg-[#1f2035] border border-[#313248] rounded-r-xl text-[11px] font-bold text-[#818cf8] text-center outline-none cursor-pointer appearance-none">
              <option value="min" className="bg-[#1f2035]">min</option>
              <option value="hrs" className="bg-[#1f2035]">hrs</option>
            </select>
          </div>
        </div>
        <div className="w-[88px] flex-shrink-0"><label className={`${labelBase} text-center`}>Pond.</label><div className="relative"><input type="number" value={ev.peso ?? ''} onChange={(e) => setEv({...ev, peso: e.target.value ? parseInt(e.target.value) : null})} className={`${smallInput} pr-9`} placeholder="0" /><span className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none"><span className="text-[11px] font-bold text-[#818cf8] bg-[#818cf8]/10 px-1.5 py-0.5 rounded-md">%</span></span></div></div>
                <div className="w-[72px] flex-shrink-0">
          <label className={`${labelBase} text-center`}>Grupos</label>
          <input
            type="number"
            value={ev.cantidadGrupos ?? ''}
            onChange={(e) => {
              const grupos = e.target.value ? parseInt(e.target.value) : null;
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
            value={ev.personasPorGrupo ?? ''}
            onChange={(e) => {
              const personas = e.target.value ? parseInt(e.target.value) : null;
              const { cantidadGrupos } = calcularDistribucionGrupos(totalEstudiantes, personas);
              setEv({...ev, personasPorGrupo: personas, cantidadGrupos: cantidadGrupos || null});
            }}
            className={smallInput}
            placeholder="#"
          />
        </div>
        <div className="flex-shrink-0 flex items-end">
          <div className="px-2 py-2.5 bg-[#818cf8]/8 border border-[#818cf8]/15 rounded-lg text-[10px] text-[#818cf8] font-medium leading-tight whitespace-nowrap">
            <Users className="w-3 h-3 mx-auto mb-0.5" />
            {totalEstudiantes} est.
            {ev.cantidadGrupos && ev.personasPorGrupo && ev.cantidadGrupos > 0 && (
              <span className="block text-[#b0b0c4] mt-0.5">
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
        <div className="flex-1 min-w-[260px]">
          <label className={labelBase}>Fecha y hora</label>
          <div className="flex gap-2">
            <div className="flex-1"><DatePicker value={ev.fecha} onChange={(d: Date) => setEv({...ev, fecha: d})} /></div>
            <div className="w-[130px]"><TimePicker value={ev.fecha} onChange={(d: Date) => setEv({...ev, fecha: d})} /></div>
          </div>
        </div>
      </div>

      {/* ---- DESCRIPCIÓN (con validación SE) ---- */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setEv({...ev, mostrarDescripcion: !ev.mostrarDescripcion})}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border ${ev.mostrarDescripcion ? 'bg-[#818cf8]/10 text-[#818cf8] border-[#818cf8]/30' : 'bg-[#272839] text-[#b0b0c4] border-[#313248] hover:bg-[#313248]'}`}
        >
          {ev.mostrarDescripcion ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar Descripción</> : <><ChevronDown className="w-3.5 h-3.5" /> Mostrar Descripción</>}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {ev.mostrarDescripcion && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) validarCampoAlBlur('descripcion', ev.descripcion || ''); }}
            >
              <StreamTextarea
                value={ev.descripcion ?? ''}
                onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, descripcion: val, errores: {...prev.errores, descripcion: undefined}})); }}
                placeholder="Descripción detallada de la evaluación..."
                className={`${textareaBase} min-h-[200px] mt-2 ${ev.errores?.descripcion ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
              />
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
        )}
      </AnimatePresence>

      {/* ---- BOTONES ---- */}
      <div className="flex justify-end gap-2 pt-1">
        <Tooltip text="Limpiar formulario">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={limpiar} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#272839] hover:bg-[#313248] rounded-lg text-xs text-[#b0b0c4] transition-all font-medium"><Trash2 className="w-3.5 h-3.5" />Limpiar</motion.button>
        </Tooltip>
        <Tooltip text={tieneErrores ? 'Corrige los errores primero' : 'Guardar (Ctrl+S)'}>
          <motion.button
            whileHover={{ scale: tieneErrores ? 1 : 1.02 }}
            whileTap={{ scale: tieneErrores ? 1 : 0.98 }}
            onClick={guardar}
            disabled={tieneErrores}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md ${
              tieneErrores
                ? 'bg-[#313248] text-[#5a5b6e] cursor-not-allowed shadow-none'
                : 'bg-[#818cf8] hover:bg-[#6366f1] text-white shadow-md'
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
          className="w-full py-4 border border-dashed border-[#313248] rounded-2xl text-sm text-[#8a8b9e] hover:bg-[#1f2035] hover:text-[#818cf8] hover:border-[#818cf8]/50 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" /> Agregar Evaluación {numEvaluaciones + 1}
        </motion.button>
      )}
    </div>
  );
}

// ============================================
// AGENTE PANEL (CON SCROLL MEJORADO)
// ============================================
function AgentePanel({ expandido, setExpandido, planificacion, setPlanificacion, setPropuestaPendiente, onAccept, setVistaPanel, setPdfUrl, setPdfAbierto, agregarNotificacion, generarPDF, limpiarYScroll, totalEstudiantes = 8 }: any) {
  const [mensaje, setMensaje] = useState(''); 
  const [pensando, setPensando] = useState(false); 
  const [escribiendo, setEscribiendo] = useState(false); 
  const [historial, setHistorial] = useState<Mensaje[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isChatStarted = historial.length > 0; 
  const [navegarAlPlan, setNavegarAlPlan] = useState(false);
  const [propuestaPendienteLocal, setPropuestaPendienteLocal] = useState<any>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { if (navegarAlPlan) { setVistaPanel('planificacion'); setNavegarAlPlan(false); } }, [navegarAlPlan, setVistaPanel]);
  
  const detectarOpciones = (texto: string) => { 
    const regex = /\[(✅|🔄|📝|⏱️|🔴)\s+([^\]]+)\]/g; 
    const opciones: { emoji: string; texto: string; accion: string }[] = []; 
    let match; 
    while ((match = regex.exec(texto)) !== null) opciones.push({ emoji: match[1], texto: match[2], accion: match[2] }); 
    return opciones; 
  };
  
  const traducirOpcion = (opcion: string) => { 
    if (opcion.includes('Aceptar')) return 'aceptar'; 
    if (opcion.includes('Cambiar estrategia')) return 'cambiar'; 
    if (opcion.includes('Generar')) return 'generar pdf'; 
    return opcion.toLowerCase(); 
  };
  
  useEffect(() => { if (!escribiendo) scrollToBottom(); }, [historial.length, pensando]);
  useEffect(() => { if (escribiendo) scrollToBottom(); }, [escribiendo, historial]);
  
  const onTypewriterComplete = useCallback((mensajeId: string) => { 
    setTimeout(() => { 
      setEscribiendo(false); 
      setHistorial(prev => prev.map(m => m.id === mensajeId ? { ...m, completo: true } : m)); 
      setNavegarAlPlan(true); 
    }, 0); 
  }, []);

  const esConfirmacionGuardado = (msg: string): boolean => {
    const palabras = ['sí','si','guardar','confirmo','aceptar','están bien','guardar evaluaciones','ok','vale','perfecto','adelante','dale','si guarda','guardar plan','excelente','genial','de acuerdo','claro','por supuesto'];
    const msgLower = msg.toLowerCase().trim();
    return palabras.some(p => msgLower.includes(p));
  };

  const esSolicitudPlanAccion = (msg: string): boolean => {
    const msgLower = msg.toLowerCase().trim();
    return msgLower.includes('plan de acción') || msgLower.includes('plan de accion') || msgLower.includes('genera plan');
  };

  const esNegacion = (msg: string): boolean => {
    const msgLower = msg.toLowerCase().trim();
    const palabrasNegativas = ['no quiero','no quiera','no generar','no crees','no hagas','cancelar','cancel','rechazar','rechazo','descartar','no guardar','no guardes','olvida','olvídalo'];
    return palabrasNegativas.some(p => msgLower.includes(p));
  };

  const guardarEvaluacionesDirecto = async () => {
    if (!propuestaPendienteLocal || !propuestaPendienteLocal.evaluaciones) return { success: false, mensaje: 'No hay evaluaciones para guardar.' };
    const totalEvals = propuestaPendienteLocal.evaluaciones.length;
    const sonCuatro = totalEvals === 4;
    const fechaBase = new Date();
    const fechas = calcularFechasEvaluaciones(fechaBase, totalEvals);
    const nuevasSecciones: SeccionExamen[] = propuestaPendienteLocal.evaluaciones.map((p: any, idx: number) => {
      let fechaExamen = fechas[idx] || new Date();
      if (p.fecha && p.hora) fechaExamen = new Date(`${p.fecha}T${p.hora}:00`);
      else if (p.fecha) fechaExamen = new Date(p.fecha);
      return { id: `eval${idx+1}-${Date.now()}`, nombre: `${p.tipo || `Evaluación ${idx+1}`}: ${limpiarTexto(p.materia)}`, tipoPregunta: 'desarrollo', peso: p.peso ?? null, cantidadPreguntas: 1, contenidosEvaluados: [], nivelBloom: 'aplicar', tiempoEstimadoMinutos: p.duracionMinutos ?? null, tipoActividad: p.tipoActividad || undefined, descripcion: p.descripcion || '', cantidadGrupos: p.cantidadGrupos ?? undefined, personasPorGrupo: p.personasPorGrupo ?? undefined, enfoque: p.enfoque || undefined, fecha: fechaExamen };
    });
    setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: [...prev.secciones, ...nuevasSecciones] }));
    setPropuestaPendiente(null);
    let pdfGenerado = false;
    // ✅ DESPUÉS (la solución):
if (sonCuatro && generarPDF) { 
  try {
    const url = await generarPDF(nuevasSecciones); 
    if (url) { 
      pdfGenerado = true; 
      if (agregarNotificacion) agregarNotificacion('📄 Plan de acción generado automáticamente.'); 
    } 
  } catch (error) {
    console.error('Error generando PDF:', error);
    
  }
}
    setPropuestaPendienteLocal(null);
    if (limpiarYScroll) limpiarYScroll();
    return { success: true, totalEvals, sonCuatro, pdfGenerado, mensaje: sonCuatro ? `✅ ¡Excelente! Se han guardado las ${totalEvals} evaluaciones y generado el Plan de Acción en PDF automáticamente. Puedes descargarlo en la sección "Planificador".` : `✅ ¡Excelente! Se han guardado las ${totalEvals} evaluaciones correctamente.` };
  };

  const manejarComandoEliminacion = (texto: string): boolean => {
    const msgLower = texto.toLowerCase().trim();
    const borrarTodasRegex = /^(borrar|eliminar|quitar|suprimir)\s+(todas\s+las\s+)?evaluacion(es)?(\s*guardad[ao]s?)?$/i;
    if (borrarTodasRegex.test(msgLower)) { setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: [] })); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: '🗑️ Todas las evaluaciones han sido eliminadas.', completo: true, id: `agent-${Date.now()}` }]); return true; }
    const borrarUnaRegex = /^(borrar|eliminar|quitar|suprimir)\s+(la\s+)?evaluaci[oó]n\s+(\d+)/i;
    const match = msgLower.match(borrarUnaRegex);
    if (match) { const num = parseInt(match[3], 10); const index = num - 1; const secciones = planificacion.secciones; if (index >= 0 && index < secciones.length) { const nombre = limpiarTexto(secciones[index].nombre); setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: prev.secciones.filter((_: SeccionExamen, i: number) => i !== index) })); setHistorial(prev => [...prev, { rol: 'agent', contenido: `🗑️ Evaluación ${num} «${nombre}» eliminada.`, completo: true, id: `agent-${Date.now()}` }]); return true; } else { setHistorial(prev => [...prev, { rol: 'agent', contenido: `❌ No se encontró la evaluación ${num}.`, completo: true, id: `agent-${Date.now()}` }]); return true; } }
    return false;
  };

  const cancelarPropuesta = () => {
    if (propuestaPendienteLocal) { setPropuestaPendienteLocal(null); setPropuestaPendiente(null); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: '✅ Propuesta descartada. Los formularios se han limpiado.', completo: true, id: `agent-${Date.now()}` }]); }
  };

  const handleSend = async (overrideMsg?: string) => {
    const msg = overrideMsg || mensaje;
    if (!msg.trim() || pensando || escribiendo) return;
    setHistorial(prev => [...prev, { rol: 'user', contenido: msg, completo: true, id: `user-${Date.now()}` }]);
    setMensaje(''); setPensando(true);
    scrollToBottom();
    if (manejarComandoEliminacion(msg)) { setPensando(false); return; }
    if (propuestaPendienteLocal && esNegacion(msg)) { setPensando(false); cancelarPropuesta(); return; }
    if (propuestaPendienteLocal && esConfirmacionGuardado(msg)) { setPensando(false); const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } return; }
    if ((msg.trim().toLowerCase() === 'aceptar' || msg.trim().toLowerCase() === 'si' || msg.trim().toLowerCase() === 'sí') && propuestaPendienteLocal) { setPensando(false); const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } return; }
    if (esSolicitudPlanAccion(msg) && !propuestaPendienteLocal) { if (esNegacion(msg)) { setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'De acuerdo, no generaré el plan de acción.', completo: true, id: `agent-${Date.now()}` }]); return; } try { const response = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje: msg, historial: historial.slice(-10), planificacion, totalEstudiantes, accion: 'plan_accion' }) }); const data = await response.json(); setPensando(false); const agentMsgId = `agent-${Date.now()}`; setHistorial(prev => [...prev, { rol: 'agent', contenido: data.respuesta, completo: false, id: agentMsgId }]); setEscribiendo(true); let datosExtraidos = null; if (data.datos && data.datos.evaluaciones?.length) { datosExtraidos = data.datos; } else { const jsonExtraido = extraerJSONDelTexto(data.respuesta); if (jsonExtraido?.evaluaciones) datosExtraidos = jsonExtraido; } if (datosExtraidos) { setPropuestaPendienteLocal(datosExtraidos); setPropuestaPendiente(datosExtraidos); } } catch (error) { console.error('Error:', error); setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'Error de conexión.', completo: true, id: `error-${Date.now()}` }]); } return; }
    try { const response = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje: msg, historial: historial.slice(-10), planificacion, totalEstudiantes }) }); const data = await response.json(); setPensando(false); const agentMsgId = `agent-${Date.now()}`; setHistorial(prev => [...prev, { rol: 'agent', contenido: data.respuesta, completo: false, id: agentMsgId }]); setEscribiendo(true); let datosExtraidos = null; if (data.datos && data.datos.evaluaciones?.length) { datosExtraidos = data.datos; } else { const jsonExtraido = extraerJSONDelTexto(data.respuesta); if (jsonExtraido?.evaluaciones) datosExtraidos = jsonExtraido; } if (datosExtraidos) { if (esNegacion(msg)) { setPropuestaPendienteLocal(null); setPropuestaPendiente(null); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'De acuerdo, he descartado los resultados de la evaluación.', completo: true, id: `agent-${Date.now()}` }]); } else { setPropuestaPendienteLocal(datosExtraidos); setPropuestaPendiente(datosExtraidos); } } } catch (error) { console.error('Error:', error); setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'Error de conexión.', completo: true, id: `error-${Date.now()}` }]); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleMicClick = async () => {
    if (isRecording) { if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); setIsRecording(false); } else {
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); audioChunksRef.current = []; mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); }; mediaRecorder.onstop = async () => { setTranscribiendo(true); const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const formData = new FormData(); formData.append('file', audioBlob, 'audio.webm'); try { const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/voice`, { method: 'POST', body: formData }); const data = await res.json(); if (data.text) setMensaje(prev => prev ? prev + " " + data.text : data.text); } catch (err) { alert("Error al transcribir."); } finally { setTranscribiendo(false); } }; mediaRecorder.start(); mediaRecorderRef.current = mediaRecorder; setIsRecording(true); } catch (err) { alert("No se pudo acceder al micrófono."); }
    }
  };

  const renderOpciones = (contenido: string) => {
    const opciones = detectarOpciones(limpiarBloqueJSON(contenido));
    if (opciones.length === 0) return null;
    return (<div className="flex flex-wrap gap-2 mt-3">{opciones.map((op, i) => { const esAceptar = op.accion.includes('Aceptar') || op.accion.includes('Guardar'); return (<button key={i} onClick={async () => { if (esAceptar) { if (!propuestaPendienteLocal?.evaluaciones) { setHistorial(prev => [...prev, { rol: 'agent', contenido: '⚠️ No hay propuesta para guardar. Genera un plan primero.', completo: true, id: `agent-${Date.now()}` }]); return; } const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } } else { handleSend(traducirOpcion(op.accion)); } }} disabled={pensando || escribiendo} className="px-3 py-1.5 bg-[#818cf8]/10 hover:bg-[#818cf8]/20 border border-[#818cf8]/20 rounded-xl text-sm text-[#c0c0d0] transition-all cursor-pointer disabled:opacity-50">{op.emoji} {op.texto}</button>); })}</div>);
  };

  return (
    <motion.div animate={{ width: expandido ? 640 : 0, opacity: expandido ? 1 : 0 }} transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className="border-r border-[#282a3f] flex flex-col h-full bg-[#191a26] overflow-hidden" style={{ minWidth: expandido ? 640 : 0 }}>
      <div className="px-6 py-4 border-b border-[#282a3f] flex items-center gap-3 bg-gradient-to-r from-[#191a26] to-[#1f2035]"><div className="relative"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center shadow-lg shadow-[#818cf8]/30"><Bot className="w-5 h-5 text-white" /></div><div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#191a26] flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /></div></div><div><h2 className="text-sm font-semibold text-[#d0d0da] font-['Inter'] flex items-center gap-2">Agente planificador de evaluaciones<span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">IA</span></h2><p className="text-xs text-[#8a8b9e] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>{isChatStarted ? 'Procesando...' : 'Listo'}</p></div></div>
      {!isChatStarted ? (<div className="flex-1 flex flex-col items-center justify-center px-6"><motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center text-center"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#818cf8]/20 to-[#6366f1]/20 flex items-center justify-center border-2 border-[#818cf8]/30 mb-6 shadow-2xl shadow-[#818cf8]/20"><Sparkle className="w-10 h-10 text-[#818cf8]" /></div><h1 className="text-2xl font-bold text-[#d0d0da] font-['Inter'] mb-2">Agente planificador de evaluaciones</h1><p className="text-sm text-[#8a8b9e] font-['Inter'] max-w-sm">Escribe el tema que quieres evaluar o usa el micrófono para hablar.</p></motion.div></div>) : (<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar"><AnimatePresence>{historial.map((msg) => (<motion.div key={msg.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex ${msg.rol === 'user' ? 'justify-end' : 'justify-start'}`}>{msg.rol === 'agent' ? (<div className="flex items-start gap-3 max-w-[90%]"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-[#818cf8]/20"><Bot className="w-4 h-4 text-white" /></div><div className="text-base text-[#c0c0cc] leading-relaxed pt-0.5 font-['Inter']">{msg.completo ? (<div><div dangerouslySetInnerHTML={{ __html: formatMessage(msg.contenido) }} />{renderOpciones(msg.contenido)}</div>) : (<TypewriterText text={msg.contenido} onComplete={() => onTypewriterComplete(msg.id)} onUpdate={scrollToBottom} />)}</div></div>) : (<div className="max-w-[85%] px-5 py-3 bg-[#818cf8]/10 text-[#d8d8e2] rounded-2xl rounded-br-md text-base leading-relaxed font-['Inter'] border border-[#818cf8]/20">{msg.contenido}</div>)}</motion.div>))}</AnimatePresence>{pensando && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-3 justify-start"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#818cf8]/20"><Bot className="w-4 h-4 text-white" /></div><div className="px-4 py-3.5 bg-[#1f2035] rounded-2xl rounded-tl-md border border-[#313248] flex items-center gap-1.5 mt-0.5">{[0,1,2].map(i => (<motion.span key={i} className="w-2 h-2 bg-[#818cf8] rounded-full" animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />))}</div></motion.div>)}<div ref={chatEndRef} /></div>)}
      <div className="p-5 border-t border-[#282a3f] bg-gradient-to-t from-[#161722] to-transparent"><div className="relative"><motion.div className="absolute -inset-1 rounded-2xl opacity-70" animate={{ opacity: [0.4, 0.6, 0.4] }} transition={{ duration: 4, repeat: Infinity }} style={{ background: 'linear-gradient(90deg, #818cf8, #6366f1, #818cf8)', filter: 'blur(12px)' }} /><motion.div className="relative flex items-end gap-2.5 bg-[#1f2035] border border-[#313248] rounded-2xl px-4 py-3 focus-within:border-[#818cf8]/60 transition-all duration-300 shadow-lg shadow-black/20"><motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()} className="p-2 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-xl transition-colors flex-shrink-0 self-end"><Paperclip className="w-5 h-5" /></motion.button><input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" /><Tooltip text={isRecording ? "Detener grabación" : "Hablar (n8n transcribe)"}><motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={handleMicClick} disabled={transcribiendo || pensando || escribiendo} className={`p-2 rounded-xl transition-colors flex-shrink-0 self-end ${isRecording ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839]'} disabled:opacity-50 disabled:cursor-not-allowed`}>{transcribiendo ? (<div className="w-5 h-5 border-2 border-t-red-400 rounded-full animate-spin"></div>) : isRecording ? (<div className="w-3 h-3 bg-red-500 rounded-sm"></div>) : (<Mic className="w-5 h-5" />)}</motion.button></Tooltip><div className="flex-1 relative"><textarea value={mensaje} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMensaje(e.target.value)} onKeyDown={handleKeyDown} placeholder={transcribiendo ? "Transcribiendo..." : "Escribe tu consulta..."} rows={1} className="w-full bg-transparent text-base text-[#d8d8e2] placeholder-[#6a6b7e] outline-none resize-none py-1.5 font-['Inter'] min-h-[40px] max-h-[120px]" style={{ lineHeight: '1.5' }} /></div><motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={() => handleSend()} disabled={!mensaje.trim() || pensando || escribiendo} className={`p-2.5 rounded-xl transition-all flex-shrink-0 self-end ${mensaje.trim() && !pensando && !escribiendo ? 'bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white hover:shadow-lg hover:shadow-[#818cf8]/30 shadow-md' : 'bg-[#272839] text-[#5a5b6e] cursor-not-allowed'}`}><Send className="w-4 h-4" /></motion.button></motion.div></div></div>
    </motion.div>
  );
}

// ============================================
// PANEL DERECHO (CONFIG Y NOTIFICACIONES MEJORADAS)
// ============================================
type PanelDerechoHandle = { limpiarYScroll: () => void; };
interface PanelDerechoProps { planificacion: PlanificacionExamen; setPlanificacion: React.Dispatch<React.SetStateAction<PlanificacionExamen>>; propuestaPendiente: PropuestaEvaluacion | null; aceptarPropuesta: () => void; setPropuestaPendiente: (p: PropuestaEvaluacion | null) => void; vistaInicial: 'planificacion' | 'rubrica' | 'estadisticas' | 'estudiantes' | 'configuracion'; onCambiarVista: (v: 'planificacion' | 'rubrica' | 'estadisticas' | 'estudiantes' | 'configuracion') => void; pdfUrl: string | null; setPdfUrl: (url: string | null) => void; pdfAbierto: boolean; setPdfAbierto: (abierto: boolean) => void; generarPDF: (secciones?: SeccionExamen[]) => Promise<string | null>; planificacionId: string | null; setPlanificacionId: (id: string | null) => void; }

const PanelDerecho = forwardRef<PanelDerechoHandle, PanelDerechoProps>(function PanelDerecho({ planificacion, setPlanificacion, propuestaPendiente, aceptarPropuesta, setPropuestaPendiente, vistaInicial, onCambiarVista, pdfUrl: pdfUrlProp, setPdfUrl: setPdfUrlProp, pdfAbierto: pdfAbiertoProp, setPdfAbierto: setPdfAbiertoProp, generarPDF, planificacionId, setPlanificacionId }: PanelDerechoProps, ref) {
  const [vista, setVista] = useState<'planificacion' | 'rubrica' | 'estadisticas' | 'estudiantes' | 'configuracion'>(vistaInicial);
  const [numEvaluaciones, setNumEvaluaciones] = useState(1); 
  const seccionesGuardadasRef = useRef<HTMLDivElement>(null);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const [scrollToSections, setScrollToSections] = useState(false);
  const [pdfUrlLocal, setPdfUrlLocal] = useState<string | null>(pdfUrlProp || null);
  const [pdfAbiertoLocal, setPdfAbiertoLocal] = useState(pdfAbiertoProp || false);
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [campanaActiva, setCampanaActiva] = useState(false);
  const [mostrarMenuEnvio, setMostrarMenuEnvio] = useState(false);
  const [enviarA, setEnviarA] = useState<'profesor' | 'estudiantes' | null>(null);
  const [filtroEnvio, setFiltroEnvio] = useState<'todos' | 'seleccionar' | null>(null);
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');
  const [notificaciones, setNotificaciones] = useState<{id: string, mensaje: string, timestamp: Date, leido: boolean}[]>([{ id: 'bienvenida', mensaje: '👋 Bienvenido al planificador', timestamp: new Date(), leido: false }]);

    // Total de estudiantes registrados (para auto-calcular grupos)
  const [totalEstudiantes, setTotalEstudiantes] = useState(8); // 8 por defecto

  useEffect(() => {
    const cargarTotal = async () => {
      try {
        const data = await apiEstudiantes.listar();
        if (Array.isArray(data) && data.length > 0) {
          setTotalEstudiantes(data.length);
        }
      } catch {
        // Si falla, mantiene el valor por defecto (8)
      }
    };
    cargarTotal();
  }, []);

  // Estados para el efecto glow
  const [glow1, setGlow1] = useState(false);
  const [glow2, setGlow2] = useState(false);
  const [glow3, setGlow3] = useState(false);
  const [glow4, setGlow4] = useState(false);

  useEffect(() => { setVista(vistaInicial); }, [vistaInicial]);
  useEffect(() => { onCambiarVista(vista); }, [vista, onCambiarVista]);
  useEffect(() => { if (pdfUrlProp !== undefined) setPdfUrlLocal(pdfUrlProp); }, [pdfUrlProp]);
  useEffect(() => { if (pdfAbiertoProp !== undefined) setPdfAbiertoLocal(pdfAbiertoProp); }, [pdfAbiertoProp]);

  const setPdfUrl = (url: string | null) => { setPdfUrlLocal(url); if (setPdfUrlProp) setPdfUrlProp(url); };
  const setPdfAbierto = (abierto: boolean) => { setPdfAbiertoLocal(abierto); if (setPdfAbiertoProp) setPdfAbiertoProp(abierto); };
  const agregarNotificacion = (mensaje: string) => { setNotificaciones(prev => [{ id: `notif-${Date.now()}`, mensaje, timestamp: new Date(), leido: false }, ...prev.slice(0, 19)]); };
  const scrollToTarjeta = () => { setTimeout(() => { if (tarjetaRef.current) tarjetaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); };
  
  useEffect(() => { if (scrollToSections && seccionesGuardadasRef.current && vista === 'planificacion') { requestAnimationFrame(() => { seccionesGuardadasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScrollToSections(false); }); } }, [planificacion.secciones, scrollToSections, vista]);

  const evalInit: EvaluacionFormulario = { materia: '', duracionMinutos: null, duracionUnidad: 'min', peso: null, fecha: new Date(), tipoActividad: '', descripcion: '', cantidadGrupos: null, personasPorGrupo: null, editandoId: null, mostrarDescripcion: false, enfoque: '', errores: {}, };
  const [evaluacion1, setEvaluacion1] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion2, setEvaluacion2] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion3, setEvaluacion3] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion4, setEvaluacion4] = useState<EvaluacionFormulario>({...evalInit});

  const limpiarYScroll = () => { setEvaluacion1({...evalInit}); setEvaluacion2({...evalInit}); setEvaluacion3({...evalInit}); setEvaluacion4({...evalInit}); setNumEvaluaciones(1); setScrollToSections(true); setVista('planificacion'); setGlow1(false); setGlow2(false); setGlow3(false); setGlow4(false); };
  useImperativeHandle(ref, () => ({ limpiarYScroll }), [limpiarYScroll]);
    // Función para guardar en Supabase sin interrumpir la UI
  const sincronizarConBD = async (planActualizada: PlanificacionExamen) => {
    try {
      let idMateriaActual = planificacionId;
      if (!idMateriaActual) {
        const nuevaMateria = await fetch('/api/materias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: planActualizada.materia || 'Nueva Asignatura', codigo: `MAT-${Date.now()}` }),
        }).then(res => res.json());
        idMateriaActual = nuevaMateria.id;
        setPlanificacionId(idMateriaActual);
      }

      if (idMateriaActual) {
        const dataParaDB = {
          materiaId: idMateriaActual,
          estado: planActualizada.estado.toUpperCase(),
          tipoExamen: planActualizada.tipoExamen.toUpperCase(),
          fechaExamen: planActualizada.fechaExamen.toISOString(),
          duracionMinutos: planActualizada.duracionMinutos,
          evaluaciones: planActualizada.secciones.map((ev, idx) => ({
            nombre: ev.nombre, tipoPregunta: ev.tipoPregunta.toUpperCase(), nivelBloom: ev.nivelBloom.toUpperCase(),
            peso: ev.peso, cantidadPreguntas: ev.cantidadPreguntas, contenidosEvaluados: ev.contenidosEvaluados,
            tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos, tipoActividad: ev.tipoActividad, descripcion: ev.descripcion,
            cantidadGrupos: ev.cantidadGrupos, personasPorGrupo: ev.personasPorGrupo, orden: ev.orden ?? idx,
            enfoque: ev.enfoque, fecha: ev.fecha ? ev.fecha.toISOString() : null,
          })),
          rubrica: planActualizada.rubrica.map(crit => ({
            nombre: crit.nombre, peso: crit.peso, descripcion: crit.descripcion,
            niveles: (crit.niveles || []).map(niv => ({ nombre: niv.nombre, puntaje: niv.puntaje, descripcion: niv.descripcion })),
          })),
        };

        if (planificacionId) {
          await fetch(`/api/planificaciones/${planificacionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataParaDB) });
        } else {
          const nueva = await fetch('/api/planificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataParaDB) }).then(res => res.json());
          setPlanificacionId(nueva.id);
        }
      }
    } catch (error) {
      console.error("Error guardando en BD:", error);
    }
  };

  useEffect(() => {
    if (propuestaPendiente?.evaluaciones) {
      const count = propuestaPendiente.evaluaciones.length; setNumEvaluaciones(count); 
      const fechaBase = new Date(); const fechas = calcularFechasEvaluaciones(fechaBase, count);
      propuestaPendiente.evaluaciones.forEach((p, idx) => {
        let fechaExamen = fechas[idx] || new Date();
        if (p.fecha && p.hora) fechaExamen = new Date(`${p.fecha}T${p.hora}:00`);
        else if (p.fecha) fechaExamen = new Date(p.fecha);
        const evalData: EvaluacionFormulario = { materia: p.materia, duracionMinutos: p.duracionMinutos ?? null, duracionUnidad: 'min', peso: p.peso ?? null, fecha: fechaExamen, tipoActividad: p.tipoActividad || '', descripcion: p.descripcion || '', cantidadGrupos: p.cantidadGrupos ?? null, personasPorGrupo: p.personasPorGrupo ?? null, editandoId: null, mostrarDescripcion: false, enfoque: p.enfoque || '', errores: {} };
        if (idx === 0) { setEvaluacion1(evalData); activarGlow(1); }
        else if (idx === 1) { setEvaluacion2(evalData); activarGlow(2); }
        else if (idx === 2) { setEvaluacion3(evalData); activarGlow(3); }
        else if (idx === 3) { setEvaluacion4(evalData); activarGlow(4); }
      });
      setPropuestaPendiente(null);
    }
  }, [propuestaPendiente, setPropuestaPendiente]);

  const activarGlow = (num: number) => {
    const setters = [setGlow1, setGlow2, setGlow3, setGlow4];
    const setter = setters[num-1];
    if (setter) {
      setter(true);
      setTimeout(() => setter(false), 1500);
    }
  };

  const cargarSeccionParaEditar = (seccion: SeccionExamen) => {
    const nombreLimpio = limpiarTexto(seccion.nombre);
    const esEval1 = seccion.nombre.toLowerCase().includes('evaluación 1') || seccion.nombre.toLowerCase().includes('evaluacion 1');
    const esEval2 = seccion.nombre.toLowerCase().includes('evaluación 2') || seccion.nombre.toLowerCase().includes('evaluacion 2');
    const esEval3 = seccion.nombre.toLowerCase().includes('evaluación 3') || seccion.nombre.toLowerCase().includes('evaluacion 3');
    const datosBase: EvaluacionFormulario = { materia: nombreLimpio, duracionMinutos: seccion.tiempoEstimadoMinutos ?? null, duracionUnidad: 'min', peso: seccion.peso ?? null, fecha: seccion.fecha || new Date(), tipoActividad: seccion.tipoActividad || '', descripcion: seccion.descripcion || '', cantidadGrupos: seccion.cantidadGrupos ?? null, personasPorGrupo: seccion.personasPorGrupo ?? null, editandoId: seccion.id, mostrarDescripcion: false, enfoque: seccion.enfoque || '', errores: {} }; 
    if (esEval1) setEvaluacion1(datosBase);
    else if (esEval2) setEvaluacion2(datosBase);
    else if (esEval3) setEvaluacion3(datosBase);
    else setEvaluacion4(datosBase);
  };

  const limpiarEvaluacion1 = () => setEvaluacion1({...evalInit});
  const limpiarEvaluacion2 = () => setEvaluacion2({...evalInit});
  const limpiarEvaluacion3 = () => setEvaluacion3({...evalInit});
  const limpiarEvaluacion4 = () => setEvaluacion4({...evalInit});

    // Genera el Plan de Acción como HTML visual (sin depender de n8n)
  const generarPlanVisual = (): string | null => {
    if (planificacion.secciones.length === 0) return null;
    const nombreMateria = planificacion.materia || 'Asignatura';
    const fechaPlan = planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir';
    
    const renderFila = (sec: SeccionExamen, i: number) => {
      const nombreLimpio = sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i, '') || 'Sin Nombre';
      const descripcion = sec.descripcion || '';
      return `<tr key="${sec.id || i}">
        <td style="p: 16px; font-medium; color: #334155;">${nombreLimpio}</td>
        <td style="padding: 16px; color: #475569;">${sec.tipoActividad || 'Desarrollo'}</td>
        <td style="padding: 16px; text-align: center; font-weight: 700; color: #1e3a8a;">${sec.peso || 0}%</td>
        <td style="padding: 16px; text-align: center; color: #475569;">${sec.fecha ? new Date(sec.fecha).toLocaleDateString() : fechaPlan}</td>
      </tr>`;
    };

    const tieneDescripciones = planificacion.secciones.some(s => s.descripcion);
    const renderDescripciones = tieneDescripciones ? `
      <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid #e2e8f0;">
        <h3 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 12px 0;">📋 Especificaciones</h3>
        <div style="display: grid; gap: 16px;">
          ${planificacion.secciones.map((sec, i) => {
            const n = sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i, '') || 'Sin Nombre';
            return sec.descripcion ? `<div key="${sec.id || i}" style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #94a3b8;">#${i + 1}</span>
                <span style="font-weight: 600; color: #1e293b;">${n}</span>
              </div>
              <p style="font-size: 14px; color: #475569; white-space: pre-wrap;">${sec.descripcion}</p>
            </div>` : '';
          }).join('')}
        </div>
      </div>` : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plan de Acción - ${nombreMateria}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 0; }
    .page { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
    .header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #1e3a8a; }
    .badge { position: absolute; top: 40px; right: 40px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 6px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 2px; }
    .title { font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 4px 0 0 0; }
    .meta { display: flex; gap: 24px; margin-top: 12px; font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; text-align: left; background: white; }
    thead tr { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
    th { padding: 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    td { padding: 16px; }
    .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #d1d5db; }
    .firma-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .firma-linea { border-bottom: 2px solid #cbd5e1; width: 75%; }
    .sello-label { font-size: 10px; color: #94a3b8; margin-top: 4px; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page" style="position: relative;">
    <div class="badge">Plan v1.0</div>
    <div class="header">
      <div class="subtitle">Plan de Acción</div>
      <h1 class="title">${nombreMateria}</h1>
      <div class="meta">
        <p>👤 Prof. Dianella Stuch</p>
        <p>📅 ${fechaPlan}</p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Contenido</th>
          <th>Estrategia</th>
          <th style="text-align: center;">Peso</th>
          <th style="text-align: center;">Fecha</th>
        </tr>
      </thead>
      <tbody>
        ${planificacion.secciones.map((sec, idx) => renderFila(sec, idx))}
      </tbody>
    </table>
    ${renderDescripciones}
    <div class="firmas">
      <div><p class="firma-label">Prof. Dianella Stuch</p><div class="firma-linea"></div><p class="sello-label">Firma</p></div>
      <div><p class="firma-label">Coordinación Académica</p><div class="firma-linea"></div><p class="sello-label">Sello</p></div>
    </div>
  </div>
</body>
</html>`;
  };

    const limpiarTodasLasEvaluaciones = () => {
    const estadoVacio = { ...planificacion, secciones: [] };
    setPlanificacion(estadoVacio);
    sincronizarConBD(estadoVacio); // ESTA LÍNEA ES LA QUE BORRA DE LA BD
    limpiarEvaluacion1(); limpiarEvaluacion2(); limpiarEvaluacion3(); limpiarEvaluacion4();
    if (pdfUrlLocal) { URL.revokeObjectURL(pdfUrlLocal); setPdfUrl(null); setPdfAbierto(false); setMostrarMenuEnvio(false); }
    agregarNotificacion('🧹 Todas las evaluaciones eliminadas de la BD.');
  };

  const crearSeccion = (evalData: EvaluacionFormulario, tipo: string, idPrefix: string): SeccionExamen => {
    const materiaLimpia = limpiarTexto(evalData.materia);
    const duracionMin = evalData.duracionUnidad === 'hrs' ? (evalData.duracionMinutos || 0) * 60 : evalData.duracionMinutos;
    return { id: evalData.editandoId || `${idPrefix}-${Date.now()}`, nombre: `${tipo}: ${materiaLimpia}`, tipoPregunta: 'desarrollo', peso: evalData.peso, cantidadPreguntas: 1, contenidosEvaluados: [], nivelBloom: 'comprender', tiempoEstimadoMinutos: duracionMin, tipoActividad: evalData.tipoActividad || undefined, descripcion: evalData.descripcion, cantidadGrupos: evalData.cantidadGrupos ?? undefined, personasPorGrupo: evalData.personasPorGrupo ?? undefined, orden: planificacion.secciones.length, enfoque: evalData.enfoque || undefined, fecha: evalData.fecha };
  };

            const guardarEval = async (ev: EvaluacionFormulario, tipo: string, prefix: string, limpiar: () => void, setEv: (updater: (prev: EvaluacionFormulario) => EvaluacionFormulario) => void) => {
    if (!ev.materia.trim()) { alert(`Completa el nombre de ${tipo}`); return; }

    // === VALIDACIÓN DE INGENIERÍA DE SOFTWARE ===
        // === VALIDACIÓN DE INGENIERÍA DE SOFTWARE ===
    const nuevosErrores: ErroresEvaluacion = {};

    if (ev.materia.trim()) {
      const rMateria = validarContenidoSE(ev.materia);
      if (!rMateria.valido) nuevosErrores.materia = rMateria.error;
    }
    if (ev.tipoActividad.trim()) {
      const rTipo = validarContenidoSE(ev.tipoActividad);
      if (!rTipo.valido) nuevosErrores.tipoActividad = rTipo.error;
    }
    if (ev.enfoque?.trim()) {
      const rEnfoque = validarEnfoque(ev.enfoque);
      if (!rEnfoque.valido) nuevosErrores.enfoque = rEnfoque.error;
    }
    if (ev.descripcion?.trim()) {
      const rDesc = validarContenidoSE(ev.descripcion);
      if (!rDesc.valido) nuevosErrores.descripcion = rDesc.error;
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setEv(prev => ({ ...prev, errores: nuevosErrores }));
      agregarNotificacion('❌ Corrige los errores antes de guardar. Solo se permiten temas de Ingeniería de Software.');
      return;
    }
    // === FIN VALIDACIÓN ===

    const nuevaSeccion = crearSeccion(ev, tipo, prefix);
    
    const estadoActualizado: PlanificacionExamen = {
      ...planificacion,
      secciones: ev.editandoId 
        ? planificacion.secciones.map(sec => sec.id === ev.editandoId ? nuevaSeccion : sec)
        : [...planificacion.secciones, nuevaSeccion]
    };

    // 1. Actualizar en el frontend
    setPlanificacion(estadoActualizado);
    
    // 2. Guardar en la BD
    sincronizarConBD(estadoActualizado);
    
    // 3. Si hay 4 evaluaciones, generar el PDF automáticamente
    if (estadoActualizado.secciones.length === 4 && generarPDF) {
      agregarNotificacion('📄 Generando Plan de Acción...');
      const url = await generarPDF(estadoActualizado.secciones);
      if (url) agregarNotificacion('✅ Plan de Acción generado (4 evaluaciones).');
    }
    
    agregarNotificacion(`✅ ${tipo} "${ev.materia}" guardada.`);
    limpiar(); 
    setVista('planificacion'); 
    setScrollToSections(true);
  };
  
  const guardarEvaluacion1 = () => guardarEval(evaluacion1, 'Evaluación 1', 'eval1', limpiarEvaluacion1, setEvaluacion1);
  const guardarEvaluacion2 = () => guardarEval(evaluacion2, 'Evaluación 2', 'eval2', limpiarEvaluacion2, setEvaluacion2);
  const guardarEvaluacion3 = () => guardarEval(evaluacion3, 'Evaluación 3', 'eval3', limpiarEvaluacion3, setEvaluacion3);
  const guardarEvaluacion4 = () => guardarEval(evaluacion4, 'Evaluación 4', 'eval4', limpiarEvaluacion4, setEvaluacion4);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (vista === 'planificacion') {
          if (evaluacion1.materia.trim()) guardarEvaluacion1();
          if (numEvaluaciones >= 2 && evaluacion2.materia.trim()) guardarEvaluacion2();
          if (numEvaluaciones >= 3 && evaluacion3.materia.trim()) guardarEvaluacion3();
          if (numEvaluaciones >= 4 && evaluacion4.materia.trim()) guardarEvaluacion4();
          agregarNotificacion('💾 Evaluaciones guardadas con Ctrl+S');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vista, numEvaluaciones, evaluacion1, evaluacion2, evaluacion3, evaluacion4]);

  const tabs = [
    { id: 'estadisticas' as const, label: 'Dashboard', icon: BarChart3 }, 
    { id: 'planificacion' as const, label: 'Planificador', icon: ClipboardList }, 
    { id: 'rubrica' as const, label: 'Rúbrica', icon: FileText }, 
    { id: 'estudiantes' as const, label: 'Estudiantes', icon: Users }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <style>{` input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } `}</style>
      <div className="px-4 py-3 border-b border-[#282a3f] flex flex-wrap items-center gap-1 md:gap-2 bg-[#161722]">
        {tabs.map(tab => (<motion.button key={tab.id} onClick={() => setVista(tab.id)} className={`relative flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 font-['Inter'] whitespace-nowrap ${vista === tab.id ? 'text-[#c7d2fe] bg-[#818cf8]/10' : 'text-[#8a8b9e] hover:text-[#b0b0c4] hover:bg-[#1d1e2e]'}`}>{vista === tab.id && (<motion.div layoutId="activeTab" className="absolute inset-0 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />)}<tab.icon className={`relative z-10 w-4 h-4 transition-colors ${vista === tab.id ? 'text-[#818cf8]' : ''}`} /><span className="relative z-10 hidden sm:inline">{tab.label}</span></motion.button>))}
        {/* Botón de configuración junto a la campanita */}
        <div className="ml-auto flex items-center gap-2">
          <motion.button
            onClick={() => setVista('configuracion')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 font-['Inter'] whitespace-nowrap ${vista === 'configuracion' ? 'text-[#c7d2fe] bg-[#818cf8]/10' : 'text-[#8a8b9e] hover:text-[#b0b0c4] hover:bg-[#1d1e2e]'}`}
          >
            {vista === 'configuracion' && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
            )}
            <Settings className="w-4 h-4 relative z-10" />
            <span className="relative z-10 hidden sm:inline">Config</span>
          </motion.button>
          <CampanitaNotificacionesFlotante notificaciones={notificaciones} setNotificaciones={setNotificaciones} campanaActiva={campanaActiva} setCampanaActiva={setCampanaActiva} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#161722]">
        <AnimatePresence mode="wait">
          {vista === 'estadisticas' && (<motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><Dashboard planificacion={planificacion} /></motion.div>)}
          {vista === 'planificacion' && (
            <motion.div key="plan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-5 max-w-5xl mx-auto">
                <EvaluacionesApiladas 
                evaluacion1={evaluacion1} setEvaluacion1={setEvaluacion1} guardarEvaluacion1={guardarEvaluacion1} limpiarEvaluacion1={limpiarEvaluacion1}
                evaluacion2={evaluacion2} setEvaluacion2={setEvaluacion2} guardarEvaluacion2={guardarEvaluacion2} limpiarEvaluacion2={limpiarEvaluacion2}
                evaluacion3={evaluacion3} setEvaluacion3={setEvaluacion3} guardarEvaluacion3={guardarEvaluacion3} limpiarEvaluacion3={limpiarEvaluacion3}
                evaluacion4={evaluacion4} setEvaluacion4={setEvaluacion4} guardarEvaluacion4={guardarEvaluacion4} limpiarEvaluacion4={limpiarEvaluacion4}
                numEvaluaciones={numEvaluaciones} setNumEvaluaciones={setNumEvaluaciones}
                justFilled1={glow1} justFilled2={glow2} justFilled3={glow3} justFilled4={glow4}
                totalEstudiantes={totalEstudiantes}
              />
              <div ref={seccionesGuardadasRef} className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider font-['Inter']">Evaluaciones guardadas ({planificacion.secciones.length})</h2>
                  <div className="flex gap-2">
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
  if (planificacion.secciones.length === 0) {
    alert('No hay evaluaciones guardadas para generar el plan.');
    return;
  }

  setCargandoPdf(true);

  try {

    // Esperar un frame para que React pinte el spinner
    await new Promise(resolve => requestAnimationFrame(resolve));

    let urlFinal: string | null = null;

    // Intentar generar PDF
    if (generarPDF) {
      try {
        urlFinal = await generarPDF(planificacion.secciones);
      } catch (e) {
        console.log("n8n no disponible");
      }
    }

    // Si no hubo PDF, generar HTML visual
    if (!urlFinal) {
      const html = generarPlanVisual();

      if (html) {
        const blob = new Blob([html], {
          type: "text/html;charset=utf-8"
        });

        urlFinal = URL.createObjectURL(blob);
      }
    }

    if (urlFinal) {
      setPdfUrl(urlFinal);

      // Mantener cerrado
      setPdfAbierto(false);

      agregarNotificacion("📄 Plan de Acción generado correctamente.");
    }

  } catch (err) {
    console.error(err);
    agregarNotificacion("❌ Error al generar el Plan de Acción.");
  } finally {
    setCargandoPdf(false);
  }
}}
                        disabled={planificacion.secciones.length === 0 || cargandoPdf} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          planificacion.secciones.length === 0 || cargandoPdf 
                            ? 'bg-[#313248] text-[#8a8b9e] cursor-not-allowed' 
                            : 'bg-[#818cf8] hover:bg-[#6366f1] text-white shadow-md'
                        }`}
                      >
                        {cargandoPdf ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-t-white rounded-full animate-spin"></div>
                            Generando...
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            Generar Plan de Acción
                          </>
                        )}
                      </motion.button>
                  </div>
                </div>
                <DragDropSecciones
                  secciones={planificacion.secciones} onReorder={(nuevoOrden: SeccionExamen[]) => setPlanificacion(prev => ({ ...prev, secciones: nuevoOrden }))} onEdit={cargarSeccionParaEditar} onDelete={(id: string) => { 
  const estadoActualizado = { ...planificacion, secciones: planificacion.secciones.filter(s => s.id !== id) };
  setPlanificacion(estadoActualizado);
  sincronizarConBD(estadoActualizado);
  agregarNotificacion(`🗑️ Evaluación eliminada de la BD.`); 
}}
                  mostrarMenuEnvio={mostrarMenuEnvio} setMostrarMenuEnvio={setMostrarMenuEnvio} scrollToTarjeta={scrollToTarjeta} planificacion={planificacion} 
                  mensajeWhatsApp={mensajeWhatsApp} setMensajeWhatsApp={setMensajeWhatsApp} enviarA={enviarA} setEnviarA={setEnviarA} filtroEnvio={filtroEnvio} setFiltroEnvio={setFiltroEnvio} pdfUrl={pdfUrlLocal}
  pdfAbierto={pdfAbiertoLocal}
  setPdfAbierto={setPdfAbierto}
  setPdfUrl={setPdfUrl}
  agregarNotificacion={agregarNotificacion}
                />
              </div>
              {planificacion.comentariosAgente.length > 0 && (<div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-xl"><h2 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']"><Sparkles className="w-4 h-4 text-[#818cf8]" /> Feedback del agente</h2><div className="space-y-2">{planificacion.comentariosAgente.slice(-3).map(c => (<motion.p key={c.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-base text-[#9090a4] leading-relaxed font-['Inter']">{c.mensaje}</motion.p>))}</div></div>)}
            </motion.div>
          )}
          {vista === 'rubrica' && (<motion.div key="rubrica" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-5xl mx-auto"><RubricaPanel planificacion={planificacion} setPlanificacion={setPlanificacion} /></motion.div>)}
          {vista === 'estudiantes' && (<motion.div key="estudiantes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><EstudiantesPanel /></motion.div>)}
          {vista === 'configuracion' && (
            <motion.div key="configuracion" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto">
              <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#d0d0da] flex items-center gap-3 mb-1">
                    <Settings className="w-6 h-6 text-[#818cf8]" /> Configuración del plan
                  </h2>
                  <p className="text-sm text-[#8a8b9e]">Ajusta los parámetros generales de la planificación.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelBase}>Materia / Asignatura</label>
                    <input
                      type="text"
                      value={planificacion.materia}
                      onChange={(e) => setPlanificacion(prev => ({ ...prev, materia: e.target.value }))}
                      className={inputBase}
                      placeholder="Ej: Ingeniería de Software"
                    />
                  </div>
                  <div>
                    <label className={labelBase}>Fecha del examen</label>
                    <DatePicker
                      value={planificacion.fechaExamen}
                      onChange={(date) => setPlanificacion(prev => ({ ...prev, fechaExamen: date }))}
                    />
                  </div>
                  <div>
                    <label className={labelBase}>Tipo de examen</label>
                    <select
                      value={planificacion.tipoExamen}
                      onChange={(e) => setPlanificacion(prev => ({ ...prev, tipoExamen: e.target.value as any }))}
                      className={inputBase}
                    >
                      <option value="teorico">Teórico</option>
                      <option value="practico">Práctico</option>
                      <option value="mixto">Mixto</option>
                      <option value="proyecto">Proyecto</option>
                      <option value="oral">Oral</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelBase}>Duración total (minutos)</label>
                    <input
                      type="number"
                      value={planificacion.duracionMinutos}
                      onChange={(e) => setPlanificacion(prev => ({ ...prev, duracionMinutos: parseInt(e.target.value) || 0 }))}
                      className={smallInput}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-[#313248]">
                  <button
                    onClick={() => {
                      if (confirm('¿Estás seguro de que deseas restablecer toda la planificación? Esta acción no se puede deshacer.')) {
                        setPlanificacion(prev => ({
                          ...prev,
                          materia: '',
                          fechaExamen: new Date(),
                          tipoExamen: 'mixto',
                          duracionMinutos: 0,
                          secciones: [],
                          rubrica: [],
                          comentariosAgente: []
                        }));
                        limpiarYScroll();
                        agregarNotificacion('🔄 Planificación restablecida por completo.');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-all border border-red-500/20"
                  >
                    <RotateCcw className="w-4 h-4" /> Restablecer todo
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ============================================
// APP PRINCIPAL
// ============================================
export default function PlanificadorExamenes() {
  // ===== INICIO CONEXIÓN BD =====
const [planificacionId, setPlanificacionId] = useState<string | null>(null);
const [guardando, setGuardando] = useState(false);

const guardarPlanificacionEnBD = async () => {
  setGuardando(true);
  try {
    let idMateria = planificacionId; 

    // 1. Si es nuevo, crear la materia automáticamente en la BD
    if (!planificacionId) {
      try {
        const nuevaMateria = await fetch('/api/materias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            nombre: planificacion.materia || 'Nueva Asignatura', 
            codigo: `MAT-${Date.now()}` 
          }),
        }).then(res => res.json());
        idMateria = nuevaMateria.id;
      } catch (e) {
        console.error(e);
      }
    }

    if (!idMateria) {
      alert("Error: No se pudo obtener la materia");
      setGuardando(false);
      return;
    }

    // 2. Preparar datos transformando minúsculas a MAYÚSCULAS (Prisma lo requiere)
    const dataParaDB = {
      materiaId: idMateria,
      estado: planificacion.estado.toUpperCase(),
      tipoExamen: planificacion.tipoExamen.toUpperCase(),
      fechaExamen: planificacion.fechaExamen.toISOString(),
      duracionMinutos: planificacion.duracionMinutos,
      evaluaciones: planificacion.secciones.map((ev, idx) => ({
        nombre: ev.nombre,
        tipoPregunta: ev.tipoPregunta.toUpperCase(),
        nivelBloom: ev.nivelBloom.toUpperCase(),
        peso: ev.peso,
        cantidadPreguntas: ev.cantidadPreguntas,
        contenidosEvaluados: ev.contenidosEvaluados,
        tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos,
        tipoActividad: ev.tipoActividad,
        descripcion: ev.descripcion,
        cantidadGrupos: ev.cantidadGrupos,
        personasPorGrupo: ev.personasPorGrupo,
        orden: ev.orden ?? idx,
        enfoque: ev.enfoque,
        fecha: ev.fecha ? ev.fecha.toISOString() : null,
      })),
      rubrica: planificacion.rubrica.map(crit => ({
        nombre: crit.nombre,
        peso: crit.peso,
        descripcion: crit.descripcion,
        niveles: (crit.niveles || []).map(niv => ({
          nombre: niv.nombre,
          puntaje: niv.puntaje,
          descripcion: niv.descripcion,
        })),
      })),
    };

    // 3. Enviar a la BD (Crear o Actualizar)
    if (planificacionId) {
      await fetch(`/api/planificaciones/${planificacionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataParaDB),
      });
      alert('✅ ¡Planificación actualizada en la Base de Datos!');
    } else {
      const nueva = await fetch('/api/planificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataParaDB),
      }).then(res => res.json());
      
      setPlanificacionId(nueva.id); // Guardar el ID para las próximas veces
      alert('✅ ¡Planificación guardada en la Base de Datos!');
    }
  } catch (error: any) {
    alert('Error al guardar: ' + error.message);
  } finally {
    setGuardando(false);
  }
};
// ===== FIN CONEXIÓN BD =====
  const [agenteExpandido, setAgenteExpandido] = useState(true);
  const [propuestaPendiente, setPropuestaPendiente] = useState<PropuestaEvaluacion | null>(null);
  const [vistaActual, setVistaActual] = useState<'planificacion' | 'rubrica' | 'estadisticas' | 'estudiantes' | 'configuracion'>('estadisticas');
  const [planificacion, setPlanificacion] = useState<PlanificacionExamen>({ id: '1', version: 1, estado: 'borrador', fechaExamen: new Date(), tipoExamen: 'mixto', duracionMinutos: 0, materia: 'Ing Software', secciones: [], rubrica: [], comentariosAgente: [{ id: 'c1', tipo: 'info', mensaje: 'Sube un archivo o escribe en el chat para comenzar la planificación.', timestamp: new Date() }] });
    // CARGAR EVALUACIONES DESDE LA BD AL REFRESCAR
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        // 1. Buscar si ya existe una materia
        const materias = await fetch('/api/materias').then(r => r.json());
        if (materias.length === 0) return; // Primera vez, no hay nada que cargar

        // 2. Buscar la materia "Ing Software" o usar la primera
        const materiaActual = materias.find((m: any) => m.nombre === 'Ing Software') || materias[0];
        
        // 3. Buscar las planificaciones de esa materia
        const planes = await fetch(`/api/planificaciones?materiaId=${materiaActual.id}`).then(r => r.json());
        
        if (planes.length > 0) {
          const ultimoPlan = planes[0];
          
          // 4. Guardar el ID para futuras actualizaciones
          setPlanificacionId(ultimoPlan.id);
          
          // 5. Mapear los datos de la BD al formato del frontend
          setPlanificacion(prev => ({
            ...prev,
            materia: typeof ultimoPlan.materia === 'string' 
              ? ultimoPlan.materia 
              : ultimoPlan.materia?.nombre || prev.materia,
            estado: ultimoPlan.estado.toLowerCase() as any,
            tipoExamen: ultimoPlan.tipoExamen.toLowerCase() as any,
            fechaExamen: new Date(ultimoPlan.fechaExamen),
            duracionMinutos: ultimoPlan.duracionMinutos || 0,
            secciones: (ultimoPlan.evaluaciones || []).map((ev: any) => ({
              id: ev.id,
              nombre: ev.nombre,
              tipoPregunta: ev.tipoPregunta.toLowerCase(),
              peso: ev.peso,
              cantidadPreguntas: ev.cantidadPreguntas || 0,
              contenidosEvaluados: ev.contenidosEvaluados || [],
              nivelBloom: ev.nivelBloom.toLowerCase(),
              tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos,
              tipoActividad: ev.tipoActividad || undefined,
              descripcion: ev.descripcion || '',
              cantidadGrupos: ev.cantidadGrupos ?? undefined,
              personasPorGrupo: ev.personasPorGrupo ?? undefined,
              orden: ev.orden ?? undefined,
              enfoque: ev.enfoque || undefined,
              fecha: ev.fecha ? new Date(ev.fecha) : undefined,
            })),
            rubrica: (ultimoPlan.rubrica || []).map((crit: any) => ({
              id: crit.id,
              nombre: crit.nombre,
              peso: crit.peso,
              descripcion: crit.descripcion || '',
              niveles: (crit.niveles || []).map((niv: any) => ({
                id: niv.id,
                nombre: niv.nombre,
                puntaje: niv.puntaje,
                descripcion: niv.descripcion || '',
              })),
            })),
          }));
        }
      } catch (error) {
        // Es la primera vez que entras, no hay datos en la BD, eso es normal
        console.log("Iniciando sin datos previos en la Base de Datos.");
      }
    };
    
    cargarDatosIniciales();
  }, []); // El array vacío significa: "Ejecutar SOLO al cargar la página"
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfAbierto, setPdfAbierto] = useState(false);

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setAgenteExpandido(prev => !prev); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);

  const agregarNotificacion = (mensaje: string) => { console.log('📢 Notificación:', mensaje); };

  const generarPDF = async (secciones?: SeccionExamen[]): Promise<string | null> => {
    const seccionesParaPDF = secciones || planificacion.secciones;
    if (seccionesParaPDF.length === 0) { alert('No hay evaluaciones guardadas'); return null; }
    try { const response = await fetch('http://localhost:5678/webhook/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'pdf', examenData: { fechaExamen: planificacion.fechaExamen.toISOString(), materia: planificacion.materia || 'Asignatura', tipoExamen: planificacion.tipoExamen || 'mixto', duracionMinutos: planificacion.duracionMinutos || 0, secciones: seccionesParaPDF.map(sec => ({ nombre: sec.nombre, tipoActividad: sec.tipoActividad, tiempoEstimadoMinutos: sec.tiempoEstimadoMinutos, peso: sec.peso, cantidadGrupos: sec.cantidadGrupos, personasPorGrupo: sec.personasPorGrupo, descripcion: sec.descripcion, enfoque: sec.enfoque, nivelBloom: sec.nivelBloom, fecha: sec.fecha })) } }) }); if (!response.ok) throw new Error('Error al generar PDF'); const blob = await response.blob(); const url = URL.createObjectURL(blob); setPdfUrl(url); setPdfAbierto(false); agregarNotificacion('📄 Plan de acción generado correctamente.'); return url; } catch (error) { console.error('Error:', error); alert('Error al generar el plan de acción.'); return null; }
  };

  const aceptarPropuesta = async () => { return { success: true }; };
  const panelDerechoRef = useRef<PanelDerechoHandle | null>(null);

  const [totalEstudiantesGlobal, setTotalEstudiantesGlobal] = useState(8);

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await apiEstudiantes.listar();
        if (Array.isArray(data) && data.length > 0) setTotalEstudiantesGlobal(data.length);
      } catch {}
    };
    cargar();
  }, []);

  return (
    <div className="flex h-screen bg-[#161722] text-[#b0b0c0] overflow-hidden">
      <style>{` @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); * { font-family: 'Inter', system-ui, -apple-system, sans-serif; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #414258; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } body { scrollbar-width: thin; scrollbar-color: #313248 #161722; } `}</style>
      <div className="flex-1 flex overflow-hidden">
                <AgentePanel expandido={agenteExpandido} setExpandido={setAgenteExpandido} planificacion={planificacion} setPlanificacion={setPlanificacion} setPropuestaPendiente={setPropuestaPendiente} onAccept={aceptarPropuesta} setVistaPanel={setVistaActual} setPdfUrl={setPdfUrl} setPdfAbierto={setPdfAbierto} agregarNotificacion={agregarNotificacion} generarPDF={generarPDF} limpiarYScroll={() => { if (panelDerechoRef.current?.limpiarYScroll) panelDerechoRef.current.limpiarYScroll(); }} totalEstudiantes={totalEstudiantesGlobal} />
        <PanelDerecho 
          ref={panelDerechoRef} 
          planificacion={planificacion} 
          setPlanificacion={setPlanificacion} 
          propuestaPendiente={propuestaPendiente} 
          aceptarPropuesta={aceptarPropuesta} 
          setPropuestaPendiente={setPropuestaPendiente} 
          vistaInicial={vistaActual} 
          onCambiarVista={setVistaActual} 
          pdfUrl={pdfUrl} 
          setPdfUrl={setPdfUrl} 
          pdfAbierto={pdfAbierto} 
          setPdfAbierto={setPdfAbierto} 
          generarPDF={generarPDF}
          planificacionId={planificacionId}
          setPlanificacionId={setPlanificacionId}
        />
      </div>
    </div>
  );
}