// Herramientas (acciones) que el agente puede PROPONER. Nada se ejecuta en el servidor:
// la app muestra una tarjeta y el profesor confirma con un botón.
import crypto from 'crypto'
import { ENFOQUES } from './prompt'
import { normalizarExamen } from '@/lib/examen'

type Esquema = { type: string; description?: string; properties?: Record<string, Esquema>; required?: string[]; items?: Esquema; enum?: string[] }
export interface Herramienta { name: string; description: string; parameters: Esquema }

const evaluacionRef: Esquema = { type: 'integer', description: 'Número de la evaluación en la sección activa (#1, #2…)' }

export const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'proponer_evaluaciones',
    description: 'Propone crear o editar evaluaciones de la sección activa. Úsala solo si el profesor lo pide de forma explícita.',
    parameters: {
      type: 'object',
      properties: {
        evaluaciones: {
          type: 'array', description: 'Entre 1 y 4 evaluaciones',
          items: {
            type: 'object',
            properties: {
              numero: { type: 'integer', description: 'Número de la evaluación (1 a 4). Si editas una existente, usa su mismo número.' },
              nombre: { type: 'string', description: 'Nombre descriptivo del tema evaluado (sin "Evaluación N:")' },
              tipoActividad: { type: 'string', description: 'Estrategia, ej. "Taller práctico", "Exposición grupal", "Ensayo"' },
              enfoque: { type: 'string', enum: ENFOQUES, description: 'Uno de los enfoques permitidos' },
              duracionMinutos: { type: 'integer' },
              peso: { type: 'integer', description: 'Porcentaje de la nota' },
              cantidadGrupos: { type: 'integer' },
              personasPorGrupo: { type: 'integer' },
              fecha: { type: 'string', description: 'YYYY-MM-DD' },
              hora: { type: 'string', description: 'HH:MM (24 h)' },
              descripcion: { type: 'string', description: 'Texto plano (90-140 palabras) con OBJETIVO, ACTIVIDAD, HERRAMIENTAS, ENTREGABLES, CRITERIOS DE EVALUACIÓN' },
              examenEnLinea: { type: 'boolean', description: 'true SOLO si el estudiante la responde escribiendo, individual, dentro de un examen en línea con tiempo (prueba escrita, cuestionario, selección simple, verdadero/falso, preguntas de desarrollo, ensayo, informe escrito). false si entrega diagramas, código, repositorio, prototipo, documento hecho en otra herramienta, presentación, laboratorio, taller práctico, proyecto o algo presencial/grupal.' },
            },
            required: ['numero', 'nombre', 'tipoActividad', 'enfoque', 'duracionMinutos', 'peso', 'fecha', 'hora', 'descripcion'],
          },
        },
      },
      required: ['evaluaciones'],
    },
  },
  {
    name: 'crear_rubrica',
    description: 'Crea una rúbrica sugerida (criterios y niveles, 20 puntos) para una evaluación de la sección activa.',
    parameters: { type: 'object', properties: { evaluacion: evaluacionRef }, required: ['evaluacion'] },
  },
  {
    name: 'buscar_recursos',
    description: 'Busca videos de YouTube y páginas verificadas y los asigna a una evaluación para que los estudiantes estudien.',
    parameters: { type: 'object', properties: { evaluacion: evaluacionRef }, required: ['evaluacion'] },
  },
  {
    name: 'reprogramar',
    description: 'Cambia la fecha y hora de una evaluación de la sección activa.',
    parameters: {
      type: 'object',
      properties: { evaluacion: evaluacionRef, fecha: { type: 'string', description: 'YYYY-MM-DD' }, hora: { type: 'string', description: 'HH:MM (24 h)' }, motivo: { type: 'string', description: 'Por qué (una frase)' } },
      required: ['evaluacion', 'fecha'],
    },
  },
  {
    name: 'ajustar_pesos',
    description: 'Cambia los porcentajes de varias evaluaciones de la sección activa (deben sumar 100).',
    parameters: {
      type: 'object',
      properties: { pesos: { type: 'array', items: { type: 'object', properties: { evaluacion: evaluacionRef, peso: { type: 'integer' } }, required: ['evaluacion', 'peso'] } } },
      required: ['pesos'],
    },
  },
  {
    name: 'generar_preguntas',
    description: 'Crea un banco de preguntas de examen con sus respuestas para una evaluación o tema.',
    parameters: {
      type: 'object',
      properties: {
        evaluacion: { type: 'integer', description: 'Número de la evaluación (opcional)' },
        tema: { type: 'string', description: 'Tema de las preguntas' },
        preguntas: {
          type: 'array', description: 'Entre 3 y 25 preguntas',
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['seleccion', 'verdadero_falso', 'desarrollo', 'caso', 'practica'] },
              enunciado: { type: 'string' },
              opciones: { type: 'array', items: { type: 'string' }, description: 'Solo para selección (4 opciones, sin letras)' },
              respuesta: { type: 'string', description: 'Respuesta correcta o lo que se espera' },
              puntos: { type: 'number' },
            },
            required: ['tipo', 'enunciado', 'respuesta'],
          },
        },
      },
      required: ['tema', 'preguntas'],
    },
  },
  {
    name: 'copiar_plan',
    description: 'Copia las evaluaciones de una sección a otra, corriendo las fechas unos días.',
    parameters: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Letra de la sección origen (ej. "A")' },
        hacia: { type: 'string', description: 'Letra de la sección destino (ej. "B")' },
        dias: { type: 'integer', description: 'Días que se corren las fechas (0 = mismas fechas, 7 = una semana después)' },
        reemplazar: { type: 'boolean', description: 'true = borra lo que tenga la sección destino' },
      },
      required: ['desde', 'hacia', 'dias'],
    },
  },
  {
    name: 'mensaje_estudiantes',
    description: 'Prepara un mensaje de WhatsApp para estudiantes de la sección activa (el profesor lo revisa antes de enviar).',
    parameters: {
      type: 'object',
      properties: {
        destinatarios: { type: 'string', enum: ['seccion', 'riesgo', 'nombres'], description: 'seccion = todos; riesgo = los que van mal; nombres = los indicados' },
        nombres: { type: 'array', items: { type: 'string' }, description: 'Solo si destinatarios = nombres' },
        texto: { type: 'string', description: 'Mensaje (usa {nombre} para personalizar)' },
        incluirEnlace: { type: 'boolean', description: 'Agregar el enlace a su página personal' },
      },
      required: ['destinatarios', 'texto'],
    },
  },
  {
    name: 'cambiar_estado',
    description: 'Marca una evaluación como realizada, cancelada o de vuelta a programada.',
    parameters: { type: 'object', properties: { evaluacion: evaluacionRef, estado: { type: 'string', enum: ['REALIZADA', 'CANCELADA', 'PROGRAMADA'] } }, required: ['evaluacion', 'estado'] },
  },
  {
    name: 'recordar_preferencia',
    description: 'Guarda algo del profesor para recordarlo en futuras conversaciones.',
    parameters: { type: 'object', properties: { texto: { type: 'string', description: 'Una preferencia corta, ej. "No evalúa los viernes"' } }, required: ['texto'] },
  },
  {
    name: 'generar_plan_accion',
    description: 'Genera el Plan de Acción en PDF de la sección activa con las evaluaciones marcadas.',
    parameters: { type: 'object', properties: {} },
  },
  // ----- Consultas propias (solo lectura, se ejecutan en el servidor y vuelves a responder con el resultado) -----
  {
    name: 'consultar',
    description: 'Busca datos que NO están en el CONTEXTO y te los devuelve para que sigas respondiendo: historial completo de un estudiante, la lista de notas de una evaluación, otra sección, los envíos de WhatsApp, todas las opiniones o las materias. Úsala antes de responder cuando necesites esos detalles; no le digas al profesor que vas a consultar, solo hazlo.',
    parameters: {
      type: 'object',
      properties: {
        que: { type: 'string', enum: ['estudiante', 'notas_evaluacion', 'seccion', 'envios_whatsapp', 'opiniones', 'materias'] },
        nombre: { type: 'string', description: 'Nombre del estudiante (para que = estudiante)' },
        evaluacion: { type: 'integer', description: 'Número (#) en la sección activa (para que = notas_evaluacion)' },
        seccion: { type: 'string', description: 'Letra (para que = seccion)' },
      },
      required: ['que'],
    },
  },
  {
    name: 'crear_examen',
    description: 'Prepara el examen en línea de una evaluación TEÓRICA de la sección activa (prueba escrita, selección simple, desarrollo, ensayo, informe, análisis de caso). El profesor lo revisa antes de adjuntarlo. No lo uses para exposiciones, laboratorios, proyectos, talleres prácticos ni debates.',
    parameters: {
      type: 'object',
      properties: {
        evaluacion: evaluacionRef,
        instrucciones: { type: 'string', description: 'Instrucciones para el estudiante (1-3 frases)' },
        duracionMin: { type: 'integer', description: 'Minutos para responder' },
        modoCorreccion: { type: 'string', enum: ['sugerida', 'profesor', 'automatica'], description: 'sugerida (por defecto): la IA corrige y el profesor publica; automatica solo si es todo selección/VF' },
        preguntas: {
          type: 'array', description: 'Selección/VF: 8-15. Desarrollo: 3-5. Informe: 1-2. Mixto: combina. Los puntos suman 20.',
          items: {
            type: 'object',
            properties: {
              tipo: { type: 'string', enum: ['seleccion', 'vf', 'desarrollo', 'informe'] },
              enunciado: { type: 'string', description: 'Pregunta clara y corta, sin comillas dobles' },
              opciones: { type: 'array', items: { type: 'string' }, description: 'Solo selección: 4 opciones sin letras' },
              correcta: { type: 'integer', description: 'Selección: índice (0-3) de la correcta. VF: 1 verdadero, 0 falso' },
              esperado: { type: 'string', description: 'Desarrollo/informe: lo que debe incluir la respuesta (máx. 40 palabras)' },
              puntos: { type: 'number' },
            },
            required: ['tipo', 'enunciado', 'puntos'],
          },
        },
      },
      required: ['evaluacion', 'preguntas'],
    },
  },
  // ----- Control de toda la app -----
  {
    name: 'navegar',
    description: 'Abre una pantalla de la app y, si se indica, cambia la sección activa. Se ejecuta sola (no pide confirmación).',
    parameters: {
      type: 'object',
      properties: {
        vista: { type: 'string', enum: ['dashboard', 'planificador', 'calendario', 'estudiantes', 'papelera', 'perfil', 'configuracion'] },
        seccion: { type: 'string', description: 'Letra de la sección a activar (opcional)' },
      },
      required: ['vista'],
    },
  },
  {
    name: 'agregar_estudiantes',
    description: 'Agrega estudiantes a una sección. Cada uno necesita nombre, correo y teléfono: si el profesor no dio alguno, déjalo vacío y él lo completa en la tarjeta.',
    parameters: {
      type: 'object',
      properties: {
        seccion: { type: 'string', description: 'Letra de la sección (por defecto la activa)' },
        estudiantes: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' }, email: { type: 'string' }, telefono: { type: 'string' } }, required: ['nombre'] } },
      },
      required: ['estudiantes'],
    },
  },
  {
    name: 'modificar_estudiantes',
    description: 'Cambia de sección, retira (deja inactivos) o reactiva estudiantes, buscándolos por nombre.',
    parameters: {
      type: 'object',
      properties: {
        nombres: { type: 'array', items: { type: 'string' }, description: 'Nombres tal como aparecen en la lista de estudiantes' },
        accion: { type: 'string', enum: ['mover', 'retirar', 'reactivar'] },
        seccion: { type: 'string', description: 'Sección destino (solo para mover)' },
      },
      required: ['nombres', 'accion'],
    },
  },
  {
    name: 'cargar_notas',
    description: 'Registra notas (0 a 20) de una evaluación de la sección activa a partir de lo que dicta o pega el profesor.',
    parameters: {
      type: 'object',
      properties: {
        evaluacion: evaluacionRef,
        notas: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' }, nota: { type: 'number', description: 'Nota de 0 a 20' }, observacion: { type: 'string' } }, required: ['nombre', 'nota'] } },
        enviar: { type: 'boolean', description: 'true = enviar a cada uno su nota por WhatsApp al guardarlas (solo si el profesor lo pide)' },
      },
      required: ['evaluacion', 'notas'],
    },
  },
  {
    name: 'abrir_en_portal',
    description: 'Abre (o vuelve a cerrar) una evaluación en la página de los estudiantes antes de los 7 días previos, para que vean descripción, recursos y rúbrica.',
    parameters: { type: 'object', properties: { evaluacion: evaluacionRef, abrir: { type: 'boolean' } }, required: ['evaluacion', 'abrir'] },
  },
  {
    name: 'enviar_plan',
    description: 'Envía por WhatsApp a los estudiantes de la sección activa el enlace a su página personal con el plan.',
    parameters: { type: 'object', properties: { soloSinAbrir: { type: 'boolean', description: 'true = solo a quienes todavía no han abierto su página' } } },
  },
  {
    name: 'eliminar_evaluaciones',
    description: 'Elimina evaluaciones de la sección activa (van a la papelera con sus notas y se pueden restaurar).',
    parameters: { type: 'object', properties: { evaluaciones: { type: 'array', items: { type: 'integer' }, description: 'Números (#) de las evaluaciones' } }, required: ['evaluaciones'] },
  },
  {
    name: 'cambiar_materia',
    description: 'Abre otra materia del profesor o crea una nueva (cada materia tiene su propio plan).',
    parameters: { type: 'object', properties: { nombre: { type: 'string' }, crear: { type: 'boolean', description: 'true = crearla si no existe' } }, required: ['nombre'] },
  },
]

