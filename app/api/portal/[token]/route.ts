import { NextResponse } from 'next/server'
import { datosPortal } from '@/lib/portalDatos'

export const dynamic = 'force-dynamic'

// GET /api/portal/:token — datos de la página personal del estudiante (pública, protegida por el token secreto)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const datos = await datosPortal(token)
    if (!datos) return NextResponse.json({ error: 'Este enlace no existe o ya no está activo. Pídele a tu profesor uno nuevo.' }, { status: 404 })
    return NextResponse.json(datos, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar tu plan. Intenta de nuevo en un momento.' }, { status: 500 })
  }
}
