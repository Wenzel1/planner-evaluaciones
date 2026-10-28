import { NextResponse } from 'next/server'
import { datosPortal } from '@/lib/portalDatos'
import { generarPdfPlan, nombreArchivoPdf } from '@/lib/pdfPlan'

export const maxDuration = 60

// GET /api/portal/:token/pdf?materia=ID — el plan de evaluación en PDF (lo bloqueado sale sin detalles)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const datos = await datosPortal(token)
    if (!datos) return NextResponse.json({ error: 'Enlace no válido.' }, { status: 404 })
    const id = new URL(request.url).searchParams.get('materia')
    const materia = datos.materias.find(m => m.id === id) || datos.materias[0]
    if (!materia) return NextResponse.json({ error: 'Todavía no hay evaluaciones.' }, { status: 404 })
    const pdf = await generarPdfPlan({
      materia: materia.nombre, profesor: datos.profesor, seccion: datos.estudiante.seccion, fechaExamen: new Date(),
      secciones: materia.evaluaciones.map(e => ({ nombre: e.nombre, tipoActividad: e.tipoActividad, peso: e.peso, fecha: e.fecha, descripcion: e.descripcion, rubrica: e.rubrica })),
    })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivoPdf(materia.nombre, datos.estudiante.seccion)}"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 })
  }
}