// Herramientas que resuelve el propio servidor (no llegan a la app como tarjeta)
export const HERRAMIENTAS_SERVIDOR = ['consultar']

// Acciones que no cambian datos: se ejecutan solas, sin tarjeta de confirmación
export const ACCIONES_AUTOMATICAS = ['navegar']

// Gemini usa los tipos en MAYÚSCULAS (OBJECT, STRING…); Groq usa JSON Schema normal
function aGemini(e: Esquema): any {
  const r: any = { type: e.type.toUpperCase() }
  if (e.description) r.description = e.description
  if (e.enum) { r.enum = e.enum; r.format = 'enum' }
  if (e.items) r.items = aGemini(e.items)
  if (e.properties) { r.properties = Object.fromEntries(Object.entries(e.properties).map(([k, v]) => [k, aGemini(v)])); if (e.required?.length) r.required = e.required }
  return r
}
export const herramientasGemini = () => [{
  functionDeclarations: HERRAMIENTAS.map(h => ({
    name: h.name, description: h.description,
    ...(Object.keys(h.parameters.properties || {}).length ? { parameters: aGemini(h.parameters) } : {}),
  })),
}]
export const herramientasGroq = () => HERRAMIENTAS.map(h => ({ type: 'function', function: { name: h.name, description: h.description, parameters: h.parameters } }))

