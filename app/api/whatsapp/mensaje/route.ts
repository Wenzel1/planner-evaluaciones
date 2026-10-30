import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarLoteN8n, nuevoId, primerNombre, type MensajeLote } from '@/lib/whatsappLotes'
import { tokensDeEstudiantes, urlPortal } from '@/lib/portal'
import { estudiantesEnRiesgo, filtrarRiesgo } from '@/lib/agente/analisis'

export const maxDuration = 60

// POST /api/whatsapp/mensaje
// { seccion, destinatarios: 'seccion' | 'riesgo' | 'nombres', nombres?: string[], texto, incluirEnlace?: boolean, planificacionId? }
// Mensaje libre del profesor (redactado con el agente) a estudiantes de una sección. {nombre} se reemplaza por el de cada uno.
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const seccion = String(body.seccion ?? '').trim().toUpperCase()
    if (!/^[A-Z]$/.test(seccion)) return NextResponse.json({ error: 'Sección no válida.' }, { status: 400 })
    const texto = String(body.texto ?? '').trim().slice(0, 1500)
    if (texto.length < 5) return NextResponse.json({ error: 'Escribe el mensaje.' }, { status: 400 })

    let estudiantes = await prisma.estudiante.findMany({
      where: { usuarioId: actor.id, grupo: seccion, estado: 'ACTIVO' },
      select: { id: true, nombre: true, telefono: true },
    })
    const modo = String(body.destinatarios || 'seccion')
    if (modo === 'nombres') {
      const buscados = (Array.isArray(body.nombres) ? body.nombres : []).map((n: any) => String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()).filter(Boolean)
      const sinTilde = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      estudiantes = estudiantes.filter(e => buscados.some((b: string) => sinTilde(e.nombre).includes(b) || b.includes(sinTilde(e.nombre))))
    } else if (modo === 'riesgo') {
      const plan = body.planificacionId ? await prisma.planificacion.findFirst({ where: { id: String(body.planificacionId), materia: { usuarioId: actor.id } }, select: { id: true } }) : null
      if (!plan) return NextResponse.json({ error: 'Guarda el plan primero para calcular quiénes están en riesgo.' }, { status: 400 })
      const evs = await prisma.evaluacion.findMany({
        where: { planificacionId: plan.id, grupoSeccion: seccion },
        select: { id: true, nombre: true, peso: true, estado: true, fecha: true, rubrica: true, calificaciones: { select: { estudianteId: true, puntaje: true, detalle: true } } },
      })
      const enRiesgo = new Set(filtrarRiesgo(estudiantesEnRiesgo(evs as any, estudiantes)).map(r => r.id))
      estudiantes = estudiantes.filter(e => enRiesgo.has(e.id))
    }
    if (estudiantes.length === 0) return NextResponse.json({ error: 'No hay estudiantes que cumplan con eso en la sección.' }, { status: 400 })

    const conTelefono = estudiantes.filter(e => (e.telefono || '').replace(/\D/g, '').length >= 7)
    const sinTelefono = estudiantes.filter(e => !conTelefono.includes(e)).map(e => e.nombre)
    if (conTelefono.length === 0) return NextResponse.json({ error: 'Ninguno de esos estudiantes tiene teléfono.' }, { status: 400 })

    const tokens = body.incluirEnlace ? await tokensDeEstudiantes(conTelefono.map(e => e.id)) : new Map<string, string>()
    const loteId = nuevoId()
    const mensajes: MensajeLote[] = conTelefono.map(e => ({
      id: nuevoId(), telefono: e.telefono as string,
      texto: texto.replace(/\{nombre\}/gi, primerNombre(e.nombre)) + (body.incluirEnlace ? `\n\n📚 Tu plan y tus notas: ${urlPortal(request, tokens.get(e.id) as string)}` : ''),
    }))
    await prisma.envioWhatsApp.createMany({ data: mensajes.map((m, i) => ({ id: m.id, loteId, usuarioId: actor.id, tipo: 'MENSAJE', estudianteId: conTelefono[i].id, nombre: conTelefono[i].nombre, telefono: m.telefono })) })
    const r = await enviarLoteN8n(request, mensajes)
    await registrarActividad({ actor, accion: 'ENVIAR', entidad: 'Mensaje', detalle: `Envió un mensaje por WhatsApp a ${mensajes.length} estudiante(s) de la sección ${seccion}${r.ok ? '' : ' — falló: ' + r.error}`.slice(0, 300) })
    if (!r.ok) return NextResponse.json({ error: r.error, loteId }, { status: 502 })
    return NextResponse.json({ ok: true, loteId, total: mensajes.length, sinTelefono, nombres: conTelefono.map(e => e.nombre) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 })
  }
}
