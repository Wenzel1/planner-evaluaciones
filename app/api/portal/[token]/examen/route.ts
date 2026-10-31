import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TOKEN_VALIDO } from '@/lib/portal'
import { normalizarExamen, examenParaEstudiante, ventanaExamen, limiteEstudiante, GRACIA_SEG, type Correccion } from '@/lib/examen'
import { cerrarSiVencio, procesarEntrega } from '@/lib/examenServidor'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const cuando = (d: Date) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(d)
const no = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

// Estudiante y evaluación (solo de SU profesor y de SU sección, con examen adjunto)
async function cargar(token: string, evaluacionId: string) {
  if (!TOKEN_VALIDO.test(token)) return { error: no('Enlace no válido.', 404) }
  const est = await prisma.estudiante.findUnique({ where: { enlaceToken: token }, select: { id: true, estado: true, usuarioId: true, grupo: true } })
  if (!est || est.estado !== 'ACTIVO' || !est.usuarioId) return { error: no('Enlace no válido.', 404) }
  const ev = await prisma.evaluacion.findFirst({
    where: { id: evaluacionId, grupoSeccion: est.grupo || 'A', estado: { not: 'CANCELADA' }, planificacion: { materia: { usuarioId: est.usuarioId } } },
    select: { id: true, fecha: true, examen: true },
  })
  const examen = ev ? normalizarExamen(ev.examen) : null
  if (!ev || !examen) return { error: no('Esta evaluación no tiene examen en línea.', 404) }
  return { est, ev, examen }
}

// Resultado para mostrar al estudiante (solo cuando la nota está publicada)
function resultado(examen: ReturnType<typeof normalizarExamen> & {}, f: any, cerrado: boolean) {
  if (!f?.publicada) return null
  const c = (f.correccion || {}) as Correccion
  return {
    nota: f.nota, comentario: f.comentario || null,
    preguntas: examen.preguntas.map(p => ({
      id: p.id, puntos: p.puntos, obtenidos: c[p.id]?.puntos ?? null, comentario: c[p.id]?.comentario || null,
      // La respuesta correcta se muestra cuando ya cerró el examen para todos (así no se pasa a quien no lo ha presentado)
      correcta: cerrado && (p.tipo === 'seleccion' || p.tipo === 'vf') ? p.correcta : undefined,
    })),
  }
}

// GET /api/portal/:token/examen?evaluacionId= — estado del examen (y el examen, si ya lo empezó)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const r = await cargar(token, String(new URL(request.url).searchParams.get('evaluacionId') || ''))
    if ('error' in r) return r.error
    const { est, ev, examen } = r
    const { abre, cierra } = ventanaExamen(examen, ev.fecha)
    let f: any = await prisma.respuestaExamen.findUnique({ where: { estudianteId_evaluacionId: { estudianteId: est.id, evaluacionId: ev.id } } })
    if (f) f = await cerrarSiVencio(f, examen)
    const ahora = Date.now()
    const cerrado = !!cierra && ahora > cierra.getTime() + examen.duracionMin * 60000
    const estado = f?.entregadoEn ? 'entregado' : f ? 'en_curso' : !abre ? 'sin_fecha' : ahora < abre.getTime() ? 'bloqueado' : cierra && ahora > cierra.getTime() ? 'cerrado' : 'disponible'
    return NextResponse.json({
      estado, abre, cierra, duracionMin: examen.duracionMin, preguntas: examen.preguntas.length, tipo: examen.tipo,
      ...(estado === 'en_curso' ? { examen: examenParaEstudiante(examen), respuestas: f.respuestas || {}, limite: f.limite, ahora: new Date().toISOString() } : {}),
      ...(estado === 'entregado' ? { entregadoEn: f.entregadoEn, resultado: resultado(examen, f, cerrado) } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error(e)
    return no('No se pudo cargar el examen.', 500)
  }
}

// POST /api/portal/:token/examen  { evaluacionId, accion: 'iniciar' | 'guardar' | 'entregar', respuestas? }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const r = await cargar(token, String(body.evaluacionId || ''))
    if ('error' in r) return r.error
    const { est, ev, examen } = r
    const ahora = new Date()
    const clave = { estudianteId_evaluacionId: { estudianteId: est.id, evaluacionId: ev.id } }
    let f: any = await prisma.respuestaExamen.findUnique({ where: clave })

    if (body.accion === 'iniciar') {
      if (!f) {
        const { abre, cierra } = ventanaExamen(examen, ev.fecha)
        if (!abre) return no('El examen todavía no tiene fecha.', 403)
        if (ahora < abre) return no(`El examen se abre el ${cuando(abre).replace(/\.$/, '')}.`, 403)
        if (cierra && ahora > cierra) return no('El tiempo para empezar este examen ya pasó. Habla con tu profesor.', 403)
        try {
          f = await prisma.respuestaExamen.create({ data: { evaluacionId: ev.id, estudianteId: est.id, inicio: ahora, limite: limiteEstudiante(examen, ahora), respuestas: {} } })
        } catch (e: any) {
          if (e?.code !== 'P2002') throw e
          f = await prisma.respuestaExamen.findUnique({ where: clave }) // abrió dos pestañas a la vez
        }
      }
      f = await cerrarSiVencio(f, examen)
      if (f.entregadoEn) return no('Ya entregaste este examen.', 409)
      return NextResponse.json({ examen: examenParaEstudiante(examen), respuestas: f.respuestas || {}, limite: f.limite, ahora: ahora.toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (body.accion === 'guardar' || body.accion === 'entregar') {
      if (!f) return no('Primero empieza el examen.', 400)
      if (f.entregadoEn) return no('Ya entregaste este examen.', 409)
      const vencido = ahora.getTime() > f.limite.getTime() + GRACIA_SEG * 1000
      // Solo respuestas de preguntas que existen, con largo razonable
      const ids = new Set(examen.preguntas.map(p => p.id))
      const nuevas: Record<string, any> = {}
      for (const [k, v] of Object.entries(body.respuestas && typeof body.respuestas === 'object' ? body.respuestas : {})) {
        if (!ids.has(k)) continue
        nuevas[k] = typeof v === 'string' ? v.slice(0, 20000) : typeof v === 'number' || typeof v === 'boolean' ? v : null
      }
      const respuestas = vencido ? (f.respuestas || {}) : { ...(f.respuestas || {}), ...nuevas } // pasado el tiempo ya no se cambia nada
      if (body.accion === 'guardar' && !vencido) {
        await prisma.respuestaExamen.update({ where: { id: f.id }, data: { respuestas } })
        return NextResponse.json({ ok: true, guardado: ahora.toISOString() })
      }
      await prisma.respuestaExamen.update({ where: { id: f.id }, data: { respuestas, entregadoEn: vencido ? f.limite : ahora } })
      const fila = await procesarEntrega(f.id).catch((e) => { console.error('[Examen] al procesar la entrega:', e); return null })
      return NextResponse.json({ ok: true, entregado: true, tarde: vencido, publicada: !!fila?.publicada, nota: fila?.publicada ? fila.nota : null })
    }
    return no('Acción no válida.')
  } catch (e) {
    console.error(e)
    return no('No se pudo guardar. Revisa tu conexión e intenta de nuevo.', 500)
  }
}