// ---------- Validación de lo que devuelve el modelo ----------
export interface Accion { id: string; tipo: string; datos: any }
const ent = (v: any, min: number, max: number): number | null => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null }
const texto = (v: any, max: number) => String(v ?? '').replace(/\*\*/g, '').trim().slice(0, max)
const fechaOk = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '')
const horaOk = (v: any) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? '')); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : '' }
const letra = (v: any) => (/^[A-Za-z]$/.test(String(v ?? '').trim()) ? String(v).trim().toUpperCase() : '')
const enfoqueOk = (v: any) => { const s = String(v ?? '').trim().toLowerCase(); return ENFOQUES.find(e => e.toLowerCase() === s) || '' }

export function normalizarAccion(nombre: string, args: any): Accion | null {
  const a = args && typeof args === 'object' ? args : {}
  const id = crypto.randomUUID()
  switch (nombre) {
    case 'proponer_evaluaciones': {
      const lista = (Array.isArray(a.evaluaciones) ? a.evaluaciones : []).slice(0, 4).map((e: any, i: number) => ({
        numero: ent(e?.numero, 1, 4) ?? i + 1,
        nombre: texto(e?.nombre, 160).replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '') || `Evaluación ${i + 1}`,
        tipoActividad: texto(e?.tipoActividad, 80),
        enfoque: enfoqueOk(e?.enfoque),
        duracionMinutos: ent(e?.duracionMinutos, 5, 600),
        peso: ent(e?.peso, 0, 100),
        cantidadGrupos: ent(e?.cantidadGrupos, 1, 60),
        personasPorGrupo: ent(e?.personasPorGrupo, 1, 15),
        fecha: fechaOk(e?.fecha), hora: horaOk(e?.hora) || '08:00',
        descripcion: texto(e?.descripcion, 4000),
        examenEnLinea: e?.examenEnLinea === true,
      }))
      return lista.length ? { id, tipo: nombre, datos: { evaluaciones: lista } } : null
    }
    case 'crear_rubrica':
    case 'buscar_recursos': {
      const n = ent(a.evaluacion, 1, 20)
      return n ? { id, tipo: nombre, datos: { evaluacion: n } } : null
    }
    case 'reprogramar': {
      const n = ent(a.evaluacion, 1, 20); const f = fechaOk(a.fecha)
      return n && f ? { id, tipo: nombre, datos: { evaluacion: n, fecha: f, hora: horaOk(a.hora), motivo: texto(a.motivo, 200) } } : null
    }
    case 'ajustar_pesos': {
      const pesos = (Array.isArray(a.pesos) ? a.pesos : []).map((p: any) => ({ evaluacion: ent(p?.evaluacion, 1, 20), peso: ent(p?.peso, 0, 100) })).filter((p: any) => p.evaluacion && p.peso != null).slice(0, 20)
      return pesos.length ? { id, tipo: nombre, datos: { pesos } } : null
    }
    case 'generar_plan_accion':
      return { id, tipo: nombre, datos: {} }
    case 'generar_preguntas': {
      const tipos = ['seleccion', 'verdadero_falso', 'desarrollo', 'caso', 'practica']
      const preguntas = (Array.isArray(a.preguntas) ? a.preguntas : []).slice(0, 30).map((q: any) => ({
        tipo: tipos.includes(q?.tipo) ? q.tipo : 'desarrollo',
        enunciado: texto(q?.enunciado, 800),
        opciones: Array.isArray(q?.opciones) ? q.opciones.slice(0, 6).map((o: any) => texto(o, 300).replace(/^[a-fA-F][).]\s*/, '')).filter(Boolean) : [],
        respuesta: texto(q?.respuesta, 800),
        puntos: q?.puntos == null ? null : Math.max(0, Math.min(20, Math.round(Number(q.puntos) * 2) / 2) || 0),
      })).filter((q: any) => q.enunciado)
      return preguntas.length ? { id, tipo: nombre, datos: { evaluacion: ent(a.evaluacion, 1, 20), tema: texto(a.tema, 160), preguntas } } : null
    }
    case 'copiar_plan': {
      const desde = letra(a.desde), hacia = letra(a.hacia)
      return desde && hacia && desde !== hacia ? { id, tipo: nombre, datos: { desde, hacia, dias: ent(a.dias, -120, 120) ?? 0, reemplazar: a.reemplazar === true } } : null
    }
    case 'mensaje_estudiantes': {
      const dest = ['seccion', 'riesgo', 'nombres'].includes(a.destinatarios) ? a.destinatarios : 'seccion'
      const nombres = Array.isArray(a.nombres) ? a.nombres.slice(0, 40).map((n: any) => texto(n, 80)).filter(Boolean) : []
      const msg = texto(a.texto, 1200)
      return msg.length >= 5 ? { id, tipo: nombre, datos: { destinatarios: dest === 'nombres' && !nombres.length ? 'seccion' : dest, nombres, texto: msg, incluirEnlace: a.incluirEnlace !== false } } : null
    }
    case 'cambiar_estado': {
      const n = ent(a.evaluacion, 1, 20); const e = String(a.estado ?? '').toUpperCase()
      return n && ['REALIZADA', 'CANCELADA', 'PROGRAMADA'].includes(e) ? { id, tipo: nombre, datos: { evaluacion: n, estado: e } } : null
    }
    case 'recordar_preferencia': {
      const t = texto(a.texto, 200)
      return t.length >= 4 ? { id, tipo: nombre, datos: { texto: t } } : null
    }
    case 'navegar': {
      const vistas = ['dashboard', 'planificador', 'calendario', 'estudiantes', 'papelera', 'perfil', 'configuracion']
      const v = String(a.vista ?? '').toLowerCase()
      return vistas.includes(v) ? { id, tipo: nombre, datos: { vista: v, seccion: letra(a.seccion) } } : null
    }
    case 'agregar_estudiantes': {
      const lista = (Array.isArray(a.estudiantes) ? a.estudiantes : []).slice(0, 60).map((e: any) => ({
        nombre: texto(e?.nombre, 80), email: texto(e?.email, 100).toLowerCase().replace(/\s+/g, ''), telefono: texto(e?.telefono, 25),
      })).filter((e: any) => e.nombre.length >= 3)
      return lista.length ? { id, tipo: nombre, datos: { seccion: letra(a.seccion), estudiantes: lista } } : null
    }
    case 'modificar_estudiantes': {
      const nombres = (Array.isArray(a.nombres) ? a.nombres : []).slice(0, 60).map((n: any) => texto(n, 80)).filter(Boolean)
      const acc = ['mover', 'retirar', 'reactivar'].includes(a.accion) ? a.accion : ''
      const sec = letra(a.seccion)
      return nombres.length && acc && (acc !== 'mover' || sec) ? { id, tipo: nombre, datos: { nombres, accion: acc, seccion: sec } } : null
    }
    case 'cargar_notas': {
      const n = ent(a.evaluacion, 1, 20)
      const notas = (Array.isArray(a.notas) ? a.notas : []).slice(0, 120).map((x: any) => {
        const v = Number(String(x?.nota ?? '').replace(',', '.'))
        return { nombre: texto(x?.nombre, 80), nota: Number.isFinite(v) && v >= 0 && v <= 20 ? Math.round(v * 100) / 100 : null, observacion: texto(x?.observacion, 300) }
      }).filter((x: any) => x.nombre && x.nota != null)
      return n && notas.length ? { id, tipo: nombre, datos: { evaluacion: n, notas, enviar: a.enviar === true } } : null
    }
    case 'abrir_en_portal': {
      const n = ent(a.evaluacion, 1, 20)
      return n ? { id, tipo: nombre, datos: { evaluacion: n, abrir: a.abrir !== false } } : null
    }
    case 'enviar_plan':
      return { id, tipo: nombre, datos: { soloSinAbrir: a.soloSinAbrir === true } }
    case 'eliminar_evaluaciones': {
      const nums = [...new Set((Array.isArray(a.evaluaciones) ? a.evaluaciones : []).map((x: any) => ent(x, 1, 20)).filter(Boolean))].slice(0, 12)
      return nums.length ? { id, tipo: nombre, datos: { evaluaciones: nums } } : null
    }
    case 'crear_examen': {
      const n = ent(a.evaluacion, 1, 20)
      const ex = normalizarExamen({ instrucciones: a.instrucciones, duracionMin: a.duracionMin, modoCorreccion: a.modoCorreccion, preguntas: a.preguntas })
      return n && ex ? { id, tipo: nombre, datos: { evaluacion: n, examen: ex } } : null
    }
    case 'cambiar_materia': {
      const m = texto(a.nombre, 120)
      return m.length >= 2 ? { id, tipo: nombre, datos: { nombre: m, crear: a.crear === true } } : null
    }
    default:
      return null
  }
}

