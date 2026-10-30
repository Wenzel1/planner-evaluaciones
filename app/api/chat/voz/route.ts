import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'

export const maxDuration = 60

// POST /api/chat/voz (multipart, campo "file") — transcribe el audio del micrófono del chat.
// Usa Groq Whisper (rápido y gratis) y, si no hay clave de Groq o falla, Gemini.
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const form = await request.formData().catch(() => null)
    const archivo = form?.get('file')
    if (!archivo || typeof archivo === 'string') return NextResponse.json({ error: 'No llegó el audio.' }, { status: 400 })
    if (archivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'El audio es muy largo (máximo ~5 minutos).' }, { status: 400 })

    if (process.env.GROQ_API_KEY) {
      const f = new FormData()
      f.append('file', archivo, 'audio.webm')
      f.append('model', 'whisper-large-v3-turbo')
      f.append('language', 'es')
      f.append('response_format', 'json')
      const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: f })
      const d: any = await r.json().catch(() => ({}))
      if (r.ok && typeof d.text === 'string') return NextResponse.json({ text: d.text.trim() })
      console.error('[Voz] Groq falló:', r.status, d?.error?.message)
    }
    if (process.env.GEMINI_API_KEY) {
      const b64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: archivo.type || 'audio/webm', data: b64 } }, { text: 'Transcribe este audio en español, tal cual, sin comentarios.' }] }], generationConfig: { temperature: 0 } }),
      })
      const d: any = await r.json().catch(() => ({}))
      const texto = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim()
      if (r.ok && texto) return NextResponse.json({ text: texto })
      console.error('[Voz] Gemini falló:', r.status, d?.error?.message)
    }
    return NextResponse.json({ error: 'No se pudo transcribir el audio. Revisa GROQ_API_KEY o GEMINI_API_KEY.' }, { status: 502 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo transcribir.' }, { status: 500 })
  }
}
