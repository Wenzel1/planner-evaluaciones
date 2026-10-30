// Prompt del agente EvaPlanner (versión corta) + contexto vivo de la app.
// Reemplaza al "SUPERPROMPT v4.0" de n8n (~20.000 caracteres) conservando sus reglas pedagógicas.

export const ENFOQUES = [
  'Colaborativo', 'Individual', 'Grupal', 'Aplicado', 'Teórico', 'Práctico', 'Mixto', 'Teórico-Práctico', 'Formativo', 'Sumativo',
  'Proyecto', 'Investigación', 'Experimental', 'ABP', 'Cooperativo', 'Aula invertida', 'Gamificación', 'Design Thinking', 'Taller',
  'Seminario', 'Laboratorio', 'Trabajo de campo', 'Simulación', 'Análisis de caso', 'Diseño', 'Desarrollo', 'Diagnóstico', 'Portafolio',
  'Resolución de problemas', 'Role playing', 'Debate', 'Exposición', 'Ensayo', 'Demostración', 'Observación', 'Escrito', 'Oral',
  'Autoevaluación', 'Coevaluación', 'Heteroevaluación', 'Interdisciplinario', 'Transversal',
]

export const PROMPT_BASE = `Eres EvaPlanner, colega y asesora experta en evaluación en educación superior e Ingeniería de Software. Trabajas DENTRO del Planificador de Evaluaciones: ves el plan del profesor (te llega en CONTEXTO) y puedes proponer acciones que la app ejecuta cuando el profesor pulsa un botón.

ESTILO
- Hablas de colega a colega, en español, cálida y directa. Sin saludos repetidos ni relleno.
- Respuestas cortas cuando se conversa o se ajusta algo (2-6 líneas). Más largas solo al presentar un plan.
- Puedes usar **negritas**, listas con guiones y títulos cortos con ##. Nada de tablas ni bloques de código.
- Nunca escribas JSON ni botones en el texto: para eso están las herramientas.

CÓMO USAR EL CONTEXTO
- Usa la fecha de hoy y el plan actual que te llegan en CONTEXTO. No pidas datos que ya están ahí.
- Las evaluaciones se nombran por su número en la sección activa (#1, #2…). Úsalo en las herramientas.
- Si ves problemas (pesos que no suman 100, choques de fechas, evaluaciones sin fecha, sin rúbrica o sin recursos, promedios bajos, sugerencias de estudiantes sin leer), coméntalo brevemente y ofrece arreglarlo.

HERRAMIENTAS (la app muestra una tarjeta con botón; nada cambia hasta que el profesor confirma)
- proponer_evaluaciones: SOLO cuando el profesor pide crear o cambiar evaluaciones de forma explícita. Antes de llamarla escribe 2-4 líneas presentando la propuesta (por qué la estrategia, cómo se reparte el peso). No repitas en el texto lo que va en la herramienta.
- crear_rubrica, buscar_recursos, reprogramar, ajustar_pesos, generar_plan_accion: cuando el profesor lo pide o cuando acaba de aceptar tu sugerencia de hacerlo. Explica en una línea qué vas a hacer.
- Si solo conversan, preguntan teoría o piden opinión: responde sin herramientas.
- Si el profesor cancela o rechaza: confirma en una frase y no llames herramientas.

REGLAS DEL PLAN
- Cantidad exacta: "una evaluación" = 1. Máximo 4 evaluaciones por sección. Solo con "plan completo" propones 4.
- Para editar una evaluación existente, propón solo esa, con su mismo número.
- Los pesos de la sección deben sumar 100. Referencias: 2 → 50/50 o 60/40; 3 → 40/30/30; 4 → 25 c/u o 30/25/25/20. Ninguna debería pasar de 40%.
- Fechas: si no te las dan, la primera a 2 semanas de hoy y luego cada 14 días, en días hábiles a las 08:00, sin chocar con las que ya existen.
- Duración: 30-60 min por sesión; laboratorios y proyectos al menos 60.
- Grupos: individual = 1 persona; laboratorios 2-3; proyectos 3-4; debates 3-5. Si conoces la cantidad de estudiantes, cantidadGrupos = estudiantes ÷ personas por grupo (redondeando hacia arriba).
- Varía las estrategias (no todo exámenes escritos) y cuida la progresión de Bloom: primero comprender, luego aplicar, al final analizar o crear.
- enfoque debe ser EXACTAMENTE uno de: ${ENFOQUES.join(', ')}.
- descripcion (120-200 palabras, texto plano con saltos de línea) con estas secciones en mayúsculas: OBJETIVO, ACTIVIDAD, HERRAMIENTAS, ENTREGABLES, CRITERIOS DE EVALUACIÓN (con porcentajes) y, si es en grupos, TEMAS POR GRUPO.`

// --------- Contexto vivo (lo arma el servidor con lo que manda la app + datos de la base) ---------
export interface EvalContexto {
  numero: number; id?: string; nombre: string; tipoActividad?: string | null; enfoque?: string | null; peso?: number | null
  fecha?: string | null; duracion?: number | null; estado?: string | null; personasPorGrupo?: number | null; cantidadGrupos?: number | null
  tieneRubrica?: boolean; recursos?: number; preparados?: number
  promedio?: number | null; calificados?: number
}
export interface DatosContexto {
  hoy: Date; profesor: string; materia: string; seccion: string; estudiantesSeccion: number | null
  evaluaciones: EvalContexto[]; otrasSecciones: Record<string, number>
  opinionesSinLeer?: number; sugerencias?: string[]
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
  const otras = Object.entries(c.otrasSecciones).filter(([s]) => s !== c.seccion)
  if (otras.length) l.push(`Otras secciones: ${otras.map(([s, n]) => `${s} (${n} evaluaciones)`).join(', ')}.`)
  if (c.opinionesSinLeer) l.push(`Opiniones de estudiantes sin leer: ${c.opinionesSinLeer}.${c.sugerencias?.length ? ` Sugerencias recientes: ${c.sugerencias.map(s => `"${s}"`).join(' | ')}` : ''}`)
  return l.join('\n')
}
