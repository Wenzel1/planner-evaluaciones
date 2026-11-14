import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { SELECT_COMENTARIO, vistaComentario } from '@/lib/adjuntos'

export const dynamic = 'force-dynamic'

const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '')

// Mensajes privados del profesor, reunidos en UN hilo por estudiante (cada mensaje sigue perteneciendo a una evaluación).
// GET /api/mensajes?materiaId=…                  → { hilos, evaluaciones, estudiantes } (para la lista y para escribir uno nuevo)
// GET /api/mensajes?materiaId=…&estudianteId=…   → todos los mensajes con ese estudiante en esa materia (marca leídos los suyos)
// Para enviar se usa POST /api/evaluaciones/:id/comentarios (el mensaje va sobre una evaluación).
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const q = new URL(request.url).searchParams
    const materiaId = q.get('materiaId') || ''
    const materia = await prisma.materia.findUnique({ where: { id: materiaId }, select: { id: true, usuarioId: true } })
    if (!materia) return NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 })
    const denegado = verificarAcceso(actor!, materia.usuarioId, 'leer')
    if (denegado) return denegado
    const deLaMateria = { evaluacion: { planificacion: { materiaId } } }

    const estudianteId = q.get('estudianteId')
    if (estudianteId) {
      const lista = await prisma.comentarioEvaluacion.findMany({
        where: { ...deLaMateria, estudianteId }, orderBy: { createdAt: 'asc' }, take: 400,
        select: { ...SELECT_COMENTARIO, evaluacionId: true, evaluacion: { select: { nombre: true } } },
      })
      if (verificarAcceso(actor!, materia.usuarioId, 'escribir') === null) {
        await prisma.comentarioEvaluacion.updateMany({ where: { ...deLaMateria, estudianteId, autor: 'ESTUDIANTE', leido: false }, data: { leido: true } })
      }
      return NextResponse.json(lista.map(c => ({ ...vistaComentario(c), evaluacionId: c.evaluacionId, evaluacion: limpiar(c.evaluacion.nombre) })))
    }

    const [recientes, evaluaciones, estudiantes] = await Promise.all([
      prisma.comentarioEvaluacion.findMany({
        where: deLaMateria, orderBy: { createdAt: 'desc' }, take: 1500,
        select: { estudianteId: true, evaluacionId: true, autor: true, texto: true, leido: true, createdAt: true, adjuntoNombre: true, adjuntoTipo: true },
      }),
      prisma.evaluacion.findMany({ where: { planificacion: { materiaId } }, orderBy: [{ grupoSeccion: 'asc' }, { orden: 'asc' }], select: { id: true, nombre: true, grupoSeccion: true } }),
      prisma.estudiante.findMany({
        where: { usuarioId: materia.usuarioId, estado: 'ACTIVO', OR: [{ materiaId: null }, { materiaId }] }, orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, grupo: true, cuentaId: true, cuenta: { select: { avatarEn: true } } },
      }),
    ])
    const porEst = new Map<string, { ultimo: typeof recientes[number]; sinLeer: number }>()
    for (const c of recientes) {
      const h = porEst.get(c.estudianteId)
      if (!h) porEst.set(c.estudianteId, { ultimo: c, sinLeer: c.autor === 'ESTUDIANTE' && !c.leido ? 1 : 0 })
      else if (c.autor === 'ESTUDIANTE' && !c.leido) h.sinLeer++
    }
    const persona = (e: typeof estudiantes[number]) => ({ id: e.id, nombre: e.nombre, grupo: e.grupo || 'A', cuentaId: e.cuentaId, avatarEn: e.cuenta?.avatarEn ?? null })
    const hilos = estudiantes.filter(e => porEst.has(e.id)).map(e => {
      const h = porEst.get(e.id)!
      return {
        estudiante: persona(e), sinLeer: h.sinLeer,
        ultimo: { autor: h.ultimo.autor, texto: h.ultimo.texto, createdAt: h.ultimo.createdAt, evaluacionId: h.ultimo.evaluacionId, adjunto: h.ultimo.adjuntoNombre ? { nombre: h.ultimo.adjuntoNombre, tipo: h.ultimo.adjuntoTipo } : null },
      }
    }).sort((a, b) => new Date(b.ultimo.createdAt).getTime() - new Date(a.ultimo.createdAt).getTime())
    return NextResponse.json({
      hilos,
      evaluaciones: evaluaciones.map(e => ({ id: e.id, nombre: limpiar(e.nombre), seccion: (e.grupoSeccion || 'A').toUpperCase() })),
      estudiantes: estudiantes.map(persona),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron cargar los mensajes.' }, { status: 500 })
  }
}