// Texto corto que se guarda en la memoria para que el modelo recuerde lo que propuso
export function resumenAccion(a: Accion): string {
  switch (a.tipo) {
    case 'proponer_evaluaciones': return `[Propuse ${a.datos.evaluaciones.length} evaluación(es): ${a.datos.evaluaciones.map((e: any) => `#${e.numero} ${e.nombre} (${e.peso ?? '?'}%, ${e.fecha || 'sin fecha'})`).join('; ')}]`
    case 'crear_rubrica': return `[Propuse crear la rúbrica de #${a.datos.evaluacion}]`
    case 'buscar_recursos': return `[Propuse buscar recursos para #${a.datos.evaluacion}]`
    case 'reprogramar': return `[Propuse mover #${a.datos.evaluacion} al ${a.datos.fecha} ${a.datos.hora || ''}]`
    case 'ajustar_pesos': return `[Propuse pesos: ${a.datos.pesos.map((p: any) => `#${p.evaluacion}=${p.peso}%`).join(', ')}]`
    case 'generar_plan_accion': return '[Propuse generar el Plan de Acción en PDF]'
    case 'generar_preguntas': return `[Generé ${a.datos.preguntas.length} preguntas sobre ${a.datos.tema}]`
    case 'copiar_plan': return `[Propuse copiar el plan de la sección ${a.datos.desde} a la ${a.datos.hacia}${a.datos.dias ? ` corriendo ${a.datos.dias} días` : ''}]`
    case 'mensaje_estudiantes': return `[Preparé un WhatsApp para ${a.datos.destinatarios === 'riesgo' ? 'los estudiantes en riesgo' : a.datos.destinatarios === 'nombres' ? a.datos.nombres.join(', ') : 'toda la sección'}: "${a.datos.texto.slice(0, 120)}"]`
    case 'cambiar_estado': return `[Propuse marcar #${a.datos.evaluacion} como ${a.datos.estado.toLowerCase()}]`
    case 'recordar_preferencia': return `[Propuse recordar: ${a.datos.texto}]`
    case 'navegar': return `[Abrí la pantalla ${a.datos.vista}${a.datos.seccion ? ` (sección ${a.datos.seccion})` : ''}]`
    case 'agregar_estudiantes': return `[Propuse agregar ${a.datos.estudiantes.length} estudiante(s): ${a.datos.estudiantes.map((e: any) => e.nombre).join(', ').slice(0, 200)}]`
    case 'modificar_estudiantes': return `[Propuse ${a.datos.accion} a ${a.datos.nombres.join(', ').slice(0, 200)}${a.datos.seccion ? ` → sección ${a.datos.seccion}` : ''}]`
    case 'cargar_notas': return `[Propuse cargar ${a.datos.notas.length} nota(s) en #${a.datos.evaluacion}${a.datos.enviar ? ' y enviarlas' : ''}]`
    case 'abrir_en_portal': return `[Propuse ${a.datos.abrir ? 'abrir' : 'cerrar'} #${a.datos.evaluacion} en la página de los estudiantes]`
    case 'enviar_plan': return `[Propuse enviar el plan por WhatsApp${a.datos.soloSinAbrir ? ' a quienes no han abierto su página' : ''}]`
    case 'eliminar_evaluaciones': return `[Propuse eliminar ${a.datos.evaluaciones.map((n: number) => `#${n}`).join(', ')}]`
    case 'crear_examen': return `[Preparé el examen en línea de #${a.datos.evaluacion}: ${a.datos.examen.preguntas.length} preguntas (${a.datos.examen.tipo}), ${a.datos.examen.duracionMin} min]`
    case 'cambiar_materia': return `[Propuse ${a.datos.crear ? 'abrir o crear' : 'abrir'} la materia «${a.datos.nombre}»]`
    default: return ''
  }
}
