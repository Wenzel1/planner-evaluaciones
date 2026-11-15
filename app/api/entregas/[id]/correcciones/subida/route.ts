import { NextResponse } from 'next/server'
import { prepararAdjuntoEn } from '@/lib/adjuntos'
import { entregaDelProfesor, carpetaCorrecciones } from '@/lib/correcciones'

export const dynamic = 'force-dynamic'

// POST /api/entregas/:id/correcciones/subida  { nombre, tamano, tipo } — prepara la subida directa de la copia corregida
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'escribir')
    if (r.error) return r.error
    return await prepararAdjuntoEn(carpetaCorrecciones(id), await request.json().catch(() => ({})))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
