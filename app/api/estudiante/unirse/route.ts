import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirEstudiante } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { normalizarCodigo } from '@/lib/clases'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

// POST /api/estudiante/unirse  { codigo } — el estudiante se une a la clase (profesor + materia + sección) del código.
//  - Si el profesor ya lo tenía cargado con ese correo, se enlaza ese registro (conserva sus notas).
//  - Si no, se crea en la lista del profesor: directo, o como solicitud si la sección pide aprobación.
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirEstudiante(request)
    if (error) return error
    const clave = `unirse:${actor.id}`
    if (bloqueado(clave)) return NextResponse.json({ error: `Demasiados intentos. Prueba de nuevo en ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    const body = await request.json().catch(() => ({}))
    const codigo = normalizarCodigo(body.codigo)
    const seccion = codigo ? await prisma.seccionMateria.findUnique({ where: { codigo }, include: { materia: { select: { id: true, nombre: true, usuarioId: true, usuario: { select: { nombre: true, activo: true } } } } } }) : null
    if (!seccion || !seccion.activo || !seccion.materia.usuarioId || seccion.materia.usuario?.activo === false) {
      registrarFallo(clave)
      return NextResponse.json({ error: 'Ese código no existe o ya no está activo. Revísalo con tu profesor.' }, { status: 404 })
    }
    const profesorId = seccion.materia.usuarioId
    const email = actor.email.toLowerCase()
    const destino = { materia: seccion.materia.nombre, profesor: seccion.materia.usuario?.nombre || 'tu profesor', seccion: seccion.letra }

    const existente = await prisma.estudiante.findUnique({ where: { usuarioId_email: { usuarioId: profesorId, email } } })
    if (existente) {
      if (existente.cuentaId && existente.cuentaId !== actor.id) return NextResponse.json({ error: 'Ese estudiante ya está enlazado a otra cuenta. Habla con tu profesor.' }, { status: 409 })
      // Ya estaba en la lista del profesor: se enlaza a esta cuenta. Si estaba en otra materia del mismo profesor, pasa a valer para todas.
      const otraMateria = existente.materiaId && existente.materiaId !== seccion.materiaId
      await prisma.estudiante.update({ where: { id: existente.id }, data: { cuentaId: actor.id, ...(otraMateria ? { materiaId: null } : {}) } })
      await registrarActividad({ actor, accion: 'EDITAR', entidad: 'Estudiante', detalle: `Enlazó su cuenta a la clase de ${destino.profesor} (${destino.materia})` })
      return NextResponse.json({ estado: existente.estado === 'PENDIENTE' ? 'PENDIENTE' : 'ACTIVO', enlazado: true, ...destino })
    }
    const estado = seccion.requiereAprobacion ? 'PENDIENTE' : 'ACTIVO'
    await prisma.estudiante.create({
      data: { nombre: actor.nombre, email, grupo: seccion.letra, estado, usuarioId: profesorId, materiaId: seccion.materiaId, cuentaId: actor.id, solicitadoEn: new Date() },
    })
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Estudiante', detalle: `Se unió con código a ${destino.materia}, Sección ${destino.seccion} (${estado === 'PENDIENTE' ? 'espera aprobación' : 'directo'})` })
    return NextResponse.json({ estado, ...destino })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo completar. Intenta de nuevo.' }, { status: 500 })
  }
}
