import { NextResponse } from 'next/server'
import { accesoPortal } from '@/lib/portalAcceso'
import prisma from '@/lib/prisma'
import { estudianteDeToken, evaluacionDelEstudiante } from '@/lib/entregas'
import { estaAbierta, normalizarRecursos } from '@/lib/portal'
import { normalizarRubrica } from '@/lib/rubrica'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const maxDuration = 60

const SISTEMA = `Eres el asistente de estudio de un estudiante universitario venezolano. Hablas en español, con calidez y claridad, en frases cortas.
Tu trabajo: ayudarlo a PREPARARSE para su evaluación.
- Explica los temas con ejemplos sencillos y paso a paso.
- Si te lo pide, hazle preguntas de práctica (una a la vez) y corrígelas explicando por qué.
- Sugiere cómo organizar su estudio y cuáles recursos de la evaluación ver primero.
- NO hagas la tarea por él: no escribas el trabajo, el código completo, el informe ni las respuestas de un examen. Si te lo pide, ofrécele guiarlo con preguntas y pistas para que lo haga él.
- Si pregunta algo de notas, fechas o reglas que no sepas, dile que le escriba a su profesor desde "Mensajes privados".
- Respuestas de máximo 180 palabras, con listas cuando ayuden.`

// POST /api/portal/:token/tutor  { evaluacionId?, mensajes: [{ rol: 'user'|'assistant', texto }] }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const clave = `tutor:${est.id}`
    if (bloqueado(clave, 40)) return NextResponse.json({ error: `Hiciste muchas preguntas seguidas. Descansa ${minutosRestantes(clave)} minuto(s) y sigue.` }, { status: 429 })
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'El asistente no está disponible en este momento.' }, { status: 503 })
    const body = await request.json().catch(() => ({}))
    const mensajes = (Array.isArray(body.mensajes) ? body.mensajes : []).slice(-12)
      .map((m: any) => ({ role: m.rol === 'assistant' ? 'assistant' : 'user', content: String(m.texto || '').slice(0, 2000) }))
      .filter((m: any) => m.content.trim())
    if (!mensajes.length || mensajes[mensajes.length - 1].role !== 'user') return NextResponse.json({ error: 'Escribe tu pregunta.' }, { status: 400 })
    registrarFallo(clave)

    // Contexto: la evaluación que eligió (solo lo que el estudiante ya puede ver)
    let contexto = ''
    if (body.evaluacionId) {
      const ev = await evaluacionDelEstudiante(est, String(body.evaluacionId))
      if (ev) {
        const d = await prisma.evaluacion.findUnique({ where: { id: ev.id }, select: { nombre: true, tipoActividad: true, fecha: true, estado: true, abiertaManual: true, descripcion: true, recursos: true, rubrica: true } })
        if (d) {
          const { abierta } = estaAbierta({ fecha: d.fecha, estado: d.estado, abiertaManual: d.abiertaManual })
          const rub = abierta ? normalizarRubrica(d.rubrica) : null
          const rec = abierta ? normalizarRecursos(d.recursos) ?? [] : []
          contexto = `\n\nEVALUACIÓN QUE ESTÁ PREPARANDO (${ev.planificacion.materia.nombre}): «${d.nombre.replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '')}»${d.tipoActividad ? `, ${d.tipoActividad}` : ''}${d.fecha ? `, el ${d.fecha.toLocaleDateString('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.`
            + (abierta && d.descripcion ? `\nDescripción: ${d.descripcion.slice(0, 2500)}` : '\n(La descripción aún no está publicada: ayúdalo con el tema general.)')
            + (rub?.criterios?.length ? `\nRúbrica: ${rub.criterios.map((c: any) => `${c.nombre} (${c.puntos} pts)`).join(', ')}` : '')
            + (rec.length ? `\nRecursos de estudio: ${rec.map(r => r.titulo || r.url).join('; ').slice(0, 600)}` : '')
        }
      }
    }
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
      body: JSON.stringify({ model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(), temperature: 0.5, max_tokens: 700, messages: [{ role: 'system', content: SISTEMA + contexto }, ...mensajes] }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => null)
    const d: any = r ? await r.json().catch(() => ({})) : {}
    const texto = String(d?.choices?.[0]?.message?.content || '').trim()
    if (!r?.ok || !texto) return NextResponse.json({ error: r?.status === 402 ? 'El asistente no está disponible (sin saldo). Avísale a tu profesor.' : 'El asistente no pudo responder. Intenta de nuevo.' }, { status: 502 })
    return NextResponse.json({ texto })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'El asistente no pudo responder.' }, { status: 500 })
  }
}
