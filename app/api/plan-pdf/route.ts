import { NextResponse } from 'next/server'
import { requerirActor } from '@/lib/permisos'
import { generarPdfPlan, nombreArchivoPdf } from '@/lib/pdfPlan'

// POST /api/plan-pdf  { examenData: { materia, profesor, fechaExamen, seccion, secciones: [...] } }
// Genera el PDF del Plan de Acción en el propio servidor (ya no depende de html2pdf ni de n8n).
export async function POST(request: Request) {
  try {
    const { error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const datos = body.examenData || body
    if (!Array.isArray(datos?.secciones) || datos.secciones.length === 0) {
      return NextResponse.json({ error: 'El plan no tiene evaluaciones.' }, { status: 400 })
    }
    const pdf = await generarPdfPlan({ ...datos, secciones: datos.secciones.slice(0, 30) })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivoPdf(datos.materia, datos.seccion)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 })
  }
}
