// Consultas que el agente hace POR SU CUENTA (solo lectura): se ejecutan en el servidor y el resultado
// vuelve al modelo para que siga respondiendo. Siempre limitadas a los datos del profesor que pregunta.
import prisma from '@/lib/prisma'
import { promedioPonderado, textoNota, NOTA_APROBATORIA } from '@/lib/notas'

export interface ContextoConsulta {
  usuarioId: string
  planId: string | null
  materiaId: string | null
  seccion: string
  evaluaciones: { numero: number; id?: string; nombre: string }[] // las de la sección activa, en el orden que ve el profesor
}

const ZONA = process.env.ZONA_HORARIA || 'America/Caracas'
const dia = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' }).format(d) : 'sin fecha')
const limpio = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*)+/i, '').trim()
const normal = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

// Mismo criterio que la app: exacto, o que tenga todas las palabras dichas
function buscar<T extends { nombre: string }>(lista: T[], nombre: string): T[] {
  const n = normal(nombre); if (!n) return []
  const exactos = lista.filter(x => normal(x.nombre) === n)
  if (exactos.length) return exactos
  const palabras = n.split(' ')
  return lista.filter(x => { const pm = normal(x.nombre).split(' '); return palabras.every(p => pm.some(w => w === p || (p.length >= 4 && w.startsWith(p)))) })
}

export const TIPOS_CONSULTA = ['estudiante', 'notas_evaluacion', 'seccion', 'envios_whatsapp', 'opiniones', 'materias'] as const

export function describirConsulta(a: any): string {
  switch (a?.que) {
    case 'estudiante': return `historial de ${a.nombre || 'un estudiante'}`
    case 'notas_evaluacion': return `notas de la evaluación #${a.evaluacion ?? '?'}`
    case 'seccion': return `la Sección ${String(a.seccion || '?').toUpperCase()}`
    case 'envios_whatsapp': return 'los envíos de WhatsApp'
    case 'opiniones': return 'las opiniones de los estudiantes'
    case 'materias': return 'tus materias'
    default: return 'datos'
  }
}

export async function ejecutarConsulta(c: ContextoConsulta, a: any): Promise<string> {
  try {
    switch (a?.que) {
      case 'estudiante': return await consultaEstudiante(c, String(a.nombre || ''))
      case 'notas_evaluacion': return await consultaNotas(c, Number(a.evaluacion))
      case 'seccion': return await consultaSeccion(c, String(a.seccion || '').toUpperCase())
      case 'envios_whatsapp': return await consultaEnvios(c)
      case 'opiniones': return await consultaOpiniones(c)
      case 'materias': return await consultaMaterias(c)
      default: return 'Consulta no reconocida.'
    }
  } catch (e: any) {
    console.error('[Chat] consulta falló:', e?.message || e)
    return 'No se pudo leer ese dato en este momento.'
  }
}

