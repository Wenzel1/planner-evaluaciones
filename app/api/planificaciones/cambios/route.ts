import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { filtroMateria, aceptaAvisos } from '@/lib/clases'
import { urlAcceso } from '@/lib/portal'
import { enviarLoteN8n, nuevoId, primerNombre, destinoDe, tieneDestino, type MensajeLote } from '@/lib/whatsappLotes'
import { textoCambio } from '@/lib/cambiosPlan'
import { registrarActividad } from '@/lib/actividad'
import { bloqueado, registrarFallo } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function contexto(request: Request, materiaId: unknown, seccion: unknown, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const materia = await prisma.materia.findUnique({ where: { id: String(materiaId || '') }, select: { id: true, nombre: true, usuarioId: true } })
  if (!materia) return { error: NextResponse.json({ error: 'Materia no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, materia.usuarioId, modo)
  if (denegado) return { error: denegado }
  const letra = String(seccion || 'A').toUpperCase().slice(0, 3)
  return { actor: actor!, materia, seccion: letra }
}

// Los cambios pendientes, con los datos actuales de cada evaluación (fecha y peso de hoy, no los de cuando se anotó)
async function pendientes(materiaId: string, seccion: string) {
  const lista = await prisma.cambioPlan.findMany({ where: { materiaId, seccion, avisadoEn: null }, orderBy: { createdAt: 'asc' } })
  const ids = lista.map(c => c.evaluacionId).filter(Boolean) as string[]
  const evs = ids.length ? await prisma.evaluacion.findMany({ where: { id: { in: ids } }, select: { id: true, fecha: true, peso: true } }) : []
  const porId = new Map(evs.map(e => [e.id, e]))
  return lista.map(c => {
    const ev = c.evaluacionId ? porId.get(c.evaluacionId) : undefined
    return { id: c.id, tipo: c.tipo, nombre: c.nombre, texto: textoCambio(c, { fecha: ev?.fecha?.toISOString() ?? null, peso: ev?.peso ?? null }) }
  })
}

// GET /api/planificaciones/cambios?materiaId=…&seccion=A — cambios sin avisar, si es la primera publicación y a cuántos llegaría
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams
    const r = await contexto(request, q.get('materiaId'), q.get('seccion'), 'leer')
    if (r.error) return r.error
    const [lista, yaAvisado, alumnos] = await Promise.all([
      pendientes(r.materia.id, r.seccion),
      prisma.cambioPlan.count({ where: { materiaId: r.materia.id, seccion: r.seccion, avisadoEn: { not: null } } }),
      prisma.estudiante.findMany({ where: { usuarioId: r.materia.usuarioId, grupo: r.seccion, estado: 'ACTIVO', ...aceptaAvisos, ...filtroMateria(r.materia.id) }, select: { email: true, telefono: true } }),
    ])
    return NextResponse.json({ cambios: lista, primeraVez: yaAvisado === 0, destinatarios: alumnos.filter(tieneDestino).length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron leer los cambios.' }, { status: 500 })
  }
}

// POST /api/planificaciones/cambios  { materiaId, seccion, nota?, descartar? }
// Envía UN mensaje a cada estudiante de la sección con el resumen de los cambios y los marca como avisados.
// descartar: true → los marca como avisados sin enviar nada (cambios que no vale la pena avisar).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const r = await contexto(request, body.materiaId, body.seccion, 'escribir')
    if (r.error) return r.error
    const lista = await pendientes(r.materia.id, r.seccion)
    if (!lista.length) return NextResponse.json({ error: 'No hay cambios pendientes de avisar.' }, { status: 400 })
    const nota = String(body.nota || '').trim().slice(0, 500)
    const ahora = new Date()
    const marcar = () => prisma.cambioPlan.updateMany({ where: { id: { in: lista.map(c => c.id) } }, data: { avisadoEn: ahora, nota: nota || null } })
    if (body.descartar === true) { await marcar(); return NextResponse.json({ ok: true, enviados: 0 }) }

    const clave = `avisar-cambios:${r.actor.id}`
    if (bloqueado(clave, 15)) return NextResponse.json({ error: 'Enviaste muchos avisos seguidos. Espera unos minutos.' }, { status: 429 })
    const primeraVez = (await prisma.cambioPlan.count({ where: { materiaId: r.materia.id, seccion: r.seccion, avisadoEn: { not: null } } })) === 0
    const todos = await prisma.estudiante.findMany({
      where: { usuarioId: r.materia.usuarioId, grupo: r.seccion, estado: 'ACTIVO', ...aceptaAvisos, ...filtroMateria(r.materia.id) },
      select: { id: true, nombre: true, email: true, telefono: true },
    })
    const estudiantes = todos.filter(tieneDestino)
    // Se marcan aunque no haya a quién escribir: los estudiantes igual los ven en su cuenta
    if (!estudiantes.length) { await marcar(); return NextResponse.json({ ok: true, enviados: 0, aviso: 'Nadie de la sección tiene correo o teléfono para avisar; lo verán al entrar a su cuenta.' }) }

    registrarFallo(clave)
    const asunto = primeraVez ? `Ya está tu plan de evaluación · ${r.materia.nombre}` : `Tu profesor actualizó el plan · ${r.materia.nombre}`
    const lineas = lista.map(c => `• ${c.texto}`).join('\n')
    const enlace = urlAcceso(request)
    const loteId = `C_${r.materia.id}_${r.seccion}_${nuevoId()}`
    const mensajes: MensajeLote[] = []
    const filas: { id: string; loteId: string; usuarioId: string; tipo: string; estudianteId: string; nombre: string; telefono: string }[] = []
    for (const est of estudiantes) {
      const id = nuevoId()
      const destino = destinoDe(est)
      const encabezado = primeraVez ? `Tu profesor(a) ${r.actor.nombre} publicó el plan de evaluación de ${r.materia.nombre} (Sección ${r.seccion}).` : `Tu profesor(a) ${r.actor.nombre} hizo cambios en el plan de ${r.materia.nombre} (Sección ${r.seccion}):`
      mensajes.push({ id, telefono: destino, asunto, texto: `Hola ${primerNombre(est.nombre)} 👋\n${encabezado}\n\n${lineas}${nota ? `\n\n📝 ${nota}` : ''}\n\nMíralo en tu cuenta: ${enlace}` })
      filas.push({ id, loteId, usuarioId: r.materia.usuarioId || r.actor.id, tipo: 'RECORDATORIO', estudianteId: est.id, nombre: est.nombre, telefono: destino })
    }
    await prisma.envioWhatsApp.createMany({ data: filas })
    const envio = await enviarLoteN8n(request, mensajes)
    if (!envio.ok) return NextResponse.json({ error: envio.error || 'No se pudo enviar el aviso.' }, { status: 502 })
    await marcar()
    await registrarActividad({ actor: r.actor, accion: 'EDITAR', entidad: 'Plan', detalle: `${primeraVez ? 'Publicó el plan' : 'Avisó cambios del plan'} a la Sección ${r.seccion} de "${r.materia.nombre}" (${lista.length} cambio(s), ${estudiantes.length} estudiante(s))` }).catch(() => {})
    return NextResponse.json({ ok: true, enviados: estudiantes.length, sinDestino: todos.length - estudiantes.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo enviar el aviso.' }, { status: 500 })
  }
}
