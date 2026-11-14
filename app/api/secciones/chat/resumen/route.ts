import { NextResponse } from 'next/server'
import { mensajesChat, extrasProfesor } from '@/lib/chatSeccion'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { accesoChat } from '../acceso'

export const maxDuration = 60

const SISTEMA = `Eres el asistente de un profesor universitario venezolano. Lees el chat de una de sus secciones y las opiniones de sus estudiantes sobre el plan de evaluación.
Escribe un resumen breve, claro y profesional en español, con estas partes (omite las que no tengan contenido):
**Quejas o molestias** — qué les preocupa o no les gusta (con cuántos estudiantes lo mencionan, si se nota).
**Recomendaciones de los estudiantes** — lo que proponen cambiar.
**Dudas frecuentes** — preguntas que se repiten.
**Qué podrías hacer** — 2 a 4 acciones concretas para el profesor.
Usa viñetas cortas. No inventes nada que no esté en los mensajes. No copies datos personales más allá del nombre cuando sea útil. Máximo 220 palabras.`

// POST /api/secciones/chat/resumen  { materiaId, seccion } — la IA resume lo que dicen los estudiantes en el chat de la sección
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await accesoChat(request, body.materiaId, body.seccion, 'leer')
    if (r.error) return r.error
    const { actor, materia, seccion } = r
    const clave = `resumen-chat:${actor.id}`
    if (bloqueado(clave, 20)) return NextResponse.json({ error: `Pediste muchos resúmenes seguidos. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'La IA no está disponible en este momento.' }, { status: 503 })
    const [mensajes, extras] = await Promise.all([mensajesChat(materia.id, seccion, { usuarioId: actor.id }), extrasProfesor(materia.id, seccion)])
    const deEstudiantes = [...mensajes.filter(m => m.autorTipo === 'ESTUDIANTE'), ...extras.filter(e => e.tipo === 'OPINION')]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-200)
    if (!deEstudiantes.length) return NextResponse.json({ texto: 'Todavía no hay mensajes ni opiniones de los estudiantes en esta sección para resumir.' })
    registrarFallo(clave)
    const fecha = (d: Date) => new Date(d).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short' })
    const transcripcion = deEstudiantes.map(m => `[${fecha(m.createdAt)}] ${m.autorNombre}${m.tipo === 'OPINION' ? (m.deAcuerdo ? ' (opinión del plan: DE ACUERDO)' : ' (opinión del plan: SUGERENCIA)') : ''}: ${m.texto || (m.adjunto ? `(envió ${m.adjunto.tipo?.startsWith('audio/') ? 'una nota de voz' : `el archivo ${m.adjunto.nombre}`})` : '')}`).join('\n').slice(-24000)
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
      body: JSON.stringify({ model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(), temperature: 0.3, max_tokens: 900, messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: `Materia: ${materia.nombre} · Sección ${seccion}\n\n${transcripcion}` }] }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => null)
    const d: any = resp ? await resp.json().catch(() => ({})) : {}
    const texto = String(d?.choices?.[0]?.message?.content || '').trim()
    if (!resp?.ok || !texto) return NextResponse.json({ error: resp?.status === 402 ? 'La IA no tiene saldo disponible.' : 'La IA no pudo resumir el chat. Intenta de nuevo.' }, { status: 502 })
    return NextResponse.json({ texto, mensajes: deEstudiantes.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo resumir el chat.' }, { status: 500 })
  }
}
