import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { materiaDelProfesor, unidadesDeMateria } from '@/lib/materiales'
import { borrarArchivo } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'

const fechaONull = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d }

// GET /api/unidades?materiaId=…  — unidades de la materia con sus materiales
export async function GET(request: Request) {
  try {
    const r = await materiaDelProfesor(request, new URL(request.url).searchParams.get('materiaId'), 'leer')
    if (r.error) return r.error
    return NextResponse.json(await unidadesDeMateria(r.materia.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los materiales.' }, { status: 500 })
  }
}

// POST /api/unidades  { materiaId, nombre, descripcion?, visibleDesde? }  — crea una unidad al final
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await materiaDelProfesor(request, body.materiaId, 'escribir')
    if (r.error) return r.error
    const nombre = String(body.nombre || '').trim().slice(0, 120)
    if (nombre.length < 2) return NextResponse.json({ error: 'Escribe el nombre de la unidad.' }, { status: 400 })
    const total = await prisma.unidad.count({ where: { materiaId: r.materia.id } })
    if (total >= 60) return NextResponse.json({ error: 'Llegaste al máximo de 60 unidades.' }, { status: 400 })
    const ultima = await prisma.unidad.findFirst({ where: { materiaId: r.materia.id }, orderBy: { orden: 'desc' }, select: { orden: true } })
    const u = await prisma.unidad.create({
      data: { materiaId: r.materia.id, nombre, descripcion: String(body.descripcion || '').trim().slice(0, 500) || null, visibleDesde: fechaONull(body.visibleDesde), orden: (ultima?.orden ?? -1) + 1 },
      select: { id: true },
    })
    return NextResponse.json({ id: u.id }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo crear la unidad.' }, { status: 500 })
  }
}

// PATCH /api/unidades  { id, nombre?, descripcion?, visibleDesde?, mover?: 'arriba' | 'abajo' }
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const unidad = await prisma.unidad.findUnique({ where: { id: String(body.id || '') }, select: { id: true, materiaId: true, orden: true } })
    if (!unidad) return NextResponse.json({ error: 'Unidad no encontrada.' }, { status: 404 })
    const r = await materiaDelProfesor(request, unidad.materiaId, 'escribir')
    if (r.error) return r.error
    if (body.mover === 'arriba' || body.mover === 'abajo') {
      const todas = await prisma.unidad.findMany({ where: { materiaId: unidad.materiaId }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }], select: { id: true } })
      const i = todas.findIndex(u => u.id === unidad.id)
      const j = body.mover === 'arriba' ? i - 1 : i + 1
      if (i >= 0 && j >= 0 && j < todas.length) {
        ;[todas[i], todas[j]] = [todas[j], todas[i]]
        await prisma.$transaction(todas.map((u, k) => prisma.unidad.update({ where: { id: u.id }, data: { orden: k } })))
      }
      return NextResponse.json({ ok: true })
    }
    const datos: { nombre?: string; descripcion?: string | null; visibleDesde?: Date | null } = {}
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre || '').trim().slice(0, 120)
      if (nombre.length < 2) return NextResponse.json({ error: 'Escribe el nombre de la unidad.' }, { status: 400 })
      datos.nombre = nombre
    }
    if (body.descripcion !== undefined) datos.descripcion = String(body.descripcion || '').trim().slice(0, 500) || null
    if (body.visibleDesde !== undefined) datos.visibleDesde = fechaONull(body.visibleDesde)
    await prisma.unidad.update({ where: { id: unidad.id }, data: datos })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar la unidad.' }, { status: 500 })
  }
}

// DELETE /api/unidades?id=…  — borra la unidad con sus materiales (y sus archivos)
export async function DELETE(request: Request) {
  try {
    const unidad = await prisma.unidad.findUnique({ where: { id: new URL(request.url).searchParams.get('id') || '' }, select: { id: true, materiaId: true, materiales: { select: { ruta: true } } } })
    if (!unidad) return NextResponse.json({ error: 'Unidad no encontrada.' }, { status: 404 })
    const r = await materiaDelProfesor(request, unidad.materiaId, 'eliminar')
    if (r.error) return r.error
    await prisma.unidad.delete({ where: { id: unidad.id } })
    await Promise.all(unidad.materiales.filter(m => m.ruta).map(m => borrarArchivo(m.ruta!).catch(() => {})))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo borrar la unidad.' }, { status: 500 })
  }
}