async function consultaEstudiante(c: ContextoConsulta, nombre: string): Promise<string> {
  const todos = await prisma.estudiante.findMany({ where: { usuarioId: c.usuarioId }, select: { id: true, nombre: true, grupo: true } })
  const hallados = buscar<{ id: string; nombre: string; grupo: string }>(todos, nombre)
  if (hallados.length === 0) return `No hay ningún estudiante llamado «${nombre}».`
  if (hallados.length > 1) return `Hay ${hallados.length} estudiantes con ese nombre: ${hallados.slice(0, 8).map(e => `${e.nombre} (sec. ${e.grupo})`).join(', ')}. Pregunta cuál.`
  const e = await prisma.estudiante.findUnique({
    where: { id: hallados[0].id },
    select: {
      nombre: true, grupo: true, estado: true, telefono: true, promedio: true, portalVisitas: true, portalUltimaVisita: true,
      calificaciones: { select: { puntaje: true, observaciones: true, evaluacion: { select: { nombre: true, peso: true, fecha: true, estado: true, grupoSeccion: true, planificacion: { select: { materia: { select: { nombre: true } } } } } } } },
      opiniones: { select: { deAcuerdo: true, comentario: true, materia: { select: { nombre: true } } } },
      preparaciones: { select: { evaluacion: { select: { nombre: true } } } },
    },
  })
  if (!e) return 'No encontrado.'
  const l: string[] = [`${e.nombre} · sección ${e.grupo} · ${e.estado === 'ACTIVO' ? 'activo' : 'retirado'} · ${(e.telefono || '').replace(/\D/g, '').length >= 7 ? 'tiene WhatsApp' : 'SIN teléfono'}`]
  l.push(e.portalVisitas ? `Abrió su página ${e.portalVisitas} vez/veces (última: ${dia(e.portalUltimaVisita)}).` : 'Nunca ha abierto su página personal.')
  const notas = e.calificaciones.filter(n => n.puntaje != null)
  if (notas.length) {
    l.push(`Notas (promedio ponderado ${textoNota(promedioPonderado(notas.filter(n => n.evaluacion.estado !== 'CANCELADA').map(n => ({ puntaje: n.puntaje as number, peso: n.evaluacion.peso }))))}/20):`)
    for (const n of notas) l.push(`- ${limpio(n.evaluacion.nombre)} (${n.evaluacion.planificacion.materia.nombre}, ${n.evaluacion.peso ?? '?'}%, ${dia(n.evaluacion.fecha)}): ${textoNota(n.puntaje as number)}${(n.puntaje as number) < NOTA_APROBATORIA ? ' ✗' : ''}${n.observaciones ? ` — "${n.observaciones.slice(0, 120)}"` : ''}`)
  } else l.push('Todavía no tiene notas.')
  if (e.preparaciones.length) l.push(`Marcó "ya me preparé" en: ${e.preparaciones.map(p => limpio(p.evaluacion.nombre)).join(', ')}.`)
  for (const o of e.opiniones) l.push(`Opinión sobre ${o.materia.nombre}: ${o.deAcuerdo ? 'de acuerdo con el plan' : 'sugiere cambios'}${o.comentario ? ` — "${o.comentario.slice(0, 200)}"` : ''}`)
  return l.join('\n')
}

async function consultaNotas(c: ContextoConsulta, numero: number): Promise<string> {
  const ev = c.evaluaciones.find(e => e.numero === numero)
  if (!ev?.id) return `No existe la evaluación #${numero} en la Sección ${c.seccion} (o todavía no se guardó).`
  const datos = await prisma.evaluacion.findFirst({
    where: { id: ev.id, planificacion: { materia: { usuarioId: c.usuarioId } } },
    select: { nombre: true, grupoSeccion: true, estado: true, calificaciones: { select: { estudianteId: true, puntaje: true, observaciones: true } } },
  })
  if (!datos) return 'Esa evaluación no está guardada todavía.'
  const alumnos = await prisma.estudiante.findMany({ where: { usuarioId: c.usuarioId, grupo: datos.grupoSeccion, estado: 'ACTIVO' }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } })
  const porId = new Map<string, { puntaje: number | null; observaciones: string | null }>(datos.calificaciones.map(n => [n.estudianteId, n]))
  const con = alumnos.filter(a => porId.get(a.id)?.puntaje != null)
  const sin = alumnos.filter(a => porId.get(a.id)?.puntaje == null)
  const valores = con.map(a => porId.get(a.id)!.puntaje as number)
  const l = [`#${numero} ${limpio(datos.nombre)} (${datos.estado.toLowerCase()}): ${con.length} con nota, ${sin.length} sin nota.`]
  if (valores.length) {
    l.push(`Promedio ${textoNota(Math.round(valores.reduce((t, v) => t + v, 0) / valores.length * 100) / 100)} · aprobados ${valores.filter(v => v >= NOTA_APROBATORIA).length} · máx ${textoNota(Math.max(...valores))} · mín ${textoNota(Math.min(...valores))}`)
    l.push(con.map(a => `${a.nombre}: ${textoNota(porId.get(a.id)!.puntaje as number)}`).join('; '))
  }
  if (sin.length) l.push(`Sin nota: ${sin.map(a => a.nombre).join(', ')}`)
  return l.join('\n')
}

