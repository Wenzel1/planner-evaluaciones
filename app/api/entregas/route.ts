import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { filtroMateria } from '@/lib/clases'
import { esTarde, archivosDeEntrega, archivosPublicos } from '@/lib/entregas'
import { archivosConfigurados } from '@/lib/almacenamiento'
import { normalizarRubrica } from '@/lib/rubrica'

export const dynamic = 'force-dynamic'

// GET /api/entregas?materiaId=…  — Bandeja de entregas del profesor (todas las evaluaciones de esa materia):
// cada entrega con sus archivos, su estado y su nota; y por evaluación, quiénes faltan por entregar.
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const materiaId = new URL(request.url).searchParams.get('materiaId') || null

    const evaluaciones = await prisma.evaluacion.findMany({
      where: { estado: { not: 'CANCELADA' }, planificacion: { materia: { usuarioId: actor.id }, ...(materiaId ? { materiaId } : {}) } },
      orderBy: [{ fecha: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, nombre: true, fecha: true, grupoSeccion: true, aceptaEntregas: true, rubrica: true, examen: true,
        planificacion: { select: { materiaId: true } },
        entregas: {
          orderBy: { entregadaEn: 'desc' },
          include: {
            archivos: { orderBy: { createdAt: 'asc' } },
            estudiante: { select: { id: true, nombre: true, grupo: true, estado: true, cuentaId: true, cuenta: { select: { avatarEn: true } } } },
          },
        },
      },
    })
    // Solo las evaluaciones que reciben trabajos (las que tienen examen en línea se corrigen en su propia ventana)
    const conEntregas = evaluaciones.filter(ev => ev.entregas.length > 0 || (ev.aceptaEntregas && !ev.examen))
    const ids = conEntregas.map(ev => ev.id)

    const [estudiantes, notas, mensajes] = await Promise.all([
      prisma.estudiante.findMany({
        where: { usuarioId: actor.id, estado: 'ACTIVO', ...filtroMateria(materiaId) },
        select: { id: true, nombre: true, grupo: true }, orderBy: { nombre: 'asc' },
      }),
      prisma.calificacion.findMany({ where: { evaluacionId: { in: ids } }, select: { evaluacionId: true, estudianteId: true, puntaje: true, observaciones: true, detalle: true } }),
      prisma.comentarioEvaluacion.groupBy({ by: ['evaluacionId', 'estudianteId'], where: { evaluacionId: { in: ids }, autor: 'ESTUDIANTE', leido: false }, _count: true }),
    ])
    const nota = new Map(notas.map(n => [`${n.evaluacionId}:${n.estudianteId}`, n]))
    const sinLeer = new Map(mensajes.map(m => [`${m.evaluacionId}:${m.estudianteId}`, m._count]))

    const entregas = conEntregas.flatMap(ev => ev.entregas.map(e => {
      const n = nota.get(`${ev.id}:${e.estudianteId}`)
      return {
        id: e.id,
        estudiante: { id: e.estudiante.id, nombre: e.estudiante.nombre, grupo: e.estudiante.grupo, cuentaId: e.estudiante.cuentaId, avatarEn: e.estudiante.cuenta?.avatarEn?.toISOString() ?? null },
        evaluacion: { id: ev.id, nombre: ev.nombre, fecha: ev.fecha, seccion: ev.grupoSeccion || 'A' },
        entregadaEn: e.entregadaEn, tarde: esTarde(e.entregadaEn, ev.fecha),
        revisada: e.revisada, devuelta: e.devuelta, devolucion: e.devolucion,
        comentario: e.comentario, url: e.url,
        archivos: archivosPublicos(archivosDeEntrega(e)),
        nota: n ? { puntaje: n.puntaje, observaciones: n.observaciones, detalle: n.detalle } : null,
        sinLeer: sinLeer.get(`${ev.id}:${e.estudianteId}`) || 0,
      }
    })).sort((a, b) => new Date(b.entregadaEn).getTime() - new Date(a.entregadaEn).getTime())

    const resumen = conEntregas.map(ev => {
      const seccion = ev.grupoSeccion || 'A'
      const deLaSeccion = estudiantes.filter(s => (s.grupo || 'A') === seccion)
      const entregaron = new Set(ev.entregas.map(e => e.estudianteId))
      return {
        id: ev.id, nombre: ev.nombre, fecha: ev.fecha, seccion, aceptaEntregas: ev.aceptaEntregas,
        rubrica: normalizarRubrica(ev.rubrica),
        estudiantes: deLaSeccion.length, entregadas: ev.entregas.length,
        faltan: deLaSeccion.filter(s => !entregaron.has(s.id)).map(s => ({ id: s.id, nombre: s.nombre })),
      }
    })

    return NextResponse.json({
      archivos: archivosConfigurados(),
      entregas,
      evaluaciones: resumen,
      contadores: {
        total: entregas.length,
        sinRevisar: entregas.filter(e => !e.revisada && !e.devuelta).length,
        revisadas: entregas.filter(e => e.revisada).length,
        devueltas: entregas.filter(e => e.devuelta).length,
        tarde: entregas.filter(e => e.tarde).length,
        faltan: resumen.reduce((t, r) => t + r.faltan.length, 0),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar la bandeja de entregas.' }, { status: 500 })
  }
}
