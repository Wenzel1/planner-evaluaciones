import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { materiaDelProfesor, carpetaMateriales } from '@/lib/materiales'
import { datosAdjuntoEn } from '@/lib/adjuntos'
import { borrarArchivo, enlaceArchivo } from '@/lib/almacenamiento'
import { enlaceValido } from '@/lib/entregas'

export const dynamic = 'force-dynamic'

async function materialConAcceso(request: Request, id: string, modo: 'leer' | 'eliminar') {
  const m = await prisma.material.findUnique({ where: { id }, select: { id: true, ruta: true, titulo: true, tipo: true, unidad: { select: { materiaId: true } } } })
  if (!m) return { error: NextResponse.json({ error: 'Material no encontrado.' }, { status: 404 }) }
  const r = await materiaDelProfesor(request, m.unidad.materiaId, modo)
  if (r.error) return { error: r.error }
  return { m }
}

// GET /api/unidades/materiales?abrir=<id>[&descargar=1]  — abre el archivo (enlace temporal)
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const r = await materialConAcceso(request, q.get('abrir') || '', 'leer')
    if (r.error) return r.error
    if (!r.m.ruta) return NextResponse.json({ error: 'Este material no es un archivo.' }, { status: 400 })
    return NextResponse.redirect(await enlaceArchivo(r.m.ruta, q.get('descargar') ? r.m.titulo : undefined))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo abrir el archivo.' }, { status: 500 })
  }
}

// POST /api/unidades/materiales
//   { unidadId, tipo: 'ENLACE', titulo?, url }  |  { unidadId, tipo: 'ARCHIVO', adjunto: { ruta, nombre, tamano, tipo } }  |  { unidadId, tipo: 'EVALUACION', evaluacionId }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const unidad = await prisma.unidad.findUnique({ where: { id: String(body.unidadId || '') }, select: { id: true, materiaId: true, _count: { select: { materiales: true } } } })
    if (!unidad) return NextResponse.json({ error: 'Unidad no encontrada.' }, { status: 404 })
    const r = await materiaDelProfesor(request, unidad.materiaId, 'escribir')
    if (r.error) return r.error
    if (unidad._count.materiales >= 80) return NextResponse.json({ error: 'Esta unidad ya tiene 80 materiales.' }, { status: 400 })
    const orden = unidad._count.materiales
    const tipo = String(body.tipo || '')
    if (tipo === 'ENLACE') {
      const url = enlaceValido(body.url)
      if (!url) return NextResponse.json({ error: 'El enlace no es válido. Debe empezar con http:// o https://' }, { status: 400 })
      const titulo = String(body.titulo || '').trim().slice(0, 150) || new URL(url).hostname.replace(/^www\./, '')
      await prisma.material.create({ data: { unidadId: unidad.id, tipo, titulo, url, orden } })
    } else if (tipo === 'ARCHIVO') {
      const adj = datosAdjuntoEn(carpetaMateriales(unidad.materiaId), body.adjunto)
      if (!adj || adj === 'invalido') return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 })
      await prisma.material.create({ data: { unidadId: unidad.id, tipo, titulo: String(body.titulo || '').trim().slice(0, 150) || adj.adjuntoNombre, ruta: adj.adjuntoRuta, archivoTipo: adj.adjuntoTipo, archivoTamano: adj.adjuntoTamano, orden } })
    } else if (tipo === 'EVALUACION') {
      const ev = await prisma.evaluacion.findFirst({ where: { id: String(body.evaluacionId || ''), planificacion: { materiaId: unidad.materiaId } }, select: { id: true, nombre: true } })
      if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada. Guárdala primero en el planificador.' }, { status: 404 })
      // Una evaluación pertenece a una sola unidad: si estaba en otra, se mueve
      await prisma.material.deleteMany({ where: { tipo: 'EVALUACION', evaluacionId: ev.id, unidad: { materiaId: unidad.materiaId } } })
      await prisma.material.create({ data: { unidadId: unidad.id, tipo, titulo: ev.nombre.slice(0, 150), evaluacionId: ev.id, orden } })
    } else {
      return NextResponse.json({ error: 'Tipo de material no válido.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo agregar el material.' }, { status: 500 })
  }
}

// DELETE /api/unidades/materiales?id=…
export async function DELETE(request: Request) {
  try {
    const r = await materialConAcceso(request, new URL(request.url).searchParams.get('id') || '', 'eliminar')
    if (r.error) return r.error
    await prisma.material.delete({ where: { id: r.m.id } })
    if (r.m.ruta) await borrarArchivo(r.m.ruta).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo quitar el material.' }, { status: 500 })
  }
}
