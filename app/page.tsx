// app/page.tsx - Versión final con streaming, config funcional y mejoras visuales

'use client';

import { useState, useEffect, useRef, useCallback, ChangeEvent, useImperativeHandle, forwardRef, Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
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
  MessageCircleQuestion, Eye as EyeIcon, Speech, Download,
  UserCog, ShieldCheck, RefreshCw, Upload, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

// Agregar esto debajo de los imports de lucide-react
import { apiEstudiantes, apiPlanificaciones } from '@/lib/api'; 
import StreamInput from "@/components/StreamInput";
import StreamTextarea from "@/components/StreamTextarea";
import { validarNombre, validarEmail, validarPassword, validarTelefono, validarCedula } from '@/lib/validacionesUsuario';
import { csvAEstudiantes, plantillaCSV } from '@/lib/csvEstudiantes';
import { calcularAlertas } from '@/lib/alertas';

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
  // Sección/paralelo al que pertenece esta evaluación (A, B, C...). Por defecto 'A'.
  grupoSeccion?: string;
  // PROGRAMADA | REALIZADA | REPROGRAMADA | CANCELADA (se cambia con /api/evaluaciones/:id/estado)
  estado?: string;
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
  // Marca qué campos fueron autocompletados por el agente (IA). Mientras un campo esté marcado
  // como true, se omite la validación estricta de "palabras de la materia" para ese campo,
  // ya que el agente puede redactar con sinónimos que no están en la lista de palabras clave.
  // En cuanto el usuario edita manualmente ese campo, la bandera pasa a false y se vuelve a validar.
  origenAgente?: { materia?: boolean; tipoActividad?: boolean; descripcion?: boolean };
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
    'ci/cd pipeline','mocking','data pipeline','etl',

    // --- Temas frecuentes de la carrera que antes no sumaban puntos ---
    'diagrama de flujo','diagramas de flujo','pseudocodigo','pseudocódigo','poo',
    'orientada a objetos','orientado a objetos','modelado','modelo entidad relacion',
    'modelo entidad relación','entidad relacion','entidad relación','normalizacion','normalización',
    'bpmn','casos de uso','ciclo de vida del software','sdlc','ia agentica','ia agéntica',
    'agentes de ia','redes neuronales','vision por computadora','visión por computadora',
    'chatbot','app movil','app móvil','aplicacion movil','aplicación móvil','android','ios',
    'flutter','kotlin','swift','php','c++','scrum master','product owner','ux','ui',
    'usabilidad','accesibilidad web','scraping','automatizacion','automatización','script',
    'prueba','pruebas','defecto','bug','transaccion','transacción','concurrencia','escalabilidad',
    'requisitos funcionales','arquitectura limpia','control de versiones','repositorio',
    'next.js','node.js','vue.js','react.js','nest.js','nestjs','tailwind','modal','formulario web'
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


// ---------- Validación de temas de Ingeniería de Software ----------
// Reglas:
//  - Se comparan PALABRAS COMPLETAS (antes "fe" bloqueaba "defectos" y "dios" bloqueaba "estudios").
//  - Las palabras técnicas mandan: "API REST para un sistema de ventas" es válido aunque diga "ventas".
//  - Bloqueo duro solo en casos claros: texto sin sentido o tema ajeno SIN ninguna palabra técnica.
//  - En los casos dudosos se devuelve una "advertencia": el profesor puede guardar igual si confirma.
const normalizarSE = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escaparRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Palabra técnica: coincide al inicio de una palabra ("api" → "apis", "patron" → "patrones").
// Las siglas cortas (≤ 3 letras) deben ser la palabra completa, para que "go" no sume en "algoritmo".
const crearRegexClave = (kw: string) => {
  const t = normalizarSE(kw).trim().split(/\s+/).map(escaparRegExp).join('(?:s|es)?\\s+');
  return new RegExp(kw.length <= 3 ? `(^|[^a-z0-9])${t}s?(?![a-z0-9])` : `(^|[^a-z0-9])${t}`);
};
// Término ajeno: palabra completa, con plural opcional ("venta" → "ventas", pero NO "ventana")
const crearRegexBloqueado = (term: string) => new RegExp(`(^|[^a-z0-9])${escaparRegExp(normalizarSE(term))}(s|es)?(?![a-z0-9])`);
const REGEX_SE = {
  fuerte: KEYWORDS_SE.fuerte.map(crearRegexClave),
  medio: KEYWORDS_SE.medio.map(crearRegexClave),
  debil: KEYWORDS_SE.debil.map(crearRegexClave),
};
// "estado" y "derecho" también son palabras técnicas/normales ("gestión de estado", "panel derecho"): no se bloquean
const REGEX_BLOQUEADOS = TERMINOS_BLOQUEADOS
  .filter(t => !['estado', 'derecho'].includes(t))
  .map(t => ({ termino: t, re: crearRegexBloqueado(t) }));

const TEMAS_VALIDOS = 'arquitectura, patrones de diseño, metodologías ágiles, testing, DevOps, CI/CD, bases de datos, APIs, seguridad, calidad de código, lenguajes de programación, diagramas, IA aplicada, etc.';

function validarContenidoSE(texto: string): { valido: boolean; error: string; puntuacion: number; advertencia?: string } {
  const limpio = (texto || '').trim();
  if (limpio.length < 3) {
    return { valido: false, error: 'Escribe al menos 3 caracteres.', puntuacion: 0 };
  }
  // Solo números o símbolos
  if (!/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(limpio)) {
    return { valido: false, error: 'No se permiten solo números o símbolos. Escribe un tema de Ingeniería de Software.', puntuacion: 0 };
  }
  // Texto sin sentido: una letra repetida muchas veces ("aaaaaa") o una palabra larga sin vocales ("qwrtzxv")
  if (/(.)\1{4,}/.test(limpio) || /[b-df-hj-np-tv-z]{6,}/i.test(normalizarSE(limpio))) {
    return { valido: false, error: 'El texto no parece un tema válido. Revisa lo que escribiste.', puntuacion: 0 };
  }

  const t = normalizarSE(limpio);
  let puntuacion = 0;
  for (const re of REGEX_SE.fuerte) if (re.test(t)) puntuacion += 3;
  for (const re of REGEX_SE.medio) if (re.test(t)) puntuacion += 2;
  for (const re of REGEX_SE.debil) if (re.test(t)) puntuacion += 1;

  // Con suficientes palabras técnicas es válido, mencione lo que mencione (dominio del proyecto: ventas, hospital, banco...)
  if (puntuacion >= 3) return { valido: true, error: '', puntuacion };

  const ajeno = REGEX_BLOQUEADOS.find(b => b.re.test(t));
  // Una palabra técnica clara y nada ajeno también es válido ("Next.js con Prisma", "Ventana modal en la interfaz")
  if (puntuacion >= 2 && !ajeno) return { valido: true, error: '', puntuacion };
  // Tema claramente ajeno y sin ninguna palabra técnica → se bloquea
  if (ajeno && puntuacion < 2) {
    return {
      valido: false,
      error: `"${ajeno.termino}" no parece un tema de Ingeniería de Software. Si es el dominio de un proyecto, agrega el enfoque técnico (ej: "Sistema de ${ajeno.termino} con API REST"). Temas válidos: ${TEMAS_VALIDOS}`,
      puntuacion,
    };
  }

  // Caso dudoso: se permite guardar si el profesor confirma
  return {
    valido: true,
    error: '',
    puntuacion,
    advertencia: ajeno
      ? `menciona "${ajeno.termino}" y tiene pocas palabras técnicas`
      : 'no tiene términos reconocidos de Ingeniería de Software',
  };
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

function Tooltip({ text, children, lado = 'arriba', alinear = 'centro' }: { text: string; children: React.ReactNode; lado?: 'arriba' | 'abajo'; alinear?: 'centro' | 'derecha' }) {
  const vertical = lado === 'abajo' ? 'top-full mt-2' : 'bottom-full mb-2';
  const horizontal = alinear === 'derecha' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div role="tooltip" className={`absolute ${vertical} ${horizontal} px-2 py-1 bg-[#0d0e14] text-[#d8d8e2] text-[10px] rounded-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-[#313248]`}>{text}</div>
    </div>
  );
}

// Escapa HTML antes de usar dangerouslySetInnerHTML (evita que el texto del agente o del usuario inyecte etiquetas)
function escaparHTML(texto: string): string {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Casilla (1 a 4) de una evaluación propuesta por el agente: usa su "tipo" ("Evaluación 3" → 3) o su posición
function casillaDeEvaluacion(p: any, idx: number): number {
  const m = String(p?.tipo ?? '').match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : idx + 1;
  return Math.min(4, Math.max(1, Number.isFinite(n) ? n : idx + 1));
}

// Une una edición parcial del agente (p. ej. solo la Evaluación 2) con la propuesta que ya estaba en pantalla
// Solo se une si el profesor pidió CAMBIAR algo; si pidió crear evaluaciones nuevas, la propuesta se reemplaza.
const PIDE_EDITAR = /\b(cambia\w*|edita\w*|modifica\w*|ajusta\w*|corrige\w*|actualiza\w*|reemplaza\w*|b[aá]ja\w*|s[uú]be\w*|aumenta\w*|reduce\w*|quita\w*|agrega\w*|añade\w*)\b/i;
function unirPropuesta(anterior: any, nueva: any, mensaje = ''): any {
  const nuevas = (nueva?.evaluaciones || []).slice(0, 4);
  const previas = anterior?.evaluaciones || [];
  const esParcial = previas.length > 0 && nuevas.length < previas.length && PIDE_EDITAR.test(mensaje) && nuevas.every((p: any) => /\d/.test(String(p?.tipo ?? '')));
  if (!esParcial) return { ...nueva, evaluaciones: nuevas };
  const porCasilla = new Map<number, any>();
  previas.forEach((p: any, i: number) => porCasilla.set(casillaDeEvaluacion(p, i), { ...p, tipo: p.tipo || `Evaluación ${i + 1}` }));
  nuevas.forEach((p: any, i: number) => porCasilla.set(casillaDeEvaluacion(p, i), p));
  return { ...anterior, ...nueva, evaluaciones: [...porCasilla.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p) };
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
  if (!text) return ''; const t = escaparHTML(limpiarBloqueJSON(text));
  return t
    .replace(/^[-*] (.*)$/gm, '<div class="flex gap-2 ml-2 my-0.5"><span class="text-[#818cf8]">•</span><span>$1</span></div>')
    .replace(/^### (.*)$/gm, '<h4 class="text-[#c0c0d0] font-semibold mt-4 mb-1">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 class="text-[#d0d0d8] font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.*)$/gm, '<h2 class="text-[#e0e0e8] font-bold mt-5 mb-3">$1</h2>')
    .replace(/^---$/gm, '<hr class="border-[#313248] my-4"/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#e0e0e8] font-semibold">$1</strong>')
    .replace(/(<\/(?:div|h2|h3|h4)>|<hr[^>]*\/>)\n/g, '$1')
    .replace(/\n/g, '<br/>');
};

// TypewriterText con soporte para auto-scroll
function TypewriterText({ text, onComplete, onUpdate }: { text: string; onComplete?: () => void; onUpdate?: () => void }) {
  const [d, setD] = useState(''); const [c, setC] = useState(0); const [i, setI] = useState(false); const r = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete); const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onCompleteRef.current = onComplete; onUpdateRef.current = onUpdate; });
  useEffect(() => {
    if (!text) { onCompleteRef.current?.(); return; }
    const t = limpiarBloqueJSON(text);
    // Velocidad constante en tiempo: textos largos avanzan varios caracteres por paso (~2 s máximo)
    const paso = Math.max(1, Math.ceil(t.length / 120));
    setD(''); setC(0); setI(false);
    let actual = 0; let terminado = false;
    r.current = setInterval(() => {
      actual = Math.min(t.length, actual + paso);
      setC(actual);
      onUpdateRef.current?.();
      if (actual >= t.length && !terminado) { terminado = true; if (r.current) clearInterval(r.current); setI(true); setTimeout(() => onCompleteRef.current?.(), 0); }
    }, 16);
    return () => { if (r.current) clearInterval(r.current); };
  }, [text]);
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
// DASHBOARD POR ROL
//  - USUARIO (profesor): solo ve su propio dashboard.
//  - ADMIN: su dashboard + vista de solo lectura del trabajo de TODOS los profesores.
//  - SUPERADMIN: lo anterior + resumen de cuentas del sistema.
// ============================================
const ESTILO_ROL: Record<string, string> = {
  SUPERADMIN: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  ADMIN: 'bg-[#818cf8]/10 text-[#a5b4fc] border-[#818cf8]/30',
  USUARIO: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};

// ============================================
// CONFIGURACIÓN DEL SISTEMA (valores que usa el navegador)
// ============================================
interface ConfigChat { activo: boolean; mensajeInactivo: string; webhookUrl: string; modelo: string; temperatura: number; maxTokens: number; ventanaMemoria: number; maxCaracteresMensaje: number; timeoutSegundos: number; instruccionesExtra: string }
interface ConfigCliente { chat: ConfigChat; planificador: { maxGrupos: number; maxPersonasPorGrupo: number } }
interface ConfigCompleta extends ConfigCliente { acceso: { registroAbierto: boolean; diasPapelera: number } }
const CONFIG_CLIENTE_DEFECTO: ConfigCliente = {
  chat: { activo: true, mensajeInactivo: 'El asistente está desactivado temporalmente. Inténtalo de nuevo más tarde.', webhookUrl: '', modelo: '', temperatura: 0.4, maxTokens: 0, ventanaMemoria: 9, maxCaracteresMensaje: 2000, timeoutSegundos: 60, instruccionesExtra: '' },
  planificador: { maxGrupos: 20, maxPersonasPorGrupo: 300 },
};
const CONFIG_COMPLETA_DEFECTO: ConfigCompleta = { ...CONFIG_CLIENTE_DEFECTO, acceso: { registroAbierto: true, diasPapelera: 30 } };
// Límites del planificador: se actualizan al cargar la configuración (los formularios los leen al dibujarse)
const LIMITES = { grupos: 20, personas: 300 };
function aplicarConfig(c: ConfigCliente) { LIMITES.grupos = c.planificador.maxGrupos; LIMITES.personas = c.planificador.maxPersonasPorGrupo; }

// ============================================
// CAMBIO OBLIGATORIO DE CONTRASEÑA (cuenta con clave temporal)
// ============================================
function CambioPasswordObligatorio({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campo = 'w-full bg-[#1b1c2b] border border-[#313248] rounded-xl px-3 py-3 text-sm text-[#e0e0ec] placeholder-[#5f6074] focus:outline-none focus:border-[#818cf8] focus:ring-2 focus:ring-[#818cf8]/20 transition-all';
  const etiqueta = 'text-[11px] font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5';

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!actual) return setError('Escribe la contraseña temporal que te entregaron.');
    const p = validarPassword(nueva); if (p) return setError(p);
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden.');
    if (nueva === actual) return setError('La nueva contraseña debe ser distinta a la temporal.');
    setGuardando(true);
    try {
      const r = await fetch('/api/perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: usuario.nombre, email: usuario.email, passwordActual: actual, passwordNueva: nueva }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo cambiar la contraseña.'); setGuardando(false); return; }
      window.location.reload(); // entra al sistema con la contraseña nueva
    } catch { setError('No se pudo conectar con el servidor.'); setGuardando(false); }
  };

  return (
    <div className="min-h-screen bg-[#12131d] flex items-center justify-center p-5">
      <motion.form onSubmit={guardar} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-[#1d1e2e] border border-[#313248] rounded-2xl p-8 shadow-2xl space-y-5" noValidate>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3"><ShieldCheck className="w-7 h-7 text-amber-300" /></div>
          <h1 className="text-xl font-semibold text-[#e0e0ec]">Elige tu nueva contraseña</h1>
          <p className="text-sm text-[#8a8b9e] mt-1">Hola, {usuario.nombre}. Entraste con una contraseña temporal; por seguridad debes cambiarla para continuar.</p>
        </div>
        <div><label className={etiqueta}>Contraseña temporal</label><input type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)} className={campo} autoComplete="current-password" autoFocus /></div>
        <div><label className={etiqueta}>Nueva contraseña</label><input type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 8, con letras y números" className={campo} autoComplete="new-password" /></div>
        <div><label className={etiqueta}>Confirmar nueva contraseña</label><input type={ver ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={campo} autoComplete="new-password" /></div>
        <label className="flex items-center gap-2 text-xs text-[#9a9bb0] cursor-pointer"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="accent-[#818cf8]" />Mostrar contraseñas</label>
        {error && <p className="text-red-300 text-xs flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></p>}
        <button type="submit" disabled={guardando} className="w-full py-3 bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white font-semibold text-sm rounded-xl shadow-lg disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar y entrar'}</button>
        <button type="button" onClick={onLogout} className="w-full text-xs text-[#8a8b9e] hover:text-[#b0b0c4]">Cerrar sesión</button>
      </motion.form>
    </div>
  );
}