async function consultaSeccion(c: ContextoConsulta, sec: string): Promise<string> {
  if (!/^[A-Z]$/.test(sec)) return 'Indica la letra de la sección.'
  const [evs, alumnos] = await Promise.all([
    c.planId ? prisma.evaluacion.findMany({ where: { planificacionId: c.planId, grupoSeccion: sec }, orderBy: [{ orden: 'asc' }], select: { nombre: true, peso: true, fecha: true, estado: true, tipoActividad: true, calificaciones: { where: { puntaje: { not: null } }, select: { puntaje: true } } } }) : Promise.resolve([]),
    prisma.estudiante.findMany({ where: { usuarioId: c.usuarioId, grupo: sec, estado: 'ACTIVO' }, select: { nombre: true, portalVisitas: true } }),
  ])
  const l = [`Sección ${sec}: ${alumnos.length} estudiantes activos (${alumnos.filter(a => !a.portalVisitas).length} sin abrir su página).`]
  if (!evs.length) l.push('No tiene evaluaciones en este plan.')
  evs.forEach((e, i) => {
    const notas = e.calificaciones.map(n => n.puntaje as number)
    l.push(`#${i + 1} ${limpio(e.nombre)} · ${e.tipoActividad || ''} · ${e.peso ?? '?'}% · ${dia(e.fecha)} · ${e.estado.toLowerCase()}${notas.length ? ` · promedio ${textoNota(Math.round(notas.reduce((t, v) => t + v, 0) / notas.length * 100) / 100)} (${notas.length} notas)` : ''}`)
  })
  return l.join('\n')
}

async function consultaEnvios(c: ContextoConsulta): Promise<string> {
  const envios = await prisma.envioWhatsApp.findMany({ where: { usuarioId: c.usuarioId }, orderBy: { createdAt: 'desc' }, take: 60, select: { tipo: true, nombre: true, estado: true, error: true, createdAt: true } })
  if (!envios.length) return 'No hay envíos de WhatsApp registrados.'
  const cuenta = (est: string) => envios.filter(e => e.estado === est).length
  const l = [`Últimos ${envios.length} mensajes: ${cuenta('ENVIADO')} enviados, ${cuenta('PENDIENTE')} pendientes, ${cuenta('FALLIDO')} fallidos.`]
  const fallidos = envios.filter(e => e.estado === 'FALLIDO').slice(0, 12)
  if (fallidos.length) l.push('Fallidos: ' + fallidos.map(f => `${f.nombre} (${f.tipo.toLowerCase()}, ${dia(f.createdAt)}): ${String(f.error || '').slice(0, 80)}`).join('; '))
  return l.join('\n')
}

async function consultaOpiniones(c: ContextoConsulta): Promise<string> {
  if (!c.materiaId) return 'Guarda el plan primero.'
  const ops = await prisma.opinionPlan.findMany({ where: { materiaId: c.materiaId }, orderBy: { updatedAt: 'desc' }, take: 40, select: { deAcuerdo: true, comentario: true, leida: true, estudiante: { select: { nombre: true, grupo: true } } } })
  if (!ops.length) return 'Ningún estudiante ha opinado todavía.'
  return [`${ops.length} opiniones: ${ops.filter(o => o.deAcuerdo).length} de acuerdo, ${ops.filter(o => !o.deAcuerdo).length} sugieren cambios.`,
    ...ops.filter(o => o.comentario).map(o => `- ${o.estudiante.nombre} (sec. ${o.estudiante.grupo})${o.leida ? '' : ' [nueva]'}: ${o.deAcuerdo ? '👍' : '✏️'} "${String(o.comentario).slice(0, 200)}"`)].join('\n')
}

async function consultaMaterias(c: ContextoConsulta): Promise<string> {
  const ms = await prisma.materia.findMany({
    where: { usuarioId: c.usuarioId }, orderBy: { nombre: 'asc' },
    select: { nombre: true, planificaciones: { orderBy: { updatedAt: 'desc' }, take: 1, select: { evaluaciones: { select: { grupoSeccion: true, estado: true } } } } },
  })
  if (!ms.length) return 'No tiene materias guardadas.'
  return ms.map(m => {
    const evs = m.planificaciones[0]?.evaluaciones || []
    const secs = [...new Set(evs.map(e => e.grupoSeccion))].sort()
    return `- ${m.nombre}: ${evs.length} evaluaciones${secs.length ? ` (secciones ${secs.join(', ')})` : ''}, ${evs.filter(e => e.estado === 'REALIZADA').length} realizadas`
  }).join('\n')
}
