import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { entregaDelProfesor, vistaCorreccion, carpetaCorrecciones, TIPOS_CORRECCION } from '@/lib/correcciones'
import { datosAdjuntoEn } from '@/lib/adjuntos'
import { borrarArchivo, enlaceArchivo } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'

// GET /api/entregas/:id/correcciones                 — las correcciones de la entrega
// GET /api/entregas/:id/correcciones?abrir=<id>      — abre la copia corregida (enlace temporal)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'leer')
    if (r.error) return r.error
    const q = new URL(request.url).searchParams
    const abrir = q.get('abrir')
    if (abrir) {
      const c = await prisma.correccionArchivo.findFirst({ where: { id: abrir, entregaId: id } })
      if (!c?.rutaCorregida) return NextResponse.json({ error: 'No hay copia corregida.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(c.rutaCorregida, q.get('descargar') ? c.nombreCorregido || undefined : undefined))
    }
    const lista = await prisma.correccionArchivo.findMany({ where: { entregaId: id }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json(lista.map(vistaCorreccion), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las correcciones.' }, { status: 500 })
  }
}

// PUT /api/entregas/:id/correcciones  { archivoId, tipo, datos?, archivo?: { ruta, nombre, tamano, tipo } | null }
// Guarda (o actualiza) la corrección de un archivo. archivo = copia corregida ya subida con /subida; null la quita.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'escribir')
    if (r.error) return r.error
    const body = await request.json().catch(() => ({}))
    const original = r.archivos.find(a => a.id === String(body.archivoId || ''))
    if (!original) return NextResponse.json({ error: 'Archivo no encontrado en la entrega.' }, { status: 404 })
    const tipo = String(body.tipo || '')
    if (!(TIPOS_CORRECCION as readonly string[]).includes(tipo)) return NextResponse.json({ error: 'Tipo de corrección no válido.' }, { status: 400 })
    if (JSON.stringify(body.datos ?? null).length > 900_000) return NextResponse.json({ error: 'La corrección es demasiado grande.' }, { status: 400 })

    const previa = await prisma.correccionArchivo.findUnique({ where: { entregaId_archivoId: { entregaId: id, archivoId: original.id } } })
    let archivo: { rutaCorregida: string | null; nombreCorregido: string | null; tipoCorregido: string | null } | undefined
    if (body.archivo === null) archivo = { rutaCorregida: null, nombreCorregido: null, tipoCorregido: null }
    else if (body.archivo) {
      const adj = datosAdjuntoEn(carpetaCorrecciones(id), body.archivo)
      if (!adj || adj === 'invalido') return NextResponse.json({ error: 'Archivo corregido no válido.' }, { status: 400 })
      archivo = { rutaCorregida: adj.adjuntoRuta, nombreCorregido: adj.adjuntoNombre, tipoCorregido: adj.adjuntoTipo }
    }
    const datos = body.datos == null ? Prisma.DbNull : (body.datos as Prisma.InputJsonValue)
    const c = await prisma.correccionArchivo.upsert({
      where: { entregaId_archivoId: { entregaId: id, archivoId: original.id } },
      create: { entregaId: id, archivoId: original.id, archivoNombre: original.nombre, tipo, datos, autorId: r.actor.id, autorNombre: r.actor.nombre, ...(archivo || {}) },
      update: { tipo, datos, autorId: r.actor.id, autorNombre: r.actor.nombre, ...(archivo || {}) },
    })
    // La copia corregida anterior ya no sirve
    if (archivo && previa?.rutaCorregida && previa.rutaCorregida !== archivo.rutaCorregida) await borrarArchivo(previa.rutaCorregida).catch(() => {})
    return NextResponse.json(vistaCorreccion(c))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar la corrección.' }, { status: 500 })
  }
}

// DELETE /api/entregas/:id/correcciones?archivoId=…  — quita la corrección (y su copia)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await entregaDelProfesor(request, id, 'escribir')
    if (r.error) return r.error
    const archivoId = new URL(request.url).searchParams.get('archivoId') || ''
    const c = await prisma.correccionArchivo.findUnique({ where: { entregaId_archivoId: { entregaId: id, archivoId } } })
    if (!c) return NextResponse.json({ ok: true })
    await prisma.correccionArchivo.delete({ where: { id: c.id } })
    if (c.rutaCorregida) await borrarArchivo(c.rutaCorregida).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo quitar la corrección.' }, { status: 500 })
  }
}
