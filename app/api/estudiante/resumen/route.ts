import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirEstudiante } from '@/lib/permisos'
import { tokenDeEstudiante } from '@/lib/portal'
import { datosPortal } from '@/lib/portalDatos'

export const dynamic = 'force-dynamic'

// GET /api/estudiante/resumen — todo lo del estudiante, de TODAS sus clases, para las pestañas
// Inicio, Calendario, Entregas, Calificaciones y Mensajes. Cada "grupo" es una materia de una clase (profesor + sección).
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirEstudiante(request)
    if (error) return error
    const clases = await prisma.estudiante.findMany({
      where: { cuentaId: actor.id, estado: 'ACTIVO', usuario: { activo: true } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, grupo: true, usuario: { select: { nombre: true } } },
    })
    const grupos: any[] = []
    const evaluaciones: any[] = []
    let archivos = false
    for (const c of clases) {
      const token = await tokenDeEstudiante(c.id)
      const d: any = await datosPortal(token).catch(() => null)
      if (!d || d.error) continue
      archivos = archivos || !!d.archivos
      for (const m of d.materias || []) {
        const clave = `${c.id}:${m.id}`
        const evs = m.evaluaciones || []
        const conNota = evs.filter((e: any) => e.nota && e.estado !== 'CANCELADA')
        const pesoEvaluado = conNota.reduce((t: number, e: any) => t + (e.peso || 0), 0)
        const puntos = conNota.reduce((t: number, e: any) => t + e.nota.puntaje * (e.peso || 0) / 100, 0)
        grupos.push({
          clave, claseId: c.id, token, materiaId: m.id, materia: m.nombre, profesor: c.usuario?.nombre || d.profesor || 'Profesor', seccion: c.grupo || 'A',
          promedio: m.promedio ?? null, pesoEvaluado, puntos: Math.round(puntos * 100) / 100,
          total: evs.filter((e: any) => e.estado !== 'CANCELADA').length,
        })
        for (const e of evs) {
          evaluaciones.push({
            grupo: clave, claseId: c.id, token, materia: m.nombre, profesor: c.usuario?.nombre || 'Profesor',
            id: e.id, nombre: e.nombre, tipoActividad: e.tipoActividad, fecha: e.fecha, duracion: e.duracion, peso: e.peso, estado: e.estado,
            abierta: e.abierta, nota: e.nota ? { puntaje: e.nota.puntaje, observaciones: e.nota.observaciones } : null,
            aceptaEntregas: !!e.aceptaEntregas && !e.examen, entrega: e.entrega || null, examen: e.examen ? { estado: e.examen.estado } : null,
            mensajes: e.mensajes || 0, mensajesNuevos: e.mensajesNuevos || 0,
          })
        }
      }
    }
    return NextResponse.json({ grupos, evaluaciones, archivos, generado: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar tu resumen.' }, { status: 500 })
  }
}
