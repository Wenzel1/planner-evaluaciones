'use client';

import { tipoPerfil } from '@/lib/agente/perfil';
import { ConfigCliente, Estudiante, PaginaSugeridaUI, SeccionExamen, VideoSugeridoUI } from '@/components/planificador/tipos';

// Comparar nombres sin tildes ni mayúsculas ("jose perez" = "José Pérez")
export const nombreNormal = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
// Busca a alguien por nombre: exacto, o que contenga todas las palabras dichas. 'varios' = hay más de uno posible.
export function buscarPorNombre<T extends { nombre: string }>(lista: T[], nombre: string): T | null | 'varios' {
  const n = nombreNormal(nombre); if (!n) return null;
  const exactos = lista.filter(x => nombreNormal(x.nombre) === n);
  if (exactos.length === 1) return exactos[0];
  const palabras = n.split(' ');
  const parciales = lista.filter(x => { const m = nombreNormal(x.nombre); const pm = m.split(' '); return palabras.every(p => pm.some(w => w === p || (p.length >= 4 && w.startsWith(p)))); });
  if (parciales.length === 1) return parciales[0];
  return parciales.length > 1 || exactos.length > 1 ? 'varios' : null;
}

// ============================================
// CONSTANTES DE ESTILOS
// ============================================
export const inputBase = "w-full h-12 px-4 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] focus:border-[color:var(--c-818cf8)]/40 outline-none transition-all duration-200 font-['Inter']";
export const labelBase = "text-[11px] text-[color:var(--c-b0b0c4)] block mb-1 font-medium";

