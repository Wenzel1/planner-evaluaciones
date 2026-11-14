import { NextResponse } from 'next/server'
import { prepararAdjuntoEn, carpetaChat } from '@/lib/adjuntos'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'
import { accesoChatEstudiante } from '../acceso'

export const dynamic = 'force-dynamic'

// POST /api/portal/:token/chat/subida  { materiaId, nombre, tamano, tipo } — el estudiante adjunta un archivo o una nota de voz al chat
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const r = await accesoChatEstudiante(request, token, body.materiaId)
    if (r.error) return r.error
    const clave = `chat-adjunto:${r.est.id}`
    if (bloqueado(clave, 30)) return NextResponse.json({ error: `Enviaste muchos archivos seguidos. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    registrarFallo(clave)
    return await prepararAdjuntoEn(carpetaChat(r.materia.id, r.seccion), body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
