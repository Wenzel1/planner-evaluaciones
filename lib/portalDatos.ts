// Arma lo que ve un estudiante en su página personal (solo SUS datos y solo lo de su sección).
import prisma from '@/lib/prisma'
import { normalizarRubrica } from '@/lib/rubrica'
import { estaAbierta, normalizarRecursos, TOKEN_VALIDO } from '@/lib/portal'
import { promedioPonderado } from '@/lib/notas'

const limpiarNombre = (n: string) => String(n || '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim() || 'Evaluación'

export async function datosPortal(token: string) {
  if (!TOKEN_VALIDO.test(token)) return null
  const est = await prisma.estudiante.findUnique({
    where: { enlaceToken: token },
    select: { id: true, nombre: true, grupo: true, estado: true, usuarioId: true, usuario: { select: { nombre: true, activo: true } } },
  })
  if (!est || est.estado !== 'ACTIVO' || !est.usuarioId || est.usuario?.activo === false) return null
  const grupo = est.grupo || 'A'

  const materias = await prisma.materia.findMany({
    where: { usuarioId: est.usuarioId },
    select: {
      id: true, nombre: true,
      opiniones: { where: { estudianteId: est.id }, select: { deAcuerdo: true, comentario: true, updatedAt: true } },
      planificaciones: {
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          evaluaciones: {
            where: { grupoSeccion: grupo, estado: { not: 'CANCELADA' } },
            orderBy: [{ fecha: 'asc' }, { orden: 'asc' }],
            select: {
              id: true, nombre: true, tipoActividad: true, enfoque: true, peso: true, fecha: true, tiempoEstimadoMinutos: true,
              cantidadGrupos: true, personasPorGrupo: true, estado: true, abiertaManual: true, descripcion: true, recursos: true, rubrica: true,
              calificaciones: { where: { estudianteId: est.id }, select: { puntaje: true, observaciones: true, detalle: true } },
            },
          },
        },
      },
    },
  })

  const ahora = Date.now()
  const lista = materias
    .map(m => ({ m, plan: m.planificaciones.find(p => p.evaluaciones.length > 0) })) // el plan más reciente con evaluaciones de su sección
    .filter(x => x.plan)
    .map(({ m, plan }) => {
      const evaluaciones = plan!.evaluaciones.map(ev => {
        const { abierta, abreEl } = estaAbierta({ fecha: ev.fecha, estado: ev.estado, abiertaManual: ev.abiertaManual }, ahora)
        const nota = ev.calificaciones[0]
        return {
          id: ev.id, nombre: limpiarNombre(ev.nombre), tipoActividad: ev.tipoActividad, enfoque: ev.enfoque, peso: ev.peso,
          fecha: ev.fecha, duracion: ev.tiempoEstimadoMinutos, cantidadGrupos: ev.cantidadGrupos, personasPorGrupo: ev.personasPorGrupo,
          estado: ev.estado, abierta, abreEl,
          descripcion: abierta ? ev.descripcion : null,
          recursos: abierta ? normalizarRecursos(ev.recursos) ?? [] : [],
          rubrica: abierta ? normalizarRubrica(ev.rubrica) : null,
          nota: nota && nota.puntaje != null ? { puntaje: nota.puntaje, observaciones: nota.observaciones, detalle: Array.isArray(nota.detalle) ? nota.detalle : null } : null,
        }
      })
      const conNota = evaluaciones.filter(e => e.nota)
      return {
        id: m.id, nombre: m.nombre, evaluaciones,
        opinion: m.opiniones[0] ? { deAcuerdo: m.opiniones[0].deAcuerdo, comentario: m.opiniones[0].comentario, fecha: m.opiniones[0].updatedAt } : null,
        promedio: conNota.length ? promedioPonderado(conNota.map(e => ({ puntaje: e.nota!.puntaje, peso: e.peso }))) : null,
      }
    })

  return {
    estudiante: { nombre: est.nombre, seccion: grupo },
    profesor: est.usuario?.nombre || 'Profesor',
    materias: lista,
    generado: new Date(ahora).toISOString(),
  }
}
