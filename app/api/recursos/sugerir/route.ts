import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'
import { buscarVideos, sugerirPaginas, temaLimpio } from '@/lib/recursosAuto'

export const maxDuration = 60

// POST /api/recursos/sugerir  { nombre, tipoActividad?, enfoque?, materia? }
// Devuelve videos de YouTube y páginas verificadas para una evaluación. Si una de las dos fuentes falla, igual devuelve la otra.
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const tema = {
      nombre: String(body.nombre ?? '').slice(0, 300),
      tipoActividad: body.tipoActividad ? String(body.tipoActividad).slice(0, 120) : null,
      enfoque: body.enfoque ? String(body.enfoque).slice(0, 120) : null,
      materia: body.materia ? String(body.materia).slice(0, 120) : null,
      descripcion: body.descripcion ? String(body.descripcion).slice(0, 600) : null,
    }
    if (temaLimpio(tema.nombre).length < 2) return NextResponse.json({ error: 'La evaluación necesita un nombre o tema para buscar recursos.' }, { status: 400 })

    const [v, p] = await Promise.allSettled([buscarVideos(tema), sugerirPaginas(tema)])
    const avisos: string[] = []
    if (v.status === 'rejected') avisos.push(`Videos: ${(v.reason as Error)?.message || 'no se pudieron buscar.'}`)
    if (p.status === 'rejected') avisos.push(`Páginas: ${(p.reason as Error)?.message || 'no se pudieron buscar.'}`)
    const videos = v.status === 'fulfilled' ? v.value : []
    const paginas = p.status === 'fulfilled' ? p.value : []
    if (videos.length === 0 && paginas.length === 0 && avisos.length === 2) return NextResponse.json({ error: avisos.join(' ') }, { status: 502 })
    return NextResponse.json({ videos, paginas, avisos })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron buscar recursos.' }, { status: 500 })
  }
}
