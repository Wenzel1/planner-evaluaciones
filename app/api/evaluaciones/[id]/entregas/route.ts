import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { filtroMateria } from '@/lib/clases'
import { esTarde, archivosDeEntrega, archivosPublicos } from '@/lib/entregas'
import { enlaceArchivo, archivosConfigurados } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'

async function evaluacionDelProfesor(request: Request, id: string, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const ev = await prisma.evaluacion.findUnique({ where: { id }, select: { id: true, nombre: true, fecha: true, grupoSeccion: true, aceptaEntregas: true, planificacion: { select: { materiaId: true, materia: { select: { usuarioId: true } } } } } })
  if (!ev) return { error: NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, ev.planificacion.materia.usuarioId, modo)
  return denegado ? { error: denegado } : { ev, actor: actor! }
}

// GET /api/evaluaciones/:id/entregas — cada estudiante de la sección con su entrega (o pendiente) y sus mensajes sin leer
// ?archivo=<estudianteId> → abre el archivo que entregó ese estudiante
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await evaluacionDelProfesor(request, id, 'leer')
    if (r.error) return r.error
    const { ev } = r
    const archivoDe = new URL(request.url).searchParams.get('archivo')
    if (archivoDe) {
      const e = await prisma.entrega.findUnique({ where: { evaluacionId_estudianteId: { evaluacionId: ev.id, estudianteId: archivoDe } } })
      if (!e?.archivoRuta) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
      return NextResponse.redirect(await enlaceArchivo(e.archivoRuta, e.archivoNombre || undefined))
    }
    const estudiantes = await prisma.estudiante.findMany({
      where: { usuarioId: ev.planificacion.materia.usuarioId, grupo: ev.grupoSeccion || 'A', estado: 'ACTIVO', AND: [filtroMateria(ev.planificacion.materiaId)] },
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, cuentaId: true,
        entregas: { where: { evaluacionId: ev.id }, include: { archivos: { orderBy: { createdAt: 'asc' } } } },
        comentarios: { where: { evaluacionId: ev.id }, select: { autor: true, leido: true } },
      },
    })
    const filas = estudiantes.map(s => {
      const e = s.entregas[0]
      return {
        id: s.id, nombre: s.nombre, conCuenta: !!s.cuentaId,
        estado: !e ? 'PENDIENTE' : e.devuelta ? 'DEVUELTA' : esTarde(e.entregadaEn, ev.fecha) ? 'TARDE' : 'ENTREGADA',
        entrega: e ? { id: e.id, tipo: e.tipo, url: e.url, archivoNombre: e.archivoNombre, archivoTamano: e.archivoTamano, archivos: archivosPublicos(archivosDeEntrega(e)), revisada: e.revisada, comentario: e.comentario, entregadaEn: e.entregadaEn, devolucion: e.devolucion } : null,
        mensajes: s.comentarios.length,
        sinLeer: s.comentarios.filter(c => c.autor === 'ESTUDIANTE' && !c.leido).length,
      }
    })
    return NextResponse.json({ evaluacion: { id: ev.id, nombre: ev.nombre, fecha: ev.fecha, aceptaEntregas: ev.aceptaEntregas }, archivos: archivosConfigurados(), filas })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar las entregas.' }, { status: 500 })
  }
}

// PATCH /api/evaluaciones/:id/entregas  { estudianteId, devolver: true, devolucion } | { aceptaEntregas: boolean }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await evaluacionDelProfesor(request, id, 'escribir')
    if (r.error) return r.error
    const body = await request.json().catch(() => ({}))
    if (typeof body.aceptaEntregas === 'boolean') {
      await prisma.evaluacion.update({ where: { id }, data: { aceptaEntregas: body.aceptaEntregas } })
      return NextResponse.json({ ok: true })
    }
    if (body.devolver === true && body.estudianteId) {
      const devolucion = String(body.devolucion || '').trim().slice(0, 1000)
      if (devolucion.length < 3) return NextResponse.json({ error: 'Escribe qué debe corregir.' }, { status: 400 })
      await prisma.entrega.update({ where: { evaluacionId_estudianteId: { evaluacionId: id, estudianteId: String(body.estudianteId) } }, data: { devuelta: true, devolucion } })
      // También queda en la conversación privada, para que el estudiante lo vea con aviso
      await prisma.comentarioEvaluacion.create({ data: { evaluacionId: id, estudianteId: String(body.estudianteId), autor: 'PROFESOR', texto: `Te devolví la entrega para corregir: ${devolucion}` } })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
  }
}
