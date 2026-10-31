// Exámenes en línea (servidor): cierre de los que se pasaron de tiempo, corrección y publicación de la nota.
import prisma from '@/lib/prisma'
import { recalcularPromedios, redondearNota } from '@/lib/notas'
import { normalizarExamen, corregirObjetivas, notaDe, esObjetiva, GRACIA_SEG, type Examen, type Correccion } from '@/lib/examen'
import { sugerirCorreccion } from '@/lib/agente/corregir'
import { normalizarRubrica } from '@/lib/rubrica'

type Fila = { id: string; evaluacionId: string; estudianteId: string; limite: Date; entregadoEn: Date | null; respuestas: any; correccion: any; nota: number | null; publicada: boolean; comentario?: string | null }

const rubricaTexto = (r: unknown) => {
  const rub = normalizarRubrica(r)
  return rub ? rub.criterios.map(c => `${c.nombre} (${c.puntos} pts)`).join('; ') : undefined
}

// Si el tiempo del estudiante se acabó y no entregó (cerró la página), se da por entregado con lo que guardó
export async function cerrarSiVencio(f: Fila, examen: Examen): Promise<Fila> {
  if (f.entregadoEn || Date.now() < f.limite.getTime() + GRACIA_SEG * 1000) return f
  const correccion = corregirObjetivas(examen, f.respuestas || {}, (f.correccion as Correccion) || {})
  const nota = notaDe(examen, correccion)
  const act = await prisma.respuestaExamen.update({ where: { id: f.id }, data: { entregadoEn: f.limite, correccion: correccion as any, nota } })
  return act as any
}

// Al entregar: se corrigen solas las objetivas; según el modo, la IA sugiere las abiertas y (modo automático) se publica
export async function procesarEntrega(respuestaId: string): Promise<Fila> {
  const f = await prisma.respuestaExamen.findUnique({
    where: { id: respuestaId },
    include: { evaluacion: { select: { examen: true, rubrica: true, planificacion: { select: { materia: { select: { nombre: true } } } } } } },
  })
  if (!f) throw new Error('No encontrado')
  const examen = normalizarExamen(f.evaluacion.examen)
  if (!examen) throw new Error('La evaluación ya no tiene examen.')
  let correccion = corregirObjetivas(examen, (f.respuestas as any) || {}, (f.correccion as Correccion) || {})
  const hayAbiertas = examen.preguntas.some(p => !esObjetiva(p))
  if (hayAbiertas && examen.modoCorreccion !== 'profesor') {
    try { correccion = { ...correccion, ...(await sugerirCorreccion(examen, (f.respuestas as any) || {}, f.evaluacion.planificacion.materia.nombre, rubricaTexto(f.evaluacion.rubrica))) } }
    catch (e: any) { console.error('[Examen] la IA no pudo corregir:', e?.message || e) } // queda para el profesor
  }
  const nota = notaDe(examen, correccion)
  let fila = await prisma.respuestaExamen.update({ where: { id: f.id }, data: { correccion: correccion as any, nota } }) as any
  if (examen.modoCorreccion === 'automatica' && nota != null) fila = await publicar(fila)
  return fila
}

// La IA vuelve a sugerir las abiertas (sin tocar lo que ya corrigió el profesor)
export async function sugerirOtraVez(respuestaId: string): Promise<Fila> {
  const f = await prisma.respuestaExamen.findUnique({
    where: { id: respuestaId },
    include: { evaluacion: { select: { examen: true, rubrica: true, planificacion: { select: { materia: { select: { nombre: true } } } } } } },
  })
  if (!f) throw new Error('No encontrado')
  const examen = normalizarExamen(f.evaluacion.examen)
  if (!examen) throw new Error('La evaluación ya no tiene examen.')
  const previa = corregirObjetivas(examen, (f.respuestas as any) || {}, (f.correccion as Correccion) || {})
  const ia = await sugerirCorreccion(examen, (f.respuestas as any) || {}, f.evaluacion.planificacion.materia.nombre, rubricaTexto(f.evaluacion.rubrica))
  const correccion: Correccion = { ...previa }
  for (const [id, c] of Object.entries(ia)) if (previa[id]?.fuente !== 'profesor') correccion[id] = c
  const nota = notaDe(examen, correccion)
  return await prisma.respuestaExamen.update({ where: { id: f.id }, data: { correccion: correccion as any, nota } }) as any
}

// Publicar: la nota pasa a Calificaciones (cuenta para el promedio) y el estudiante la ve en su página
export async function publicar(f: Fila): Promise<Fila> {
  if (f.nota == null) throw new Error('Falta corregir alguna pregunta.')
  const puntaje = redondearNota(f.nota)
  const observaciones = (f.comentario || '').trim().slice(0, 500) || null
  await prisma.calificacion.upsert({
    where: { estudianteId_evaluacionId: { estudianteId: f.estudianteId, evaluacionId: f.evaluacionId } },
    create: { estudianteId: f.estudianteId, evaluacionId: f.evaluacionId, puntaje, observaciones },
    update: { puntaje, observaciones },
  })
  const act = await prisma.respuestaExamen.update({ where: { id: f.id }, data: { publicada: true } })
  await prisma.evaluacion.updateMany({ where: { id: f.evaluacionId, estado: { in: ['PROGRAMADA', 'REPROGRAMADA'] } }, data: { estado: 'REALIZADA', estadoEn: new Date() } })
  await recalcularPromedios([f.estudianteId])
  return act as any
}
