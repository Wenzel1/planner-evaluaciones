import { NextResponse } from 'next/server'
import { obtenerPdfPlan, nombreArchivoPlan } from '@/lib/planCompartido'

export const maxDuration = 60

// GET /api/plan-publico/:token — PDF del Plan de Acción compartido por WhatsApp (público, con token secreto de 48 caracteres)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!/^[a-f0-9]{48}$/.test(token)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const r = await obtenerPdfPlan(token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    return new NextResponse(new Uint8Array(r.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivoPlan(r.materia, r.seccion)}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener el plan.' }, { status: 500 })
  }
}
