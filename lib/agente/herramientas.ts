// Herramientas (acciones) que el agente puede PROPONER. Nada se ejecuta en el servidor:
// la app muestra una tarjeta y el profesor confirma con un botón.
import crypto from 'crypto'
import { ENFOQUES } from './prompt'

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
              descripcion: { type: 'string', description: 'Texto plano con OBJETIVO, ACTIVIDAD, HERRAMIENTAS, ENTREGABLES, CRITERIOS DE EVALUACIÓN' },
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
    name: 'generar_plan_accion',
    description: 'Genera el Plan de Acción en PDF de la sección activa con las evaluaciones marcadas.',
    parameters: { type: 'object', properties: {} },
  },
]

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
    default: return ''
  }
}
