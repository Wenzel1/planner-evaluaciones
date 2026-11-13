import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirEstudiante } from '@/lib/permisos'
import { tokenDeEstudiante } from '@/lib/portal'

export const dynamic = 'force-dynamic'

// GET /api/estudiante/panel — la cuenta del estudiante y sus clases (una por profesor).
// Para cada clase aceptada devuelve el token con el que se arma su vista (el mismo contenido que tenía el enlace personal).
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirEstudiante(request)
    if (error) return error
    // Si algún profesor ya lo tenía cargado con este mismo correo (verificado al crear la cuenta), se enlaza solo
    await prisma.estudiante.updateMany({ where: { email: actor.email.toLowerCase(), cuentaId: null }, data: { cuentaId: actor.id } }).catch(() => {})
    const filas = await prisma.estudiante.findMany({
      where: { cuentaId: actor.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, estado: true, grupo: true, solicitadoEn: true, usuario: { select: { nombre: true, activo: true } }, materia: { select: { nombre: true } } },
    })
    const clases = []
    for (const f of filas) {
      if (f.usuario?.activo === false) continue
      clases.push({
        id: f.id,
        estado: f.estado, // ACTIVO | PENDIENTE | INACTIVO
        profesor: f.usuario?.nombre || 'Profesor',
        materia: f.materia?.nombre || null,
        seccion: f.grupo || 'A',
        solicitadoEn: f.solicitadoEn,
        token: f.estado === 'ACTIVO' ? await tokenDeEstudiante(f.id) : null,
      })
    }
    return NextResponse.json({ cuenta: { id: actor.id, nombre: actor.nombre, email: actor.email, avatarEn: actor.avatarEn ?? null }, clases }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo cargar tu panel.' }, { status: 500 })
  }
}
