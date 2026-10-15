import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, esAdminOSuper } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

// GET /api/observaciones — las observaciones que recibió el usuario sobre SUS materias (las más recientes primero)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const items = await prisma.observacion.findMany({
      where: { materia: { usuarioId: actor.id } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, evaluacionNombre: true, autorNombre: true, autorRol: true, mensaje: true, leida: true, createdAt: true, materia: { select: { nombre: true } } },
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al obtener las observaciones' }, { status: 500 })
  }
}

// POST /api/observaciones { materiaId, evaluacionNombre?, mensaje } — solo ADMIN y SUPERADMIN
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    if (!esAdminOSuper(actor)) return NextResponse.json({ error: 'No tienes permisos para esta acción' }, { status: 403 })

    const body = await request.json()
    const mensaje = String(body.mensaje ?? '').trim()
    const evaluacionNombre = body.evaluacionNombre ? String(body.evaluacionNombre).trim().slice(0, 200) : null
    if (mensaje.length < 3) return NextResponse.json({ error: 'La observación debe tener al menos 3 caracteres.' }, { status: 400 })
    if (mensaje.length > 500) return NextResponse.json({ error: 'La observación no puede superar 500 caracteres.' }, { status: 400 })
    if (!body.materiaId) return NextResponse.json({ error: 'materiaId es obligatorio' }, { status: 400 })

    const materia = await prisma.materia.findUnique({
      where: { id: String(body.materiaId) },
      select: { id: true, nombre: true, usuarioId: true, usuario: { select: { nombre: true } } },
    })
    if (!materia) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    if (!materia.usuarioId) return NextResponse.json({ error: 'Esta materia no tiene un dueño que pueda recibir la observación.' }, { status: 400 })
    if (materia.usuarioId === actor.id) return NextResponse.json({ error: 'No puedes dejarte observaciones a ti mismo.' }, { status: 400 })

    const creada = await prisma.observacion.create({
      data: { materiaId: materia.id, evaluacionNombre, autorId: actor.id, autorNombre: actor.nombre, autorRol: actor.rol, mensaje },
      select: { id: true },
    })
    await registrarActividad({
      actor,
      accion: 'OBSERVAR',
      entidad: 'Observación',
      detalle: `Observó a ${materia.usuario?.nombre ?? 'un profesor'} (${materia.nombre}${evaluacionNombre ? ` / ${evaluacionNombre}` : ''}): "${mensaje.slice(0, 120)}"`,
    })
    return NextResponse.json(creada, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al crear la observación' }, { status: 500 })
  }
}

// PATCH /api/observaciones { id } | { todas: true } — marca como leídas las observaciones PROPIAS
export async function PATCH(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json()
    if (!body.id && !body.todas) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    const r = await prisma.observacion.updateMany({
      where: { leida: false, materia: { usuarioId: actor.id }, ...(body.id ? { id: String(body.id) } : {}) },
      data: { leida: true },
    })
    return NextResponse.json({ actualizadas: r.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al actualizar las observaciones' }, { status: 500 })
  }
}
