import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'

export const maxDuration = 60

const PEDIDO = 'Transcribe este audio en español, tal cual, sin comentarios. Si no se oye nada, responde vacío.'

// POST /api/chat/voz (multipart, campo "file") — transcribe el audio del micrófono del chat.
// El navegador lo manda en WAV de 16 kHz (o en su formato original si no pudo convertirlo).
// Prueba en orden: Groq Whisper (si hay clave) → Gemini (GEMINI_API_KEY) → OpenRouter (OPENROUTER_API_KEY).
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const form = await request.formData().catch(() => null)
    const archivo = form?.get('file')
    if (!archivo || typeof archivo === 'string') return NextResponse.json({ error: 'No llegó el audio.' }, { status: 400 })
    if (archivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El audio es muy largo (máximo 2 minutos).' }, { status: 400 })
    if (archivo.size < 2000) return NextResponse.json({ error: 'El audio quedó vacío. Mantén el micrófono un poco más.' }, { status: 400 })

    // "audio/webm;codecs=opus" → "audio/webm" (Gemini rechaza el tipo con parámetros)
    const tipo = String(archivo.type || '').split(';')[0].trim() || 'audio/webm'
    const formato = tipo.includes('wav') ? 'wav' : tipo.includes('mp4') || tipo.includes('m4a') ? 'mp4' : tipo.includes('ogg') ? 'ogg' : tipo.includes('mpeg') || tipo.includes('mp3') ? 'mp3' : 'webm'
    const bytes = Buffer.from(await archivo.arrayBuffer())
    const b64 = bytes.toString('base64')
    const fallos: string[] = []

    if (process.env.GROQ_API_KEY) {
      const f = new FormData()
      f.append('file', new Blob([bytes], { type: tipo }), `audio.${formato}`)
      f.append('model', 'whisper-large-v3-turbo')
      f.append('language', 'es')
      f.append('response_format', 'json')
      const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: f }).catch(() => null)
      const d: any = r ? await r.json().catch(() => ({})) : {}
      if (r?.ok && typeof d.text === 'string' && d.text.trim()) return NextResponse.json({ text: d.text.trim() })
      fallos.push(`Groq ${r?.status ?? 'sin conexión'} ${d?.error?.message || ''}`.trim())
    }

    if (process.env.GEMINI_API_KEY) {
      for (const modelo of ['gemini-2.5-flash-lite', 'gemini-2.5-flash']) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: tipo, data: b64 } }, { text: PEDIDO }] }], generationConfig: { temperature: 0, ...(modelo.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }),
        }).catch(() => null)
        const d: any = r ? await r.json().catch(() => ({})) : {}
        const texto = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim()
        if (r?.ok && texto) return NextResponse.json({ text: texto })
        fallos.push(`Gemini ${modelo} ${r?.status ?? 'sin conexión'} ${String(d?.error?.message || (r?.ok ? 'sin texto' : '')).slice(0, 120)}`.trim())
        if (r?.status === 400) break // el formato no le sirve: el otro modelo tampoco
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'https://planner-evaluaciones.vercel.app', 'X-Title': 'Planificador de Evaluaciones' },
        body: JSON.stringify({
          model: (process.env.OPENROUTER_MODELO || 'google/gemini-2.5-flash').trim(),
          temperature: 0, max_tokens: 1500,
          messages: [{ role: 'user', content: [{ type: 'text', text: PEDIDO }, { type: 'input_audio', input_audio: { data: b64, format: formato } }] }],
        }),
      }).catch(() => null)
      const d: any = r ? await r.json().catch(() => ({})) : {}
      const texto = String(d?.choices?.[0]?.message?.content || '').trim()
      if (r?.ok && texto) return NextResponse.json({ text: texto })
      fallos.push(`OpenRouter ${r?.status ?? 'sin conexión'} ${String(d?.error?.message || (r?.ok ? 'sin texto' : '')).slice(0, 120)}`.trim())
    }

    console.error('[Voz] no se pudo transcribir:', fallos.join(' | '))
    if (!fallos.length) return NextResponse.json({ error: 'No hay servicio de transcripción: agrega GEMINI_API_KEY u OPENROUTER_API_KEY en Vercel.' }, { status: 502 })
    return NextResponse.json({ error: `No se pudo transcribir el audio (${fallos.join(' · ').slice(0, 220)}).` }, { status: 502 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo transcribir.' }, { status: 500 })
  }
}
