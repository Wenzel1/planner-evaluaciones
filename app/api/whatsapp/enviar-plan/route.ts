import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarLoteN8n, nuevoId, origenApp, primerNombre, type MensajeLote } from '@/lib/whatsappLotes'
import { obtenerPdfPlan, nombreArchivoPlan } from '@/lib/planCompartido'

export const maxDuration = 60

const MAX_ESTUDIANTES = 200
const MENSAJE_POR_DEFECTO = 'Hola {nombre} 👋\nTe comparto el plan de evaluación de *{materia}* (sección {seccion}). Revísalo con calma y guárdalo.'

// POST /api/whatsapp/enviar-plan
// { seccion: 'A', estudianteIds: string[], mensaje?: string, plan: { materia, fechaExamen, secciones: [...] } }
// Envía el Plan de Acción en PDF por WhatsApp a los estudiantes elegidos de ESA sección (solo estudiantes propios).
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const seccion = String(body.seccion ?? '').trim().toUpperCase()
    if (!/^[A-Z]$/.test(seccion)) return NextResponse.json({ error: 'Sección no válida.' }, { status: 400 })

    const ids: string[] = Array.isArray(body.estudianteIds) ? body.estudianteIds.map(String).slice(0, MAX_ESTUDIANTES) : []
    if (ids.length === 0) return NextResponse.json({ error: 'Selecciona al menos un estudiante.' }, { status: 400 })

    const plan = body.plan || {}
    const secciones = Array.isArray(plan.secciones) ? plan.secciones.slice(0, 20) : []
    if (secciones.length === 0) return NextResponse.json({ error: 'El plan no tiene evaluaciones.' }, { status: 400 })
    const materia = String(plan.materia || 'Asignatura').slice(0, 120)

    // Solo estudiantes del profesor y de esa sección (grupo A recibe el plan A, grupo B el plan B...)
    const estudiantes = await prisma.estudiante.findMany({
      where: { id: { in: ids }, usuarioId: actor.id, grupo: seccion },
      select: { id: true, nombre: true, telefono: true },
    })
    const conTelefono = estudiantes.filter(e => (e.telefono || '').replace(/\D/g, '').length >= 7)
    const sinTelefono = estudiantes.filter(e => !conTelefono.includes(e)).map(e => e.nombre)
    if (conTelefono.length === 0) return NextResponse.json({ error: 'Ninguno de los estudiantes elegidos tiene un teléfono válido.' }, { status: 400 })

    // Copia del plan con un enlace secreto: UltraMsg descarga el PDF desde ahí
    const token = crypto.randomBytes(24).toString('hex')
    await prisma.planCompartido.create({
      data: {
        token, usuarioId: actor.id, seccion, materia,
        datos: {
          profesor: actor.nombre,
          materia,
          fechaExamen: plan.fechaExamen || new Date().toISOString(),
          secciones: secciones.map((s: any) => ({
            nombre: String(s.nombre ?? '').slice(0, 300), tipoActividad: String(s.tipoActividad ?? '').slice(0, 200),
            peso: Number(s.peso) || 0, fecha: s.fecha || null, descripcion: String(s.descripcion ?? '').slice(0, 6000),
            enfoque: s.enfoque ?? null, tiempoEstimadoMinutos: s.tiempoEstimadoMinutos ?? null,
            cantidadGrupos: s.cantidadGrupos ?? null, personasPorGrupo: s.personasPorGrupo ?? null,
          })),
        },
      },
    })

    // El PDF se genera ANTES de enviar: si falla, no se manda nada y el profesor ve el motivo
    const pdf = await obtenerPdfPlan(token)
    if ('error' in pdf) return NextResponse.json({ error: pdf.error }, { status: pdf.status })

    const plantilla = String(body.mensaje || '').trim().slice(0, 900) || MENSAJE_POR_DEFECTO
    const documentoUrl = `${origenApp(request)}/api/plan-publico/${token}`
    const archivo = nombreArchivoPlan(materia, seccion)
    const loteId = nuevoId()

    const mensajes: MensajeLote[] = conTelefono.map(e => ({
      id: nuevoId(),
      telefono: e.telefono as string,
      texto: plantilla.replace(/\{nombre\}/g, primerNombre(e.nombre)).replace(/\{materia\}/g, materia).replace(/\{seccion\}/g, seccion),
      documentoUrl,
      archivo,
    }))

    await prisma.envioWhatsApp.createMany({
      data: mensajes.map((m, i) => ({
        id: m.id, loteId, usuarioId: actor.id, tipo: 'PLAN',
        estudianteId: conTelefono[i].id, nombre: conTelefono[i].nombre, telefono: m.telefono,
      })),
    })

    const r = await enviarLoteN8n(request, mensajes)
    await registrarActividad({ actor, accion: 'ENVIAR', entidad: 'Plan', detalle: `Envió por WhatsApp el plan de "${materia}" (sección ${seccion}) a ${mensajes.length} estudiante(s)${r.ok ? '' : ' — falló: ' + r.error}`.slice(0, 300) })
    if (!r.ok) return NextResponse.json({ error: r.error, loteId }, { status: 502 })

    return NextResponse.json({ ok: true, loteId, total: mensajes.length, sinTelefono })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar el plan.' }, { status: 500 })
  }
}
