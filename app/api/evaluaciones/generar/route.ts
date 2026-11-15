import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const maxDuration = 60

const SISTEMA = `Eres EvaPlanner, asistente de un profesor universitario venezolano de Ingeniería de Software.
Propones evaluaciones para su plan de evaluación. Respondes SOLO con JSON válido, sin texto antes ni después, con esta forma:
{"evaluaciones":[{"materia":"…","tipoActividad":"…","enfoque":"…","duracionMinutos":90,"peso":25,"fecha":"AAAA-MM-DD","hora":"08:00","cantidadGrupos":null,"personasPorGrupo":null,"descripcion":"…"}]}
Reglas:
- "materia" es el TEMA de la evaluación (corto, máximo 70 caracteres), actual y propio de la ingeniería de software; alrededor de la mitad relacionados con IA aplicada al software. No repitas temas que ya están en el plan.
- "tipoActividad" es la estrategia: Taller práctico, Laboratorio práctico, Análisis de caso, Proyecto, Exposición, Prueba escrita, Ensayo, Debate… e indica si es individual o en grupos (ej. "Taller práctico en grupos").
- "enfoque" es UNO de: Teórico, Práctico, Teórico-Práctico, Aplicado, Proyecto, Investigación, ABP, Análisis de caso, Laboratorio, Taller, Exposición, Ensayo, Debate.
- Pesos enteros. Entre todas las que propones, completan lo que falta para llegar a 100% (si ya está completo, reparte 15-25% cada una).
- Fechas en días de semana (lunes a viernes), después de la última evaluación del plan y separadas al menos 7 días entre sí; hora entre 07:00 y 17:00.
- Si es en grupos, pon personasPorGrupo (3 a 5) y cantidadGrupos según los estudiantes de la sección; si es individual, ambos null.
- "descripcion": 4 a 8 líneas con: Objetivo, Actividades (con guiones), Producto a entregar y Criterios de evaluación. Concreta y aplicable.
- Si el profesor ya escribió algo en un campo, respétalo tal cual y completa lo demás de forma coherente con eso.`

// POST /api/evaluaciones/generar  { materia, seccion, estudiantes, existentes: [{ nombre, tipoActividad, peso, fecha }], formularios: [{ materia?, tipoActividad?, enfoque? }] }
// Devuelve evaluaciones listas para rellenar los formularios (no guarda nada: el profesor revisa y guarda).
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const clave = `generar-eval:${actor!.id}`
    if (bloqueado(clave, 30)) return NextResponse.json({ error: `Generaste muchas evaluaciones seguidas. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'La IA no está disponible en este momento.' }, { status: 503 })
    const body = await request.json().catch(() => ({}))
    const formularios = (Array.isArray(body.formularios) ? body.formularios : [{}]).slice(0, 4).map((f: any) => ({
      materia: String(f?.materia || '').slice(0, 200), tipoActividad: String(f?.tipoActividad || '').slice(0, 120), enfoque: String(f?.enfoque || '').slice(0, 60),
    }))
    const existentes = (Array.isArray(body.existentes) ? body.existentes : []).slice(0, 20).map((e: any) => ({
      nombre: String(e?.nombre || '').slice(0, 150), tipoActividad: String(e?.tipoActividad || '').slice(0, 80), peso: Number(e?.peso) || 0, fecha: String(e?.fecha || '').slice(0, 10),
    }))
    const suma = existentes.reduce((t: number, e: { peso: number }) => t + e.peso, 0)
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
    const pedido = [
      `Materia: ${String(body.materia || 'Ingeniería de Software').slice(0, 120)} · Sección ${String(body.seccion || 'A').slice(0, 3)} · ${Number(body.estudiantes) || 0} estudiantes.`,
      `Hoy es ${hoy}.`,
      existentes.length ? `Evaluaciones que ya están en el plan (suman ${suma}%):\n${existentes.map((e: any) => `- ${e.nombre} · ${e.tipoActividad || 'sin estrategia'} · ${e.peso}% · ${e.fecha || 'sin fecha'}`).join('\n')}` : 'El plan todavía no tiene evaluaciones.',
      `Propón exactamente ${formularios.length} evaluación(es), una por formulario, en este orden. Lo que el profesor ya escribió en cada formulario:`,
      ...formularios.map((f: any, i: number) => `${i + 1}. tema: ${f.materia || '(vacío)'} · estrategia: ${f.tipoActividad || '(vacío)'} · enfoque: ${f.enfoque || '(vacío)'}`),
    ].join('\n')

    registrarFallo(clave)
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
      body: JSON.stringify({ model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(), temperature: 0.7, max_tokens: 2500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: pedido }] }),
      signal: AbortSignal.timeout(50000),
    }).catch(() => null)
    const d: any = resp ? await resp.json().catch(() => ({})) : {}
    const texto = String(d?.choices?.[0]?.message?.content || '').trim()
    if (!resp?.ok || !texto) return NextResponse.json({ error: resp?.status === 402 ? 'La IA no tiene saldo disponible.' : 'La IA no respondió. Intenta de nuevo.' }, { status: 502 })
    let json: any = null
    try { json = JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { json = null }
    const lista = Array.isArray(json?.evaluaciones) ? json.evaluaciones : []
    if (!lista.length) return NextResponse.json({ error: 'La IA no devolvió evaluaciones válidas. Intenta de nuevo.' }, { status: 502 })
    const num = (v: unknown, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null }
    const evaluaciones = lista.slice(0, formularios.length).map((e: any, i: number) => ({
      materia: (formularios[i]?.materia || String(e?.materia || '')).slice(0, 200),
      tipoActividad: (formularios[i]?.tipoActividad || String(e?.tipoActividad || '')).slice(0, 120),
      enfoque: (formularios[i]?.enfoque || String(e?.enfoque || '')).slice(0, 60),
      duracionMinutos: num(e?.duracionMinutos, 15, 600),
      peso: num(e?.peso, 1, 100),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.fecha || '')) ? String(e.fecha) : undefined,
      hora: /^\d{2}:\d{2}$/.test(String(e?.hora || '')) ? String(e.hora) : undefined,
      cantidadGrupos: num(e?.cantidadGrupos, 1, 60),
      personasPorGrupo: num(e?.personasPorGrupo, 2, 10),
      descripcion: String(e?.descripcion || '').slice(0, 3000),
    }))
    return NextResponse.json({ evaluaciones })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar la evaluación.' }, { status: 500 })
  }
}
