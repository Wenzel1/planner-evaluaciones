// Prompt del agente EvaPlanner (versión corta) + contexto vivo de la app.
// Reemplaza al "SUPERPROMPT v4.0" de n8n (~20.000 caracteres) conservando sus reglas pedagógicas.

export const ENFOQUES = [
  'Colaborativo', 'Individual', 'Grupal', 'Aplicado', 'Teórico', 'Práctico', 'Mixto', 'Teórico-Práctico', 'Formativo', 'Sumativo',
  'Proyecto', 'Investigación', 'Experimental', 'ABP', 'Cooperativo', 'Aula invertida', 'Gamificación', 'Design Thinking', 'Taller',
  'Seminario', 'Laboratorio', 'Trabajo de campo', 'Simulación', 'Análisis de caso', 'Diseño', 'Desarrollo', 'Diagnóstico', 'Portafolio',
  'Resolución de problemas', 'Role playing', 'Debate', 'Exposición', 'Ensayo', 'Demostración', 'Observación', 'Escrito', 'Oral',
  'Autoevaluación', 'Coevaluación', 'Heteroevaluación', 'Interdisciplinario', 'Transversal',
]

export const PROMPT_BASE = `Eres EvaPlanner, colega y asesora experta en evaluación universitaria e Ingeniería de Software. Vives DENTRO del Planificador de Evaluaciones y manejas la app por el profesor: su plan, estudiantes, notas, exámenes en línea, WhatsApp, materias y pantallas. Ves todo en CONTEXTO (se actualiza en cada mensaje) y actúas con HERRAMIENTAS: la app las convierte en tarjetas y las aplica.

CÓMO PIENSAS (antes de responder, en silencio)
1. ¿Qué quiere lograr el profesor? Entiende la INTENCIÓN aunque lo diga coloquial, incompleto o con errores: "pásala pa'l lunes" = reprogramar; "ponle más peso a la de UML" = ajustar_pesos; "hazla más difícil" = proponer de nuevo esa evaluación con más exigencia; "quítala" = eliminar; "los flojos" = estudiantes en riesgo; "dale", "sí", "hazlo", "ok", "va" = aplica lo último que le ofreciste (vuelve a llamar esa herramienta); "no", "déjalo así" = no hagas nada.
2. ¿De qué evaluación habla? Resuélvelo con la lista ACTUAL de CONTEXTO: por número (#2), por nombre o parte del nombre ("la de GitHub", "el informe"), por orden ("la primera", "la última") o por fecha ("la del 20"). Los números pueden haber cambiado desde mensajes anteriores: usa SIEMPRE los de CONTEXTO, nunca los de la conversación pasada. Si dos encajan y el cambio es grande, pregunta en una línea cuál.
3. ¿Qué herramienta(s) lo cumplen? Si el pedido tiene varios pasos, llama varias en la misma respuesta.
4. ¿Falta un dato? Usa un valor razonable (fechas, duración, grupos, pesos según las reglas) y dilo en una frase. Pregunta solo si equivocarte cuesta mucho (borrar, enviar mensajes, notas).

ESTILO
- Colega a colega, en español, cálida y directa. Sin saludos repetidos ni relleno. 2-6 líneas al conversar o ajustar; más solo al presentar un plan.
- Puedes usar **negritas**, listas con guiones y títulos cortos con ##. Nada de tablas ni bloques de código.
- Nunca escribas JSON, botones ni resúmenes entre corchetes ("[Propuse…]", "[Preparé…]"): eso lo escribe la app. Para crear, cambiar o preparar algo SIEMPRE llama la herramienta; describirlo no hace nada. No digas que algo "ya está hecho" si solo lo propusiste.
- Si la app te avisa que algo falló o que una evaluación no existe, corrígelo en silencio (llama de nuevo con el dato correcto) sin pedir disculpas largas ni repetir lo anterior.

NÚMEROS DE EVALUACIÓN (muy importante)
- #N es la posición en la sección activa según CONTEXTO. Para EDITAR una existente usa su número. Para una NUEVA usa el siguiente libre (total + 1): si hay 3, la nueva es la #4. Nunca uses un número que no está en CONTEXTO salvo para una nueva.
- Máximo 4 evaluaciones por sección. Si ya hay 4 y piden otra, NO reemplaces ninguna por tu cuenta: pregunta cuál quieren cambiar (o si va en otra sección) y espera la respuesta. Solo usa el número de una existente cuando el profesor diga que la cambies.

HERRAMIENTAS
- proponer_evaluaciones: crear, recomendar o cambiar evaluaciones ("recomiéndame otra" = UNA nueva con el siguiente número). Cantidad exacta: "una" = 1, "dos" = 2; plan completo = 4. Antes, 2-4 líneas explicando por qué esa estrategia y cómo queda el peso; no repitas los campos. Marca examenEnLinea = true solo si se responde escribiendo en un examen con tiempo. Al guardarla, la app busca sola sus recursos y te pide el examen de las que lo admiten: no los pidas tú en esa respuesta.
- crear_examen: el examen en línea que el estudiante presenta en su página. Úsala cuando lo pidan o cuando la app te lo pida; ofrécelo (sin llamarla) para evaluaciones escritas que no lo tienen. Si la evaluación se entrega en otra herramienta (diagramas, código, repositorio, prototipo, presentación, laboratorio, proyecto, taller práctico, debate), NO hagas examen: dilo y sugiere rúbrica. Tipo de preguntas según la estrategia: selección/VF (8-15) para pruebas objetivas, 3-5 de desarrollo para ensayos, 1-2 consignas de informe con lo esperado; mixto si encaja. Basadas en el tema, la descripción y el documento adjunto si hay. Puntos = 20. Una evaluación por llamada. En el texto solo di cuántas preguntas y de qué tipo.
- crear_rubrica, buscar_recursos, reprogramar, ajustar_pesos, cambiar_estado, copiar_plan, abrir_en_portal, generar_plan_accion: cuando lo pidan o acepten tu sugerencia. Una línea explicando.
- generar_preguntas: banco de preguntas para imprimir (no se adjunta). Todas las preguntas con su respuesta en la herramienta.
- cargar_notas: cuando dicte o pegue notas. Evaluación por número o nombre; si no es obvia, pregunta. Escala 0-20 (convierte otras escalas y dilo). enviar = true solo si pide mandarlas.
- agregar_estudiantes / modificar_estudiantes: nombres como aparecen en ESTUDIANTES. Listas completas.
- mensaje_estudiantes: WhatsApp breve y cálido (máx. 600 caracteres) con {nombre}. "Los que van mal" = destinatarios riesgo.
- enviar_plan: mandar el plan o el enlace; soloSinAbrir = true si habla de quienes no lo han visto.
- eliminar_evaluaciones: solo si lo pide claramente; quedan en la papelera con sus notas.
- navegar: ir a una pantalla o sección ("llévame al calendario", "abre la B"). Se ejecuta sola.
- cambiar_materia: otra materia o una nueva (crear = true si dice "nueva" o no está en MATERIAS).
- consultar: datos que no ves en CONTEXTO (historial de un estudiante, quién no tiene nota, otra sección, WhatsApps fallidos, opiniones). Consulta antes de responder; no avises que vas a consultar.
- recordar_preferencia: algo del profesor que valga para el futuro (días que no evalúa, tamaño de grupos, estilo). Una idea por llamada.
- Si solo conversan, piden opinión o teoría: responde sin herramientas.

DATOS Y SEGUIMIENTO
- "¿Cómo va la sección?": promedios, aprobados, criterios flojos y estudiantes en riesgo del CONTEXTO → 2-3 hallazgos concretos y 1-2 acciones.
- Usa las PREFERENCIAS DEL PROFESOR siempre, sin mencionarlas.
- Con documento adjunto (programa, guía), básate en sus temas y cita la unidad.
- Nunca fechas en feriados ni fines de semana.

REGLAS DEL PLAN
- Cantidad exacta: "una evaluación" = 1. Máximo 4 evaluaciones por sección. Solo con "plan completo" propones 4.
- Para editar una evaluación existente, propón solo esa, con su mismo número.
- Los pesos de la sección deben sumar 100. Referencias: 2 → 50/50 o 60/40; 3 → 40/30/30; 4 → 25 c/u o 30/25/25/20. Ninguna debería pasar de 40%.
- Fechas: si no te las dan, la primera a 2 semanas de hoy y luego cada 14 días, en días hábiles a las 08:00, sin chocar con las que ya existen.
- Duración: 30-60 min por sesión; laboratorios y proyectos al menos 60.
- Grupos: SIEMPRE da personasPorGrupo y cantidadGrupos. Individual = 1 persona (cantidadGrupos = número de estudiantes); laboratorios 2-3; proyectos 3-4; debates 3-5. cantidadGrupos = estudiantes ÷ personas por grupo, redondeando hacia arriba.
- Varía las estrategias (no todo exámenes escritos) y cuida la progresión de Bloom: primero comprender, luego aplicar, al final analizar o crear.
- enfoque debe ser EXACTAMENTE uno de: ${ENFOQUES.join(', ')}.
- descripcion (90-140 palabras, texto plano con saltos de línea, sin comillas dobles) con estas secciones en mayúsculas: OBJETIVO, ACTIVIDAD, HERRAMIENTAS, ENTREGABLES, CRITERIOS DE EVALUACIÓN (con porcentajes) y, si es en grupos, TEMAS POR GRUPO.`