// Ancho de la pantalla (se actualiza al girar el celular o cambiar el tamaño de la ventana)
function useAnchoPantalla(): number {
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
const TEMA_ROL: Record<'SUPERADMIN' | 'ADMIN' | 'USUARIO', { etiqueta: string; descripcion: string; barra: string; fondo: string; texto: string; borde: string }> = {
  SUPERADMIN: { etiqueta: 'MODO SUPERADMIN', descripcion: 'Administración del sistema', barra: 'from-fuchsia-600 via-fuchsia-500 to-purple-500', fondo: 'bg-fuchsia-500/10', texto: 'text-fuchsia-300', borde: 'border-fuchsia-500/30' },
  ADMIN: { etiqueta: 'MODO ADMINISTRADOR', descripcion: 'Supervisión de profesores', barra: 'from-indigo-600 via-indigo-500 to-blue-500', fondo: 'bg-indigo-500/10', texto: 'text-indigo-300', borde: 'border-indigo-500/30' },
  USUARIO: { etiqueta: 'MODO PROFESOR', descripcion: 'Tu espacio de trabajo', barra: 'from-emerald-600 via-emerald-500 to-teal-500', fondo: 'bg-emerald-500/10', texto: 'text-emerald-300', borde: 'border-emerald-500/30' },
};
const COLOR_TEXTO_ROL: Record<string, string> = { SUPERADMIN: 'text-fuchsia-300', ADMIN: 'text-indigo-300', USUARIO: 'text-emerald-300' };

function BandaRol({ rol }: { rol: 'SUPERADMIN' | 'ADMIN' | 'USUARIO' }) {
  const tema = TEMA_ROL[rol];
  return (
    <div className={`flex-shrink-0 relative flex items-center justify-center gap-2 h-6 ${tema.fondo} border-b ${tema.borde}`}>
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${tema.barra}`} />
      <span className={`text-[10px] font-bold tracking-[0.2em] ${tema.texto}`}>{tema.etiqueta}</span>
      <span className="text-[10px] text-[#8a8b9e] hidden sm:inline">· {tema.descripcion}</span>
    </div>
  );
}

function DashboardPorRol({ planificacion, usuario, onMiTrabajo }: { planificacion: PlanificacionExamen; usuario?: UsuarioSesion | null; onMiTrabajo?: () => void }) {
  const [modo, setModo] = useState<'mio' | 'equipo'>(usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN' ? 'equipo' : 'mio');
  const esSuper = usuario?.rol === 'SUPERADMIN';
  const esAdminPlus = esSuper || usuario?.rol === 'ADMIN';
  if (!esAdminPlus) return <Dashboard planificacion={planificacion} />;

  const opciones = [
    { id: 'mio' as const, label: 'Mi trabajo', icon: BarChart3 },
    { id: 'equipo' as const, label: esSuper ? 'Todo el sistema' : 'Todos los profesores', icon: UsersIcon },
  ];
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 p-1 bg-[#161722] border border-[#282a3f] rounded-xl">
        {opciones.map(o => (
          <button key={o.id} onClick={() => { setModo(o.id); if (o.id === 'mio' && esSuper) onMiTrabajo?.(); }} className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modo === o.id ? 'text-[#c7d2fe]' : 'text-[#8a8b9e] hover:text-[#b0b0c4]'}`}>
            {modo === o.id && <motion.div layoutId="pill-dashboard-modo" className="absolute inset-0 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-lg" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <o.icon className="relative z-10 w-4 h-4" /><span className="relative z-10">{o.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={modo} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {modo === 'mio' ? <Dashboard planificacion={planificacion} /> : <DashboardEquipo esSuper={esSuper} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DashboardEquipo({ esSuper }: { esSuper: boolean }) {
  interface EvalResumen { id: string; grupoSeccion: string; descripcion: string | null; enfoque: string | null; nivelBloom: string | null; tiempoEstimadoMinutos: number | null; cantidadGrupos: number | null; personasPorGrupo: number | null; nombre: string; peso: number | null; tipoActividad: string | null; fecha: string | null }
  interface ObsResumen { id: string; autorNombre: string; evaluacionNombre: string | null; mensaje: string; leida: boolean; createdAt: string }
  interface MateriaResumen { id: string; nombre: string; fechaExamen: string | null; evaluaciones: EvalResumen[]; observaciones: ObsResumen[] }
  interface FilaResumen { id: string; nombre: string; email: string; rol: string; activo: boolean; pendiente: boolean; materias: MateriaResumen[]; totalMaterias: number; totalEvaluaciones: number; totalEstudiantes: number; ultimaActividad: string | null }
  interface Resumen {
    totales: { cuentas: { SUPERADMIN: number; ADMIN: number; USUARIO: number; desactivadas: number; pendientes: number }; materias: number; evaluaciones: number; estudiantes: number };
    usuarios: FilaResumen[];
    sinDueno: { materias: number; evaluaciones: number; estudiantes: number };
  }
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [confirmandoEval, setConfirmandoEval] = useState<string | null>(null);

  // ----- Supervisión: contenido completo de las evaluaciones, edición (solo superadmin) y estudiantes de cada profesor -----
  interface EstudianteSup { id: string; nombre: string; email: string; telefono: string | null; grupo: string; estado: string }
  const [evalAbierta, setEvalAbierta] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<{ id: string; campos: Record<string, string>; error: string; guardando: boolean } | null>(null);
  const [estudiantesDe, setEstudiantesDe] = useState<Record<string, EstudianteSup[] | 'cargando' | 'error'>>({});
  const [confirmandoEst, setConfirmandoEst] = useState<string | null>(null);
  const [edicionEst, setEdicionEst] = useState<{ id: string; duenoId: string; campos: Record<string, string>; error: string; guardando: boolean } | null>(null);
  const [mostrarAlertas, setMostrarAlertas] = useState(!esSuper); // el superadmin la ve cerrada al entrar; el admin, abierta como antes
  const ETIQUETA_ALERTA: Record<string, string> = { sinMaterias: 'SIN MATERIAS', peso: 'PESOS', choque: 'FECHAS', proxima: 'PRÓXIMA', observacion: 'OBSERVACIÓN' };

  const aFechaInput = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const cambiarCampo = (k: string, v: string) => setEdicion(prev => (prev ? { ...prev, campos: { ...prev.campos, [k]: v } } : prev));
  const iniciarEdicion = (ev: EvalResumen) => setEdicion({
    id: ev.id, error: '', guardando: false,
    campos: {
      nombre: ev.nombre, peso: ev.peso != null ? String(ev.peso) : '', fecha: aFechaInput(ev.fecha), tipoActividad: ev.tipoActividad || '', enfoque: ev.enfoque || '',
      tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos != null ? String(ev.tiempoEstimadoMinutos) : '', cantidadGrupos: ev.cantidadGrupos != null ? String(ev.cantidadGrupos) : '',
      personasPorGrupo: ev.personasPorGrupo != null ? String(ev.personasPorGrupo) : '', grupoSeccion: ev.grupoSeccion || 'A', descripcion: ev.descripcion || '',
    },
  });
  const guardarEdicion = async () => {
    if (!edicion) return;
    const c = edicion.campos;
    const numero = (v: string) => (v === '' ? null : Number(v));
    setEdicion({ ...edicion, guardando: true, error: '' });
    try {
      const r = await fetch(`/api/evaluaciones/${edicion.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: c.nombre, peso: numero(c.peso), fecha: c.fecha === '' ? null : new Date(c.fecha + 'T00:00:00').toISOString(), tipoActividad: c.tipoActividad, enfoque: c.enfoque,
          tiempoEstimadoMinutos: numero(c.tiempoEstimadoMinutos), cantidadGrupos: numero(c.cantidadGrupos), personasPorGrupo: numero(c.personasPorGrupo), grupoSeccion: c.grupoSeccion, descripcion: c.descripcion,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setEdicion({ ...edicion, guardando: false, error: d.error || 'No se pudo guardar.' }); return; }
      setEdicion(null);
      await cargar();
    } catch { setEdicion({ ...edicion, guardando: false, error: 'No se pudo conectar con el servidor.' }); }
  };

  const cargarEstudiantes = async (duenoId: string) => {
    setEstudiantesDe(prev => ({ ...prev, [duenoId]: 'cargando' }));
    try {
      const r = await fetch(`/api/estudiantes?todos=1&duenoId=${duenoId}`);
      if (!r.ok) throw new Error('error');
      const lista = await r.json();
      setEstudiantesDe(prev => ({ ...prev, [duenoId]: lista }));
    } catch { setEstudiantesDe(prev => ({ ...prev, [duenoId]: 'error' })); }
  };
  const eliminarEstudiante = async (est: EstudianteSup, duenoId: string) => {
    if (confirmandoEst !== est.id) { setConfirmandoEst(est.id); setTimeout(() => setConfirmandoEst(prev => (prev === est.id ? null : prev)), 3000); return; }
    setConfirmandoEst(null);
    const r = await fetch(`/api/estudiantes?id=${est.id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'No se pudo eliminar al estudiante.'); return; }
    await cargarEstudiantes(duenoId);
    await cargar();
  };
  const guardarEstudiante = async () => {
    if (!edicionEst) return;
    const c = edicionEst.campos;
    setEdicionEst({ ...edicionEst, guardando: true, error: '' });
    try {
      const r = await fetch('/api/estudiantes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: edicionEst.id, nombre: c.nombre, email: c.email, telefono: c.telefono, grupo: c.grupo }) });
      const d = await r.json();
      if (!r.ok) { setEdicionEst({ ...edicionEst, guardando: false, error: d.error || 'No se pudo guardar.' }); return; }
      const dueno = edicionEst.duenoId;
      setEdicionEst(null);
      await cargarEstudiantes(dueno);
    } catch { setEdicionEst({ ...edicionEst, guardando: false, error: 'No se pudo conectar con el servidor.' }); }
  };
  const alertas = datos ? calcularAlertas(datos.usuarios as any) : [];
  // Observaciones: el admin escribe una nota sobre una evaluación (o sobre la materia) y el profesor la recibe
  const [composer, setComposer] = useState<{ materiaId: string; evaluacionNombre: string | null } | null>(null);
  const [textoObs, setTextoObs] = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);
  const [errorObs, setErrorObs] = useState('');
  const abrirComposer = (materiaId: string, evaluacionNombre: string | null) => { setComposer({ materiaId, evaluacionNombre }); setTextoObs(''); setErrorObs(''); };
  const enviarObservacion = async () => {
    if (!composer) return;
    if (textoObs.trim().length < 3) { setErrorObs('Escribe al menos 3 caracteres.'); return; }
    setEnviandoObs(true); setErrorObs('');
    try {
      const r = await fetch('/api/observaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId: composer.materiaId, evaluacionNombre: composer.evaluacionNombre, mensaje: textoObs }) });
      const d = await r.json();
      if (!r.ok) { setErrorObs(d.error || 'No se pudo enviar la observación.'); return; }
      setComposer(null); setTextoObs('');
      await cargar();
    } catch { setErrorObs('No se pudo conectar con el servidor.'); }
    finally { setEnviandoObs(false); }
  };
  const esComposer = (materiaId: string, nombre: string | null) => composer?.materiaId === materiaId && composer.evaluacionNombre === nombre;
  const formularioObservacion = (
    <div className="mt-1.5 mb-2 bg-[#191a26] border border-yellow-500/30 rounded-lg p-3 space-y-2">
      <textarea value={textoObs} onChange={(e) => setTextoObs(e.target.value)} maxLength={500} rows={3} placeholder="Escribe tu observación para el profesor..." className="w-full bg-[#272839] border border-[#313248] rounded-lg px-3 py-2 text-xs text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-yellow-500/50" />
      {errorObs && <p className="text-red-400 text-[11px]">{errorObs}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#6a6b7e]">{textoObs.length}/500</span>
        <div className="flex gap-2">
          <button onClick={() => setComposer(null)} className="px-3 py-1.5 text-xs text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-lg">Cancelar</button>
          <button onClick={enviarObservacion} disabled={enviandoObs} className="px-3 py-1.5 text-xs font-semibold text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 disabled:opacity-60">{enviandoObs ? 'Enviando...' : 'Enviar observación'}</button>
        </div>
      </div>
    </div>
  );

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/resumen');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar el resumen.');
      setDatos(d);
    } catch (e: any) { setError(e.message || 'No se pudo cargar el resumen.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString() : '—');

  // Moderación: elimina una evaluación (confirmación en dos pasos). Queda registrada en la Actividad.
  const eliminarEvaluacion = async (idEval: string) => {
    if (confirmandoEval !== idEval) { setConfirmandoEval(idEval); setTimeout(() => setConfirmandoEval(prev => (prev === idEval ? null : prev)), 3000); return; }
    setConfirmandoEval(null);
    const r = await fetch(`/api/evaluaciones/${idEval}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || 'No se pudo eliminar la evaluación.'); return; }
    await cargar();
  };
  const filas = (datos?.usuarios || []).filter(u => {
    const q = busqueda.trim().toLowerCase();
    return !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const tarjetas = datos ? [
    { titulo: 'Profesores', valor: datos.totales.cuentas.USUARIO, icono: UsersIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10', borde: 'border-emerald-500/20' },
    { titulo: 'Materias', valor: datos.totales.materias, icono: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', borde: 'border-blue-500/20' },
    { titulo: 'Evaluaciones', valor: datos.totales.evaluaciones, icono: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', borde: 'border-amber-500/20' },
    { titulo: 'Estudiantes', valor: datos.totales.estudiantes, icono: GraduationCap, color: 'text-purple-400', bg: 'bg-purple-500/10', borde: 'border-purple-500/20' },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#d0d0da] flex items-center gap-3"><UsersIcon className="w-6 h-6 text-[#818cf8]" />{esSuper ? 'Todo el sistema' : 'Todos los profesores'}</h2>
          <p className="text-sm text-[#8a8b9e] mt-1">{esSuper ? 'Control total: revisa, edita y elimina el trabajo y los estudiantes de cualquier profesor.' : 'Revisa el trabajo y los estudiantes de cada profesor. Puedes eliminarlos como moderación; editarlos es del superadmin.'}</p>
        </div>
        <button onClick={cargar} disabled={cargando} className="flex items-center gap-2 px-3 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl hover:border-[#818cf8]/40 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />Actualizar
        </button>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {cargando && !datos && <div className="p-8 text-center text-sm text-[#8a8b9e]">Cargando...</div>}

      <AnimatePresence>
        {edicionEst && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setEdicionEst(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-2xl space-y-3">
              <h3 className="text-base font-semibold text-[#e0e0ec]">Editar estudiante</h3>
              {([['nombre', 'Nombre completo'], ['email', 'Correo'], ['telefono', 'Teléfono']] as const).map(([k, et]) => (
                <input key={k} value={edicionEst.campos[k]} onChange={(e) => setEdicionEst({ ...edicionEst, campos: { ...edicionEst.campos, [k]: e.target.value } })} placeholder={et} className="w-full bg-[#272839] border border-[#313248] rounded-xl px-3 py-2.5 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8]" />
              ))}
              <select value={edicionEst.campos.grupo} onChange={(e) => setEdicionEst({ ...edicionEst, campos: { ...edicionEst.campos, grupo: e.target.value } })} className="w-full bg-[#272839] border border-[#313248] rounded-xl px-3 py-2.5 text-sm text-[#e0e0ec]">
                {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>Grupo {g}</option>)}
              </select>
              {edicionEst.error && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{edicionEst.error}</span></p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEdicionEst(null)} className="flex-1 py-2.5 text-sm text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-xl">Cancelar</button>
                <button onClick={guardarEstudiante} disabled={edicionEst.guardando} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-xl disabled:opacity-60">{edicionEst.guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {datos && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tarjetas.map((t, i) => (
              <motion.div key={t.titulo} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }} className={`bg-[#1f2035] border ${t.borde} rounded-xl p-4 shadow-lg`}>
                <div className="flex items-center justify-between"><div><p className="text-xs text-[#8a8b9e]">{t.titulo}</p><p className="text-2xl font-bold text-[#d0d0da] mt-1">{t.valor}</p></div><div className={`${t.bg} p-2.5 rounded-lg`}><t.icono className={`w-5 h-5 ${t.color}`} /></div></div>
              </motion.div>
            ))}
          </div>

          {esSuper && (
            <div className="bg-[#1f2035] border border-[#313248] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2 mb-4"><ShieldCheck className="w-4 h-4 text-[#818cf8]" />Cuentas del sistema</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {([['SUPERADMIN', datos.totales.cuentas.SUPERADMIN], ['ADMIN', datos.totales.cuentas.ADMIN], ['USUARIO', datos.totales.cuentas.USUARIO]] as [string, number][]).map(([rol, n]) => (
                  <div key={rol} className="bg-[#191a26] border border-[#282a3f] rounded-lg p-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[rol]}`}>{rol}</span><p className="text-xl font-bold text-[#d0d0da] mt-2">{n}</p></div>
                ))}
                <div className="bg-[#191a26] border border-[#282a3f] rounded-lg p-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADAS</span><p className="text-xl font-bold text-[#d0d0da] mt-2">{datos.totales.cuentas.desactivadas}</p></div>
                <div className="bg-[#191a26] border border-[#282a3f] rounded-lg p-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">PENDIENTES</span><p className="text-xl font-bold text-[#d0d0da] mt-2">{datos.totales.cuentas.pendientes}</p></div>
              </div>
            </div>
          )}

          {alertas.length > 0 && (
            <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl overflow-hidden">
              <button onClick={() => setMostrarAlertas(v => !v)} className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[#232438] transition-colors">
                <AlertCircle className="w-4 h-4 text-amber-300" />
                <span className="text-sm font-semibold text-[#d0d0da]">Atención y próximas evaluaciones</span>
                <span className="text-xs text-[#8a8b9e]">{alertas.filter(a => a.tipo !== 'proxima').length} por revisar · {alertas.filter(a => a.tipo === 'proxima').length} próximas (14 días)</span>
                <span className="ml-auto text-[#8a8b9e]">{mostrarAlertas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
              </button>
              {mostrarAlertas && (
                <div className="border-t border-[#313248] divide-y divide-[#313248] max-h-72 overflow-y-auto">
                  {alertas.slice(0, 40).map((a, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                      <span className={`mt-0.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${a.gravedad === 'alta' ? 'bg-red-500/10 text-red-300 border-red-500/30' : a.gravedad === 'media' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'}`}>{ETIQUETA_ALERTA[a.tipo]}</span>
                      <span className="flex-1 text-[#c0c0cc] break-words"><strong className="text-[#d0d0da]">{a.usuario}</strong> · {limpiarTexto(a.texto)}</span>
                      {a.fecha && <span className="text-[#8a8b9e] whitespace-nowrap">{new Date(a.fecha).toLocaleDateString()}</span>}
                    </div>
                  ))}
                  {alertas.length > 40 && <div className="px-4 py-2 text-[11px] text-[#6a6b7e]">... y {alertas.length - 40} más.</div>}
                </div>
              )}
            </div>
          )}

          <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-[#313248] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#6a6b7e]" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo..." className="flex-1 bg-transparent text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none" />
              <span className="text-xs text-[#8a8b9e]">{filas.length} cuenta(s)</span>
            </div>
            {filas.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#8a8b9e]">No hay cuentas que coincidan.</div>
            ) : (
              <div className="divide-y divide-[#313248]">
                {filas.map(u => {
                  const expandido = abierto === u.id;
                  return (
                    <div key={u.id}>
                      <button onClick={() => setAbierto(expandido ? null : u.id)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-[#232438] transition-colors">
                        <div className="w-9 h-9 rounded-full bg-[#272839] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-[#818cf8]" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#d0d0da] truncate">{u.nombre}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[u.rol] || ''}`}>{u.rol}</span>
                            {u.pendiente && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">PENDIENTE</span>}
                            {!u.activo && !u.pendiente && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADA</span>}
                          </div>
                          <div className="text-xs text-[#8a8b9e] truncate">{u.email}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-5 text-xs text-[#b0b0c4]">
                          <span title="Materias"><BookOpen className="w-3.5 h-3.5 inline mr-1 text-blue-400" />{u.totalMaterias}</span>
                          <span title="Evaluaciones"><FileText className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{u.totalEvaluaciones}</span>
                          <span title="Estudiantes"><GraduationCap className="w-3.5 h-3.5 inline mr-1 text-purple-400" />{u.totalEstudiantes}</span>
                          <span className="text-[#8a8b9e] w-24 text-right" title="Última actividad">{fecha(u.ultimaActividad)}</span>
                        </div>
                        {expandido ? <ChevronUp className="w-4 h-4 text-[#8a8b9e] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#8a8b9e] flex-shrink-0" />}
                      </button>
                      <AnimatePresence initial={false}>
                        {expandido && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-[#191a26]">
                            <div className="p-4 space-y-4">
                              <p className="sm:hidden text-xs text-[#8a8b9e]">{u.totalMaterias} materia(s) · {u.totalEvaluaciones} evaluación(es) · {u.totalEstudiantes} estudiante(s)</p>
                              <div>
                                <button onClick={() => { const est = estudiantesDe[u.id]; if (!est || est === 'error') cargarEstudiantes(u.id); else setEstudiantesDe(prev => { const copia = { ...prev }; delete copia[u.id]; return copia; }); }} className="flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200"><GraduationCap className="w-4 h-4" />{estudiantesDe[u.id] && estudiantesDe[u.id] !== 'error' ? 'Ocultar estudiantes' : `Ver estudiantes (${u.totalEstudiantes})`}</button>
                                {estudiantesDe[u.id] === 'cargando' && <p className="text-xs text-[#8a8b9e] mt-2">Cargando...</p>}
                                {estudiantesDe[u.id] === 'error' && <p className="text-xs text-red-400 mt-2">No se pudo cargar la lista.</p>}
                                {Array.isArray(estudiantesDe[u.id]) && (
                                  <div className="mt-2 space-y-1.5">
                                    {(estudiantesDe[u.id] as EstudianteSup[]).length === 0 ? <p className="text-xs text-[#6a6b7e]">No tiene estudiantes.</p> : (estudiantesDe[u.id] as EstudianteSup[]).map(est => (
                                      <div key={est.id} className="flex items-center gap-3 bg-[#1f2035] border border-[#282a3f] rounded-lg px-3 py-2 text-xs">
                                        <div className="flex-1 min-w-0 truncate"><span className="text-[#d0d0da]">{est.nombre}</span><span className="text-[#8a8b9e]"> · {est.email}{est.telefono ? ` · ${est.telefono}` : ''}</span></div>
                                        <span className="text-[#a5b4fc] font-semibold whitespace-nowrap">Grupo {est.grupo}</span>
                                        {esSuper && <button onClick={() => setEdicionEst({ id: est.id, duenoId: u.id, error: '', guardando: false, campos: { nombre: est.nombre, email: est.email, telefono: est.telefono || '', grupo: est.grupo } })} title="Editar estudiante" className="p-1.5 text-[#6a6b7e] hover:text-[#818cf8] hover:bg-[#272839] rounded-md"><Pencil className="w-3.5 h-3.5" /></button>}
                                        <button onClick={() => eliminarEstudiante(est, u.id)} title="Eliminar estudiante (moderación)" className={`px-1.5 py-1 rounded-md transition-colors ${confirmandoEst === est.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[#6a6b7e] hover:text-red-400 hover:bg-red-500/10'}`}>{confirmandoEst === est.id ? '¿Seguro?' : <Trash2 className="w-3.5 h-3.5" />}</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {u.materias.length === 0 ? (
                                <p className="text-xs text-[#8a8b9e]">Aún no ha creado materias.</p>
                              ) : u.materias.map(m => (
                                <div key={m.id}>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <h4 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#818cf8]" />{m.nombre}</h4>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => abrirComposer(m.id, null)} className="flex items-center gap-1 text-[11px] text-yellow-300/80 hover:text-yellow-200" title="Dejar una observación sobre esta materia"><MessageSquare className="w-3.5 h-3.5" />Observación general</button>
                                      <span className="text-xs text-[#8a8b9e]">Examen: {fecha(m.fechaExamen)}</span>
                                    </div>
                                  </div>
                                  {esComposer(m.id, null) && formularioObservacion}
                                  {m.evaluaciones.length === 0 ? (
                                    <p className="text-xs text-[#6a6b7e] pl-6">Sin evaluaciones guardadas.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {m.evaluaciones.map((ev, i) => (
                                        <div key={i}>
                                        <div className="flex items-center gap-3 bg-[#1f2035] border border-[#282a3f] rounded-lg px-3 py-2 text-xs">
                                          <button onClick={() => setEvalAbierta(evalAbierta === ev.id ? null : ev.id)} className="flex-1 min-w-0 truncate text-left text-[#d0d0da] hover:text-white" title="Ver el contenido completo"><span className="text-[#a5b4fc] mr-1.5">[{ev.grupoSeccion || 'A'}]</span>{limpiarTexto(ev.nombre)}</button>
                                          {ev.tipoActividad && <span className="hidden sm:inline text-[#8a8b9e] truncate max-w-[140px]">🎯 {ev.tipoActividad}</span>}
                                          <span className="text-[#8a8b9e]">📅 {fecha(ev.fecha)}</span>
                                          <span className="font-semibold text-[#a5b4fc] w-10 text-right">{ev.peso != null ? `${ev.peso}%` : '—'}</span>
                                          <button onClick={() => abrirComposer(m.id, ev.nombre)} title="Dejar una observación sobre esta evaluación" className="px-1.5 py-1 rounded-md text-[#6a6b7e] hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors"><MessageSquare className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => eliminarEvaluacion(ev.id)} title="Eliminar evaluación (moderación)" className={`px-1.5 py-1 rounded-md transition-colors ${confirmandoEval === ev.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[#6a6b7e] hover:text-red-400 hover:bg-red-500/10'}`}>{confirmandoEval === ev.id ? '¿Seguro?' : <Trash2 className="w-3.5 h-3.5" />}</button>
                                        </div>
                                        {esComposer(m.id, ev.nombre) && formularioObservacion}
                                        {evalAbierta === ev.id && (
                                          <div className="mt-1.5 mb-2 bg-[#191a26] border border-[#313248] rounded-lg p-3 text-xs space-y-3">
                                            {edicion?.id === ev.id ? (
                                              <>
                                                <p className="text-[11px] text-amber-300">Al guardar, el profesor recibirá una observación automática con lo que cambiaste.</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                  {([['nombre', 'Nombre', 'text', 'col-span-2'], ['peso', 'Peso (%)', 'number', ''], ['fecha', 'Fecha', 'date', ''], ['tipoActividad', 'Tipo de actividad', 'text', ''], ['enfoque', 'Enfoque', 'text', ''], ['tiempoEstimadoMinutos', 'Duración (min)', 'number', ''], ['grupoSeccion', 'Sección', 'text', ''], ['cantidadGrupos', 'Grupos', 'number', ''], ['personasPorGrupo', 'Personas/grupo', 'number', '']] as const).map(([k, et, tipo, extra]) => (
                                                    <label key={k} className={`block ${extra}`}><span className="text-[10px] uppercase tracking-wider text-[#6a6b7e]">{et}</span><input type={tipo} value={edicion.campos[k]} onChange={(e) => cambiarCampo(k, e.target.value)} maxLength={k === 'grupoSeccion' ? 1 : undefined} className="mt-1 w-full bg-[#272839] border border-[#313248] rounded-lg px-2.5 py-1.5 text-xs text-[#e0e0ec] focus:outline-none focus:border-[#818cf8]" /></label>
                                                  ))}
                                                </div>
                                                <label className="block"><span className="text-[10px] uppercase tracking-wider text-[#6a6b7e]">Descripción</span><textarea value={edicion.campos.descripcion} onChange={(e) => cambiarCampo('descripcion', e.target.value)} rows={4} maxLength={4000} className="mt-1 w-full bg-[#272839] border border-[#313248] rounded-lg px-2.5 py-1.5 text-xs text-[#e0e0ec] focus:outline-none focus:border-[#818cf8]" /></label>
                                                {edicion.error && <p className="text-red-400 text-[11px]">{edicion.error}</p>}
                                                <div className="flex gap-2 justify-end">
                                                  <button onClick={() => setEdicion(null)} className="px-3 py-1.5 text-xs text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-lg">Cancelar</button>
                                                  <button onClick={guardarEdicion} disabled={edicion.guardando} className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-lg disabled:opacity-60">{edicion.guardando ? 'Guardando...' : 'Guardar cambios'}</button>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[#9a9bb0]">
                                                  <span>Sección: <b className="text-[#d0d0da]">{ev.grupoSeccion || 'A'}</b></span>
                                                  <span>Tipo: <b className="text-[#d0d0da]">{ev.tipoActividad || '—'}</b></span>
                                                  <span>Duración: <b className="text-[#d0d0da]">{ev.tiempoEstimadoMinutos != null ? `${ev.tiempoEstimadoMinutos} min` : '—'}</b></span>
                                                  <span>Nivel Bloom: <b className="text-[#d0d0da]">{ev.nivelBloom || '—'}</b></span>
                                                  <span>Grupos: <b className="text-[#d0d0da]">{ev.cantidadGrupos ?? '—'}</b></span>
                                                  <span>Personas/grupo: <b className="text-[#d0d0da]">{ev.personasPorGrupo ?? '—'}</b></span>
                                                  <span className="col-span-2">Enfoque: <b className="text-[#d0d0da]">{ev.enfoque || '—'}</b></span>
                                                </div>
                                                <div><p className="text-[10px] uppercase tracking-wider text-[#6a6b7e] mb-1">Descripción</p><p className="text-[#c0c0cc] whitespace-pre-wrap break-words">{ev.descripcion || 'Sin descripción.'}</p></div>
                                                {esSuper && <button onClick={() => iniciarEdicion(ev)} className="flex items-center gap-1.5 text-[11px] text-[#a5b4fc] hover:text-[#c7d2fe]"><Pencil className="w-3.5 h-3.5" />Editar esta evaluación</button>}
                                              </>
                                            )}
                                          </div>
                                        )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {m.observaciones.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-[#6a6b7e]">Observaciones enviadas</p>
                                      {m.observaciones.map(o => (
                                        <div key={o.id} className="flex items-start gap-2 text-[11px] text-[#9a9bb0]">
                                          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5 text-yellow-300/70" />
                                          <span className="flex-1 break-words"><span className="text-[#c0c0cc]">{o.autorNombre}</span>{o.evaluacionNombre ? ` · «${limpiarTexto(o.evaluacionNombre)}»` : ''}: {o.mensaje}</span>
                                          <span className={`flex-shrink-0 ${o.leida ? 'text-emerald-400/80' : 'text-amber-300/80'}`}>{o.leida ? 'leída' : 'sin leer'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(datos.sinDueno.materias > 0 || datos.sinDueno.estudiantes > 0) && (
            <p className="text-xs text-[#8a8b9e] flex items-start gap-2"><Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" /><span>Hay datos sin dueño ({datos.sinDueno.materias} materia(s), {datos.sinDueno.evaluaciones} evaluación(es) y {datos.sinDueno.estudiantes} estudiante(s)). Suelen venir de cuentas eliminadas o de antes de existir los usuarios.</span></p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// AVISOS DEL PLAN: suma de pesos y evaluaciones en el mismo día (por sección)
// ============================================
function AlertasPlan({ secciones }: { secciones: SeccionExamen[] }) {
  if (secciones.length === 0) return null;

  const suma = secciones.reduce((acc, s) => acc + (s.peso ?? 0), 0);

  // Agrupa por día (en hora local) para detectar evaluaciones que caen el mismo día
  const porDia = new Map<string, SeccionExamen[]>();
  secciones.forEach(s => {
    if (!s.fecha) return;
    const d = new Date(s.fecha);
    if (isNaN(d.getTime())) return;
    const clave = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    porDia.set(clave, [...(porDia.get(clave) || []), s]);
  });
  const choques = [...porDia.values()].filter(lista => lista.length > 1);

  const chip = 'flex items-start gap-2 text-xs rounded-lg px-3 py-2 border';
  return (
    <div className="space-y-2 mb-4">
      {suma === 100 ? (
        <div className={`${chip} bg-emerald-500/10 border-emerald-500/30 text-emerald-300`}><CheckCircle className="w-4 h-4 flex-shrink-0" /><span>Los pesos de esta sección suman 100%.</span></div>
      ) : suma < 100 ? (
        <div className={`${chip} bg-amber-500/10 border-amber-500/30 text-amber-300`}><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>Los pesos suman {suma}%: faltan {100 - suma}% para llegar a 100%.</span></div>
      ) : (
        <div className={`${chip} bg-red-500/10 border-red-500/30 text-red-300`}><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>Los pesos suman {suma}%: sobran {suma - 100}% sobre el 100%.</span></div>
      )}
      {choques.map((lista, i) => (
        <div key={i} className={`${chip} bg-amber-500/10 border-amber-500/30 text-amber-300`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{lista.length} evaluaciones caen el {new Date(lista[0].fecha as any).toLocaleDateString()}: {lista.map(s => limpiarTexto(s.nombre)).join(', ')}.</span>
        </div>
      ))}
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

// ============================================
// MI PERFIL (disponible para los tres roles)
// ============================================
function PerfilPanel({ usuario, onActualizado }: { usuario?: UsuarioSesion | null; onActualizado?: (u: UsuarioSesion) => void }) {
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [passwordActual, setPasswordActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGlobal, setErrorGlobal] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [creadoEn, setCreadoEn] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [cedulaBloqueada, setCedulaBloqueada] = useState(false);
  const telefonoOriginal = useRef('');

  useEffect(() => { if (usuario) { setNombre(usuario.nombre); setEmail(usuario.email); } }, [usuario?.id, usuario?.nombre, usuario?.email]);
  useEffect(() => {
    fetch('/api/perfil').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.createdAt) setCreadoEn(new Date(d.createdAt).toLocaleDateString()); if (d) { setTelefono(d.telefono || ''); telefonoOriginal.current = (d.telefono || '').replace(/[\s().-]/g, ''); setCedula(d.cedula || ''); setCedulaBloqueada(!!d.cedula); } }).catch(() => {});
  }, []);

  const INFO_ROL = {
    SUPERADMIN: {
      badge: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
      descripcion: 'Control total del sistema.',
      permisos: ['Crear, editar y eliminar cuentas de administradores y profesores', 'Atender las solicitudes de "olvidé mi contraseña"', 'Ver, editar y eliminar el trabajo y los estudiantes de cualquier profesor', 'Configurar el chat, el modelo de lenguaje y los límites del sistema', 'Consultar el registro de actividad', 'Usar el planificador y el chat como cualquier profesor'],
    },
    ADMIN: {
      badge: 'bg-[#818cf8]/10 text-[#a5b4fc] border-[#818cf8]/30',
      descripcion: 'Supervisas a los profesores y administras sus cuentas.',
      permisos: ['Crear, editar, desactivar y eliminar cuentas de profesores (rol USUARIO)', 'Ver el trabajo y los estudiantes de todos los profesores, y eliminarlos como moderación (editarlos es del superadmin)', 'No puedes modificar a otros administradores ni al superadmin', 'Gestionar tus propias materias, estudiantes y evaluaciones'],
    },
    USUARIO: {
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      descripcion: 'Profesor: trabajas con tus propios datos.',
      permisos: ['Gestionar tus materias, secciones y evaluaciones', 'Agregar y administrar a tus propios estudiantes', 'Generar y enviar planes de acción', 'Tus datos no son visibles para otros profesores'],
    },
  } as const;
  const rol = usuario?.rol || 'USUARIO';
  const info = INFO_ROL[rol];

  const inputCls = 'w-full bg-[#272839] border border-[#313248] rounded-xl px-3 py-2.5 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8] transition-colors';
  const labelCls = 'text-xs font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5';

  const guardar = async () => {
    setExito(''); setErrorGlobal('');
    const e: Record<string, string> = {};
    const n = validarNombre(nombre); if (n) e.nombre = n;
    const m = validarEmail(email); if (m) e.email = m;
    if (telefono.trim()) { const tl = validarTelefono(telefono); if (tl) e.telefono = tl; }
    if (!cedulaBloqueada && cedula.trim()) { const cd = validarCedula(cedula); if (cd) e.cedula = cd; }
    const cambiaEmail = !!usuario && email.trim().toLowerCase() !== usuario.email.toLowerCase();
    const cambiaPassword = nueva.length > 0 || confirmar.length > 0;
    const cambiaTelefono = telefono.trim() !== '' && telefono.replace(/[\s().-]/g, '') !== telefonoOriginal.current;
    if (cambiaPassword) {
      const p = validarPassword(nueva);
      if (p) e.nueva = p;
      else if (nueva !== confirmar) e.confirmar = 'Las contraseñas no coinciden.';
    }
    if ((cambiaEmail || cambiaPassword || cambiaTelefono) && !passwordActual) e.passwordActual = 'Ingresa tu contraseña actual para confirmar este cambio.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    try {
      const r = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, telefono, cedula: cedulaBloqueada ? undefined : cedula, passwordActual: passwordActual || undefined, passwordNueva: nueva || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setErrorGlobal(d.error || 'No se pudieron guardar los cambios.'); return; }
      if (onActualizado) onActualizado(d);
      telefonoOriginal.current = telefono.replace(/[\s().-]/g, ''); if (cedula.trim()) setCedulaBloqueada(true);
      setPasswordActual(''); setNueva(''); setConfirmar('');
      setExito(cambiaPassword ? 'Cambios guardados. Tu contraseña fue actualizada.' : 'Cambios guardados.');
    } catch {
      setErrorGlobal('No se pudo conectar con el servidor.');
    } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ec]">Mi perfil</h2>
        <p className="text-xs text-[#8a8b9e] mt-0.5">Administra tus datos de acceso.{creadoEn && ` Cuenta creada el ${creadoEn}.`}</p>
      </div>

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-full bg-[#272839] flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[#818cf8]" /></div>
          <div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${info.badge}`}>{rol}</span>
            <p className="text-sm text-[#b0b0c4] mt-1">{info.descripcion}</p>
          </div>
        </div>
        <ul className="space-y-1.5 pt-1">
          {info.permisos.map(p => (<li key={p} className="text-xs text-[#9a9bb0] flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /><span>{p}</span></li>))}
        </ul>
      </div>

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[#d0d0da]">Datos personales</h3>
        <div>
          <label className={labelCls}>Nombre completo</label>
          <input value={nombre} onChange={(e) => { setNombre(e.target.value); setExito(''); }} className={`${inputCls} ${errores.nombre ? 'border-red-500/50' : ''}`} />
          {errores.nombre && <p className="text-red-400 text-[11px] mt-1">{errores.nombre}</p>}
        </div>
        <div>
          <label className={labelCls}>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setExito(''); }} className={`${inputCls} ${errores.email ? 'border-red-500/50' : ''}`} />
          {errores.email && <p className="text-red-400 text-[11px] mt-1">{errores.email}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); setExito(''); }} placeholder="Ej: 0412 123 4567" className={`${inputCls} ${errores.telefono ? 'border-red-500/50' : ''}`} />
            {errores.telefono && <p className="text-red-400 text-[11px] mt-1">{errores.telefono}</p>}
            <p className="text-[11px] text-[#6a6b7e] mt-1">Por este número el administrador puede contactarte (por ejemplo, para entregarte una clave temporal).</p>
          </div>
          <div>
            <label className={labelCls}>Cédula</label>
            <input value={cedula} disabled={cedulaBloqueada} onChange={(e) => { setCedula(e.target.value); setExito(''); }} inputMode="numeric" placeholder="Solo números" className={`${inputCls} disabled:opacity-60 ${errores.cedula ? 'border-red-500/50' : ''}`} />
            {errores.cedula && <p className="text-red-400 text-[11px] mt-1">{errores.cedula}</p>}
            <p className="text-[11px] text-[#6a6b7e] mt-1">{cedulaBloqueada ? 'Si necesitas corregirla, pídeselo a un administrador.' : 'Se registra una sola vez.'}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#d0d0da]">Seguridad</h3>
          <p className="text-[11px] text-[#8a8b9e] mt-0.5">Necesitas tu contraseña actual solo si cambias tu correo o tu contraseña.</p>
        </div>
        <div>
          <label className={labelCls}>Contraseña actual</label>
          <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} autoComplete="current-password" className={`${inputCls} ${errores.passwordActual ? 'border-red-500/50' : ''}`} />
          {errores.passwordActual && <p className="text-red-400 text-[11px] mt-1">{errores.passwordActual}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mín. 8, letras y números" autoComplete="new-password" className={`${inputCls} ${errores.nueva ? 'border-red-500/50' : ''}`} />
            {errores.nueva && <p className="text-red-400 text-[11px] mt-1">{errores.nueva}</p>}
          </div>
          <div>
            <label className={labelCls}>Confirmar nueva contraseña</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" className={`${inputCls} ${errores.confirmar ? 'border-red-500/50' : ''}`} />
            {errores.confirmar && <p className="text-red-400 text-[11px] mt-1">{errores.confirmar}</p>}
          </div>
        </div>
      </div>

      {errorGlobal && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{errorGlobal}</span></p>}
      {exito && <p className="text-emerald-400 text-xs flex items-start gap-1.5"><CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{exito}</span></p>}

      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={guardar} disabled={guardando} className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-xl shadow-lg disabled:opacity-60">
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </motion.button>
    </div>
  );
}

// ============================================
// REGISTRO DE ACTIVIDAD (solo SUPERADMIN)
// ============================================
const ESTILO_ACCION: Record<string, string> = {
  CREAR: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  EDITAR: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  ELIMINAR: 'bg-red-500/10 text-red-300 border-red-500/30',
  RECHAZAR: 'bg-red-500/10 text-red-300 border-red-500/30',
  APROBAR: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  REGISTRO: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  LOGIN: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  LOGIN_FALLIDO: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  LOGOUT: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  OBSERVAR: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  RESTAURAR: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  RECUPERAR: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  RESTABLECER: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  VERIFICAR: 'bg-green-500/10 text-green-300 border-green-500/30',
  ENVIAR: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};

function ActividadPanel() {
  interface RegistroActividad { id: string; usuarioNombre: string; usuarioRol: string | null; accion: string; entidad: string; detalle: string | null; createdAt: string }
  const [items, setItems] = useState<RegistroActividad[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [accion, setAccion] = useState('');
  const [buscar, setBuscar] = useState('');
  const [buscarAplicado, setBuscarAplicado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async (p: number) => {
    setCargando(true); setError('');
    try {
      const params = new URLSearchParams({ pagina: String(p) });
      if (accion) params.set('accion', accion);
      if (buscarAplicado) params.set('buscar', buscarAplicado);
      const r = await fetch(`/api/actividad?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la actividad.');
      setItems(d.items); setTotal(d.total); setTotalPaginas(d.totalPaginas); setPagina(d.pagina);
    } catch (e: any) { setError(e.message || 'No se pudo cargar la actividad.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(1); }, [accion, buscarAplicado]);

  const acciones = ['LOGIN', 'LOGIN_FALLIDO', 'LOGOUT', 'REGISTRO', 'APROBAR', 'RECHAZAR', 'CREAR', 'EDITAR', 'ELIMINAR', 'OBSERVAR', 'RESTAURAR', 'RECUPERAR', 'RESTABLECER', 'VERIFICAR', 'ENVIAR'];
  const inputCls = 'bg-[#272839] border border-[#313248] rounded-xl px-3 py-2 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8] transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#e0e0ec] flex items-center gap-2"><Activity className="w-5 h-5 text-[#818cf8]" />Registro de actividad</h2>
          <p className="text-xs text-[#8a8b9e] mt-0.5">Quién hizo qué y cuándo. Solo lectura. {total} registro(s).</p>
        </div>
        <button onClick={() => cargar(pagina)} disabled={cargando} className="flex items-center gap-2 px-3 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl hover:border-[#818cf8]/40 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />Actualizar
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={accion} onChange={(e) => setAccion(e.target.value)} className={inputCls}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setBuscarAplicado(buscar.trim()); }} placeholder="Buscar por persona o detalle y presiona Enter..." className={`${inputCls} w-full pl-9`} />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl overflow-hidden">
        {cargando && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8a8b9e]">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8a8b9e]">No hay registros{accion || buscarAplicado ? ' con esos filtros' : ' todavía'}.</div>
        ) : (
          <div className="divide-y divide-[#313248]">
            {items.map(it => (
              <div key={it.id} className="p-4 flex items-start gap-3 hover:bg-[#232438] transition-colors">
                <span className={`mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ESTILO_ACCION[it.accion] || 'bg-slate-500/10 text-slate-300 border-slate-500/30'}`}>{it.accion.replace('_', ' ')}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#d0d0da]">{it.usuarioNombre}</span>
                    {it.usuarioRol && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[it.usuarioRol] || ''}`}>{it.usuarioRol}</span>}
                    <span className="text-[11px] text-[#6a6b7e]">· {it.entidad}</span>
                  </div>
                  {it.detalle && <p className="text-xs text-[#9a9bb0] mt-0.5 break-words">{it.detalle}</p>}
                </div>
                <span className="text-[11px] text-[#8a8b9e] whitespace-nowrap">{new Date(it.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => cargar(pagina - 1)} disabled={pagina <= 1 || cargando} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl disabled:opacity-40">Anterior</button>
          <span className="text-xs text-[#8a8b9e]">Página {pagina} de {totalPaginas}</span>
          <button onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas || cargando} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}

// ============================================
// OBSERVACIONES RECIBIDAS (lo que un administrador dejó sobre tu trabajo)
// ============================================
interface ObservacionRecibida { id: string; evaluacionNombre: string | null; autorNombre: string; autorRol: string; mensaje: string; leida: boolean; createdAt: string; materia: { nombre: string } }

function ObservacionesRecibidas({ items, onLeer }: { items: ObservacionRecibida[]; onLeer: (id?: string) => void }) {
  const [verLeidas, setVerLeidas] = useState(false);
  if (items.length === 0) return null;
  const sinLeer = items.filter(o => !o.leida);
  const leidas = items.filter(o => o.leida);

  const tarjeta = (o: ObservacionRecibida, nueva: boolean) => (
    <div key={o.id} className="p-4 flex items-start gap-3">
      <MessageSquare className={`w-4 h-4 flex-shrink-0 mt-0.5 ${nueva ? 'text-amber-300' : 'text-[#6a6b7e]'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-[#d0d0da]">{o.autorNombre}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[o.autorRol] || ''}`}>{o.autorRol}</span>
          <span className="text-[#8a8b9e]">· {o.materia.nombre}{o.evaluacionNombre ? ` · «${limpiarTexto(o.evaluacionNombre)}»` : ''}</span>
          <span className="text-[#6a6b7e]">· {new Date(o.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-sm text-[#c0c0cc] mt-1 whitespace-pre-wrap break-words">{o.mensaje}</p>
      </div>
      {nueva && <button onClick={() => onLeer(o.id)} className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors">Entendido</button>}
    </div>
  );

  return (
    <div className="space-y-3">
      {sinLeer.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2 flex-wrap">
            <MessageSquare className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-amber-200">Observaciones nuevas ({sinLeer.length})</h3>
            <span className="text-[11px] text-[#8a8b9e]">Un administrador revisó tu trabajo.</span>
            {sinLeer.length > 1 && <button onClick={() => onLeer()} className="ml-auto text-xs text-amber-200/80 hover:text-amber-100 underline">Marcar todas como leídas</button>}
          </div>
          <div className="divide-y divide-amber-500/10">{sinLeer.map(o => tarjeta(o, true))}</div>
        </div>
      )}
      {leidas.length > 0 && (
        <div>
          <button onClick={() => setVerLeidas(v => !v)} className="text-xs text-[#8a8b9e] hover:text-[#b0b0c4] flex items-center gap-1">
            {verLeidas ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{verLeidas ? 'Ocultar' : 'Ver'} observaciones leídas ({leidas.length})
          </button>
          {verLeidas && <div className="mt-2 bg-[#1d1e2e] border border-[#313248] rounded-2xl divide-y divide-[#313248] overflow-hidden">{leidas.map(o => tarjeta(o, false))}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================
// PAPELERA (lo eliminado se guarda 30 días y se puede restaurar)
// ============================================
function PapeleraPanel({ usuario }: { usuario?: UsuarioSesion | null }) {
  interface ItemPapelera { id: string; tipo: string; nombre: string; contexto: string | null; eliminadoPorNombre: string; eliminadoPorId: string | null; createdAt: string }
  const [items, setItems] = useState<ItemPapelera[]>([]);
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/papelera');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la papelera.');
      setItems(d.items); setDias(d.diasRetencion);
    } catch (e: any) { setError(e.message || 'No se pudo cargar la papelera.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const restaurar = async (it: ItemPapelera) => {
    setProcesandoId(it.id); setError(''); setAviso('');
    try {
      const r = await fetch(`/api/papelera/${it.id}/restaurar`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo restaurar.'); return; }
      if (it.tipo === 'EVALUACION') {
        // La evaluación vuelve a la base de datos: se recarga la página para que aparezca en el planificador
        setAviso('Evaluación restaurada. Recargando...');
        setTimeout(() => window.location.reload(), 900);
      } else {
        setAviso('Estudiante restaurado. Ya aparece en la pestaña Estudiantes.');
        await cargar();
      }
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally { setProcesandoId(null); }
  };

  const eliminarDefinitivo = async (it: ItemPapelera) => {
    if (confirmandoId !== it.id) { setConfirmandoId(it.id); setTimeout(() => setConfirmandoId(prev => (prev === it.id ? null : prev)), 3000); return; }
    setConfirmandoId(null);
    const r = await fetch(`/api/papelera/${it.id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
    await cargar();
  };

  const diasRestantes = (creado: string) => Math.max(0, Math.ceil((new Date(creado).getTime() + dias * 86400000 - Date.now()) / 86400000));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ec] flex items-center gap-2"><Trash2 className="w-5 h-5 text-[#818cf8]" />Papelera</h2>
        <p className="text-xs text-[#8a8b9e] mt-0.5">Lo que eliminas se guarda {dias} días y luego se borra definitivamente. Aquí puedes restaurarlo.</p>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {aviso && <p className="text-emerald-400 text-sm flex items-start gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{aviso}</span></p>}

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-[#8a8b9e]">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#8a8b9e]"><Trash2 className="w-8 h-8 mx-auto mb-3 text-[#3a3b52]" />La papelera está vacía.</div>
        ) : (
          <div className="divide-y divide-[#313248]">
            {items.map(it => {
              const porOtro = !!it.eliminadoPorId && it.eliminadoPorId !== usuario?.id;
              return (
                <div key={it.id} className="p-4 flex items-center gap-3 hover:bg-[#232438] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#272839] flex items-center justify-center flex-shrink-0">{it.tipo === 'ESTUDIANTE' ? <User className="w-4 h-4 text-purple-300" /> : <FileText className="w-4 h-4 text-amber-300" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#d0d0da] truncate">{it.tipo === 'EVALUACION' ? limpiarTexto(it.nombre) : it.nombre}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-300 border-slate-500/30">{it.tipo === 'ESTUDIANTE' ? 'ESTUDIANTE' : 'EVALUACIÓN'}</span>
                      {porOtro && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">ELIMINADA POR {it.eliminadoPorNombre.toUpperCase()}</span>}
                    </div>
                    <div className="text-xs text-[#8a8b9e] truncate">{it.contexto ? `${it.contexto} · ` : ''}Eliminado el {new Date(it.createdAt).toLocaleDateString()} · se borra en {diasRestantes(it.createdAt)} día(s)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => restaurar(it)} disabled={procesandoId === it.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-60"><RotateCcw className="w-3.5 h-3.5" />{procesandoId === it.id ? 'Restaurando...' : 'Restaurar'}</button>
                    <button onClick={() => eliminarDefinitivo(it)} className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${confirmandoId === it.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[#6a6b7e] hover:text-red-400 hover:bg-red-500/10'}`} title="Eliminar definitivamente">{confirmandoId === it.id ? '¿Seguro?' : <Trash2 className="w-4 h-4" />}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CONFIGURACIÓN DEL SISTEMA (solo SUPERADMIN): chat, modelo de lenguaje, límites del planificador y acceso
// ============================================
function ConfigSistemaPanel({ onGuardada }: { onGuardada: (c: ConfigCliente) => void }) {
  const [cfg, setCfg] = useState<ConfigCompleta | null>(null);
  const [original, setOriginal] = useState('');
  const [meta, setMeta] = useState<{ por: string | null; en: string | null }>({ por: null, en: null });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/configuracion');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la configuración.');
      setCfg(d.config); setOriginal(JSON.stringify(d.config)); setMeta({ por: d.actualizadoPor, en: d.actualizadoEn });
    } catch (e: any) { setError(e.message || 'No se pudo cargar la configuración.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const sucia = !!cfg && JSON.stringify(cfg) !== original;
  const cambiarChat = (p: Partial<ConfigChat>) => cfg && setCfg({ ...cfg, chat: { ...cfg.chat, ...p } });
  const cambiarPlan = (p: Partial<ConfigCompleta['planificador']>) => cfg && setCfg({ ...cfg, planificador: { ...cfg.planificador, ...p } });
  const cambiarAcceso = (p: Partial<ConfigCompleta['acceso']>) => cfg && setCfg({ ...cfg, acceso: { ...cfg.acceso, ...p } });

  const guardar = async () => {
    if (!cfg) return;
    setGuardando(true); setError(''); setExito('');
    try {
      const r = await fetch('/api/configuracion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo guardar la configuración.'); return; }
      setCfg(d.config); setOriginal(JSON.stringify(d.config));
      setExito(d.cambios?.length ? 'Configuración guardada. Se aplica de inmediato a todos los usuarios.' : 'No había cambios que guardar.');
      onGuardada({ chat: d.config.chat, planificador: d.config.planificador });
      await cargar();
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally { setGuardando(false); }
  };

  const campo = 'w-full bg-[#272839] border border-[#313248] rounded-xl px-3 py-2.5 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8] transition-colors';
  const etiqueta = 'text-xs font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5';
  const ayuda = 'text-[11px] text-[#6a6b7e] mt-1';
  const tarjeta = 'bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 space-y-5';

  const Interruptor = ({ activo, onChange, texto, detalle }: { activo: boolean; onChange: (v: boolean) => void; texto: string; detalle?: string }) => (
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm text-[#d0d0da] font-medium">{texto}</p>{detalle && <p className={ayuda}>{detalle}</p>}</div>
      <button type="button" role="switch" aria-checked={activo} onClick={() => onChange(!activo)} className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${activo ? 'bg-[#818cf8]' : 'bg-[#313248]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  if (cargando && !cfg) return <div className="p-10 text-center text-sm text-[#8a8b9e]">Cargando configuración...</div>;
  if (!cfg) return <p className="text-red-400 text-sm">{error || 'No se pudo cargar la configuración.'}</p>;

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ec] flex items-center gap-2"><Settings className="w-5 h-5 text-[#818cf8]" />Configuración del sistema</h2>
        <p className="text-xs text-[#8a8b9e] mt-0.5">Solo el superadmin ve esta pantalla. {meta.por ? `Última modificación: ${meta.por}${meta.en ? `, ${new Date(meta.en).toLocaleString()}` : ''}.` : 'Todavía no se ha modificado: se usan los valores por defecto.'}</p>
      </div>

      {/* ---------- CHAT ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#a5b4fc]" />Chat y modelo de lenguaje</h3>
        <Interruptor activo={cfg.chat.activo} onChange={(v) => cambiarChat({ activo: v })} texto="Asistente activado" detalle="Si lo apagas, el chat no responde y los usuarios ven el mensaje de abajo. Los comandos de guardar y eliminar siguen funcionando." />
        {!cfg.chat.activo && (
          <div><label className={etiqueta}>Mensaje cuando está apagado</label><input value={cfg.chat.mensajeInactivo} onChange={(e) => cambiarChat({ mensajeInactivo: e.target.value })} maxLength={300} className={campo} /></div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={etiqueta}>Modelo de lenguaje</label>
            <input list="modelos-sugeridos" value={cfg.chat.modelo} onChange={(e) => cambiarChat({ modelo: e.target.value })} placeholder="(el que tiene el flujo de n8n)" className={campo} />
            <datalist id="modelos-sugeridos"><option value="models/gemini-2.5-flash" /><option value="models/gemini-2.5-pro" /><option value="models/gemini-2.0-flash" /></datalist>
            <p className={ayuda}>Déjalo vacío para usar el modelo que ya tiene n8n. Los nombres de ejemplo pueden no existir en tu cuenta; si el chat falla tras cambiarlo, vacíalo.</p>
          </div>
          <div>
            <label className={etiqueta}>Dirección de n8n</label>
            <input value={cfg.chat.webhookUrl} onChange={(e) => cambiarChat({ webhookUrl: e.target.value })} placeholder="(la variable NEXT_PUBLIC_N8N_URL)" className={campo} />
            <p className={ayuda}>Ejemplo: http://localhost:5678. También la usa la generación del plan en PDF.</p>
          </div>
        </div>
        <div>
          <label className={etiqueta}>Creatividad (temperatura): {cfg.chat.temperatura.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={cfg.chat.temperatura} onChange={(e) => cambiarChat({ temperatura: parseFloat(e.target.value) })} className="w-full accent-[#818cf8]" />
          <p className={ayuda}>Más bajo = respuestas más precisas y repetibles. Más alto = más variadas y creativas.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className={etiqueta}>Largo de respuesta</label><input type="number" min={0} max={32000} value={cfg.chat.maxTokens} onChange={(e) => cambiarChat({ maxTokens: parseInt(e.target.value) || 0 })} className={campo} /><p className={ayuda}>Tokens máx. 0 = automático.</p></div>
          <div><label className={etiqueta}>Memoria</label><input type="number" min={1} max={30} value={cfg.chat.ventanaMemoria} onChange={(e) => cambiarChat({ ventanaMemoria: parseInt(e.target.value) || 1 })} className={campo} /><p className={ayuda}>Mensajes que recuerda.</p></div>
          <div><label className={etiqueta}>Máx. caracteres</label><input type="number" min={100} max={5000} value={cfg.chat.maxCaracteresMensaje} onChange={(e) => cambiarChat({ maxCaracteresMensaje: parseInt(e.target.value) || 100 })} className={campo} /><p className={ayuda}>Por mensaje del usuario.</p></div>
          <div><label className={etiqueta}>Espera máx. (s)</label><input type="number" min={10} max={180} value={cfg.chat.timeoutSegundos} onChange={(e) => cambiarChat({ timeoutSegundos: parseInt(e.target.value) || 10 })} className={campo} /><p className={ayuda}>Antes de rendirse.</p></div>
        </div>
        <div>
          <label className={etiqueta}>Instrucciones adicionales para el agente</label>
          <textarea value={cfg.chat.instruccionesExtra} onChange={(e) => cambiarChat({ instruccionesExtra: e.target.value })} maxLength={1500} rows={4} placeholder="Ej: Responde siempre en tono formal y usa ejemplos de ingeniería de software." className={campo} />
          <p className={ayuda}>{cfg.chat.instruccionesExtra.length}/1500 · Se le entregan al agente junto con cada mensaje, sin tocar su prompt base.</p>
        </div>
        <div className="flex items-start gap-2 text-xs text-[#9a9bb0] bg-[#161722] border border-[#282a3f] rounded-xl p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#a5b4fc]" />
          <span>Estos valores viajan a n8n con cada mensaje. Para que el <strong className="text-[#c0c0cc]">modelo, la creatividad, la memoria y las instrucciones</strong> se apliquen, importa en n8n el flujo <code className="text-emerald-300">My_workflow_configurable.json</code>. Con el flujo antiguo siguen funcionando el interruptor, el límite de caracteres, la espera máxima y la dirección.</span>
        </div>
      </div>

      {/* ---------- PLANIFICADOR ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#a5b4fc]" />Límites del planificador</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={etiqueta}>Máximo de grupos por evaluación</label><input type="number" min={1} max={100} value={cfg.planificador.maxGrupos} onChange={(e) => cambiarPlan({ maxGrupos: parseInt(e.target.value) || 1 })} className={campo} /></div>
          <div><label className={etiqueta}>Máximo de personas por grupo</label><input type="number" min={1} max={1000} value={cfg.planificador.maxPersonasPorGrupo} onChange={(e) => cambiarPlan({ maxPersonasPorGrupo: parseInt(e.target.value) || 1 })} className={campo} /></div>
        </div>
      </div>

      {/* ---------- ACCESO ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[#d0d0da] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#a5b4fc]" />Acceso y datos</h3>
        <Interruptor activo={cfg.acceso.registroAbierto} onChange={(v) => cambiarAcceso({ registroAbierto: v })} texto="Registro público abierto" detalle="Permite que los profesores soliciten su cuenta desde el login. Ciérralo cuando ya estén todos; las cuentas las seguirás creando desde Usuarios." />
        <div className="max-w-xs"><label className={etiqueta}>Días que se conserva la papelera</label><input type="number" min={7} max={90} value={cfg.acceso.diasPapelera} onChange={(e) => cambiarAcceso({ diasPapelera: parseInt(e.target.value) || 7 })} className={campo} /><p className={ayuda}>Entre 7 y 90 días.</p></div>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {exito && <p className="text-emerald-400 text-sm flex items-start gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{exito}</span></p>}

      <div className="sticky bottom-4 flex items-center gap-3 bg-[#1d1e2e]/95 backdrop-blur border border-[#313248] rounded-2xl p-3 shadow-2xl">
        <span className={`text-xs flex-1 ${sucia ? 'text-amber-300' : 'text-[#8a8b9e]'}`}>{sucia ? 'Hay cambios sin guardar.' : 'Todo guardado.'}</span>
        <button onClick={() => { setCfg(JSON.parse(original)); setError(''); setExito(''); }} disabled={!sucia || guardando} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-xl disabled:opacity-40">Descartar</button>
        <button onClick={() => { setCfg(CONFIG_COMPLETA_DEFECTO); setExito(''); }} disabled={guardando} className="px-4 py-2 text-sm text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-xl disabled:opacity-40">Valores por defecto</button>
        <button onClick={guardar} disabled={!sucia || guardando} className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-xl disabled:opacity-40">{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </div>
  );
}

// ============================================
// PANEL DE USUARIOS (solo ADMIN y SUPERADMIN)
// ============================================
function UsuariosPanel() {
  type RolU = 'SUPERADMIN' | 'ADMIN' | 'USUARIO';
  interface UsuarioFila { id: string; nombre: string; email: string; rol: RolU; activo: boolean; pendiente: boolean; telefono: string | null; cedula: string | null; debeCambiarPassword: boolean; telefonoVerificado?: boolean; }
  interface RecuperacionFila { id: string; createdAt: string; usuario: { id: string; nombre: string; email: string; telefono: string | null; cedula: string | null; rol: RolU } }
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [actor, setActor] = useState<{ id: string; rol: RolU } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState<null | 'nuevo' | UsuarioFila>(null);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'USUARIO' as RolU, activo: true, telefono: '', cedula: '' });
  const [recuperaciones, setRecuperaciones] = useState<RecuperacionFila[]>([]);
  const [resultadoReset, setResultadoReset] = useState<{ passwordTemporal: string; nombre: string; email: string; telefono: string | null } | null>(null);
  const [procesandoRec, setProcesandoRec] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGlobal, setErrorGlobal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const r = await fetch('/api/usuarios');
      const d = await r.json();
      if (r.ok) {
        setUsuarios(d.usuarios); setActor(d.actor);
        if (d.actor?.rol === 'SUPERADMIN') {
          const rr = await fetch('/api/recuperaciones');
          if (rr.ok) setRecuperaciones(await rr.json());
        }
      }
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const esSuper = actor?.rol === 'SUPERADMIN';
  // SUPERADMIN gestiona a todos; ADMIN solo a usuarios con rol USUARIO (y puede editarse a sí mismo)
  const puedeEditar = (u: UsuarioFila) => esSuper || u.rol === 'USUARIO' || u.id === actor?.id;
  const puedeEliminar = (u: UsuarioFila) => u.id !== actor?.id && (esSuper || u.rol === 'USUARIO');

  const abrirNuevo = () => { setForm({ nombre: '', email: '', password: '', rol: 'USUARIO', activo: true, telefono: '', cedula: '' }); setErrores({}); setErrorGlobal(''); setModal('nuevo'); };
  const abrirEditar = (u: UsuarioFila) => { setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo, telefono: u.telefono || '', cedula: u.cedula || '' }); setErrores({}); setErrorGlobal(''); setModal(u); };

  const validar = (editando: boolean) => {
    const e: Record<string, string> = {};
    const n = validarNombre(form.nombre); if (n) e.nombre = n;
    const m = validarEmail(form.email); if (m) e.email = m;
    // Al crear una cuenta teléfono y cédula son obligatorios; al editar (cuentas antiguas) solo se validan si se escriben
    if (!editando || form.telefono.trim()) { const tl = validarTelefono(form.telefono); if (tl) e.telefono = tl; }
    if (!editando || form.cedula.trim()) { const cd = validarCedula(form.cedula); if (cd) e.cedula = cd; }
    if (!editando || form.password) { const p = validarPassword(form.password); if (p) e.password = p; }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    const editando = modal !== 'nuevo' && modal !== null;
    if (!validar(editando)) return;
    setGuardando(true); setErrorGlobal('');
    try {
      const r = await fetch('/api/usuarios', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando ? { id: (modal as UsuarioFila).id, ...form, password: form.password || undefined } : form),
      });
      const d = await r.json();
      if (!r.ok) { setErrorGlobal(d.error || 'No se pudo guardar.'); return; }
      setModal(null);
      await cargar();
    } finally { setGuardando(false); }
  };

  const eliminar = async (u: UsuarioFila) => {
    // Confirmación en dos pasos sin cuadros de diálogo: primer clic arma, segundo clic elimina
    if (confirmandoId !== u.id) { setConfirmandoId(u.id); setTimeout(() => setConfirmandoId(prev => (prev === u.id ? null : prev)), 3000); return; }
    setConfirmandoId(null);
    const r = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'No se pudo eliminar.'); return; }
    await cargar();
  };

  const badgeRol = (rol: RolU) =>
    rol === 'SUPERADMIN' ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30'
    : rol === 'ADMIN' ? 'bg-[#818cf8]/10 text-[#a5b4fc] border-[#818cf8]/30'
    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

  const inputCls = 'w-full bg-[#272839] border border-[#313248] rounded-xl px-3 py-2.5 text-sm text-[#e0e0ec] placeholder-[#6a6b7e] focus:outline-none focus:border-[#818cf8] transition-colors';
  const rolesDisponibles: RolU[] = esSuper ? ['USUARIO', 'ADMIN', 'SUPERADMIN'] : ['USUARIO'];
  const editandoSelf = modal !== null && modal !== 'nuevo' && modal.id === actor?.id;
  const pendientes = usuarios.filter(u => u.pendiente);
  const aprobados = usuarios.filter(u => !u.pendiente);

  // Aprueba una solicitud de cuenta hecha desde el login (rechazar = eliminar, con el mismo "¿Seguro?")
  // Solicitudes de "olvidé mi contraseña": el superadmin restablece la clave y se la hace llegar por teléfono
  const restablecerRec = async (sol: RecuperacionFila) => {
    setProcesandoRec(sol.id);
    try {
      const r = await fetch(`/api/recuperaciones/${sol.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'restablecer' }) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'No se pudo restablecer la contraseña.'); return; }
      setCopiado(false);
      setResultadoReset({ passwordTemporal: d.passwordTemporal, nombre: d.usuario.nombre, email: d.usuario.email, telefono: d.usuario.telefono });
      await cargar();
    } finally { setProcesandoRec(null); }
  };
  const descartarRec = async (sol: RecuperacionFila) => {
    setProcesandoRec(sol.id);
    try {
      const r = await fetch(`/api/recuperaciones/${sol.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'descartar' }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'No se pudo descartar.'); return; }
      await cargar();
    } finally { setProcesandoRec(null); }
  };
  const copiarClave = async () => {
    if (!resultadoReset) return;
    try { await navigator.clipboard.writeText(resultadoReset.passwordTemporal); setCopiado(true); } catch { /* la puede copiar a mano */ }
  };

  const aprobar = async (u: UsuarioFila) => {
    const r = await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, accion: 'aprobar' }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'No se pudo aprobar la cuenta.'); return; }
    await cargar();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#e0e0ec]">Usuarios del sistema</h2>
          <p className="text-xs text-[#8a8b9e] mt-0.5">{esSuper ? 'Como superadmin gestionas a todos los usuarios.' : 'Como administrador gestionas a los usuarios con rol USUARIO.'}</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={abrirNuevo} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white text-sm font-semibold rounded-xl shadow-lg"><Plus className="w-4 h-4" />Nuevo usuario</motion.button>
      </div>

      {esSuper && recuperaciones.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-500/20 flex items-center gap-2 flex-wrap">
            <AlertCircle className="w-4 h-4 text-red-300" />
            <h3 className="text-sm font-semibold text-red-200">Recuperación de contraseña ({recuperaciones.length})</h3>
            <span className="text-[11px] text-[#8a8b9e]">Verifica la identidad por teléfono antes de entregar la clave temporal.</span>
          </div>
          <div className="divide-y divide-red-500/10">
            {recuperaciones.map(sol => (
              <div key={sol.id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-[#272839] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-red-300" /></div>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium text-[#d0d0da]">{sol.usuario.nombre}</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeRol(sol.usuario.rol)}`}>{sol.usuario.rol}</span></div>
                  <div className="text-xs text-[#8a8b9e]">{sol.usuario.email}{sol.usuario.cedula ? ` · CC ${sol.usuario.cedula}` : ''} · {new Date(sol.createdAt).toLocaleString()}</div>
                  {sol.usuario.telefono
                    ? <a href={`tel:${sol.usuario.telefono}`} className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 mt-0.5"><Phone className="w-3 h-3" />{sol.usuario.telefono}</a>
                    : <span className="text-xs text-amber-300">Esta cuenta no tiene teléfono registrado.</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => restablecerRec(sol)} disabled={procesandoRec === sol.id} className="px-3 py-1.5 text-xs font-semibold text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-60">{procesandoRec === sol.id ? 'Procesando...' : 'Restablecer contraseña'}</button>
                  <button onClick={() => descartarRec(sol)} disabled={procesandoRec === sol.id} className="px-3 py-1.5 text-xs text-[#9a9bb0] bg-[#272839] border border-[#313248] rounded-lg hover:bg-[#2c2d40] disabled:opacity-60">Descartar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {resultadoReset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="w-full max-w-md bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-[#e0e0ec]">Contraseña temporal para {resultadoReset.nombre}</h3>
              <div className="bg-[#161722] border border-[#313248] rounded-xl p-4 text-center">
                <code className="text-2xl font-mono tracking-widest text-emerald-300 select-all">{resultadoReset.passwordTemporal}</code>
              </div>
              <button onClick={copiarClave} className="w-full py-2.5 text-sm text-[#c7d2fe] bg-[#272839] border border-[#313248] rounded-xl hover:bg-[#2c2d40]">{copiado ? '¡Copiada!' : 'Copiar contraseña'}</button>
              <div className="text-xs text-[#9a9bb0] space-y-1.5">
                {resultadoReset.telefono ? <p>Entrégasela por teléfono: <a href={`tel:${resultadoReset.telefono}`} className="text-emerald-300 font-medium">{resultadoReset.telefono}</a>.</p> : <p className="text-amber-300">Esta cuenta no tiene teléfono registrado: contacta a la persona por otro medio.</p>}
                <p>Se muestra <strong className="text-[#c0c0cc]">solo esta vez</strong>. Al entrar, la persona deberá elegir una contraseña nueva, y sus sesiones abiertas anteriores se cerraron.</p>
              </div>
              <button onClick={() => setResultadoReset(null)} className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-xl">Entendido</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {pendientes.length > 0 && (
          <motion.div key="solicitudes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2 flex-wrap">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-200">Solicitudes pendientes ({pendientes.length})</h3>
                <span className="text-[11px] text-[#8a8b9e]">Se registraron desde el login y todavía no pueden entrar.</span>
              </div>
              <div className="divide-y divide-amber-500/10">
                {pendientes.map(u => (
                  <div key={u.id} className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#272839] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-amber-300" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#d0d0da] truncate flex items-center gap-2">{u.nombre}{u.telefonoVerificado
                        ? <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">WhatsApp verificado</span>
                        : <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30" title="La persona todavía no escribió el código que le llegó por WhatsApp">WhatsApp sin verificar</span>}</div>
                      <div className="text-xs text-[#8a8b9e] truncate">{u.email}{u.telefono ? ` · 📞 ${u.telefono}` : ''}{u.cedula ? ` · C.I. ${u.cedula}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => aprobar(u)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"><CheckCircle className="w-3.5 h-3.5" />Aprobar</button>
                      {puedeEliminar(u) && (
                        <button onClick={() => eliminar(u)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"><X className="w-3.5 h-3.5" />{confirmandoId === u.id ? '¿Seguro?' : 'Rechazar'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-[#8a8b9e]">Cargando...</div>
        ) : aprobados.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8a8b9e]">No hay usuarios registrados.</div>
        ) : (
          <div className="divide-y divide-[#313248]">
            {aprobados.map(u => (
              <div key={u.id} className="p-4 flex items-center gap-3 hover:bg-[#232438] transition-colors">
                <div className="w-9 h-9 rounded-full bg-[#272839] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-[#818cf8]" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#d0d0da] truncate">{u.nombre}</span>
                    {u.id === actor?.id && <span className="text-[10px] text-[#8a8b9e]">(tú)</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeRol(u.rol)}`}>{u.rol}</span>
                    {!u.activo && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADO</span>}
                    {u.debeCambiarPassword && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">CLAVE TEMPORAL</span>}
                  </div>
                  <div className="text-xs text-[#8a8b9e] truncate">{u.email}{u.telefono ? ` · 📞 ${u.telefono}` : ''}{u.cedula ? ` · CC ${u.cedula}` : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  {puedeEditar(u) && <Tooltip text="Editar"><button onClick={() => abrirEditar(u)} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg"><Pencil className="w-4 h-4" /></button></Tooltip>}
                  {puedeEliminar(u) && (confirmandoId === u.id
                    ? <button onClick={() => eliminar(u)} className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg">¿Seguro?</button>
                    : <Tooltip text="Eliminar"><button onClick={() => eliminar(u)} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></Tooltip>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setModal(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#e0e0ec]">{modal === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
                <button onClick={() => setModal(null)} className="p-1 text-[#8a8b9e] hover:text-[#d0d0da]"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" className={`${inputCls} ${errores.nombre ? 'border-red-500/50' : ''}`} />
                {errores.nombre && <p className="text-red-400 text-[11px] mt-1">{errores.nombre}</p>}
              </div>
              <div>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo electrónico" className={`${inputCls} ${errores.email ? 'border-red-500/50' : ''}`} />
                {errores.email && <p className="text-red-400 text-[11px] mt-1">{errores.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Cédula" inputMode="numeric" className={`${inputCls} ${errores.cedula ? 'border-red-500/50' : ''}`} />
                  {errores.cedula && <p className="text-red-400 text-[11px] mt-1">{errores.cedula}</p>}
                </div>
                <div>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" type="tel" className={`${inputCls} ${errores.telefono ? 'border-red-500/50' : ''}`} />
                  {errores.telefono && <p className="text-red-400 text-[11px] mt-1">{errores.telefono}</p>}
                </div>
              </div>
              <div>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={modal === 'nuevo' ? 'Contraseña (mín. 8, letras y números)' : 'Nueva contraseña (dejar vacío para no cambiar)'} className={`${inputCls} ${errores.password ? 'border-red-500/50' : ''}`} autoComplete="new-password" />
                {errores.password && <p className="text-red-400 text-[11px] mt-1">{errores.password}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5">Rol</label>
                <select value={form.rol} disabled={!esSuper || editandoSelf} onChange={(e) => setForm({ ...form, rol: e.target.value as RolU })} className={`${inputCls} disabled:opacity-60`}>
                  {(esSuper ? rolesDisponibles : [form.rol]).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {modal !== 'nuevo' && !editandoSelf && (
                <label className="flex items-center gap-2 text-sm text-[#b0b0c4] cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="accent-[#818cf8]" />
                  Cuenta activa
                </label>
              )}

              {errorGlobal && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{errorGlobal}</span></p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-[#b0b0c4] bg-[#272839] border border-[#313248] rounded-xl hover:bg-[#2c2d40]">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#818cf8] to-[#6366f1] rounded-xl disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EstudiantesPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('todos');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{ creados: number; omitidos: { fila: number; motivo: string }[]; desplazamiento: number } | null>(null);
  const [errorImport, setErrorImport] = useState('');
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  
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

  // Importa estudiantes desde un archivo CSV (Excel → Guardar como → CSV). Máximo 500 por archivo.
  const importarArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setResultadoImport(null); setErrorImport('');
    try {
      if (!/\.(csv|txt)$/i.test(archivo.name)) { setErrorImport('El archivo debe ser .csv. En Excel usa Guardar como → CSV.'); return; }
      const { estudiantes: filas, tieneEncabezado } = csvAEstudiantes(await archivo.text());
      if (filas.length === 0) { setErrorImport('El archivo está vacío.'); return; }
      setImportando(true);
      const r = await fetch('/api/estudiantes/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudiantes: filas }) });
      const d = await r.json();
      if (!r.ok) { setErrorImport(d.error || 'No se pudo importar el archivo.'); return; }
      setResultadoImport({ creados: d.creados, omitidos: d.omitidos, desplazamiento: tieneEncabezado ? 1 : 0 });
      await recargarEstudiantes();
    } catch { setErrorImport('No se pudo leer o enviar el archivo.'); }
    finally { setImportando(false); if (inputArchivoRef.current) inputArchivoRef.current.value = ''; }
  };

  const descargarPlantilla = () => {
    const url = URL.createObjectURL(new Blob([plantillaCSV()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla-estudiantes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEstudiantes = estudiantes.filter(e => {
    const matchSearch = e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase()) || (e.telefono || '').includes(searchTerm);
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

  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null);
  const eliminarEstudiante = async (id: string) => {
    if (confirmandoBorrar !== id) { setConfirmandoBorrar(id); setTimeout(() => setConfirmandoBorrar(prev => (prev === id ? null : prev)), 3000); return; }
    setConfirmandoBorrar(null);
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
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={inputArchivoRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => importarArchivo(e.target.files?.[0])} />
          <button onClick={descargarPlantilla} className="flex items-center gap-2 px-3 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl hover:border-[#818cf8]/40 transition-colors"><Download className="w-4 h-4" />Plantilla</button>
          <button onClick={() => inputArchivoRef.current?.click()} disabled={importando} className="flex items-center gap-2 px-3 py-2 text-sm text-[#b0b0c4] bg-[#1f2035] border border-[#313248] rounded-xl hover:border-[#818cf8]/40 transition-colors disabled:opacity-60"><Upload className="w-4 h-4" />{importando ? 'Importando...' : 'Importar CSV'}</button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm font-medium rounded-xl transition-all shadow-md"><Plus className="w-4 h-4" /> Agregar estudiante</motion.button>
        </div>
      </div>

      {errorImport && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1">{errorImport}</span><button onClick={() => setErrorImport('')} className="text-red-300/70 hover:text-red-200"><X className="w-4 h-4" /></button></div>
      )}
      {resultadoImport && (
        <div className={`rounded-xl px-4 py-3 border text-sm ${resultadoImport.omitidos.length > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          <div className="flex items-start gap-2">
            {resultadoImport.omitidos.length > 0 ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-medium">Se importaron {resultadoImport.creados} estudiante(s){resultadoImport.omitidos.length > 0 ? ` y se omitieron ${resultadoImport.omitidos.length}.` : '.'}</p>
              {resultadoImport.omitidos.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                  {resultadoImport.omitidos.slice(0, 10).map(o => (<li key={o.fila}>Fila {o.fila + resultadoImport.desplazamiento}: {o.motivo}</li>))}
                  {resultadoImport.omitidos.length > 10 && <li>... y {resultadoImport.omitidos.length - 10} más.</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setResultadoImport(null)} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

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
                      {confirmandoBorrar === est.id ? (<button onClick={() => eliminarEstudiante(est.id)} className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg">¿Seguro?</button>) : (<Tooltip text="Eliminar"><button onClick={() => eliminarEstudiante(est.id)} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button></Tooltip>)}
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
                <div><label className={labelBase}>Teléfono</label><input type="tel" inputMode="numeric" value={nuevoTelefono} onChange={(e) => { setNuevoTelefono(e.target.value); setErroresNuevo(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.telefono ? 'border-red-500/50' : ''}`} placeholder="04121234567" />{erroresNuevo.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.telefono}</p>}</div>
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
                <div><label className={labelBase}>Teléfono</label><input type="tel" inputMode="numeric" value={editando.telefono || ''} onChange={(e) => { setEditando({...editando, telefono: e.target.value}); setErroresEdit(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresEdit.telefono ? 'border-red-500/50' : ''}`} />{erroresEdit.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.telefono}</p>}</div>
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
            className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[500px] overflow-hidden bg-[#1f2035] border border-[#313248] rounded-2xl shadow-2xl shadow-black/60 z-50"
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
// ============================================
// ESTADO DE REALIZACIÓN DE UNA EVALUACIÓN
// ============================================
// "Por confirmar" no se guarda: es una evaluación programada cuya fecha ya pasó.
function estadoVisibleEvaluacion(s: SeccionExamen): { texto: string; clase: string; porConfirmar: boolean } {
  const estado = String(s.estado || 'PROGRAMADA').toUpperCase();
  const paso = !!s.fecha && new Date(s.fecha).getTime() < Date.now();
  if (estado === 'REALIZADA') return { texto: '✅ Realizada', clase: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', porConfirmar: false };
  if (estado === 'CANCELADA') return { texto: '⛔ Cancelada', clase: 'bg-red-500/10 text-red-300 border-red-500/30', porConfirmar: false };
  if (paso) return { texto: '⚠ Por confirmar', clase: 'bg-amber-500/10 text-amber-300 border-amber-500/30', porConfirmar: true };
  if (estado === 'REPROGRAMADA') return { texto: '🔁 Reprogramada', clase: 'bg-sky-500/10 text-sky-300 border-sky-500/30', porConfirmar: false };
  return { texto: '🗓 Programada', clase: 'bg-[#272839] text-[#b0b0c4] border-[#313248]', porConfirmar: false };
}

// Fecha → valor para <input type="datetime-local"> en la hora local del navegador
function aInputFechaHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SelectorEstadoEvaluacion({ seccion, onCambiar }: { seccion: SeccionExamen; onCambiar?: (s: SeccionExamen, estado: string, fecha?: Date) => Promise<boolean> }) {
  const [abierto, setAbierto] = useState(false);
  const [reprogramando, setReprogramando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
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
  const opcion = 'w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[#272839] text-[#d0d0da] disabled:opacity-50';
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" disabled={!onCambiar} onClick={() => setAbierto(a => !a)} title="Cambiar el estado de la evaluación"
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${v.clase} ${onCambiar ? 'hover:brightness-125 cursor-pointer' : 'cursor-default'}`}>
        {guardando ? '...' : v.texto}
      </button>
      {abierto && (
        <div className="absolute z-50 left-0 top-full mt-1 w-60 p-1.5 bg-[#1b1c2b] border border-[#313248] rounded-xl shadow-2xl">
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
              <label className="text-[11px] text-[#8a8b9e] block">Nueva fecha y hora</label>
              <input type="datetime-local" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)}
                className="w-full bg-[#272839] border border-[#313248] rounded-lg px-2 py-1.5 text-xs text-[#e0e0ec] [color-scheme:dark]" />
              <p className="text-[10px] text-[#6a6b7e]">Los recordatorios se enviarán de nuevo para la nueva fecha.</p>
              <div className="flex gap-2">
                <button className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[#272839] text-[#b0b0c4]" onClick={() => setReprogramando(false)}>Volver</button>
                <button disabled={guardando || !nuevaFecha} className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-[#818cf8] text-white font-semibold disabled:opacity-50"
                  onClick={() => elegir('REPROGRAMADA', new Date(nuevaFecha))}>Guardar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ENVIAR EL PLAN DE ACCIÓN POR WHATSAPP (estudiantes de la sección)
// ============================================
const MENSAJE_PLAN_DEFECTO = 'Hola {nombre} 👋\nTe comparto el plan de evaluación de *{materia}* (sección {seccion}). Revísalo con calma y guárdalo.';

function EnviarPlanWhatsApp({ seccion, lista, materia, fechaExamen, onCerrar, agregarNotificacion }: {
  seccion: string; lista: SeccionExamen[]; materia: string; fechaExamen: Date | string;
  onCerrar: () => void; agregarNotificacion: (m: string) => void;
}) {
  interface EstudianteFila { id: string; nombre: string; telefono: string | null; estado?: string }
  interface EnvioFila { id: string; estudianteId: string | null; nombre: string; estado: string; error: string | null }
  const [estudiantes, setEstudiantes] = useState<EstudianteFila[] | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [buscar, setBuscar] = useState('');
  const [mensaje, setMensaje] = useState(MENSAJE_PLAN_DEFECTO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioFila[]>([]);
  const tieneTelefono = (e: EstudianteFila) => (e.telefono || '').replace(/\D/g, '').length >= 7;

  useEffect(() => {
    let vivo = true;
    setEstudiantes(null); setErrorCarga('');
    fetch(`/api/estudiantes?grupo=${encodeURIComponent(seccion)}`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los estudiantes.'); return d; })
      .then((d: any) => {
        if (!vivo) return;
        const activos: EstudianteFila[] = (Array.isArray(d) ? d : []).filter((e: any) => String(e.estado || 'ACTIVO').toUpperCase() === 'ACTIVO');
        setEstudiantes(activos);
        setMarcados(activos.filter(tieneTelefono).map(e => e.id)); // por defecto: todos los que tienen teléfono
      })
      .catch((e: any) => { if (vivo) setErrorCarga(e.message); });
    return () => { vivo = false; };
  }, [seccion]);

  // Seguimiento del envío: n8n manda de a uno, así que se consulta el avance cada 2,5 s
  useEffect(() => {
    if (!loteId) return;
    let vivo = true; let vueltas = 0;
    const consultar = async () => {
      vueltas++;
      const r = await fetch(`/api/whatsapp/envios?lote=${encodeURIComponent(loteId)}`).catch(() => null);
      const d = r && r.ok ? await r.json().catch(() => null) : null;
      if (!vivo) return;
      const items: EnvioFila[] = d?.items || [];
      if (items.length) setEnvios(items);
      const pendientes = items.filter(i => i.estado === 'PENDIENTE').length;
      if ((items.length && pendientes === 0) || vueltas > 300) {
        clearInterval(t);
        const ok = items.filter(i => i.estado === 'ENVIADO').length;
        if (items.length) agregarNotificacion(`📤 Plan de la sección ${seccion}: ${ok} de ${items.length} enviado(s) por WhatsApp.`);
      }
    };
    const t = setInterval(consultar, 2500);
    consultar();
    return () => { vivo = false; clearInterval(t); };
  }, [loteId]);

  const visibles = (estudiantes || []).filter(e => !buscar.trim() || e.nombre.toLowerCase().includes(buscar.trim().toLowerCase()));
  const elegibles = (estudiantes || []).filter(tieneTelefono);
  const todosMarcados = elegibles.length > 0 && elegibles.every(e => marcados.includes(e.id));
  const sinTelefono = (estudiantes || []).length - elegibles.length;
  const alternar = (id: string) => setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const enviar = async () => {
    if (marcados.length === 0 || enviando) return;
    setEnviando(true); setError('');
    try {
      const r = await fetch('/api/whatsapp/enviar-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seccion, estudianteIds: marcados, mensaje,
          plan: {
            materia, fechaExamen: new Date(fechaExamen).toISOString(),
            secciones: lista.map(s => ({
              nombre: s.nombre, tipoActividad: s.tipoActividad, peso: s.peso, fecha: s.fecha ? new Date(s.fecha).toISOString() : null,
              descripcion: s.descripcion, enfoque: s.enfoque, tiempoEstimadoMinutos: s.tiempoEstimadoMinutos,
              cantidadGrupos: s.cantidadGrupos, personasPorGrupo: s.personasPorGrupo,
            })),
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el plan.');
      setLoteId(d.loteId);
      agregarNotificacion(`📤 Enviando el plan a ${d.total} estudiante(s) de la sección ${seccion}...`);
    } catch (e: any) {
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor.' : e.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviados = envios.filter(e => e.estado === 'ENVIADO').length;
  const fallidos = envios.filter(e => e.estado === 'FALLIDO').length;
  const pendientes = envios.filter(e => e.estado === 'PENDIENTE').length;

  return (
    <div className="w-full rounded-xl border border-[#818cf8]/20 bg-[#1f2035] text-[#d0d0da] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#313248] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><Send className="w-5 h-5 text-emerald-300" /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Enviar plan por WhatsApp · Sección {seccion}</h3>
          <p className="text-xs text-[#8a8b9e]">Solo estudiantes activos del grupo {seccion} · {lista.length} evaluación(es) en el plan</p>
        </div>
        <button onClick={onCerrar} className="ml-auto p-1.5 text-[#8a8b9e] hover:text-white hover:bg-[#272839] rounded-lg" aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>

      {loteId ? (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3"><p className="text-xl font-bold text-emerald-300">{enviados}</p><p className="text-[11px] text-[#8a8b9e]">Enviados</p></div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3"><p className="text-xl font-bold text-amber-300">{pendientes}</p><p className="text-[11px] text-[#8a8b9e]">En cola</p></div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3"><p className="text-xl font-bold text-red-300">{fallidos}</p><p className="text-[11px] text-[#8a8b9e]">Fallidos</p></div>
          </div>
          {pendientes > 0 && <p className="text-xs text-[#8a8b9e]">Se envían de a uno, con unos segundos entre cada mensaje para que WhatsApp no lo tome como spam. Puedes cerrar esta ventana: el envío continúa.</p>}
          <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-[#282a3f] border border-[#282a3f] rounded-xl">
            {envios.map(e => (
              <div key={e.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <span className="w-5 text-center">{e.estado === 'ENVIADO' ? '✅' : e.estado === 'FALLIDO' ? '❌' : '⏳'}</span>
                <span className="flex-1 truncate">{e.nombre}</span>
                {e.error && <span className="text-[11px] text-red-300 truncate max-w-[50%]" title={e.error}>{e.error}</span>}
              </div>
            ))}
            {envios.length === 0 && <div className="px-3 py-6 text-center text-xs text-[#8a8b9e]">Preparando el envío...</div>}
          </div>
          <div className="flex justify-end"><button onClick={onCerrar} className="px-4 py-2 text-sm rounded-xl bg-[#272839] hover:bg-[#2e2f42] text-[#d0d0da]">Cerrar</button></div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {errorCarga && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{errorCarga}</p>}
          {!estudiantes && !errorCarga && <div className="py-8 text-center text-sm text-[#8a8b9e]">Cargando estudiantes de la sección {seccion}...</div>}
          {estudiantes && estudiantes.length === 0 && (
            <div className="py-8 text-center text-sm text-[#8a8b9e]">No hay estudiantes activos en el grupo {seccion}. Agrégalos en la pestaña Estudiantes.</div>
          )}
          {estudiantes && estudiantes.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={todosMarcados} onChange={() => setMarcados(todosMarcados ? [] : elegibles.map(e => e.id))} className="w-4 h-4 accent-[#818cf8]" />
                  Todos ({elegibles.length})
                </label>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-[#6a6b7e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar estudiante..." className="w-full bg-[#191a26] border border-[#313248] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e0e0ec] outline-none focus:border-[#818cf8]/50" />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-[#282a3f] border border-[#282a3f] rounded-xl">
                {visibles.map(e => {
                  const ok = tieneTelefono(e);
                  return (
                    <label key={e.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${ok ? 'cursor-pointer hover:bg-[#232438]' : 'opacity-50 cursor-not-allowed'}`}>
                      <input type="checkbox" disabled={!ok} checked={ok && marcados.includes(e.id)} onChange={() => alternar(e.id)} className="w-4 h-4 accent-[#818cf8]" />
                      <span className="flex-1 truncate">{e.nombre}</span>
                      <span className="text-[11px] text-[#8a8b9e]">{ok ? `📞 …${(e.telefono || '').replace(/\D/g, '').slice(-4)}` : 'Sin teléfono'}</span>
                    </label>
                  );
                })}
              </div>
              {sinTelefono > 0 && <p className="text-[11px] text-amber-300">{sinTelefono} estudiante(s) sin teléfono no recibirán el plan.</p>}
              <div>
                <label className="text-[11px] font-semibold text-[#8a8b9e] uppercase tracking-wider block mb-1.5">Mensaje que acompaña al PDF</label>
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} maxLength={900}
                  className="w-full bg-[#191a26] border border-[#313248] rounded-xl px-3 py-2 text-sm text-[#e0e0ec] outline-none focus:border-[#818cf8]/50 resize-none custom-scrollbar" />
                <p className="text-[10px] text-[#6a6b7e] mt-1">{'{nombre}'} se cambia por el nombre de cada estudiante; {'{materia}'} y {'{seccion}'} también se reemplazan.</p>
              </div>
              {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button onClick={onCerrar} className="px-4 py-2 text-sm rounded-xl bg-[#272839] hover:bg-[#2e2f42] text-[#b0b0c4]">Cancelar</button>
                <button onClick={enviar} disabled={marcados.length === 0 || enviando}
                  className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {enviando ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Preparando PDF...</>) : (<><Send className="w-4 h-4" />Enviar a {marcados.length} estudiante{marcados.length === 1 ? '' : 's'}</>)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DragDropSecciones({ secciones, onReorder, onEdit, onDelete, agregarNotificacion, pdfUrl, pdfAbierto, setPdfAbierto, mostrarMenuEnvio, setMostrarMenuEnvio, scrollToTarjeta, planificacion, setPdfUrl, mensajeWhatsApp, setMensajeWhatsApp, enviarA, setEnviarA, filtroEnvio, setFiltroEnvio, generarPDF, selectedIds, onToggleSelect, seccionesPlan, profesor, seccionActiva = 'A', onCambiarEstado }: any) {
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
              <Tooltip text={mostrarMenuEnvio ? 'Volver al plan' : 'Enviar por WhatsApp'}>
                <button
                  onClick={() => {
                    // Un toque abre (o cierra) la ventana de envío; si el plan estaba contraído, primero lo despliega
                    if (mostrarMenuEnvio) { setMostrarMenuEnvio(false); return; }
                    if (pdfAbierto) setMostrarMenuEnvio(true);
                    else { setPdfAbierto(true); setTimeout(() => setMostrarMenuEnvio(true), 250); }
                  }}
                  aria-label="Enviar el plan por WhatsApp"
                  className={`p-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
                    mostrarMenuEnvio
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                      : 'text-[#8a8b9e] hover:text-sky-400 hover:bg-sky-500/10 border-transparent'
                  }`}
                >
                  <Send className="w-4 h-4" />
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
                  <motion.div key="envio" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.2 }}>
                    <EnviarPlanWhatsApp seccion={seccionActiva} lista={listaPlan} materia={planificacion.materia || 'Asignatura'} fechaExamen={planificacion.fechaExamen} onCerrar={() => setMostrarMenuEnvio(false)} agregarNotificacion={agregarNotificacion} />
                  </motion.div>
                ) : (
                  <motion.div key="pdf" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.2 }} className="w-full h-[600px] overflow-y-auto border border-slate-200 rounded-xl bg-white text-slate-800 font-sans shadow-lg custom-scrollbar">
                    <div className="p-10 relative">
                      <div className="absolute top-10 right-10 text-[10px] uppercase tracking-widest font-bold text-[#818cf8] bg-[#818cf8]/10 border border-[#818cf8]/20 px-3 py-1 rounded-md">Plan v1.0</div>
                      <div className="mb-8 border-b-2 border-[#1e3a8a] pb-6"><span className="text-[11px] font-bold text-[#60a5fa] uppercase tracking-widest">Plan de Acción</span><h2 className="text-3xl font-black text-[#1e3a8a] mt-1">{planificacion.materia || 'Asignatura'}</h2><div className="flex gap-6 mt-3 text-xs text-slate-500"><p>👤 {profesor ? `Prof. ${profesor}` : 'Docente'}</p><p>📅 {planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir'}</p></div></div>
                      <div className="overflow-x-auto mb-8 rounded-xl border border-slate-200"><table className="w-full border-collapse text-left bg-white"><thead><tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500"><th className="p-4">Contenido</th><th className="p-4">Estrategia</th><th className="p-4 text-center">Peso</th><th className="p-4 text-center">Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">{listaPlan.map((sec: SeccionExamen, idx: number) => (<tr key={sec.id||idx}><td className="p-4 font-medium text-slate-700">{sec.nombre?.replace(/^(Evaluación [1-4]:|Evaluacion [1-4]:)\s*/i,'')||'Sin Nombre'}</td><td className="p-4 text-slate-600">{sec.tipoActividad||'Desarrollo'}</td><td className="p-4 text-center font-bold text-[#1e3a8a]">{sec.peso||0}%</td><td className="p-4 text-center text-slate-600">{sec.fecha ? new Date(sec.fecha).toLocaleDateString() : (planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : '—')}</td></tr>))}</tbody></table></div>
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
            />
          );
        })}
      </Reorder.Group>
      <div className="space-y-2">
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
// TARJETA DE EVALUACIÓN (draggable individual, fluida con Framer Motion)
// ============================================
function TarjetaEvaluacion({ seccion, index, isSelected, onToggleSelect, expanded, onToggleExpand, onEdit, onDelete, onEnviar, enviando, onCambiarEstado }: {
  seccion: SeccionExamen; index: number; isSelected: boolean; onToggleSelect?: (id: string) => void;
  expanded: boolean; onToggleExpand: () => void; onEdit: (s: SeccionExamen) => void; onDelete: (id: string) => void;
  onEnviar: (s: SeccionExamen) => void; enviando: boolean; onCambiarEstado?: (s: SeccionExamen, estado: string, fecha?: Date) => Promise<boolean>;
}) {
  const dragControls = useDragControls();
  const nombreLimpio = limpiarTexto(seccion.nombre);
  return (
    <Reorder.Item
      as="div"
      value={seccion}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{ scale: 1.03, boxShadow: '0 18px 40px rgba(0,0,0,0.45)', zIndex: 50, cursor: 'grabbing' }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="bg-[#1f2035] rounded-xl border border-[#313248] hover:border-[#414258] select-none relative"
    >
      <div className="p-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-[#272839] transition-colors text-[#6a6b7e] touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <Tooltip text={isSelected ? 'Incluida en el Plan de Acción (clic para quitarla)' : 'Fuera del Plan de Acción (clic para incluirla)'}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (onToggleSelect) onToggleSelect(seccion.id); }}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 border transition-all duration-150 ${isSelected ? 'bg-[#a855f7] border-[#a855f7] text-white shadow-[0_0_10px_rgba(168,85,247,0.6)] scale-110' : 'bg-[#272839] border-transparent text-[#8a8b9e] hover:border-[#a855f7]/50 hover:text-[#c084fc]'}`}
          >
            {index + 1}
          </button>
        </Tooltip>
        <div className="flex-1 min-w-[140px] cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#818cf8] flex-shrink-0" /><h4 className="text-sm text-[#d0d0da] font-medium truncate">{nombreLimpio}</h4><SelectorEstadoEvaluacion seccion={seccion} onCambiar={onCambiarEstado} /></div>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-[#b0b0c4]">
            {seccion.peso != null && <span>{seccion.peso}%</span>}
            {seccion.tipoActividad && <span>🎯 {seccion.tipoActividad}</span>}
            {seccion.enfoque && <span>📌 {seccion.enfoque}</span>}
            {seccion.tiempoEstimadoMinutos && <span>⏱️ {seccion.tiempoEstimadoMinutos} min</span>}
            {seccion.cantidadGrupos && <span>👥 {seccion.cantidadGrupos} grupos</span>}
            {seccion.fecha && <span>📅 {new Date(seccion.fecha).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <Tooltip text="Ver Detalle"><button onClick={onToggleExpand} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button></Tooltip>
          <Tooltip text="Enviar"><button onClick={() => onEnviar(seccion)} disabled={enviando} className="p-1.5 text-[#8a8b9e] hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{enviando ? <div className="w-4 h-4 border-2 border-t-emerald-400 rounded-full animate-spin" /> : <Send className="w-4 h-4" />}</button></Tooltip>
          <Tooltip text="Editar"><button onClick={() => onEdit(seccion)} className="p-1.5 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-lg"><Pencil className="w-4 h-4" /></button></Tooltip>
          <Tooltip text="Eliminar"><button onClick={() => onDelete(seccion.id)} className="p-1.5 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></Tooltip>
        </div>
      </div>
      <AnimatePresence>{expanded && seccion.descripcion && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#313248]"><div className="p-3 pl-14 text-sm text-[#c0c0cc] whitespace-pre-wrap">{seccion.descripcion}</div></motion.div>)}</AnimatePresence>
    </Reorder.Item>
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
            <input type="number" value={ev.duracionMinutos ?? ''} onChange={(e) => setEv({...ev, duracionMinutos: e.target.value ? parseInt(e.target.value) : null})} className="flex-1 min-w-0 h-12 px-2.5 bg-[#1f2035] border border-r-0 border-[#313248] rounded-l-xl text-sm text-[#d8d8e2] placeholder-[#6a6b7e] focus:border-[#818cf8]/40 outline-none transition-all duration-200 font-['Inter'] text-center" placeholder="0" />
            <select value={ev.duracionUnidad || 'min'} onChange={(e) => setEv({...ev, duracionUnidad: e.target.value as 'min' | 'hrs'})} className="w-[48px] h-12 bg-[#1f2035] border border-[#313248] rounded-r-xl text-[11px] font-bold text-[#818cf8] text-center outline-none cursor-pointer appearance-none">
              <option value="min" className="bg-[#1f2035]">min</option>
              <option value="hrs" className="bg-[#1f2035]">hrs</option>
            </select>
          </div>
        </div>
        <div className="w-[88px] flex-shrink-0"><label className={`${labelBase} text-center`}>Pond.</label><div className="relative"><input type="number" min={0} max={100} value={ev.peso ?? ''} onChange={(e) => { const v = e.target.value ? Math.min(100, Math.max(0, parseInt(e.target.value))) : null; setEv({...ev, peso: v}); }} className={`${smallInput} pr-9`} placeholder="0" /><span className="absolute inset-y-0 right-0 flex items-center pr-1.5 pointer-events-none"><span className="text-[11px] font-bold text-[#818cf8] bg-[#818cf8]/10 px-1.5 py-0.5 rounded-md">%</span></span></div></div>
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
          <StreamTextarea
            value={ev.descripcion ?? ''}
            onChange={(val: string) => { setEv((prev: EvaluacionFormulario) => ({...prev, descripcion: val, errores: {...prev.errores, descripcion: undefined}, origenAgente: {...prev.origenAgente, descripcion: false}})); }}
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
function AgentePanel({ seccionActiva = 'A', expandido, setExpandido, planificacion, setPlanificacion, setPropuestaPendiente, onAccept, setVistaPanel, setPdfUrl, setPdfAbierto, agregarNotificacion, generarPDF, limpiarYScroll, totalEstudiantes = 8, config, usuarioId, esMovil = false, anchoChat = 640, esSuperadmin = false }: any) {
  // Atajos del encabezado del chat: llevan al panel de la derecha (en el celular el chat se oculta para dejarlo ver)
  const irAPanel = (vista: string) => { setVistaPanel(vista); if (esMovil) setExpandido(false); };
  const [mensaje, setMensaje] = useState(''); 
  // Configuración del superadmin: dirección de n8n, tiempo máximo y lo que se le pide al modelo en cada mensaje
  const urlChat: string = config?.chat?.webhookUrl || process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678';
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
  const [navegarAlPlan, setNavegarAlPlan] = useState(false);
  const [propuestaPendienteLocal, setPropuestaPendienteLocal] = useState<any>(null);
  const hayPropuestaRef = useRef(false);
  useEffect(() => { hayPropuestaRef.current = !!propuestaPendienteLocal; }, [propuestaPendienteLocal]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // El cuadro de texto crece con el contenido (hasta 160px)
  useEffect(() => { const t = textareaRef.current; if (!t) return; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 120)}px`; }, [mensaje]);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
  // NOTA: scrollToBottom ahora respeta si el usuario se desplazó hacia arriba (ver comprobarSiEstaAbajo),
  // por lo que estos efectos ya no lo arrastran forzosamente hacia abajo mientras lee mensajes anteriores.
  
  const onTypewriterComplete = useCallback((mensajeId: string) => { 
    setTimeout(() => { 
      setEscribiendo(false); 
      setHistorial(prev => prev.map(m => m.id === mensajeId ? { ...m, completo: true } : m)); 
      if (hayPropuestaRef.current) setNavegarAlPlan(true); 
    }, 0); 
  }, []);

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

  const esSolicitudPlanAccion = (msg: string): boolean => {
    const msgLower = msg.toLowerCase().trim();
    return msgLower.includes('plan de acción') || msgLower.includes('plan de accion') || msgLower.includes('genera plan');
  };

  const esNegacion = (msg: string): boolean => {
    const msgLower = msg.toLowerCase().trim();
    const palabrasNegativas = ['no quiero','no quiera','no generar','no crees','no hagas','cancelar','cancela','cancel','rechazar','rechaza','rechazo','descartar','descarta','no guardar','no guardes','olvida','olvídalo','olvidalo','mejor no'];
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
    // Las evaluaciones del chat se guardan en la sección que está abierta en el planificador
    nuevasSecciones.forEach(n => { n.grupoSeccion = seccionActiva; });
    setPlanificacion((prev: PlanificacionExamen) => {
      let secciones = [...prev.secciones];
      nuevasSecciones.forEach((nueva, idx) => {
        const tipoBuscado = (propuestaPendienteLocal.evaluaciones[idx]?.tipo || `Evaluación ${idx + 1}`).toLowerCase();
        // Solo se reemplaza una evaluación con el mismo número DENTRO de la misma sección (antes podía pisar la de otra sección)
        const indiceExistente = secciones.findIndex(s => (s.grupoSeccion || 'A') === seccionActiva && s.nombre.toLowerCase().startsWith(`${tipoBuscado}:`));
        if (indiceExistente !== -1) {
          // Ya existe una evaluación con ese mismo número/tipo → se actualiza en su lugar (edición)
          secciones[indiceExistente] = { ...nueva, id: secciones[indiceExistente].id, grupoSeccion: secciones[indiceExistente].grupoSeccion };
        } else {
          secciones = [...secciones, nueva];
        }
      });
      return { ...prev, secciones };
    });
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
    const verbosBorrar = '(borrar|borra|eliminar|elimina|quitar|quita|suprimir|suprime)';
    const borrarTodasRegex = new RegExp(`^${verbosBorrar}\\s+(todas\\s+las\\s+)?evaluacion(es)?(\\s*guardad[ao]s?)?$`, 'i');
    if (borrarTodasRegex.test(msgLower)) { setPlanificacion((prev: PlanificacionExamen) => ({ ...prev, secciones: [] })); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: '🗑️ Todas las evaluaciones han sido eliminadas.', completo: true, id: `agent-${Date.now()}` }]); return true; }
    const borrarUnaRegex = new RegExp(`^${verbosBorrar}\\s+(la\\s+)?evaluaci[oó]n\\s+(\\d+)`, 'i');
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
    scrollToBottom(true);
    if (manejarComandoEliminacion(msg)) { setPensando(false); return; }
    if (propuestaPendienteLocal && esNegacion(msg)) { setPensando(false); cancelarPropuesta(); return; }
    if (propuestaPendienteLocal && esConfirmacionGuardado(msg)) { setPensando(false); const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } return; }
    if ((msg.trim().toLowerCase() === 'aceptar' || msg.trim().toLowerCase() === 'si' || msg.trim().toLowerCase() === 'sí') && propuestaPendienteLocal) { setPensando(false); const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } return; }
    // Chat apagado o mensaje demasiado largo (configurado por el superadmin). Los comandos locales de arriba siguen funcionando.
    if (config && !config.chat.activo) { setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: '⏸️ ' + config.chat.mensajeInactivo, completo: true, id: `agent-${Date.now()}` }]); return; }
    if (config && msg.length > config.chat.maxCaracteresMensaje) { setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: `✂️ Tu mensaje tiene ${msg.length} caracteres y el máximo permitido es ${config.chat.maxCaracteresMensaje}. Acórtalo e inténtalo de nuevo.`, completo: true, id: `agent-${Date.now()}` }]); return; }
    if (esSolicitudPlanAccion(msg) && !propuestaPendienteLocal) { if (esNegacion(msg)) { setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'De acuerdo, no generaré el plan de acción.', completo: true, id: `agent-${Date.now()}` }]); return; } try { const response = await fetch(`${urlChat}/webhook/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(tiempoChat), body: JSON.stringify({ mensaje: msg, historial: historial.slice(-10), planificacion, totalEstudiantes, sessionId: usuarioId, config: configParaN8n, accion: 'plan_accion' }) }); const data = await response.json(); setPensando(false); const agentMsgId = `agent-${Date.now()}`; setHistorial(prev => [...prev, { rol: 'agent', contenido: data.respuesta, completo: false, id: agentMsgId }]); setEscribiendo(true); let datosExtraidos = null; if (data.datos && data.datos.evaluaciones?.length) { datosExtraidos = data.datos; } else { const jsonExtraido = extraerJSONDelTexto(data.respuesta); if (jsonExtraido?.evaluaciones) datosExtraidos = jsonExtraido; } if (datosExtraidos) { datosExtraidos = unirPropuesta(propuestaPendienteLocal, datosExtraidos, msg); setPropuestaPendienteLocal(datosExtraidos); setPropuestaPendiente(datosExtraidos); } } catch (error) { console.error('Error:', error); setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'Error de conexión.', completo: true, id: `error-${Date.now()}` }]); } return; }
    try { const response = await fetch(`${urlChat}/webhook/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(tiempoChat), body: JSON.stringify({ mensaje: msg, historial: historial.slice(-10), planificacion, totalEstudiantes, sessionId: usuarioId, config: configParaN8n }) }); const data = await response.json(); setPensando(false); const agentMsgId = `agent-${Date.now()}`; setHistorial(prev => [...prev, { rol: 'agent', contenido: data.respuesta, completo: false, id: agentMsgId }]); setEscribiendo(true); let datosExtraidos = null; if (data.datos && data.datos.evaluaciones?.length) { datosExtraidos = data.datos; } else { const jsonExtraido = extraerJSONDelTexto(data.respuesta); if (jsonExtraido?.evaluaciones) datosExtraidos = jsonExtraido; } if (datosExtraidos) { if (esNegacion(msg)) { setPropuestaPendienteLocal(null); setPropuestaPendiente(null); if (limpiarYScroll) limpiarYScroll(); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'De acuerdo, he descartado los resultados de la evaluación.', completo: true, id: `agent-${Date.now()}` }]); } else { setPropuestaPendienteLocal(datosExtraidos); setPropuestaPendiente(datosExtraidos); } } } catch (error) { console.error('Error:', error); setPensando(false); setHistorial(prev => [...prev, { rol: 'agent', contenido: 'Error de conexión.', completo: true, id: `error-${Date.now()}` }]); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleMicClick = async () => {
    if (isRecording) { if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); setIsRecording(false); } else {
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); audioChunksRef.current = []; mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); }; mediaRecorder.onstop = async () => { stream.getTracks().forEach(t => t.stop()); setTranscribiendo(true); const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const formData = new FormData(); formData.append('file', audioBlob, 'audio.webm'); try { const res = await fetch(`${urlChat}/webhook/voice`, { method: 'POST', body: formData }); const data = await res.json(); if (data.text) setMensaje(prev => prev ? prev + " " + data.text : data.text); } catch (err) { alert("Error al transcribir."); } finally { setTranscribiendo(false); } }; mediaRecorder.start(); mediaRecorderRef.current = mediaRecorder; setIsRecording(true); } catch (err) { alert("No se pudo acceder al micrófono."); }
    }
  };

  const chatInactivo = !!config && !config.chat.activo;
  const ocupado = pensando || escribiendo || transcribiendo;
  const estadoTexto = chatInactivo ? 'Desactivado' : pensando ? 'Pensando...' : escribiendo ? 'Escribiendo...' : isRecording ? 'Escuchando...' : transcribiendo ? 'Transcribiendo...' : 'En línea';
  const limiteCaracteres: number = config?.chat?.maxCaracteresMensaje ?? 2000;

  const adjuntarArchivo = async (archivo?: File) => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!archivo) return;
    if (!/\.(txt|csv|md)$/i.test(archivo.name)) { setHistorial(prev => [...prev, { rol: 'agent', contenido: '📎 Por ahora solo puedo leer archivos de texto (.txt, .csv o .md).', completo: true, id: `agent-${Date.now()}` }]); return; }
    try {
      const texto = (await archivo.text()).trim();
      if (!texto) return;
      setMensaje(prev => (prev ? prev + '\n\n' : '') + `Contenido de «${archivo.name}»:\n` + texto.slice(0, limiteCaracteres));
      textareaRef.current?.focus();
    } catch { setHistorial(prev => [...prev, { rol: 'agent', contenido: '📎 No se pudo leer el archivo.', completo: true, id: `agent-${Date.now()}` }]); }
  };

  const renderOpciones = (contenido: string) => {
    const opciones = detectarOpciones(limpiarBloqueJSON(contenido));
    if (opciones.length === 0) return null;
    return (<div className="flex flex-wrap gap-2 mt-3">{opciones.map((op, i) => { const esAceptar = op.accion.includes('Aceptar') || op.accion.includes('Guardar'); return (<button key={i} onClick={async () => { if (esAceptar) { if (!propuestaPendienteLocal?.evaluaciones) { setHistorial(prev => [...prev, { rol: 'agent', contenido: '⚠️ No hay propuesta para guardar. Genera un plan primero.', completo: true, id: `agent-${Date.now()}` }]); return; } const resultado = await guardarEvaluacionesDirecto(); setHistorial(prev => [...prev, { rol: 'agent', contenido: resultado.success ? resultado.mensaje : '⚠️ ' + resultado.mensaje, completo: true, id: `agent-${Date.now()}` }]); if (resultado.success) { setNavegarAlPlan(true); setVistaPanel('planificacion'); } } else { handleSend(traducirOpcion(op.accion)); } }} disabled={pensando || escribiendo} className="px-3 py-1.5 bg-[#818cf8]/10 hover:bg-[#818cf8]/20 border border-[#818cf8]/20 rounded-xl text-sm text-[#c0c0d0] transition-all cursor-pointer disabled:opacity-50">{op.emoji} {op.texto}</button>); })}</div>);
  };

  return (
    <motion.div animate={esMovil ? { x: expandido ? 0 : '-100%' } : { width: expandido ? anchoChat : 0, opacity: expandido ? 1 : 0 }} transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }} className={esMovil ? 'fixed inset-0 z-50 border-r border-[#282a3f] flex flex-col bg-[#191a26] overflow-hidden' : 'relative border-r border-[#282a3f] flex flex-col self-stretch min-h-0 max-h-full flex-shrink-0 bg-[#191a26] overflow-hidden'} style={esMovil ? { height: '100dvh', pointerEvents: expandido ? 'auto' : 'none' } : { minWidth: expandido ? anchoChat : 0 }} aria-hidden={!expandido}>
      <div className="flex-shrink-0 px-3 sm:px-6 py-4 border-b border-[#282a3f] flex items-center gap-3 bg-gradient-to-r from-[#191a26] to-[#1f2035]"><div className="relative"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center shadow-lg shadow-[#818cf8]/30"><Bot className="w-5 h-5 text-white" /></div><div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#191a26] flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /></div></div><div className="min-w-0"><h2 className="text-sm font-semibold text-[#d0d0da] font-['Inter'] flex items-center gap-2 flex-wrap">Agente planificador de evaluaciones<span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">IA</span></h2><p className="text-xs text-[#8a8b9e] flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full inline-block ${chatInactivo ? 'bg-[#6a6b7e]' : ocupado ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`}></span>{estadoTexto}</p></div><div className="ml-auto flex items-center gap-2 flex-shrink-0"><div className="flex items-center gap-0.5 p-1 bg-[#161722]/80 border border-[#282a3f] rounded-xl">{esSuperadmin && (<Tooltip text="Configuración del agente" lado="abajo"><button onClick={() => irAPanel('sistema')} aria-label="Configuración del agente" className="p-2 text-[#8a8b9e] hover:text-[#c7d2fe] hover:bg-[#818cf8]/15 rounded-lg transition-colors"><Settings className="w-4 h-4" /></button></Tooltip>)}<Tooltip text="Planificador de evaluaciones" lado="abajo"><button onClick={() => irAPanel('planificacion')} aria-label="Planificador de evaluaciones" className="p-2 text-[#8a8b9e] hover:text-[#c7d2fe] hover:bg-[#818cf8]/15 rounded-lg transition-colors"><ClipboardList className="w-4 h-4" /></button></Tooltip></div><Tooltip text={esMovil ? 'Ocultar chat' : 'Ocultar chat (Ctrl+B)'} lado="abajo" alinear="derecha"><motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={() => setExpandido(false)} aria-label="Ocultar el chat" className="group/ocultar w-9 h-9 flex items-center justify-center rounded-xl border border-[#818cf8]/25 bg-gradient-to-br from-[#818cf8]/15 to-[#6366f1]/5 text-[#a5b4fc] hover:text-white hover:border-[#818cf8]/60 hover:from-[#818cf8]/40 hover:to-[#6366f1]/25 hover:shadow-lg hover:shadow-[#818cf8]/25 transition-all"><PanelLeftClose className="w-[18px] h-[18px] transition-transform duration-200 group-hover/ocultar:-translate-x-0.5" /></motion.button></Tooltip></div></div>
      {!isChatStarted ? (<div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-6 custom-scrollbar"><motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center text-center"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#818cf8]/20 to-[#6366f1]/20 flex items-center justify-center border-2 border-[#818cf8]/30 mb-6 shadow-2xl shadow-[#818cf8]/20"><Sparkle className="w-10 h-10 text-[#818cf8]" /></div><h1 className="text-2xl font-bold text-[#d0d0da] font-['Inter'] mb-2">Agente planificador de evaluaciones</h1><p className="text-sm text-[#8a8b9e] font-['Inter'] max-w-sm">Escribe el tema que quieres evaluar o usa el micrófono para hablar.</p></motion.div></div>) : (<div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-5 space-y-6 custom-scrollbar"><AnimatePresence>{historial.map((msg) => (<motion.div key={msg.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex ${msg.rol === 'user' ? 'justify-end' : 'justify-start'}`}>{msg.rol === 'agent' ? (<div className="flex items-start gap-3 max-w-[90%]"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-[#818cf8]/20"><Bot className="w-4 h-4 text-white" /></div><div className="text-base text-[#c0c0cc] leading-relaxed pt-0.5 font-['Inter']">{msg.completo ? (<div><div dangerouslySetInnerHTML={{ __html: formatMessage(msg.contenido) }} />{renderOpciones(msg.contenido)}</div>) : (<TypewriterText text={msg.contenido} onComplete={() => onTypewriterComplete(msg.id)} onUpdate={scrollToBottom} />)}</div></div>) : (<div className="max-w-[85%] px-5 py-3 bg-[#818cf8]/10 text-[#d8d8e2] rounded-2xl rounded-br-md text-base leading-relaxed font-['Inter'] border border-[#818cf8]/20"><span className="whitespace-pre-wrap break-words">{msg.contenido}</span></div>)}</motion.div>))}</AnimatePresence>{pensando && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-3 justify-start"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#818cf8] to-[#6366f1] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#818cf8]/20"><Bot className="w-4 h-4 text-white" /></div><div className="px-4 py-3.5 bg-[#1f2035] rounded-2xl rounded-tl-md border border-[#313248] flex items-center gap-1.5 mt-0.5">{[0,1,2].map(i => (<motion.span key={i} className="w-2 h-2 bg-[#818cf8] rounded-full" animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />))}</div></motion.div>)}<div ref={chatEndRef} /></div>)}
      <div className="flex-shrink-0 p-3 sm:p-5 border-t border-[#282a3f] bg-gradient-to-t from-[#161722] to-transparent"><div className="relative"><motion.div className="absolute -inset-1 rounded-2xl opacity-70" animate={{ opacity: [0.4, 0.6, 0.4] }} transition={{ duration: 4, repeat: Infinity }} style={{ background: 'linear-gradient(90deg, #818cf8, #6366f1, #818cf8)', filter: 'blur(12px)' }} /><motion.div className="relative flex items-end gap-2.5 bg-[#1f2035] border border-[#313248] rounded-2xl px-4 py-3 focus-within:border-[#818cf8]/60 transition-all duration-300 shadow-lg shadow-black/20"><motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar archivo de texto" title="Adjuntar texto (.txt, .csv, .md)" className="p-2 text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839] rounded-xl transition-colors flex-shrink-0 self-end"><Paperclip className="w-5 h-5" /></motion.button><input ref={fileInputRef} type="file" className="hidden" accept=".txt,.csv,.md" onChange={(e) => adjuntarArchivo(e.target.files?.[0])} /><Tooltip text={isRecording ? "Detener grabación" : "Hablar (n8n transcribe)"}><motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={handleMicClick} disabled={transcribiendo || pensando || escribiendo} className={`p-2 rounded-xl transition-colors flex-shrink-0 self-end ${isRecording ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#272839]'} disabled:opacity-50 disabled:cursor-not-allowed`}>{transcribiendo ? (<div className="w-5 h-5 border-2 border-t-red-400 rounded-full animate-spin"></div>) : isRecording ? (<div className="w-3 h-3 bg-red-500 rounded-sm"></div>) : (<Mic className="w-5 h-5" />)}</motion.button></Tooltip><div className="flex-1 relative"><textarea ref={textareaRef} value={mensaje} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMensaje(e.target.value)} onKeyDown={handleKeyDown} placeholder={transcribiendo ? "Transcribiendo..." : "Escribe tu consulta..."} rows={1} className="w-full bg-transparent text-base text-[#d8d8e2] placeholder-[#6a6b7e] outline-none resize-none py-1.5 font-['Inter'] min-h-[40px] max-h-[120px]" style={{ lineHeight: '1.5' }} /></div><motion.button whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }} onClick={() => handleSend()} disabled={!mensaje.trim() || pensando || escribiendo} className={`p-2.5 rounded-xl transition-all flex-shrink-0 self-end ${mensaje.trim() && !pensando && !escribiendo ? 'bg-gradient-to-r from-[#818cf8] to-[#6366f1] text-white hover:shadow-lg hover:shadow-[#818cf8]/30 shadow-md' : 'bg-[#272839] text-[#5a5b6e] cursor-not-allowed'}`}><Send className="w-4 h-4" /></motion.button></motion.div></div></div>
    </motion.div>
  );
}

// ============================================
// PANEL DERECHO (CONFIG Y NOTIFICACIONES MEJORADAS)
// ============================================
type PanelDerechoHandle = { limpiarYScroll: () => void; };
interface UsuarioSesion { id: string; nombre: string; email: string; rol: 'SUPERADMIN' | 'ADMIN' | 'USUARIO'; debeCambiarPassword?: boolean; }
interface PanelDerechoProps { onSeccionActivaCambia?: (letra: string) => void; chatAbierto?: boolean; onAbrirChat?: () => void; usuario?: UsuarioSesion | null; onLogout?: () => void; onUsuarioActualizado?: (u: UsuarioSesion) => void; onConfigActualizada?: (c: ConfigCliente) => void; datosCargados?: boolean; planificacion: PlanificacionExamen; setPlanificacion: React.Dispatch<React.SetStateAction<PlanificacionExamen>>; propuestaPendiente: PropuestaEvaluacion | null; aceptarPropuesta: () => void; setPropuestaPendiente: (p: PropuestaEvaluacion | null) => void; vistaInicial: 'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema'; onCambiarVista: (v: 'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema') => void; pdfUrl: string | null; setPdfUrl: (url: string | null) => void; pdfAbierto: boolean; setPdfAbierto: (abierto: boolean) => void; generarPDF: (secciones?: SeccionExamen[]) => Promise<string | null>; planificacionId: string | null; setPlanificacionId: (id: string | null) => void; }

const PanelDerecho = forwardRef<PanelDerechoHandle, PanelDerechoProps>(function PanelDerecho({ onSeccionActivaCambia, chatAbierto = true, onAbrirChat, usuario, onLogout, onUsuarioActualizado, onConfigActualizada, datosCargados, planificacion, setPlanificacion, propuestaPendiente, aceptarPropuesta, setPropuestaPendiente, vistaInicial, onCambiarVista, pdfUrl: pdfUrlProp, setPdfUrl: setPdfUrlProp, pdfAbierto: pdfAbiertoProp, setPdfAbierto: setPdfAbiertoProp, generarPDF, planificacionId, setPlanificacionId }: PanelDerechoProps, ref) {
  const [vista, setVista] = useState<'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema'>(vistaInicial);
  const [numEvaluaciones, setNumEvaluaciones] = useState(1); 
  const seccionesGuardadasRef = useRef<HTMLDivElement>(null);
  // --- Tarjetas incluidas en el "Plan de Acción" ---
  // Todas empiezan incluidas (círculo morado). Al desmarcar una, sale del plan; al marcarla, vuelve a entrar.
  const [tarjetasExcluidas, setTarjetasExcluidas] = useState<string[]>([]);
  const toggleTarjetaSeleccionada = (id: string) => {
    setTarjetasExcluidas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  // --- Secciones/paralelos (A, B, C...) del grupo de estudiantes que comparten la materia ---
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>(['A', 'B', 'C']);
  // Si al cargar aparecen evaluaciones de otras secciones (ej. 'E'), se agregan a las pestañas
  useEffect(() => {
    const letras = new Set(planificacion.secciones.map((s: SeccionExamen) => s.grupoSeccion || 'A'));
    setSeccionesDisponibles(prev => { const faltan = [...letras].filter(l => !prev.includes(l)); return faltan.length ? [...prev, ...faltan].sort() : prev; });
  }, [planificacion.secciones]);
  const [seccionActiva, setSeccionActiva] = useState<string>('A');
  useEffect(() => { onSeccionActivaCambia?.(seccionActiva); }, [seccionActiva]); // el chat guarda en la sección que estás viendo
  const agregarNuevaSeccion = () => {
    // Genera la siguiente letra disponible después de la última (A, B, C, D...)
    const ultima = seccionesDisponibles[seccionesDisponibles.length - 1] || 'A';
    const siguienteCodigo = ultima.charCodeAt(0) + 1;
    if (siguienteCodigo > 'Z'.charCodeAt(0)) return; // límite razonable
    const nuevaLetra = String.fromCharCode(siguienteCodigo);
    setSeccionesDisponibles(prev => [...prev, nuevaLetra]);
    setSeccionActiva(nuevaLetra);
  };
  const cambiarSeccionActiva = (letra: string) => {
    setSeccionActiva(letra);
  };
  const eliminarSeccionActiva = () => {
    if (seccionesDisponibles.length <= 1) {
      alert('Debe existir al menos una sección activa.');
      return;
    }
    const letra = seccionActiva;
    const restantes = seccionesDisponibles.filter(l => l !== letra);
    const estadoActualizado = { ...planificacion, secciones: planificacion.secciones.filter(s => (s.grupoSeccion || 'A') !== letra) };
    setPlanificacion(estadoActualizado);
    sincronizarConBD(estadoActualizado);
    setSeccionesDisponibles(restantes);
    setSeccionActiva(restantes[0]);
    // Limpia también el plan de acción propio de la sección eliminada
    setPdfPorSeccion(prev => { const copia = { ...prev }; delete copia[letra]; return copia; });
    setPdfAbiertoPorSeccion(prev => { const copia = { ...prev }; delete copia[letra]; return copia; });
    agregarNotificacion(`🗑️ Sección ${letra} eliminada.`);
  };
  // Evaluaciones que pertenecen a la sección activa (A, B, C...)
  const seccionesFiltradas = planificacion.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva);
  // El plan usa solo las evaluaciones de la sección activa que siguen marcadas
  const seccionesParaPlan = seccionesFiltradas.filter((s: SeccionExamen) => !tarjetasExcluidas.includes(s.id));
  const idsSeleccionados = seccionesParaPlan.map((s: SeccionExamen) => s.id);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const [scrollToSections, setScrollToSections] = useState(false);
  const [pdfPorSeccion, setPdfPorSeccion] = useState<Record<string, string | null>>({});
  const [pdfAbiertoPorSeccion, setPdfAbiertoPorSeccion] = useState<Record<string, boolean>>({});
  // Cada sección (A, B, C...) tiene su propio Plan de Acción generado; cambiar de pestaña
  // no debe mostrar el plan de otra sección.
  const pdfUrlLocal = pdfPorSeccion[seccionActiva] ?? null;
  const pdfAbiertoLocal = pdfAbiertoPorSeccion[seccionActiva] ?? false;
  const [cargandoPdf, setCargandoPdf] = useState(false);
  // Marca una evaluación como realizada / reprogramada / cancelada (se guarda al instante en la base de datos)
  const cambiarEstadoEvaluacion = async (sec: SeccionExamen, estado: string, fecha?: Date): Promise<boolean> => {
    try {
      const r = await fetch(`/api/evaluaciones/${encodeURIComponent(sec.id)}/estado`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, fecha: fecha ? fecha.toISOString() : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { agregarNotificacion('❌ ' + (d.error || 'No se pudo cambiar el estado.')); return false; }
      setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => s.id === sec.id ? { ...s, estado: d.estado, fecha: d.fecha ? new Date(d.fecha) : s.fecha } : s) }));
      const textos: Record<string, string> = { REALIZADA: '✅ Evaluación marcada como realizada.', REPROGRAMADA: '🔁 Evaluación reprogramada. Los recordatorios usarán la nueva fecha.', CANCELADA: '⛔ Evaluación cancelada: no se enviarán recordatorios.', PROGRAMADA: '🗓 Evaluación programada de nuevo.' };
      agregarNotificacion(textos[d.estado] || 'Estado actualizado.');
      return true;
    } catch {
      agregarNotificacion('❌ No se pudo conectar con el servidor.');
      return false;
    }
  };
  // Genera el Plan de Acción de la sección activa con la lista indicada (PDF por n8n; si falla, versión HTML)
  const generarPlanAccion = async (lista: SeccionExamen[], silencioso = false) => {
    if (lista.length === 0) { if (!silencioso) alert('No hay evaluaciones marcadas para generar el plan.'); return; }
    setCargandoPdf(true);
    try {
      await new Promise(resolve => requestAnimationFrame(resolve)); // deja que se pinte el spinner
      let urlFinal: string | null = null;
      if (generarPDF) { try { urlFinal = await generarPDF(lista); } catch { console.log('n8n no disponible'); } }
      if (!urlFinal) {
        const html = generarPlanVisual(lista);
        if (html) urlFinal = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      }
      if (urlFinal) {
        setPdfUrl(urlFinal);
        if (!silencioso) setPdfAbierto(false);
        agregarNotificacion(silencioso ? '🔄 Plan de Acción actualizado con las evaluaciones marcadas.' : '📄 Plan de Acción generado correctamente.');
      }
    } catch (err) {
      console.error(err);
      agregarNotificacion('❌ Error al generar el Plan de Acción.');
    } finally {
      setCargandoPdf(false);
    }
  };
  const [campanaActiva, setCampanaActiva] = useState(false);
  const [mostrarMenuEnvio, setMostrarMenuEnvio] = useState(false);
  const [enviarA, setEnviarA] = useState<'profesor' | 'estudiantes' | null>(null);
  const [filtroEnvio, setFiltroEnvio] = useState<'todos' | 'seleccionar' | null>(null);
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');
  const [notificaciones, setNotificaciones] = useState<{id: string, mensaje: string, timestamp: Date, leido: boolean}[]>([{ id: 'bienvenida', mensaje: '👋 Bienvenido al planificador', timestamp: new Date(), leido: false }]);

    // Total de estudiantes registrados (para auto-calcular grupos).
  // Se recalcula por sección/paralelo (A, B, C...) usando el campo "grupo" que ya
  // existe en el modelo de Estudiante, para que el cálculo de equipos de la
  // evaluación corresponda solo a los estudiantes de la sección activa.
  const [totalEstudiantes, setTotalEstudiantes] = useState(8); // 8 por defecto

  useEffect(() => {
    const cargarTotal = async () => {
      try {
        const data = await apiEstudiantes.listar();
        if (Array.isArray(data) && data.length > 0) {
          const delaSeccion = data.filter((e: any) => (e?.grupo || 'A') === seccionActiva);
          // Si aún no hay estudiantes cargados con ese código de sección específico,
          // se usa el total general como respaldo para no bloquear la planificación.
          setTotalEstudiantes(delaSeccion.length > 0 ? delaSeccion.length : data.length);
        }
      } catch {
        // Si falla, mantiene el valor por defecto (8)
      }
    };
    cargarTotal();
  }, [seccionActiva]);

  // Estados para el efecto glow
  const [glow1, setGlow1] = useState(false);
  const [glow2, setGlow2] = useState(false);
  const [glow3, setGlow3] = useState(false);
  const [glow4, setGlow4] = useState(false);

  useEffect(() => { setVista(vistaInicial); }, [vistaInicial]);
  useEffect(() => { onCambiarVista(vista); }, [vista, onCambiarVista]);
  useEffect(() => { if (pdfUrlProp !== undefined) setPdfPorSeccion(prev => ({ ...prev, [seccionActiva]: pdfUrlProp })); }, [pdfUrlProp]);
  useEffect(() => { if (pdfAbiertoProp !== undefined) setPdfAbiertoPorSeccion(prev => ({ ...prev, [seccionActiva]: pdfAbiertoProp })); }, [pdfAbiertoProp]);

  const setPdfUrl = (url: string | null) => { setPdfPorSeccion(prev => ({ ...prev, [seccionActiva]: url })); if (setPdfUrlProp) setPdfUrlProp(url); };
  const setPdfAbierto = (abierto: boolean) => { setPdfAbiertoPorSeccion(prev => ({ ...prev, [seccionActiva]: abierto })); if (setPdfAbiertoProp) setPdfAbiertoProp(abierto); };
  const agregarNotificacion = (mensaje: string) => { setNotificaciones(prev => [{ id: `notif-${Date.now()}`, mensaje, timestamp: new Date(), leido: false }, ...prev.slice(0, 19)]); };
  const scrollToTarjeta = () => { setTimeout(() => { if (tarjetaRef.current) tarjetaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); };
  
  useEffect(() => { if (scrollToSections && seccionesGuardadasRef.current && vista === 'planificacion') { requestAnimationFrame(() => { seccionesGuardadasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setScrollToSections(false); }); } }, [planificacion.secciones, scrollToSections, vista]);

  const evalInit: EvaluacionFormulario = { materia: '', duracionMinutos: null, duracionUnidad: 'min', peso: null, fecha: new Date(), tipoActividad: '', descripcion: '', cantidadGrupos: null, personasPorGrupo: null, editandoId: null, mostrarDescripcion: false, enfoque: '', errores: {}, origenAgente: {}, };
  const [evaluacion1, setEvaluacion1] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion2, setEvaluacion2] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion3, setEvaluacion3] = useState<EvaluacionFormulario>({...evalInit});
  const [evaluacion4, setEvaluacion4] = useState<EvaluacionFormulario>({...evalInit});

  const limpiarYScroll = () => { setEvaluacion1({...evalInit}); setEvaluacion2({...evalInit}); setEvaluacion3({...evalInit}); setEvaluacion4({...evalInit}); setNumEvaluaciones(1); setScrollToSections(true); setVista('planificacion'); setGlow1(false); setGlow2(false); setGlow3(false); setGlow4(false); };
  useImperativeHandle(ref, () => ({ limpiarYScroll }), [limpiarYScroll]);

  // Al marcar o desmarcar una tarjeta, el Plan de Acción ya generado de esta sección se rehace (espera 1 s por si marcas varias)
  const regenerarRef = useRef<() => void>(() => {});
  regenerarRef.current = () => { if (pdfUrlLocal && seccionesParaPlan.length > 0 && !cargandoPdf) generarPlanAccion(seccionesParaPlan, true); };
  const primeraVezExcluidas = useRef(true);
  useEffect(() => {
    if (primeraVezExcluidas.current) { primeraVezExcluidas.current = false; return; }
    const t = setTimeout(() => regenerarRef.current(), 1000);
    return () => clearTimeout(t);
  }, [tarjetasExcluidas]);
    // Función para guardar en Supabase sin interrumpir la UI
  // ----- Guardado en la base de datos -----
  // Los guardados pasan por una cola (uno a la vez): antes, dos guardados seguidos podían crear materias duplicadas
  // o perder cambios. planIdRef guarda el id del plan al instante, sin esperar a que React actualice el estado.
  const planIdRef = useRef<string | null>(planificacionId);
  useEffect(() => { planIdRef.current = planificacionId; }, [planificacionId]);
  const colaSync = useRef<Promise<void>>(Promise.resolve());
  const ultimaFirma = useRef<string | null>(null);
  const [estadoGuardado, setEstadoGuardado] = useState<'inactivo' | 'guardando' | 'guardado' | 'error'>('inactivo');

  const firmaDePlan = (p: PlanificacionExamen) => JSON.stringify([
    p.materia, p.estado, p.tipoExamen, new Date(p.fechaExamen).getTime(), p.duracionMinutos,
    p.secciones.map(s => [s.nombre, s.tipoPregunta, s.nivelBloom, s.peso, s.cantidadPreguntas, s.contenidosEvaluados, s.tiempoEstimadoMinutos, s.tipoActividad, s.descripcion, s.cantidadGrupos, s.personasPorGrupo, s.orden, s.enfoque, s.fecha ? new Date(s.fecha).getTime() : null, s.grupoSeccion || 'A']),
    p.rubrica,
  ]);

  const sincronizarInterno = async (planActualizada: PlanificacionExamen) => {
    const firma = firmaDePlan(planActualizada);
    setEstadoGuardado('guardando');
    try {
      const planId = planIdRef.current;
      let materiaId: string | undefined;
      if (!planId) {
        // Primera vez: se crea la materia y luego el plan
        const resMateria = await fetch('/api/materias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: planActualizada.materia || 'Nueva Asignatura', codigo: `MAT-${Date.now()}` }),
        });
        const nuevaMateria = await resMateria.json();
        if (!resMateria.ok || !nuevaMateria.id) throw new Error(nuevaMateria.error || 'No se pudo crear la materia');
        materiaId = nuevaMateria.id;
      }

      const dataParaDB = {
        ...(materiaId ? { materiaId } : {}),
        materiaNombre: planActualizada.materia,
        estado: planActualizada.estado.toUpperCase(),
        tipoExamen: planActualizada.tipoExamen.toUpperCase(),
        fechaExamen: planActualizada.fechaExamen.toISOString(),
        duracionMinutos: planActualizada.duracionMinutos,
        evaluaciones: planActualizada.secciones.map((ev, idx) => ({
          id: ev.id,
          nombre: ev.nombre, tipoPregunta: ev.tipoPregunta.toUpperCase(), nivelBloom: ev.nivelBloom.toUpperCase(),
          peso: ev.peso, cantidadPreguntas: ev.cantidadPreguntas, contenidosEvaluados: ev.contenidosEvaluados,
          tiempoEstimadoMinutos: ev.tiempoEstimadoMinutos, tipoActividad: ev.tipoActividad, descripcion: ev.descripcion,
          cantidadGrupos: ev.cantidadGrupos, personasPorGrupo: ev.personasPorGrupo, orden: ev.orden ?? idx,
          enfoque: ev.enfoque, fecha: ev.fecha ? ev.fecha.toISOString() : null, grupoSeccion: ev.grupoSeccion || 'A',
        })),
        rubrica: planActualizada.rubrica.map(crit => ({
          nombre: crit.nombre, peso: crit.peso, descripcion: crit.descripcion,
          niveles: (crit.niveles || []).map(niv => ({ nombre: niv.nombre, puntaje: niv.puntaje, descripcion: niv.descripcion })),
        })),
      };

      const respuesta = planId
        ? await fetch(`/api/planificaciones/${planId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataParaDB) })
        : await fetch('/api/planificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataParaDB) });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo guardar el plan');
      if (!planId && cuerpo.id) { planIdRef.current = cuerpo.id; setPlanificacionId(cuerpo.id); }
      // Las evaluaciones nuevas reciben su id definitivo: así conservan estado, recordatorios y calificaciones
      const idsNuevos: Record<string, string> = cuerpo.idsNuevos || {};
      if (Object.keys(idsNuevos).length > 0) {
        const cambiar = (id: string) => idsNuevos[id] || id;
        setPlanificacion(prev => ({ ...prev, secciones: prev.secciones.map(s => idsNuevos[s.id] ? { ...s, id: idsNuevos[s.id] } : s) }));
        setTarjetasExcluidas(prev => prev.map(cambiar));
        const ajustarForm = (prev: EvaluacionFormulario) => (prev.editandoId && idsNuevos[prev.editandoId] ? { ...prev, editandoId: idsNuevos[prev.editandoId] } : prev);
        setEvaluacion1(ajustarForm); setEvaluacion2(ajustarForm); setEvaluacion3(ajustarForm); setEvaluacion4(ajustarForm);
      }

      ultimaFirma.current = firma;
      setEstadoGuardado('guardado');
    } catch (error) {
      console.error('Error guardando en BD:', error);
      setEstadoGuardado('error');
      agregarNotificacion('⚠️ No se pudo guardar en la base de datos. Revisa tu conexión: se reintentará con el próximo cambio.');
    }
  };

  const sincronizarConBD = (planActualizada: PlanificacionExamen): Promise<void> => {
    const tarea = colaSync.current.then(() => sincronizarInterno(planActualizada));
    colaSync.current = tarea.catch(() => {});
    return tarea;
  };

  // Guardado automático: cualquier cambio en el plan (configuración, borrados hechos desde el chat, etc.) se guarda solo.
  // El punto de partida es lo que se cargó de la base de datos; si no cambió nada, no se guarda.
  useEffect(() => {
    if (!datosCargados) return;
    const firma = firmaDePlan(planificacion);
    if (ultimaFirma.current === null) { ultimaFirma.current = firma; return; }
    if (firma === ultimaFirma.current) return;
    if (!planIdRef.current && planificacion.secciones.length === 0) return; // todavía no hay nada que guardar
    const temporizador = setTimeout(() => { sincronizarConBD(planificacion); }, 1200);
    return () => clearTimeout(temporizador);
  }, [planificacion, datosCargados]);

  useEffect(() => {
    if (propuestaPendiente?.evaluaciones) {
      const lista = propuestaPendiente.evaluaciones.slice(0, 4);
      const casillas = lista.map((p, idx) => casillaDeEvaluacion(p, idx));
      const mayor = Math.max(1, ...casillas);
      // Plan completo → muestra justo esas casillas; edición de una sola → conserva las que ya estaban visibles
      const esCompleta = casillas.every((c, i) => c === i + 1);
      setNumEvaluaciones(prev => (esCompleta ? lista.length : Math.max(prev, mayor)));
      const fechaBase = new Date(); const fechas = calcularFechasEvaluaciones(fechaBase, Math.max(mayor, lista.length));
      lista.forEach((p, i) => {
        const idx = casillas[i] - 1;
        let fechaExamen = fechas[idx] || new Date();
        if (p.fecha && p.hora) fechaExamen = new Date(`${p.fecha}T${p.hora}:00`);
        else if (p.fecha) fechaExamen = new Date(p.fecha);
        const evalData: EvaluacionFormulario = { materia: p.materia, duracionMinutos: p.duracionMinutos ?? null, duracionUnidad: 'min', peso: p.peso ?? null, fecha: fechaExamen, tipoActividad: p.tipoActividad || '', descripcion: p.descripcion || '', cantidadGrupos: p.cantidadGrupos ?? null, personasPorGrupo: p.personasPorGrupo ?? null, editandoId: null, mostrarDescripcion: false, enfoque: p.enfoque || '', errores: {}, origenAgente: { materia: true, tipoActividad: true, descripcion: true } };
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
    if (seccion.grupoSeccion) setSeccionActiva(seccion.grupoSeccion);
    const nombreLimpio = limpiarTexto(seccion.nombre);
    const esEval1 = seccion.nombre.toLowerCase().includes('evaluación 1') || seccion.nombre.toLowerCase().includes('evaluacion 1');
    const esEval2 = seccion.nombre.toLowerCase().includes('evaluación 2') || seccion.nombre.toLowerCase().includes('evaluacion 2');
    const esEval3 = seccion.nombre.toLowerCase().includes('evaluación 3') || seccion.nombre.toLowerCase().includes('evaluacion 3');
    const datosBase: EvaluacionFormulario = { materia: nombreLimpio, duracionMinutos: seccion.tiempoEstimadoMinutos ?? null, duracionUnidad: 'min', peso: seccion.peso ?? null, fecha: seccion.fecha || new Date(), tipoActividad: seccion.tipoActividad || '', descripcion: seccion.descripcion || '', cantidadGrupos: seccion.cantidadGrupos ?? null, personasPorGrupo: seccion.personasPorGrupo ?? null, editandoId: seccion.id, mostrarDescripcion: false, enfoque: seccion.enfoque || '', errores: {} }; 
    if (esEval1) setEvaluacion1(datosBase);
    else if (esEval2) setEvaluacion2(datosBase);
    else if (esEval3) setEvaluacion3(datosBase);
    else setEvaluacion4(datosBase);
    const numFormulario = esEval1 ? 1 : esEval2 ? 2 : esEval3 ? 3 : 4;
    setNumEvaluaciones(prev => Math.max(prev, numFormulario));
    setVista('planificacion');
    // Desliza suavemente hacia los campos de la evaluación para que el usuario
    // vea de inmediato los datos cargados, sin tener que buscarlos manualmente.
    scrollToTarjeta();
  };

  const limpiarEvaluacion1 = () => setEvaluacion1({...evalInit});
  const limpiarEvaluacion2 = () => setEvaluacion2({...evalInit});
  const limpiarEvaluacion3 = () => setEvaluacion3({...evalInit});
  const limpiarEvaluacion4 = () => setEvaluacion4({...evalInit});

    // Genera el Plan de Acción como HTML visual (sin depender de n8n)
  const generarPlanVisual = (seccionesOverride?: SeccionExamen[]): string | null => {
    const seccionesPlan = seccionesOverride ?? planificacion.secciones;
    if (seccionesPlan.length === 0) return null;
    const nombreMateria = escaparHTML(planificacion.materia || 'Asignatura');
    const fechaPlan = planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir';
    
    const renderFila = (sec: SeccionExamen) => {
      const nombreLimpio = escaparHTML(limpiarTexto(sec.nombre || '') || 'Sin Nombre');
      return `<tr>
        <td style="padding: 16px; font-weight: 500; color: #334155;">${nombreLimpio}</td>
        <td style="padding: 16px; color: #475569;">${escaparHTML(sec.tipoActividad || 'Desarrollo')}</td>
        <td style="padding: 16px; text-align: center; font-weight: 700; color: #1e3a8a;">${sec.peso || 0}%</td>
        <td style="padding: 16px; text-align: center; color: #475569;">${sec.fecha ? new Date(sec.fecha).toLocaleDateString() : fechaPlan}</td>
      </tr>`;
    };

    const tieneDescripciones = seccionesPlan.some(s => s.descripcion);
    const renderDescripciones = tieneDescripciones ? `
      <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid #e2e8f0;">
        <h3 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 12px 0;">📋 Especificaciones</h3>
        <div style="display: grid; gap: 16px;">
          ${seccionesPlan.map((sec, i) => {
            const n = escaparHTML(limpiarTexto(sec.nombre || '') || 'Sin Nombre');
            return sec.descripcion ? `<div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #94a3b8;">#${i + 1}</span>
                <span style="font-weight: 600; color: #1e293b;">${n}</span>
              </div>
              <p style="font-size: 14px; color: #475569; white-space: pre-wrap;">${escaparHTML(sec.descripcion)}</p>
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
        <p>👤 ${usuario?.nombre ? 'Prof. ' + escaparHTML(usuario.nombre) : 'Docente'}</p>
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
        ${seccionesPlan.map(sec => renderFila(sec)).join('')}
      </tbody>
    </table>
    ${renderDescripciones}
    <div class="firmas">
      <div><p class="firma-label">${usuario?.nombre ? 'Prof. ' + escaparHTML(usuario.nombre) : 'Docente'}</p><div class="firma-linea"></div><p class="sello-label">Firma</p></div>
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
    return { id: evalData.editandoId || `${idPrefix}-${Date.now()}`, nombre: `${tipo}: ${materiaLimpia}`, tipoPregunta: 'desarrollo', peso: evalData.peso, cantidadPreguntas: 1, contenidosEvaluados: [], nivelBloom: 'comprender', tiempoEstimadoMinutos: duracionMin, tipoActividad: evalData.tipoActividad || undefined, descripcion: evalData.descripcion, cantidadGrupos: evalData.cantidadGrupos ?? undefined, personasPorGrupo: evalData.personasPorGrupo ?? undefined, orden: planificacion.secciones.length, enfoque: evalData.enfoque || undefined, fecha: evalData.fecha, grupoSeccion: evalData.editandoId ? (planificacion.secciones.find(s => s.id === evalData.editandoId)?.grupoSeccion || seccionActiva) : seccionActiva };
  };

            const guardarEval = async (ev: EvaluacionFormulario, tipo: string, prefix: string, limpiar: () => void, setEv: (updater: (prev: EvaluacionFormulario) => EvaluacionFormulario) => void) => {
    if (!ev.materia.trim()) { alert(`Completa el nombre de ${tipo}`); return; }

    // === VALIDACIÓN DE INGENIERÍA DE SOFTWARE ===
    // Nota: si un campo todavía contiene texto autocompletado por el agente (no editado
    // manualmente por el usuario), se omite la validación de palabras clave para ese campo.
    const nuevosErrores: ErroresEvaluacion = {};

    const advertencias: string[] = [];
    if (ev.materia.trim() && !ev.origenAgente?.materia) {
      const rMateria = validarContenidoSE(ev.materia);
      if (!rMateria.valido) nuevosErrores.materia = rMateria.error;
      else if (rMateria.advertencia) advertencias.push(`• Contenido: ${rMateria.advertencia}`);
    }
    if (ev.tipoActividad.trim() && !ev.origenAgente?.tipoActividad) {
      const rTipo = validarContenidoSE(ev.tipoActividad);
      if (!rTipo.valido) nuevosErrores.tipoActividad = rTipo.error;
      // La estrategia ("Taller", "Debate"...) suele no tener palabras técnicas: no se advierte por eso
    }
    if (ev.enfoque?.trim()) {
      const rEnfoque = validarEnfoque(ev.enfoque);
      if (!rEnfoque.valido) nuevosErrores.enfoque = rEnfoque.error;
    }
    if (ev.descripcion?.trim() && !ev.origenAgente?.descripcion) {
      const rDesc = validarContenidoSE(ev.descripcion);
      if (!rDesc.valido) nuevosErrores.descripcion = rDesc.error;
      else if (rDesc.advertencia) advertencias.push(`• Descripción: ${rDesc.advertencia}`);
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setEv(prev => ({ ...prev, errores: nuevosErrores }));
      agregarNotificacion('❌ Corrige los campos marcados en rojo antes de guardar.');
      return;
    }
    if (advertencias.length > 0 && !window.confirm(`Esto no parece del todo un tema de Ingeniería de Software:\n\n${advertencias.join('\n')}\n\n¿Quieres guardarla igual?`)) {
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
    
    // 3. Si la sección activa llegó a 4 evaluaciones, generar su Plan de Acción automáticamente (solo con las de ESTA sección)
    const deEstaSeccion = estadoActualizado.secciones.filter((s: SeccionExamen) => (s.grupoSeccion || 'A') === seccionActiva && !tarjetasExcluidas.includes(s.id));
    if (deEstaSeccion.length === 4 && generarPDF) {
      agregarNotificacion('📄 Generando Plan de Acción...');
      const url = await generarPDF(deEstaSeccion);
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

  const puedeAdministrar = usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN';
  const esSuperadmin = usuario?.rol === 'SUPERADMIN';
  // Si un USUARIO intenta llegar a una vista de administración (ej. por el chat), se le devuelve al Dashboard
  useEffect(() => { if (!puedeAdministrar && vista === 'usuarios') setVista('estadisticas'); }, [puedeAdministrar, vista]);
  useEffect(() => { if (!esSuperadmin && (vista === 'actividad' || vista === 'sistema')) setVista('estadisticas'); }, [esSuperadmin, vista]);
  // Cantidad de cuentas esperando aprobación (para el contador rojo de la pestaña Usuarios)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const recuperacionesPrevias = useRef<number | null>(null);
  const actualizarContadores = async () => {
    try {
      const r = await fetch('/api/usuarios');
      if (!r.ok) return;
      const d = await r.json();
      const registros = (d.usuarios || []).filter((u: any) => u.pendiente).length;
      let recuperaciones = 0;
      if (esSuperadmin) {
        const rr = await fetch('/api/recuperaciones');
        if (rr.ok) recuperaciones = (await rr.json()).length;
        const previas = recuperacionesPrevias.current;
        if (recuperaciones > 0 && (previas === null || recuperaciones > previas)) agregarNotificacion(`🔑 ${recuperaciones} solicitud(es) de recuperación de contraseña esperan tu atención en Usuarios.`);
        recuperacionesPrevias.current = recuperaciones;
      }
      setSolicitudesPendientes(registros + recuperaciones);
    } catch { /* se intenta de nuevo en el siguiente ciclo */ }
  };
  useEffect(() => {
    if (!puedeAdministrar) return;
    actualizarContadores();
    const t = setInterval(actualizarContadores, 60000);
    return () => clearInterval(t);
  }, [puedeAdministrar, vista]);

  // Observaciones que dejan los administradores sobre el trabajo de esta cuenta (se consultan cada minuto)
  const [observaciones, setObservaciones] = useState<ObservacionRecibida[]>([]);
  const observacionesVistas = useRef<Set<string> | null>(null);
  const cargarObservaciones = async () => {
    try {
      const r = await fetch('/api/observaciones');
      if (!r.ok) return;
      const lista: ObservacionRecibida[] = await r.json();
      setObservaciones(lista);
      const sinLeer = lista.filter(o => !o.leida);
      if (observacionesVistas.current === null) {
        observacionesVistas.current = new Set(sinLeer.map(o => o.id));
        if (sinLeer.length > 0) agregarNotificacion(`💬 Tienes ${sinLeer.length} observación(es) sin leer en el Planificador.`);
      } else {
        sinLeer.filter(o => !observacionesVistas.current!.has(o.id)).forEach(o => {
          observacionesVistas.current!.add(o.id);
          agregarNotificacion(`💬 ${o.autorNombre} dejó una observación${o.evaluacionNombre ? ` sobre «${limpiarTexto(o.evaluacionNombre)}»` : ''}.`);
        });
      }
    } catch { /* sin conexión: se intenta de nuevo en el siguiente ciclo */ }
  };
  useEffect(() => {
    if (!usuario || usuario.rol === 'SUPERADMIN') return;
    cargarObservaciones();
    const t = setInterval(cargarObservaciones, 60000);
    return () => clearInterval(t);
  }, [usuario?.id]);
  const marcarObservacionLeida = async (id?: string) => {
    await fetch('/api/observaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { todas: true }) });
    await cargarObservaciones();
  };
  // Pestañas ordenadas por rol. 'admin' = supervisión del sistema; 'trabajo' = el espacio propio de la persona.
  // El superadmin no tiene la pestaña Planificador: lo abre desde el ícono del chat, junto a la configuración del agente.
  type Pestana = { id: 'planificacion' | 'estadisticas' | 'estudiantes' | 'usuarios' | 'actividad' | 'papelera'; label: string; icon: any; grupo: 'admin' | 'trabajo'; badge?: number };
  const tabDashboard: Pestana = { id: 'estadisticas', label: 'Dashboard', icon: BarChart3, grupo: puedeAdministrar ? 'admin' : 'trabajo' };
  const tabPlanificador: Pestana = { id: 'planificacion', label: 'Planificador', icon: ClipboardList, grupo: 'trabajo' };
  const tabEstudiantes: Pestana = { id: 'estudiantes', label: 'Estudiantes', icon: Users, grupo: 'trabajo' };
  const tabPapelera: Pestana = { id: 'papelera', label: 'Papelera', icon: Trash2, grupo: 'trabajo' };
  const tabUsuarios: Pestana = { id: 'usuarios', label: 'Usuarios', icon: UserCog, grupo: 'admin', badge: solicitudesPendientes };
  const tabActividad: Pestana = { id: 'actividad', label: 'Actividad', icon: Activity, grupo: 'admin' };
  const tabs: Pestana[] = esSuperadmin
    ? [tabDashboard, tabUsuarios, tabActividad, tabEstudiantes, tabPapelera]
    : puedeAdministrar
      ? [tabDashboard, tabUsuarios, tabPlanificador, tabEstudiantes, tabPapelera]
      : [tabPlanificador, tabDashboard, tabEstudiantes, tabPapelera];

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <style>{` input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="number"] { -moz-appearance: textfield; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } .sin-barra { scrollbar-width: none; } .sin-barra::-webkit-scrollbar { display: none; } `}</style>
      <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-[#282a3f] flex items-center gap-2 bg-[#161722] flex-shrink-0">
        <AnimatePresence initial={false}>
          {!chatAbierto && onAbrirChat && (
            <motion.div key="abrir-chat" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0 flex items-center gap-2 overflow-hidden">
              <Tooltip text="Mostrar chat (Ctrl+B)" lado="abajo">
                <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} onClick={onAbrirChat} aria-label="Mostrar el chat" className="group/abrir w-9 h-9 flex items-center justify-center rounded-xl border border-[#818cf8]/25 bg-gradient-to-br from-[#818cf8]/15 to-[#6366f1]/5 text-[#a5b4fc] hover:text-white hover:border-[#818cf8]/60 hover:from-[#818cf8]/40 hover:to-[#6366f1]/25 hover:shadow-lg hover:shadow-[#818cf8]/25 transition-all">
                  <PanelLeftOpen className="w-[18px] h-[18px] transition-transform duration-200 group-hover/abrir:translate-x-0.5" />
                </motion.button>
              </Tooltip>
              <span className="w-px h-6 bg-[#313248]" aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 min-w-0 flex items-center gap-1 md:gap-2 overflow-x-auto sin-barra">
        {tabs.map((tab, i) => (<div key={tab.id} className="flex items-center gap-1 md:gap-2 flex-shrink-0">{i > 0 && tabs[i - 1].grupo !== tab.grupo && (<span className="w-px h-6 bg-[#313248] mx-1" aria-hidden="true" />)}<motion.button onClick={() => setVista(tab.id)} className={`relative flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 font-['Inter'] whitespace-nowrap ${vista === tab.id ? 'text-[#c7d2fe] bg-[#818cf8]/10' : 'text-[#8a8b9e] hover:text-[#b0b0c4] hover:bg-[#1d1e2e]'}`}>{vista === tab.id && (<motion.div layoutId="activeTab" className="absolute inset-0 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />)}<tab.icon className={`relative z-10 w-4 h-4 transition-colors ${vista === tab.id ? 'text-[#818cf8]' : ''}`} /><span className="relative z-10 hidden sm:inline">{tab.label}</span>{(tab.badge ?? 0) > 0 && (<span className="relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{tab.badge}</span>)}</motion.button></div>))}
        </div>
        {/* Botón de configuración junto a la campanita */}
        <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
          <motion.button
            onClick={() => setVista('configuracion')}
            title="Configuración del plan"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 font-['Inter'] whitespace-nowrap ${vista === 'configuracion' ? 'text-[#c7d2fe] bg-[#818cf8]/10' : 'text-[#8a8b9e] hover:text-[#b0b0c4] hover:bg-[#1d1e2e]'}`}
          >
            {vista === 'configuracion' && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
            )}
            <Settings className="w-4 h-4 relative z-10" />
            <span className="relative z-10 hidden lg:inline">Config. del plan</span>
          </motion.button>
          <CampanitaNotificacionesFlotante notificaciones={notificaciones} setNotificaciones={setNotificaciones} campanaActiva={campanaActiva} setCampanaActiva={setCampanaActiva} />
          {usuario && (
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[#282a3f]">
              <Tooltip text="Mi perfil">
                <button onClick={() => setVista('perfil')} className={`flex items-center gap-2 px-2 py-1 rounded-xl transition-colors ${vista === 'perfil' ? 'bg-[#818cf8]/10 border border-[#818cf8]/20' : 'hover:bg-[#1d1e2e] border border-transparent'}`}>
                  <User className="w-4 h-4 text-[#8a8b9e] md:hidden" />
                  <div className="hidden md:flex flex-col items-end leading-tight">
                    <span className="text-xs font-medium text-[#d0d0da] max-w-[140px] truncate">{usuario.nombre}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${COLOR_TEXTO_ROL[usuario.rol] || 'text-[#818cf8]'}`}>{usuario.rol}</span>
                  </div>
                </button>
              </Tooltip>
              <Tooltip text="Cerrar sesión">
                <button onClick={() => onLogout && onLogout()} className="p-2 text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut className="w-4 h-4" /></button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-[#161722]">
        <AnimatePresence mode="wait">
          {vista === 'estadisticas' && (<motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><DashboardPorRol planificacion={planificacion} usuario={usuario} onMiTrabajo={() => { if (typeof window !== 'undefined' && window.innerWidth >= 768) onAbrirChat?.(); }} /></motion.div>)}
          {vista === 'planificacion' && (
            <motion.div key="plan" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="space-y-5 max-w-5xl mx-auto">
                <ObservacionesRecibidas items={observaciones} onLeer={marcarObservacionLeida} />
                <div ref={tarjetaRef}>
                <EvaluacionesApiladas 
                evaluacion1={evaluacion1} setEvaluacion1={setEvaluacion1} guardarEvaluacion1={guardarEvaluacion1} limpiarEvaluacion1={limpiarEvaluacion1}
                evaluacion2={evaluacion2} setEvaluacion2={setEvaluacion2} guardarEvaluacion2={guardarEvaluacion2} limpiarEvaluacion2={limpiarEvaluacion2}
                evaluacion3={evaluacion3} setEvaluacion3={setEvaluacion3} guardarEvaluacion3={guardarEvaluacion3} limpiarEvaluacion3={limpiarEvaluacion3}
                evaluacion4={evaluacion4} setEvaluacion4={setEvaluacion4} guardarEvaluacion4={guardarEvaluacion4} limpiarEvaluacion4={limpiarEvaluacion4}
                numEvaluaciones={numEvaluaciones} setNumEvaluaciones={setNumEvaluaciones}
                justFilled1={glow1} justFilled2={glow2} justFilled3={glow3} justFilled4={glow4}
                totalEstudiantes={totalEstudiantes}
              />
                </div>
              <div ref={seccionesGuardadasRef} className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider font-['Inter']">
                      Evaluaciones guardadas (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={`${seccionActiva}-${seccionesFiltradas.length}`}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="inline-block"
                        >
                          {seccionesFiltradas.length}
                        </motion.span>
                      </AnimatePresence>
                      )
                    </h2>
                    {/* Pestañas de Sección/Paralelo (grupos de estudiantes que ven la materia en común) */}
                    <div className="flex items-center gap-1 bg-[#161722] border border-[#313248] rounded-lg p-1">
                      {seccionesDisponibles.map((letra) => (
                        <Tooltip key={letra} text={`Sección ${letra}`}>
                          <button
                            type="button"
                            onClick={() => cambiarSeccionActiva(letra)}
                            className={`relative w-7 h-7 rounded-md text-xs font-semibold transition-colors duration-200 ${seccionActiva === letra ? 'text-white' : 'text-[#8a8b9e] hover:text-[#d0d0da] hover:bg-[#232430]'}`}
                          >
                            {seccionActiva === letra && (
                              <motion.span
                                layoutId="pill-seccion-activa"
                                className="absolute inset-0 bg-[#818cf8] rounded-md shadow-md z-0"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                            <span className="relative z-10">{letra}</span>
                          </button>
                        </Tooltip>
                      ))}
                      <Tooltip text="Añadir nueva sección">
                        <button
                          type="button"
                          onClick={agregarNuevaSeccion}
                          className="w-7 h-7 rounded-md text-[#8a8b9e] hover:text-[#818cf8] hover:bg-[#232430] transition-all flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text={seccionesDisponibles.length <= 1 ? 'Debe existir al menos una sección' : `Eliminar Sección ${seccionActiva}`}>
                        <button
                          type="button"
                          onClick={eliminarSeccionActiva}
                          disabled={seccionesDisponibles.length <= 1}
                          className="w-7 h-7 rounded-md text-[#8a8b9e] hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#8a8b9e]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                    {seccionesFiltradas.length > 0 && (
                      <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${seccionesParaPlan.length === seccionesFiltradas.length ? 'bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'}`} title="Las tarjetas con el círculo morado entran en el Plan de Acción">
                        {seccionesParaPlan.length} de {seccionesFiltradas.length} en el plan
                      </span>
                    )}
                    {seccionesFiltradas.filter((s: SeccionExamen) => estadoVisibleEvaluacion(s).porConfirmar).length > 0 && (
                      <span className="text-[11px] px-2 py-1 rounded-full border font-medium bg-amber-500/10 text-amber-300 border-amber-500/30" title="Su fecha ya pasó: indica si se realizó, se reprogramó o se canceló (clic en la etiqueta de la tarjeta)">
                        ⚠ {seccionesFiltradas.filter((s: SeccionExamen) => estadoVisibleEvaluacion(s).porConfirmar).length} por confirmar
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generarPlanAccion(seccionesParaPlan)}
                        disabled={seccionesParaPlan.length === 0 || cargandoPdf} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          seccionesParaPlan.length === 0 || cargandoPdf 
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
                <AlertasPlan secciones={seccionesFiltradas} />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={seccionActiva}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <DragDropSecciones
                      secciones={seccionesFiltradas} onReorder={(nuevoOrden: SeccionExamen[]) => setPlanificacion(prev => { let i = 0; const nuevasSecciones = prev.secciones.map(s => (s.grupoSeccion || 'A') === seccionActiva ? nuevoOrden[i++] : s); return { ...prev, secciones: nuevasSecciones }; })} onEdit={cargarSeccionParaEditar} onDelete={(id: string) => { 
  const estadoActualizado = { ...planificacion, secciones: planificacion.secciones.filter(s => s.id !== id) };
  setPlanificacion(estadoActualizado);
  sincronizarConBD(estadoActualizado);
  setTarjetasExcluidas(prev => prev.filter(x => x !== id));
  agregarNotificacion(`🗑️ Evaluación eliminada de la BD.`); 
}}
                      selectedIds={idsSeleccionados} onToggleSelect={toggleTarjetaSeleccionada} seccionesPlan={seccionesParaPlan} profesor={usuario?.nombre} seccionActiva={seccionActiva} onCambiarEstado={cambiarEstadoEvaluacion}
                      mostrarMenuEnvio={mostrarMenuEnvio} setMostrarMenuEnvio={setMostrarMenuEnvio} scrollToTarjeta={scrollToTarjeta} planificacion={planificacion} 
                      mensajeWhatsApp={mensajeWhatsApp} setMensajeWhatsApp={setMensajeWhatsApp} enviarA={enviarA} setEnviarA={setEnviarA} filtroEnvio={filtroEnvio} setFiltroEnvio={setFiltroEnvio} pdfUrl={pdfUrlLocal}
  pdfAbierto={pdfAbiertoLocal}
  setPdfAbierto={setPdfAbierto}
  setPdfUrl={setPdfUrl}
  agregarNotificacion={agregarNotificacion}
  generarPDF={generarPDF}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              {planificacion.comentariosAgente.length > 0 && (<div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-6 shadow-xl"><h2 className="text-sm font-medium text-[#9090a8] uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']"><Sparkles className="w-4 h-4 text-[#818cf8]" /> Feedback del agente</h2><div className="space-y-2">{planificacion.comentariosAgente.slice(-3).map(c => (<motion.p key={c.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-base text-[#9090a4] leading-relaxed font-['Inter']">{c.mensaje}</motion.p>))}</div></div>)}
            </motion.div>
          )}
          {vista === 'estudiantes' && (<motion.div key="estudiantes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><EstudiantesPanel /></motion.div>)}
          {vista === 'papelera' && (<motion.div key="papelera" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto"><PapeleraPanel usuario={usuario} /></motion.div>)}
          {vista === 'sistema' && esSuperadmin && (<motion.div key="sistema" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto"><ConfigSistemaPanel onGuardada={(c) => onConfigActualizada && onConfigActualizada(c)} /></motion.div>)}
          {vista === 'actividad' && esSuperadmin && (<motion.div key="actividad" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><ActividadPanel /></motion.div>)}
          {vista === 'perfil' && (<motion.div key="perfil" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto"><PerfilPanel usuario={usuario} onActualizado={onUsuarioActualizado} /></motion.div>)}
          {vista === 'usuarios' && puedeAdministrar && (<motion.div key="usuarios" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-6xl mx-auto"><UsuariosPanel /></motion.div>)}
          {vista === 'configuracion' && (
            <motion.div key="configuracion" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="max-w-3xl mx-auto">
              <div className="bg-[#1d1e2e] border border-[#313248] rounded-2xl p-8 shadow-xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#d0d0da] flex items-center gap-3 mb-1">
                    <Settings className="w-6 h-6 text-[#818cf8]" /> Configuración del plan
                  </h2>
                  <p className="text-sm text-[#8a8b9e]">Ajusta los parámetros generales de la planificación. Los cambios se guardan solos.</p>
                  <p className={`text-xs mt-2 flex items-center gap-1.5 ${estadoGuardado === 'error' ? 'text-red-300' : estadoGuardado === 'guardando' ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {estadoGuardado === 'guardando' ? 'Guardando...' : estadoGuardado === 'error' ? (<>No se pudo guardar. <button type="button" onClick={() => sincronizarConBD(planificacion)} className="underline">Reintentar</button></>) : estadoGuardado === 'guardado' ? (<><CheckCircle className="w-3.5 h-3.5" />Guardado</>) : ''}
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelBase}>Materia / Asignatura</label>
                    <input
                      type="text"
                      value={planificacion.materia}
                      maxLength={120}
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
                      onChange={(e) => setPlanificacion(prev => ({ ...prev, duracionMinutos: Math.min(600, Math.max(0, parseInt(e.target.value) || 0)) }))}
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
  // ===== SESIÓN / ROLES =====
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [configSistema, setConfigSistema] = useState<ConfigCliente | null>(null);
  const [datosCargados, setDatosCargados] = useState(false);
  const aplicarYGuardarConfig = (c: ConfigCliente) => { aplicarConfig(c); setConfigSistema(c); };
  useEffect(() => {
    if (!usuario) return;
    fetch('/api/configuracion').then(r => (r.ok ? r.json() : null)).then(d => aplicarYGuardarConfig(d?.config ?? CONFIG_CLIENTE_DEFECTO)).catch(() => aplicarYGuardarConfig(CONFIG_CLIENTE_DEFECTO));
  }, [usuario?.id]);
  useEffect(() => {
    // Si la sesión expira mientras se usa la app, cualquier llamada a /api responde 401 → volver al login
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/login')) window.location.href = '/login?sesion=expirada';
      return res;
    };
    fetchOriginal('/api/auth/me').then(r => (r.ok ? r.json() : Promise.reject())).then((u: UsuarioSesion) => { setUsuario(u); setVistaActual(u.rol === 'USUARIO' ? 'planificacion' : 'estadisticas'); if (u.rol !== 'SUPERADMIN' && window.innerWidth >= 768) setAgenteExpandido(true); }).catch(() => { window.location.href = '/login'; });
    return () => { window.fetch = fetchOriginal; };
  }, []);
  const cerrarSesion = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/login'; }
  };
  // ===== FIN SESIÓN / ROLES =====
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
        grupoSeccion: ev.grupoSeccion || 'A',
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
  // El chat empieza abierto en computador y cerrado en celular
  // El chat empieza cerrado; al cargar la sesión se abre para todos menos el superadmin (y nunca solo en el celular)
  const [agenteExpandido, setAgenteExpandido] = useState<boolean>(false);
  const anchoPantalla = useAnchoPantalla();
  const esMovil = anchoPantalla < 768;
  const anchoChat = Math.min(640, Math.round(anchoPantalla * 0.45));
  const [propuestaPendiente, setPropuestaPendiente] = useState<PropuestaEvaluacion | null>(null);
  const [seccionPlanificador, setSeccionPlanificador] = useState<string>('A'); // sección (A, B, C...) abierta en el planificador
  const [vistaActual, setVistaActual] = useState<'planificacion' | 'estadisticas' | 'estudiantes' | 'configuracion' | 'usuarios' | 'perfil' | 'actividad' | 'papelera' | 'sistema'>('estadisticas');
  const [planificacion, setPlanificacion] = useState<PlanificacionExamen>({ id: '1', version: 1, estado: 'borrador', fechaExamen: new Date(), tipoExamen: 'mixto', duracionMinutos: 0, materia: 'Ing Software', secciones: [], rubrica: [], comentariosAgente: [{ id: 'c1', tipo: 'info', mensaje: 'Sube un archivo o escribe en el chat para comenzar la planificación.', timestamp: new Date() }] });
    // CARGAR EVALUACIONES DESDE LA BD AL REFRESCAR
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        // 1. Buscar si ya existe una materia
        const materias = await fetch('/api/materias').then(r => r.json());
        if (materias.length === 0) return; // Primera vez, no hay nada que cargar

        // 2. Buscar la materia "Ing Software" o usar la primera
        // Se abre la materia con actividad más reciente (antes se buscaba una llamada 'Ing Software')
        const actividadDe = (m: any) => new Date(m.planificaciones?.[0]?.updatedAt || m.planificaciones?.[0]?.createdAt || m.createdAt || 0).getTime();
        const materiaActual = [...materias].sort((a: any, b: any) => actividadDe(b) - actividadDe(a))[0];
        
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
              grupoSeccion: ev.grupoSeccion || 'A',
              estado: ev.estado || 'PROGRAMADA',
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
      } finally {
        setDatosCargados(true); // desde aquí los cambios del plan se guardan solos
      }
    };
    
    cargarDatosIniciales();
  }, []); // El array vacío significa: "Ejecutar SOLO al cargar la página"
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfAbierto, setPdfAbierto] = useState(false);

  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setAgenteExpandido(prev => !prev); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);

  const agregarNotificacion = (mensaje: string) => { console.log('📢 Notificación:', mensaje); };

  const urlN8n = configSistema?.chat.webhookUrl || process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678';
  const generarPDF = async (secciones?: SeccionExamen[]): Promise<string | null> => {
    const seccionesParaPDF = secciones || planificacion.secciones;
    if (seccionesParaPDF.length === 0) { alert('No hay evaluaciones guardadas'); return null; }
    try { const response = await fetch('/api/plan-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ examenData: { seccion: seccionesParaPDF[0]?.grupoSeccion || null, profesor: usuario?.nombre || '', fechaExamen: planificacion.fechaExamen.toISOString(), materia: planificacion.materia || 'Asignatura', tipoExamen: planificacion.tipoExamen || 'mixto', duracionMinutos: planificacion.duracionMinutos || 0, secciones: seccionesParaPDF.map(sec => ({ nombre: sec.nombre, tipoActividad: sec.tipoActividad, tiempoEstimadoMinutos: sec.tiempoEstimadoMinutos, peso: sec.peso, cantidadGrupos: sec.cantidadGrupos, personasPorGrupo: sec.personasPorGrupo, descripcion: sec.descripcion, enfoque: sec.enfoque, nivelBloom: sec.nivelBloom, fecha: sec.fecha })) } }) }); if (!response.ok || !(response.headers.get('content-type') || '').includes('pdf')) throw new Error('Error al generar PDF'); const blob = await response.blob(); const url = URL.createObjectURL(blob); setPdfUrl(url); setPdfAbierto(false); agregarNotificacion('📄 Plan de acción generado correctamente.'); return url; } catch (error) { console.error('Error al generar el PDF (se usará el plan visual local):', error); return null; }
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

  // Hasta saber quién entró no se dibuja la interfaz (evita que las pestañas "salten" al cargar)
  if (!usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#161722]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#313248] border-t-[#818cf8] rounded-full animate-spin" />
          <p className="text-xs text-[#8a8b9e]">Cargando tu espacio de trabajo...</p>
        </div>
      </div>
    );
  }

  // Entró con una clave temporal: no puede usar el sistema hasta elegir una nueva
  if (usuario.debeCambiarPassword) return <CambioPasswordObligatorio usuario={usuario} onLogout={cerrarSesion} />;
  if (!configSistema) return (<div className="flex h-screen items-center justify-center bg-[#161722]"><div className="w-8 h-8 border-2 border-[#313248] border-t-[#818cf8] rounded-full animate-spin" /></div>);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#161722] text-[#b0b0c0] overflow-hidden">
      <style>{` @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); * { font-family: 'Inter', system-ui, -apple-system, sans-serif; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #1f2035; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #313248; border-radius: 20px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #414258; } .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #313248 #1f2035; } body { scrollbar-width: thin; scrollbar-color: #313248 #161722; } @media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } } `}</style>
      <BandaRol rol={usuario.rol} />
      <div className="flex-1 flex overflow-hidden min-h-0 h-full">
                <AgentePanel seccionActiva={seccionPlanificador} expandido={agenteExpandido} setExpandido={setAgenteExpandido} planificacion={planificacion} setPlanificacion={setPlanificacion} setPropuestaPendiente={setPropuestaPendiente} onAccept={aceptarPropuesta} setVistaPanel={setVistaActual} setPdfUrl={setPdfUrl} setPdfAbierto={setPdfAbierto} agregarNotificacion={agregarNotificacion} generarPDF={generarPDF} limpiarYScroll={() => { if (panelDerechoRef.current?.limpiarYScroll) panelDerechoRef.current.limpiarYScroll(); }} totalEstudiantes={totalEstudiantesGlobal} config={configSistema} usuarioId={usuario.id} esMovil={esMovil} anchoChat={anchoChat} esSuperadmin={usuario.rol === 'SUPERADMIN'} />
        <PanelDerecho 
          onSeccionActivaCambia={setSeccionPlanificador}
          chatAbierto={agenteExpandido}
          onAbrirChat={() => setAgenteExpandido(true)}
          usuario={usuario}
          onLogout={cerrarSesion}
          onUsuarioActualizado={setUsuario}
          onConfigActualizada={aplicarYGuardarConfig}
          datosCargados={datosCargados}
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