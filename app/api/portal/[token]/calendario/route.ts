import { NextResponse } from 'next/server'
import { datosPortal } from '@/lib/portalDatos'
import { generarIcs } from '@/lib/ics'
import { urlPortal } from '@/lib/portal'

// GET /api/portal/:token/calendario?materia=ID — archivo .ics con las evaluaciones del estudiante (avisos 1 día y 2 horas antes)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const datos = await datosPortal(token)
    if (!datos) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })
    const id = new URL(request.url).searchParams.get('materia')
    const materias = id ? datos.materias.filter(m => m.id === id) : datos.materias
    const enlace = urlPortal(request, token)
    const eventos = materias.flatMap(m => m.evaluaciones
      .filter(e => e.fecha && e.estado !== 'REALIZADA' && !e.nota)
      .map(e => ({
        id: `${e.id}-${token.slice(0, 6)}`,
        titulo: `${e.nombre} · ${m.nombre}`,
        inicio: new Date(e.fecha as Date),
        duracionMin: e.duracion,
        descripcion: [e.tipoActividad, e.peso != null ? `Vale ${e.peso}%` : '', `Sección ${datos.estudiante.seccion}`, `Tu plan: ${enlace}`].filter(Boolean).join('\n'),
        url: enlace,
      })))
    const nombre = materias.length === 1 ? `Evaluaciones · ${materias[0].nombre}` : 'Mis evaluaciones'
    return new NextResponse(generarIcs(nombre, eventos), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="mis-evaluaciones.ics"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el calendario.' }, { status: 500 })
  }
}