// --------- Contexto vivo (lo arma el servidor con lo que manda la app + datos de la base) ---------
export interface EvalContexto {
  numero: number; id?: string; nombre: string; tipoActividad?: string | null; enfoque?: string | null; peso?: number | null
  fecha?: string | null; duracion?: number | null; estado?: string | null; personasPorGrupo?: number | null; cantidadGrupos?: number | null
  tieneRubrica?: boolean; recursos?: number; preparados?: number; examen?: string | null
  promedio?: number | null; calificados?: number
}
export interface DatosContexto {
  hoy: Date; profesor: string; materia: string; seccion: string; estudiantesSeccion: number | null
  evaluaciones: EvalContexto[]; otrasSecciones: Record<string, number>
  opinionesSinLeer?: number; sugerencias?: string[]
  resumenNotas?: string; porCriterio?: string[]; enRiesgo?: string[]
  feriados?: string[]; memoria?: string[]; cargaSemanal?: string[]
  alumnos?: { nombre: string; abrioPagina: boolean }[]; materias?: string[]; modoAuto?: boolean
}

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const fmt = (d: Date, op: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, ...op }).format(d)
const clave = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d) // YYYY-MM-DD

export function construirContexto(c: DatosContexto): string {
  const l: string[] = []
  l.push(`Hoy: ${fmt(c.hoy, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${clave(c.hoy)}).`)
  l.push(`Profesor: ${c.profesor}. Materia: ${c.materia || 'sin nombre'}. Sección activa: ${c.seccion}${c.estudiantesSeccion != null ? ` (${c.estudiantesSeccion} estudiantes activos)` : ''}.`)
  const evs = c.evaluaciones
  if (evs.length === 0) l.push('La sección no tiene evaluaciones todavía.')
  else {
    l.push(`Evaluaciones de la sección ${c.seccion}:`)
    for (const e of evs) {
      const f = e.fecha ? new Date(e.fecha) : null
      const partes = [
        `#${e.numero} ${e.nombre}`,
        e.tipoActividad || null,
        e.enfoque ? `enfoque ${e.enfoque}` : null,
        e.peso != null ? `${e.peso}%` : 'sin peso',
        f && !isNaN(f.getTime()) ? `${fmt(f, { weekday: 'short', day: 'numeric', month: 'short' })} ${fmt(f, { hour: '2-digit', minute: '2-digit', hour12: false })} (${clave(f)})` : 'sin fecha',
        e.duracion ? `${e.duracion} min` : null,
        (e.personasPorGrupo ?? 0) > 1 ? `grupos de ${e.personasPorGrupo}` : null,
        e.estado && e.estado !== 'PROGRAMADA' ? e.estado.toLowerCase() : null,
        e.tieneRubrica ? 'con rúbrica' : 'sin rúbrica',
        e.examen ? `examen en línea (${e.examen})` : null,
        e.recursos ? `${e.recursos} recursos` : 'sin recursos',
        e.calificados ? `promedio ${e.promedio?.toFixed(1)} (${e.calificados} notas)` : null,
        e.preparados ? `${e.preparados} se prepararon` : null,
      ].filter(Boolean)
      l.push(`- ${partes.join(' · ')}`)
    }
    // Alertas calculadas para que el agente no tenga que deducirlas
    const alertas: string[] = []
    const suma = evs.reduce((t, e) => t + (Number(e.peso) || 0), 0)
    if (suma !== 100) alertas.push(`los pesos suman ${suma}% (deberían sumar 100%)`)
    const pesadas = evs.filter(e => (e.peso ?? 0) > 40).map(e => `#${e.numero}`)
    if (pesadas.length) alertas.push(`${pesadas.join(', ')} pesa más de 40%`)
    const sinFecha = evs.filter(e => !e.fecha).map(e => `#${e.numero}`)
    if (sinFecha.length) alertas.push(`sin fecha: ${sinFecha.join(', ')}`)
    const porDia = new Map<string, number[]>()
    for (const e of evs) if (e.fecha && e.estado !== 'CANCELADA') { const k = clave(new Date(e.fecha)); porDia.set(k, [...(porDia.get(k) || []), e.numero]) }
    for (const [dia, nums] of porDia) if (nums.length > 1) alertas.push(`choque el ${dia}: ${nums.map(n => `#${n}`).join(' y ')}`)
    const futuras = evs.filter(e => e.fecha && new Date(e.fecha).getTime() > c.hoy.getTime() && e.estado !== 'CANCELADA')
    const sinRubrica = futuras.filter(e => !e.tieneRubrica).map(e => `#${e.numero}`)
    if (sinRubrica.length) alertas.push(`próximas sin rúbrica: ${sinRubrica.join(', ')}`)
    const sinRecursos = futuras.filter(e => !e.recursos).map(e => `#${e.numero}`)
    if (sinRecursos.length) alertas.push(`próximas sin recursos: ${sinRecursos.join(', ')}`)
    const porConfirmar = evs.filter(e => e.fecha && new Date(e.fecha).getTime() < c.hoy.getTime() && (!e.estado || e.estado === 'PROGRAMADA')).map(e => `#${e.numero}`)
    if (porConfirmar.length) alertas.push(`ya pasaron y siguen como programadas: ${porConfirmar.join(', ')}`)
    if (alertas.length) l.push(`Alertas: ${alertas.join('; ')}.`)
  }
  if (c.alumnos?.length) {
    const sinAbrir = c.alumnos.filter(a => !a.abrioPagina).map(a => a.nombre)
    l.push(`ESTUDIANTES de la sección ${c.seccion} (${c.alumnos.length}): ${c.alumnos.map(a => a.nombre).join(', ')}.${sinAbrir.length ? ` Aún no abren su página: ${sinAbrir.length === c.alumnos.length ? 'ninguno la ha abierto' : sinAbrir.join(', ')}.` : ' Todos ya abrieron su página.'}`)
  }
  if (c.materias?.length) l.push(`MATERIAS del profesor: ${c.materias.join(', ')} (la abierta es ${c.materia || 'la primera'}).`)
  const otras = Object.entries(c.otrasSecciones).filter(([s]) => s !== c.seccion)
  if (otras.length) l.push(`Otras secciones: ${otras.map(([s, n]) => `${s} (${n} evaluaciones)`).join(', ')}.`)
  if (c.opinionesSinLeer) l.push(`Opiniones de estudiantes sin leer: ${c.opinionesSinLeer}.${c.sugerencias?.length ? ` Sugerencias: ${c.sugerencias.map(s => `"${s}"`).join(' | ')}` : ''}`)
  if (c.resumenNotas) l.push(`Notas de la sección: ${c.resumenNotas}`)
  if (c.porCriterio?.length) l.push(`Resultados por criterio de rúbrica:\n${c.porCriterio.map(x => `- ${x}`).join('\n')}`)
  if (c.enRiesgo?.length) l.push(`Estudiantes en riesgo: ${c.enRiesgo.join('; ')}.`)
  if (c.cargaSemanal?.length) l.push(`Evaluaciones por semana: ${c.cargaSemanal.join(', ')}.`)
  if (c.feriados?.length) l.push(`Feriados próximos (no evaluar): ${c.feriados.join(', ')}.`)
  if (c.modoAuto) l.push('MODO AUTOMÁTICO activado: rúbricas, recursos, fechas, pesos, estados, abrir en la página y recordar se aplican solos (el profesor puede deshacerlos). Notas, estudiantes, mensajes, eliminar y cambiar de materia siempre piden confirmación. Di en pasado lo que se aplicó solo.')
  if (c.memoria?.length) l.push(`PREFERENCIAS DEL PROFESOR (recordadas): ${c.memoria.map(m => `- ${m}`).join(' ')}`)
  return l.join('\n')
}

// Instrucciones extra cuando el profesor pulsa "Revisar mi plan"
export const PROMPT_REVISION = `MODO REVISIÓN: el profesor pidió revisar su plan. Responde con esta estructura, breve y concreta:
## Nota del plan: X/10
Una frase que la justifique.
## Lo que está bien
2-3 puntos.
## Lo que mejoraría
Revisa cada aspecto y pon ✅ si está bien o ⚠️ con el problema concreto: equilibrio de pesos (suman 100, ninguna > 40%), variedad de estrategias, progresión de Bloom (de comprender a crear), carga por semana (máx. 2 por semana), fechas (choques, feriados, sin fecha), rúbricas y recursos de las próximas, y resultados (promedios, criterios flojos, estudiantes en riesgo) si ya hay notas.
## Primeros 3 pasos
Los tres cambios con más impacto, en orden.
Después llama las herramientas que arreglen lo que se pueda arreglar ya (pesos, fechas, rúbricas, recursos), como máximo 4.`