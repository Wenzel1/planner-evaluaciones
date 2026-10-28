import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarLoteN8n, nuevoId, primerNombre, type MensajeLote } from '@/lib/whatsappLotes'
import { tokensDeEstudiantes, urlPortal } from '@/lib/portal'

export const maxDuration = 60

const MAX_ESTUDIANTES = 200
const MENSAJE_POR_DEFECTO = 'Hola {nombre} 👋\nYa está listo tu plan de evaluación de *{materia}* (sección {seccion}).\n\nAquí lo ves completo, con los recursos para estudiar y tus notas:\n{enlace}'

// POST /api/whatsapp/enviar-plan  { seccion: 'A', estudianteIds: string[], mensaje?: string, materia?: string }
// Envía a cada estudiante elegido el enlace a SU página personal (/e/<token>). Ya no se manda el PDF:
// el estudiante lo descarga desde su página si lo quiere.
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const seccion = String(body.seccion ?? '').trim().toUpperCase()
    if (!/^[A-Z]$/.test(seccion)) return NextResponse.json({ error: 'Sección no válida.' }, { status: 400 })
    const ids: string[] = Array.isArray(body.estudianteIds) ? body.estudianteIds.map(String).slice(0, MAX_ESTUDIANTES) : []
    if (ids.length === 0) return NextResponse.json({ error: 'Selecciona al menos un estudiante.' }, { status: 400 })
    const materia = String(body.materia || body.plan?.materia || 'tu asignatura').slice(0, 120)

    // La página muestra lo guardado en la base de datos: tiene que haber al menos una evaluación de esa sección
    const hay = await prisma.evaluacion.count({ where: { grupoSeccion: seccion, estado: { not: 'CANCELADA' }, planificacion: { materia: { usuarioId: actor.id } } } })
    if (hay === 0) return NextResponse.json({ error: `Todavía no hay evaluaciones guardadas en la sección ${seccion}. Espera a que diga "Guardado" e intenta de nuevo.` }, { status: 400 })

    // Solo estudiantes activos del profesor y de esa sección
    const estudiantes = await prisma.estudiante.findMany({
      where: { id: { in: ids }, usuarioId: actor.id, grupo: seccion, estado: 'ACTIVO' },
      select: { id: true, nombre: true, telefono: true },
    })
    const conTelefono = estudiantes.filter(e => (e.telefono || '').replace(/\D/g, '').length >= 7)
    const sinTelefono = estudiantes.filter(e => !conTelefono.includes(e)).map(e => e.nombre)
    if (conTelefono.length === 0) return NextResponse.json({ error: 'Ninguno de los estudiantes elegidos tiene un teléfono válido.' }, { status: 400 })

    const tokens = await tokensDeEstudiantes(conTelefono.map(e => e.id))
    let plantilla = String(body.mensaje || '').trim().slice(0, 900) || MENSAJE_POR_DEFECTO
    if (!plantilla.includes('{enlace}')) plantilla += '\n\n{enlace}' // el enlace nunca puede faltar
    const loteId = nuevoId()

    const mensajes: MensajeLote[] = conTelefono.map(e => ({
      id: nuevoId(),
      telefono: e.telefono as string,
      texto: plantilla
        .replace(/\{nombre\}/g, primerNombre(e.nombre))
        .replace(/\{materia\}/g, materia)
        .replace(/\{seccion\}/g, seccion)
        .replace(/\{enlace\}/g, urlPortal(request, tokens.get(e.id) as string)),
    }))

    await prisma.envioWhatsApp.createMany({
      data: mensajes.map((m, i) => ({
        id: m.id, loteId, usuarioId: actor.id, tipo: 'PLAN',
        estudianteId: conTelefono[i].id, nombre: conTelefono[i].nombre, telefono: m.telefono,
      })),
    })

    const r = await enviarLoteN8n(request, mensajes)
    await registrarActividad({ actor, accion: 'ENVIAR', entidad: 'Plan', detalle: `Envió por WhatsApp el enlace del plan de "${materia}" (sección ${seccion}) a ${mensajes.length} estudiante(s)${r.ok ? '' : ' — falló: ' + r.error}`.slice(0, 300) })
    if (!r.ok) return NextResponse.json({ error: r.error, loteId }, { status: 502 })

    return NextResponse.json({ ok: true, loteId, total: mensajes.length, sinTelefono })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar el plan.' }, { status: 500 })
  }
}
