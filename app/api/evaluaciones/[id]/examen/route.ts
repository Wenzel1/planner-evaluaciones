import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { normalizarExamen, notaDe, faltaCorregir, ventanaExamen, type Correccion } from '@/lib/examen'
import { cerrarSiVencio, publicar, sugerirOtraVez } from '@/lib/examenServidor'
import { recalcularPromedios } from '@/lib/notas'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function cargarEvaluacion(id: string) {
  return prisma.evaluacion.findUnique({
    where: { id },
    select: { id: true, nombre: true, fecha: true, grupoSeccion: true, examen: true, tiempoEstimadoMinutos: true, planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } } },
  })
}

// GET /api/evaluaciones/:id/examen — el examen (completo, con respuestas correctas) y las entregas de la sección
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const ev = await cargarEvaluacion(id)
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada. Si la acabas de crear, espera a que se guarde.' }, { status: 404 })
    const dueno = ev.planificacion.materia.usuarioId
    const denegado = verificarAcceso(actor, dueno, 'leer')
    if (denegado) return denegado
    const examen = normalizarExamen(ev.examen)
    if (!examen) return NextResponse.json({ examen: null, entregas: [] })
    const [alumnos, filas] = await Promise.all([
      prisma.estudiante.findMany({ where: { usuarioId: dueno ?? actor.id, grupo: ev.grupoSeccion, estado: 'ACTIVO' }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      prisma.respuestaExamen.findMany({ where: { evaluacionId: id } }),
    ])
    const porEst = new Map<string, any>()
    for (const f of filas) porEst.set(f.estudianteId, await cerrarSiVencio(f as any, examen))
    const { abre, cierra } = ventanaExamen(examen, ev.fecha)
    const entregas = alumnos.map(a => {
      const f = porEst.get(a.id)
      return {
        estudianteId: a.id, nombre: a.nombre,
        estado: !f ? 'sin_empezar' : f.entregadoEn ? (f.publicada ? 'publicada' : 'entregado') : 'en_curso',
        inicio: f?.inicio ?? null, limite: f?.limite ?? null, entregadoEn: f?.entregadoEn ?? null,
        respuestas: f?.respuestas ?? {}, correccion: f?.correccion ?? {}, nota: f?.nota ?? null, comentario: f?.comentario ?? '',
        porCorregir: f?.entregadoEn ? faltaCorregir(examen, f.correccion as Correccion) : 0,
      }
    })
    return NextResponse.json({ examen, abre, cierra, entregas }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar el examen.' }, { status: 500 })
  }
}

// POST /api/evaluaciones/:id/examen  { accion, ... }
//  guardar {examen|null} · abrir_ya {abrir} · corregir {estudianteId, correccion, comentario} · sugerir {estudianteId?}
//  publicar {estudianteIds?} · reabrir {estudianteId} (borra su intento para que lo presente de nuevo)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const ev = await cargarEvaluacion(id)
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada. Si la acabas de crear, espera a que diga "Guardado" e intenta de nuevo.' }, { status: 404 })
    const denegado = verificarAcceso(actor, ev.planificacion.materia.usuarioId, 'escribir')
    if (denegado) return denegado
    const body = await request.json().catch(() => ({}))
    const actual = normalizarExamen(ev.examen)

    switch (body.accion) {
      case 'guardar': {
        if (body.examen === null) {
          await prisma.evaluacion.update({ where: { id }, data: { examen: Prisma.DbNull } })
          await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Examen', detalle: `Quitó el examen de "${ev.nombre}"`.slice(0, 300) })
          return NextResponse.json({ ok: true, examen: null })
        }
        const examen = normalizarExamen({ duracionMin: ev.tiempoEstimadoMinutos || 60, ...body.examen, desde: body.examen?.desde ?? actual?.desde ?? null })
        if (!examen) return NextResponse.json({ error: 'El examen necesita al menos una pregunta.' }, { status: 400 })
        await prisma.evaluacion.update({ where: { id }, data: { examen: examen as any } })
        await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Examen', detalle: `Adjuntó un examen de ${examen.preguntas.length} pregunta(s) a "${ev.nombre}"`.slice(0, 300) })
        return NextResponse.json({ ok: true, examen })
      }
      case 'abrir_ya': {
        if (!actual) return NextResponse.json({ error: 'Esta evaluación no tiene examen.' }, { status: 400 })
        const examen = { ...actual, desde: body.abrir ? new Date().toISOString() : null }
        await prisma.evaluacion.update({ where: { id }, data: { examen: examen as any } })
        return NextResponse.json({ ok: true, examen })
      }
      case 'corregir': {
        if (!actual) return NextResponse.json({ error: 'Esta evaluación no tiene examen.' }, { status: 400 })
        const f = await prisma.respuestaExamen.findUnique({ where: { estudianteId_evaluacionId: { estudianteId: String(body.estudianteId), evaluacionId: id } } })
        if (!f) return NextResponse.json({ error: 'Ese estudiante no presentó el examen.' }, { status: 404 })
        const previa = (f.correccion || {}) as Correccion
        const correccion: Correccion = { ...previa }
        for (const p of actual.preguntas) {
          const c = body.correccion?.[p.id]
          if (!c) continue
          const pts = c.puntos === null || c.puntos === '' ? null : Math.max(0, Math.min(p.puntos, Number(c.puntos)))
          const cambio = pts !== (previa[p.id]?.puntos ?? null) || String(c.comentario ?? '') !== String(previa[p.id]?.comentario ?? '')
          correccion[p.id] = cambio ? { puntos: Number.isFinite(pts as number) ? pts : null, comentario: String(c.comentario ?? '').slice(0, 300), fuente: 'profesor' } : previa[p.id]
        }
        const nota = notaDe(actual, correccion)
        let fila: any = await prisma.respuestaExamen.update({ where: { id: f.id }, data: { correccion: correccion as any, nota, comentario: String(body.comentario ?? f.comentario ?? '').slice(0, 500) || null } })
        if (fila.publicada && nota != null) fila = await publicar(fila) // si ya estaba publicada, se actualiza la nota
        return NextResponse.json({ ok: true, nota: fila.nota, correccion })
      }
      case 'sugerir': {
        const filas = await prisma.respuestaExamen.findMany({ where: { evaluacionId: id, entregadoEn: { not: null }, publicada: false, ...(body.estudianteId ? { estudianteId: String(body.estudianteId) } : {}) }, select: { id: true } })
        let hechas = 0; const errores: string[] = []
        for (const f of filas.slice(0, 40)) { try { await sugerirOtraVez(f.id); hechas++ } catch (e: any) { errores.push(e?.message || 'error') } }
        return NextResponse.json({ ok: true, hechas, error: errores[0] })
      }
      case 'publicar': {
        const ids: string[] | null = Array.isArray(body.estudianteIds) ? body.estudianteIds.map(String) : null
        const filas = await prisma.respuestaExamen.findMany({ where: { evaluacionId: id, entregadoEn: { not: null }, publicada: false, nota: { not: null }, ...(ids ? { estudianteId: { in: ids } } : {}) } })
        for (const f of filas) await publicar(f as any)
        if (filas.length) await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Notas', detalle: `Publicó ${filas.length} nota(s) del examen de "${ev.nombre}"`.slice(0, 300) })
        return NextResponse.json({ ok: true, publicadas: filas.length })
      }
      case 'reabrir': {
        const estudianteId = String(body.estudianteId || '')
        const f = await prisma.respuestaExamen.findUnique({ where: { estudianteId_evaluacionId: { estudianteId, evaluacionId: id } } })
        if (!f) return NextResponse.json({ ok: true })
        await prisma.respuestaExamen.delete({ where: { id: f.id } })
        if (f.publicada) { await prisma.calificacion.deleteMany({ where: { estudianteId, evaluacionId: id } }); await recalcularPromedios([estudianteId]) }
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
    }
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message?.startsWith('Falta') ? e.message : 'No se pudo completar la acción del examen.' }, { status: 500 })
  }
}
