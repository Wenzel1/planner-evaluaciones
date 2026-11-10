import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { seccionConCodigo, nuevoCodigo } from '@/lib/clases'

async function materiaPropia(actor: any, materiaId: string, modo: 'leer' | 'escribir') {
  const m = await prisma.materia.findUnique({ where: { id: materiaId }, select: { id: true, nombre: true, usuarioId: true } })
  if (!m) return { error: NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor, m.usuarioId, modo)
  return denegado ? { error: denegado } : { materia: m }
}

// GET /api/materias/secciones?materiaId=…  — secciones de la materia con su código de clase y solicitudes pendientes
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const materiaId = new URL(request.url).searchParams.get('materiaId') || ''
    const r = await materiaPropia(actor, materiaId, 'leer')
    if (r.error) return r.error
    const secciones = await prisma.seccionMateria.findMany({ where: { materiaId }, orderBy: { letra: 'asc' } })
    const pendientes = await prisma.estudiante.groupBy({ by: ['grupo'], where: { usuarioId: r.materia.usuarioId, estado: 'PENDIENTE', materiaId }, _count: true })
    return NextResponse.json(secciones.map(s => ({ letra: s.letra, codigo: s.codigo, requiereAprobacion: s.requiereAprobacion, activo: s.activo, pendientes: pendientes.find(p => p.grupo === s.letra)?._count || 0 })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las secciones.' }, { status: 500 })
  }
}

// POST /api/materias/secciones  { materiaId, letra } — crea la sección (o devuelve la que hay) con su código
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const r = await materiaPropia(actor, String(body.materiaId || ''), 'escribir')
    if (r.error) return r.error
    const letra = String(body.letra || 'A').toUpperCase()
    if (!/^[A-Z]$/.test(letra)) return NextResponse.json({ error: 'La sección debe ser una letra.' }, { status: 400 })
    const s = await seccionConCodigo(r.materia.id, letra)
    return NextResponse.json({ letra: s!.letra, codigo: s!.codigo, requiereAprobacion: s!.requiereAprobacion, activo: s!.activo, pendientes: 0 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo crear la sección.' }, { status: 500 })
  }
}

// PATCH /api/materias/secciones  { materiaId, letra, requiereAprobacion?, activo?, nuevoCodigo? }
export async function PATCH(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const r = await materiaPropia(actor, String(body.materiaId || ''), 'escribir')
    if (r.error) return r.error
    const s = await seccionConCodigo(r.materia.id, String(body.letra || 'A'))
    const data: any = {}
    if (typeof body.requiereAprobacion === 'boolean') data.requiereAprobacion = body.requiereAprobacion
    if (typeof body.activo === 'boolean') data.activo = body.activo
    if (body.nuevoCodigo === true) data.codigo = await nuevoCodigo(r.materia.nombre)
    const n = await prisma.seccionMateria.update({ where: { id: s!.id }, data })
    return NextResponse.json({ letra: n.letra, codigo: n.codigo, requiereAprobacion: n.requiereAprobacion, activo: n.activo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo actualizar la sección.' }, { status: 500 })
  }
}