export const KEYWORDS_SE = {
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

export const TERMINOS_BLOQUEADOS = [
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
export const normalizarSE = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const escaparRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Palabra técnica: coincide al inicio de una palabra ("api" → "apis", "patron" → "patrones").
// Las siglas cortas (≤ 3 letras) deben ser la palabra completa, para que "go" no sume en "algoritmo".
export const crearRegexClave = (kw: string) => {
  const t = normalizarSE(kw).trim().split(/\s+/).map(escaparRegExp).join('(?:s|es)?\\s+');
  return new RegExp(kw.length <= 3 ? `(^|[^a-z0-9])${t}s?(?![a-z0-9])` : `(^|[^a-z0-9])${t}`);
};
// Término ajeno: palabra completa, con plural opcional ("venta" → "ventas", pero NO "ventana")
export const crearRegexBloqueado = (term: string) => new RegExp(`(^|[^a-z0-9])${escaparRegExp(normalizarSE(term))}(s|es)?(?![a-z0-9])`);
export const REGEX_SE = {
  fuerte: KEYWORDS_SE.fuerte.map(crearRegexClave),
  medio: KEYWORDS_SE.medio.map(crearRegexClave),
  debil: KEYWORDS_SE.debil.map(crearRegexClave),
};
// "estado" y "derecho" también son palabras técnicas/normales ("gestión de estado", "panel derecho"): no se bloquean
export const REGEX_BLOQUEADOS = TERMINOS_BLOQUEADOS
  .filter(t => !['estado', 'derecho'].includes(t))
  .map(t => ({ termino: t, re: crearRegexBloqueado(t) }));

export const TEMAS_VALIDOS = 'arquitectura, patrones de diseño, metodologías ágiles, testing, DevOps, CI/CD, bases de datos, APIs, seguridad, calidad de código, lenguajes de programación, diagramas, IA aplicada, etc.';

export function validarContenidoSE(texto: string): { valido: boolean; error: string; puntuacion: number; advertencia?: string } {
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

  // Otra materia (Soporte Técnico, Redes…): la lista de palabras de Ingeniería de Software no aplica
  if (tipoPerfil(MATERIA_ACTIVA.nombre) === 'otra') return { valido: true, error: '', puntuacion: 3 };

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
export function validarEnfoque(texto: string): { valido: boolean; error: string } {
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
export function validarTipoActividad(texto: string): { valido: boolean; error: string } {
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

// Escapa HTML antes de usar dangerouslySetInnerHTML (evita que el texto del agente o del usuario inyecte etiquetas)
export function escaparHTML(texto: string): string {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Casilla (1 a 4) de una evaluación propuesta por el agente: usa su "tipo" ("Evaluación 3" → 3) o su posición
export function casillaDeEvaluacion(p: any, idx: number): number {
  const m = String(p?.tipo ?? '').match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : idx + 1;
  return Math.min(4, Math.max(1, Number.isFinite(n) ? n : idx + 1));
}

// Une una edición parcial del agente (p. ej. solo la Evaluación 2) con la propuesta que ya estaba en pantalla
// Solo se une si el profesor pidió CAMBIAR algo; si pidió crear evaluaciones nuevas, la propuesta se reemplaza.
export const PIDE_EDITAR = /\b(cambia\w*|edita\w*|modifica\w*|ajusta\w*|corrige\w*|actualiza\w*|reemplaza\w*|b[aá]ja\w*|s[uú]be\w*|aumenta\w*|reduce\w*|quita\w*|agrega\w*|añade\w*)\b/i;
export function unirPropuesta(anterior: any, nueva: any, mensaje = ''): any {
  const nuevas = (nueva?.evaluaciones || []).slice(0, 6);
  const previas = anterior?.evaluaciones || [];
  const esParcial = previas.length > 0 && nuevas.length < previas.length && PIDE_EDITAR.test(mensaje) && nuevas.every((p: any) => /\d/.test(String(p?.tipo ?? '')));
  if (!esParcial) return { ...nueva, evaluaciones: nuevas };
  const porCasilla = new Map<number, any>();
  previas.forEach((p: any, i: number) => porCasilla.set(casillaDeEvaluacion(p, i), { ...p, tipo: p.tipo || `Evaluación ${i + 1}` }));
  nuevas.forEach((p: any, i: number) => porCasilla.set(casillaDeEvaluacion(p, i), p));
  return { ...anterior, ...nueva, evaluaciones: [...porCasilla.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p) };
}

export function limpiarTexto(texto: string): string {
  if (!texto) return ''; let clean = texto;
  while (/^Evaluaci[oó]n\s+\d+\s*:\s*/i.test(clean)) { clean = clean.replace(/^Evaluaci[oó]n\s+\d+\s*:\s*/i, ''); }
  return clean.replace(/\*\*/g, '').replace(/\*/g, '').trim();
}
export function extraerJSONDelTexto(texto: string): any {
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


// ============================================
// FUNCIÓN PARA CALCULAR FECHAS (2 SEMANAS DE DIFERENCIA)
// ============================================
export function calcularFechasEvaluaciones(fechaBase: Date, totalEvaluaciones: number): Date[] {
  const fechas: Date[] = [];
  for (let i = 0; i < totalEvaluaciones; i++) {
    const fecha = new Date(fechaBase);
    fecha.setDate(fecha.getDate() + (i * 14));
    fechas.push(fecha);
  }
  return fechas;
}

// ============================================
// DASHBOARD POR ROL
//  - USUARIO (profesor): solo ve su propio dashboard.
//  - ADMIN: su dashboard + vista de solo lectura del trabajo de TODOS los profesores.
//  - SUPERADMIN: lo anterior + resumen de cuentas del sistema.
// ============================================
export const ESTILO_ROL: Record<string, string> = {
  SUPERADMIN: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  ADMIN: 'bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-a5b4fc)] border-[color:var(--c-818cf8)]/30',
  USUARIO: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};
export const CONFIG_CLIENTE_DEFECTO: ConfigCliente = {
  chat: { activo: true, mensajeInactivo: 'El asistente está desactivado temporalmente. Inténtalo de nuevo más tarde.', webhookUrl: '', modelo: '', temperatura: 0.4, maxTokens: 0, ventanaMemoria: 9, maxCaracteresMensaje: 2000, timeoutSegundos: 60, instruccionesExtra: '' },
  planificador: { maxGrupos: 20, maxPersonasPorGrupo: 300 },
};
// Límites del planificador: se actualizan al cargar la configuración (los formularios los leen al dibujarse)
export const LIMITES = { grupos: 20, personas: 300 };
// Canal por el que se avisa a los estudiantes: 'correo' (Gmail) o 'whatsapp'. Lo decide el servidor según sus variables de entorno.
export const CANAL = { valor: 'whatsapp' as 'correo' | 'whatsapp' };
// Materia activa (la fija el panel): decide si el validador de temas exige palabras de Ingeniería de Software
export const MATERIA_ACTIVA = { nombre: '' };
export const porCorreo = () => CANAL.valor === 'correo';
/** ¿Es un id de la base de datos (cuid)? Las evaluaciones recién creadas en pantalla tienen ids locales como "eval1-1730…". */
export const esIdGuardado = (id: unknown) => /^[a-z0-9]{20,40}$/i.test(String(id || ''));
export const medioEnvio = () => (porCorreo() ? 'correo' : 'WhatsApp');

export const estudiantesIniciales: Estudiante[] = [
 
];

// Secciones para elegir: A a H siempre, más las que ya se usan (y la actual, aunque sea otra letra)
export function opcionesSeccion(actual?: string, usadas: string[] = []): string[] {
  return [...new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', ...usadas, ...(actual ? [actual] : [])])].filter(g => /^[A-Z]$/.test(g)).sort();
}
export function haceCuanto(fecha: Date | string, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000));
  if (s < 45) return 'ahora';
  const min = Math.round(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fecha).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

// ============================================
// DRAG AND DROP SECCIONES
// ============================================
// ============================================
// ESTADO DE REALIZACIÓN DE UNA EVALUACIÓN
// ============================================
// "Por confirmar" no se guarda: es una evaluación programada cuya fecha ya pasó.
export function estadoVisibleEvaluacion(s: SeccionExamen): { texto: string; clase: string; porConfirmar: boolean } {
  const estado = String(s.estado || 'PROGRAMADA').toUpperCase();
  const paso = !!s.fecha && new Date(s.fecha).getTime() < Date.now();
  if (estado === 'REALIZADA') return { texto: '✅ Realizada', clase: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', porConfirmar: false };
  if (estado === 'CANCELADA') return { texto: '⛔ Cancelada', clase: 'bg-red-500/10 text-red-300 border-red-500/30', porConfirmar: false };
  if (paso) return { texto: '⚠ Por confirmar', clase: 'bg-amber-500/10 text-amber-300 border-amber-500/30', porConfirmar: true };
  if (estado === 'REPROGRAMADA') return { texto: '🔁 Reprogramada', clase: 'bg-sky-500/10 text-sky-300 border-sky-500/30', porConfirmar: false };
  return { texto: '🗓 Programada', clase: 'bg-[color:var(--c-272839)] text-[color:var(--c-b0b0c4)] border-[color:var(--c-313248)]', porConfirmar: false };
}

// Fecha → valor para <input type="datetime-local"> en la hora local del navegador
export function aInputFechaHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function duracionMin(s: SeccionExamen): number {
  const m = Number(s.tiempoEstimadoMinutos);
  return Number.isFinite(m) && m > 0 ? Math.min(m, 600) : 60;
}

// Evaluación que se debe abrir al llegar al planificador (desde el calendario: «Ver en el planificador»)
export const EVAL_POR_ABRIR = { id: '' };

// ============================================
// PRECARGA: los datos de una ventana se piden apenas el mouse pasa por el botón (o se toca),
// así cuando la ventana se abre ya están listos. Se guardan 20 segundos.
// ============================================
export const cachePeticiones = new Map<string, { t: number; p: Promise<any> }>();
export function pedirConCache(url: string, vigencia = 20000): Promise<any> {
  const c = cachePeticiones.get(url);
  if (c && Date.now() - c.t < vigencia) return c.p;
  const p = fetch(url).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo cargar.'); return d; });
  p.catch(() => cachePeticiones.delete(url)); // si falla, la próxima vez se vuelve a pedir
  cachePeticiones.set(url, { t: Date.now(), p });
  return p;
}
export function precargar(url: string) { pedirConCache(url).catch(() => {}); }
export function olvidarCache(prefijo: string) { for (const k of [...cachePeticiones.keys()]) if (k.startsWith(prefijo)) cachePeticiones.delete(k); }
// ¿Dos nombres hablan del mismo tema? Si el agente reemplaza una evaluación por otra de tema distinto,
// sus recursos, rúbrica y examen viejos NO deben pasar a la nueva.
export function mismoTema(a?: string | null, b?: string | null): boolean {
  const pal = (t?: string | null) => new Set(String(t || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4));
  const x = pal(a), y = pal(b);
  if (!x.size || !y.size) return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const comunes = [...x].filter(w => y.has(w)).length;
  return comunes / Math.min(x.size, y.size) >= 0.5;
}
// Al editar: si sigue siendo el mismo tema conserva rúbrica, recursos y examen; si cambió de tema, los borra (también en la base de datos)
export function heredado(vieja: SeccionExamen | undefined, nombreNuevo: string): Partial<SeccionExamen> & { quitarExamen?: boolean } {
  if (!vieja) return {};
  if (mismoTema(vieja.nombre, nombreNuevo)) return { rubrica: vieja.rubrica, recursos: vieja.recursos, examen: vieja.examen };
  return { rubrica: null as any, recursos: [], examen: null, quitarExamen: true };
}
export async function pedirSugerenciasRecursos(sec: SeccionExamen, materia?: string): Promise<{ videos: VideoSugeridoUI[]; paginas: PaginaSugeridaUI[]; avisos: string[] }> {
  const r = await fetch('/api/recursos/sugerir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: sec.nombre, tipoActividad: sec.tipoActividad, enfoque: sec.enfoque, descripcion: String(sec.descripcion || '').slice(0, 600), materia }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se pudieron buscar recursos.');
  return { videos: d.videos || [], paginas: d.paginas || [], avisos: d.avisos || [] };
}
// Cuándo se guardó por última vez el plan que tiene abierto esta ventana (para no pisar cambios hechos en otra)
export const planVisto: { en: string | null } = { en: null }; // objeto (no let) para compartirlo entre archivos
