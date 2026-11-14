import { NextResponse } from 'next/server'
import { prepararAdjuntoEn } from '@/lib/adjuntos'
import { materiaDelProfesor, carpetaMateriales } from '@/lib/materiales'

export const dynamic = 'force-dynamic'

// POST /api/unidades/subida  { materiaId, nombre, tamano, tipo } — prepara la subida directa de un material al almacenamiento
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await materiaDelProfesor(request, body.materiaId, 'escribir')
    if (r.error) return r.error
    return await prepararAdjuntoEn(carpetaMateriales(r.materia.id), body)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo preparar el archivo.' }, { status: 500 })
  }
}
