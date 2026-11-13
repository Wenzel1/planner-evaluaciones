import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { archivosDeEntrega } from '@/lib/entregas'
import { responderArchivo } from '@/lib/visorArchivos'

export const dynamic = 'force-dynamic'

async function entregaDelProfesor(request: Request, id: string, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const e = await prisma.entrega.findUnique({
    where: { id },
    include: { archivos: { orderBy: { createdAt: 'asc' } }, evaluacion: { select: { planificacion: { select: { materia: { select: { usuarioId: true } } } } } } },
  })
  if (!e) return { error: NextResponse.json({ error: 'Entrega no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, e.evaluacion.planificacion.materia.usuarioId, modo)
  return denegado ? { error: denegado } : { e, actor: actor! }
}

// GET /api/entregas/:id?archivoId=…&modo=url|texto|zip|zipentrada  — el visor del profesor abre un archivo de la entrega
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'leer')
    if (r.error) return r.error
    const lista = archivosDeEntrega(r.e)
    const archivoId = new URL(request.url).searchParams.get('archivoId')
    const archivo = archivoId ? lista.find(a => a.id === archivoId) : lista[0]
    if (!archivo) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
    return await responderArchivo(request, archivo)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message === 'El archivo es demasiado grande para la vista previa.' ? e.message : 'No se pudo abrir el archivo.' }, { status: 500 })
  }
}

// PATCH /api/entregas/:id  { revisada: boolean } — marcarla como revisada (o volver a "sin revisar")
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'escribir')
    if (r.error) return r.error
    const body = await request.json().catch(() => ({}))
    if (typeof body.revisada !== 'boolean') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await prisma.entrega.update({ where: { id }, data: { revisada: body.revisada, revisadaEn: body.revisada ? new Date() : null, ...(body.revisada ? { devuelta: false } : {}) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
