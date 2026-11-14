import { NextResponse } from 'next/server'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken, evaluacionDelEstudiante } from '@/lib/entregas'
import { prepararAdjunto } from '@/lib/adjuntos'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// POST /api/portal/:token/comentarios/subida  { evaluacionId, nombre, tamano, tipo } — el estudiante adjunta un archivo o una nota de voz
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const clave = `adjunto:${est.id}`
    if (bloqueado(clave, 40)) return NextResponse.json({ error: `Enviaste muchos archivos seguidos. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    registrarFallo(clave)
    const body = await request.json().catch(() => ({}))
    const ev = await evaluacionDelEstudiante(est, String(body.evaluacionId || ''))
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    return await prepararAdjunto(ev.id, est.id, body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
