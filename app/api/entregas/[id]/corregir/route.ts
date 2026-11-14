import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { archivosDeEntrega } from '@/lib/entregas'
import { leerArchivo } from '@/lib/almacenamiento'
import { extraerContenido, type Contenido } from '@/lib/extraerTexto'
import { normalizarRubrica, NIVELES_RUBRICA } from '@/lib/rubrica'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '')

const SISTEMA = `Eres un profesor universitario venezolano experto que ayuda a otro profesor a corregir el trabajo de un estudiante.
Evalúa con criterio justo y exigente, sobre 20 puntos (se aprueba con 10). Basa todo en lo que realmente contiene la entrega; si algo no se puede leer, dilo.
Escribe en español, claro y profesional, dirigido al profesor. Sé concreto: señala dónde está cada problema (sección, diapositiva, línea, hoja) cuando puedas.`

const FORMATO = `Responde SOLO con un objeto JSON con esta forma exacta:
{
  "nota": número de 0 a 20 con hasta un decimal,
  "criterios": [ { "nombre": "…", "nivel": 0, "comentario": "…" } ],
  "resumen": "2 o 3 frases con la valoración general",
  "fortalezas": ["…"],
  "correcciones": ["errores o faltas concretas que encontraste"],
  "mejoras": ["cómo mejorar el trabajo, en pasos accionables"],
  "confianza": "alta" | "media" | "baja",
  "limitaciones": "qué no pudiste revisar, o null"
}
"criterios": uno por cada criterio de la rúbrica, en el mismo orden; "nivel" es 0=${NIVELES_RUBRICA[0]}, 1=${NIVELES_RUBRICA[1]}, 2=${NIVELES_RUBRICA[2]}, 3=${NIVELES_RUBRICA[3]}. Si no hay rúbrica, deja "criterios" vacío.
Entre 2 y 6 elementos en fortalezas, correcciones y mejoras.`

