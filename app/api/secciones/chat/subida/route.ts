import { NextResponse } from 'next/server'
import { prepararAdjuntoEn, carpetaChat } from '@/lib/adjuntos'
import { accesoChat } from '../acceso'

export const dynamic = 'force-dynamic'

// POST /api/secciones/chat/subida  { materiaId, seccion, nombre, tamano, tipo } — el profesor adjunta un archivo o una nota de voz al chat
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await accesoChat(request, body.materiaId, body.seccion, 'escribir')
    if (r.error) return r.error
    return await prepararAdjuntoEn(carpetaChat(r.materia.id, r.seccion), body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
