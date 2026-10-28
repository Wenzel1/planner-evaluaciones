import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { enviarLoteN8n, nombreLimpio, nuevoId, primerNombre, type MensajeLote } from '@/lib/whatsappLotes'
import { NIVELES_RUBRICA, normalizarRubrica, puntosNivel, textoPuntos } from '@/lib/rubrica'
import { tokensDeEstudiantes, urlPortal } from '@/lib/portal'
import { NOTA_APROBATORIA, NOTA_MAXIMA, textoNota } from '@/lib/notas'

export const maxDuration = 60

// POST /api/evaluaciones/:id/notas/enviar  { estudianteIds: string[] }
// Envía a cada estudiante elegido SU nota por WhatsApp (con el detalle de la rúbrica si se calificó con ella).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const { id } = await params
    const ev = await prisma.evaluacion.findUnique({
      where: { id },
      select: { id: true, nombre: true, grupoSeccion: true, rubrica: true, planificacion: { select: { materia: { select: { nombre: true, usuarioId: true } } } } },
    })
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    const dueno = ev.planificacion.materia.usuarioId
    const denegado = verificarAcceso(actor, dueno, 'escribir')
    if (denegado) return denegado

    const body = await request.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.estudianteIds) ? body.estudianteIds.map(String).slice(0, 300) : []
    if (ids.length === 0) return NextResponse.json({ error: 'Selecciona al menos un estudiante.' }, { status: 400 })

    const notas = await prisma.calificacion.findMany({
      where: { evaluacionId: id, estudianteId: { in: ids }, puntaje: { not: null }, estudiante: { usuarioId: dueno ?? actor.id } },
      select: { puntaje: true, observaciones: true, detalle: true, estudiante: { select: { id: true, nombre: true, telefono: true } } },
    })
    const conTelefono = notas.filter(n => (n.estudiante.telefono || '').replace(/\D/g, '').length >= 7)
    if (conTelefono.length === 0) return NextResponse.json({ error: 'Ninguno de los elegidos tiene nota guardada y teléfono válido.' }, { status: 400 })

    const rubrica = normalizarRubrica(ev.rubrica)
    const evaluacion = nombreLimpio(ev.nombre)
    const materia = ev.planificacion.materia.nombre
    const seccion = ev.grupoSeccion || 'A'

    const tokens = await tokensDeEstudiantes(conTelefono.map(n => n.estudiante.id))
    const mensajes: MensajeLote[] = conTelefono.map(n => {
      const nota = n.puntaje as number
      const aprobado = nota >= NOTA_APROBATORIA
      const lineas = [
        `Hola ${primerNombre(n.estudiante.nombre)} 👋`,
        `Ya está tu nota de *${evaluacion}* (${materia}, sección ${seccion}):`,
        '',
        `📝 *${textoNota(nota)}/${NOTA_MAXIMA}* ${aprobado ? '✅ Aprobado' : '⚠️ No aprobado'}`,
      ]
      const detalle = Array.isArray(n.detalle) ? (n.detalle as any[]) : null
      if (rubrica && detalle && detalle.some(x => Number.isInteger(x))) {
        lineas.push('')
        rubrica.criterios.forEach((c, i) => {
          const nivel = detalle[i]
          if (Number.isInteger(nivel)) lineas.push(`• ${c.nombre}: ${NIVELES_RUBRICA[nivel]} (${textoPuntos(puntosNivel(c.puntos, nivel))}/${textoPuntos(c.puntos)})`)
        })
      }
      if (n.observaciones) lineas.push('', `💬 ${n.observaciones}`)
      lineas.push('', `📊 Todas tus notas y tu promedio: ${urlPortal(request, tokens.get(n.estudiante.id) as string)}`)
      lineas.push('', aprobado ? '¡Sigue así! 💪' : 'Puedes consultar con tu profesor cómo mejorar. ¡Ánimo! 💪')
      return { id: nuevoId(), telefono: n.estudiante.telefono as string, texto: lineas.join('\n') }
    })

    const loteId = nuevoId()
    await prisma.envioWhatsApp.createMany({
      data: mensajes.map((m, i) => ({ id: m.id, loteId, usuarioId: actor.id, tipo: 'NOTA', estudianteId: conTelefono[i].estudiante.id, nombre: conTelefono[i].estudiante.nombre, telefono: m.telefono })),
    })
    const r = await enviarLoteN8n(request, mensajes)
    await registrarActividad({ actor, accion: 'ENVIAR', entidad: 'Notas', detalle: `Envió por WhatsApp ${mensajes.length} nota(s) de "${evaluacion}" (${materia})${r.ok ? '' : ' — falló: ' + r.error}`.slice(0, 300) })
    if (!r.ok) return NextResponse.json({ error: r.error, loteId }, { status: 502 })
    const sinEnviar = ids.length - mensajes.length
    return NextResponse.json({ ok: true, loteId, total: mensajes.length, sinEnviar })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron enviar las notas.' }, { status: 500 })
  }
}