// POST /api/entregas/:id/corregir  { pregunta?, historial?, analisis? }
// Sin pregunta: la IA corrige la entrega y propone la nota. Con pregunta: responde sobre la entrega (seguimiento).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const e = await prisma.entrega.findUnique({
      where: { id },
      include: {
        archivos: { orderBy: { createdAt: 'asc' } },
        estudiante: { select: { nombre: true } },
        evaluacion: { select: { nombre: true, tipoActividad: true, enfoque: true, descripcion: true, rubrica: true, peso: true, planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } } } },
      },
    })
    if (!e) return NextResponse.json({ error: 'Entrega no encontrada.' }, { status: 404 })
    const denegado = verificarAcceso(actor, e.evaluacion.planificacion.materia.usuarioId, 'leer')
    if (denegado) return denegado
    const clave = `corregir:${actor.id}`
    if (bloqueado(clave, 40)) return NextResponse.json({ error: `Hiciste muchas correcciones seguidas. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'La IA no está disponible en este momento.' }, { status: 503 })
    registrarFallo(clave)

    const body = await request.json().catch(() => ({}))
    const pregunta = String(body.pregunta || '').trim().slice(0, 1500)

    // Contenido de los archivos (hasta 5)
    const contenidos: Contenido[] = []
    for (const a of archivosDeEntrega(e).slice(0, 5)) {
      try { contenidos.push(await extraerContenido(a.nombre, await leerArchivo(a.ruta))) }
      catch { contenidos.push({ tipo: 'ninguno', nombre: a.nombre, motivo: 'no se pudo descargar' }) }
    }
    const rubrica = normalizarRubrica(e.evaluacion.rubrica)
    const ev = e.evaluacion
    const contexto = [
      `MATERIA: ${ev.planificacion.materia.nombre}`,
      `EVALUACIÓN: «${limpiar(ev.nombre)}»${ev.tipoActividad ? ` · ${ev.tipoActividad}` : ''}${ev.enfoque ? ` · ${ev.enfoque}` : ''}${ev.peso ? ` · ${ev.peso}% de la nota` : ''}`,
      ev.descripcion ? `CONSIGNA / DESCRIPCIÓN:\n${ev.descripcion.slice(0, 6000)}` : 'CONSIGNA: (no hay descripción; evalúa según el nombre y tipo de la evaluación)',
      rubrica?.criterios?.length ? `RÚBRICA (puntos de cada criterio):\n${rubrica.criterios.map((c, i) => `${i + 1}. ${c.nombre} (${c.puntos} pts)${(c as any).descripcion ? `: ${(c as any).descripcion}` : ''}`).join('\n')}` : 'RÚBRICA: no tiene.',
      `ESTUDIANTE: ${e.estudiante.nombre}`,
      e.comentario ? `COMENTARIO DEL ESTUDIANTE AL ENTREGAR: ${e.comentario}` : '',
      e.url ? `ENLACE ENTREGADO (no puedes abrirlo; menciónalo si es importante): ${e.url}` : '',
      `ARCHIVOS: ${contenidos.length ? contenidos.map(c => `${c.nombre}${c.tipo === 'ninguno' ? ` (NO SE PUDO LEER: ${c.motivo})` : ''}`).join(', ') : 'ninguno'}`,
    ].filter(Boolean).join('\n\n')

    // Partes del mensaje: texto + archivos (PDF e imágenes tal cual)
    const partes: any[] = [{ type: 'text', text: contexto }]
    for (const c of contenidos) {
      if (c.tipo === 'texto') partes.push({ type: 'text', text: `=== CONTENIDO DE «${c.nombre}» ===\n${c.texto}` })
      else if (c.tipo === 'pdf') partes.push({ type: 'file', file: { filename: c.nombre, file_data: `data:application/pdf;base64,${c.base64}` } })
      else if (c.tipo === 'imagen') partes.push({ type: 'image_url', image_url: { url: c.dataUrl } })
    }
    if (!contenidos.some(c => c.tipo !== 'ninguno') && !e.url) return NextResponse.json({ error: 'La IA no puede leer los archivos de esta entrega. Pídele al estudiante el trabajo en PDF o Word.' }, { status: 400 })

    const mensajes: any[] = [{ role: 'system', content: SISTEMA }]
    if (!pregunta) {
      partes.push({ type: 'text', text: FORMATO })
      mensajes.push({ role: 'user', content: partes })
    } else {
      // Seguimiento: la entrega, el análisis anterior y la conversación
      mensajes.push({ role: 'user', content: partes })
      if (body.analisis) mensajes.push({ role: 'assistant', content: `Mi corrección anterior: ${JSON.stringify(body.analisis).slice(0, 6000)}` })
      for (const m of (Array.isArray(body.historial) ? body.historial : []).slice(-8)) mensajes.push({ role: m.rol === 'assistant' ? 'assistant' : 'user', content: String(m.texto || '').slice(0, 2000) })
      mensajes.push({ role: 'user', content: `${pregunta}\n\n(Responde en máximo 180 palabras, con viñetas si ayudan.)` })
    }

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
      body: JSON.stringify({
        model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(),
        temperature: pregunta ? 0.4 : 0.2, max_tokens: pregunta ? 700 : 2200,
        ...(pregunta ? {} : { response_format: { type: 'json_object' } }),
        messages: mensajes,
      }),
      signal: AbortSignal.timeout(55000),
    }).catch(() => null)
    const d: any = r ? await r.json().catch(() => ({})) : {}
    const salida = String(d?.choices?.[0]?.message?.content || '').trim()
    if (!r?.ok || !salida) return NextResponse.json({ error: r?.status === 402 ? 'La IA no tiene saldo disponible.' : r?.status === 413 ? 'Los archivos son demasiado grandes para la IA.' : 'La IA no pudo revisar la entrega. Intenta de nuevo.' }, { status: 502 })
    if (pregunta) return NextResponse.json({ respuesta: salida })

    // El JSON de la corrección (tolerante a texto alrededor)
    let a: any
    try { a = JSON.parse(salida) } catch { const m = salida.match(/\{[\s\S]*\}/); try { a = m ? JSON.parse(m[0]) : null } catch { a = null } }
    if (!a) return NextResponse.json({ error: 'La IA respondió en un formato inesperado. Intenta de nuevo.' }, { status: 502 })
    const lista = (x: any) => (Array.isArray(x) ? x.map((t: any) => String(t)).filter(Boolean).slice(0, 8) : [])
    const nota = Math.max(0, Math.min(20, Math.round(Number(a.nota) * 10) / 10))
    const analisis = {
      nota: Number.isFinite(nota) ? nota : null,
      criterios: rubrica?.criterios?.length ? rubrica.criterios.map((c, i) => {
        const x = Array.isArray(a.criterios) ? a.criterios[i] : null
        const nivel = Number.isInteger(x?.nivel) && x.nivel >= 0 && x.nivel <= 3 ? x.nivel : null
        return { nombre: c.nombre, nivel, comentario: x?.comentario ? String(x.comentario) : '' }
      }) : [],
      resumen: String(a.resumen || ''),
      fortalezas: lista(a.fortalezas), correcciones: lista(a.correcciones), mejoras: lista(a.mejoras),
      confianza: ['alta', 'media', 'baja'].includes(a.confianza) ? a.confianza : 'media',
      limitaciones: a.limitaciones ? String(a.limitaciones) : (contenidos.some(c => c.tipo === 'ninguno') ? `No pude leer: ${contenidos.filter(c => c.tipo === 'ninguno').map(c => c.nombre).join(', ')}.` : null),
      archivosLeidos: contenidos.filter(c => c.tipo !== 'ninguno').map(c => c.nombre),
    }
    return NextResponse.json({ analisis })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo revisar la entrega.' }, { status: 500 })
  }
}
