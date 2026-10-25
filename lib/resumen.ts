// lib/resumen.ts
// Arma el resumen que ven los ADMIN / SUPERADMIN en el Dashboard: trabajo de cada profesor + totales del sistema.
// Función pura (sin base de datos) para poder probarla fácilmente.
// Se toma solo la planificación MÁS RECIENTE de cada materia, igual que hace el planificador.

export interface UsuarioBase { id: string; nombre: string; email: string; rol: string; activo: boolean; pendiente: boolean; createdAt: Date }
export interface EvaluacionBase { id: string; nombre: string; peso: number | null; tipoActividad: string | null; fecha: Date | null; tiempoEstimadoMinutos: number | null; grupoSeccion: string; descripcion: string | null; enfoque: string | null; nivelBloom: string | null; cantidadGrupos: number | null; personasPorGrupo: number | null }
export interface PlanificacionBase { fechaExamen: Date; updatedAt: Date; evaluaciones: EvaluacionBase[] }
export interface ObservacionBase { id: string; autorNombre: string; evaluacionNombre: string | null; mensaje: string; leida: boolean; createdAt: Date }
export interface MateriaBase { id: string; nombre: string; usuarioId: string | null; planificaciones: PlanificacionBase[]; observaciones?: ObservacionBase[] } // planificaciones: la más reciente primero
export interface GrupoEstudiantes { usuarioId: string | null; total: number }

export function construirResumen(usuarios: UsuarioBase[], materias: MateriaBase[], grupos: GrupoEstudiantes[]) {
  const estudiantes = new Map<string | null, number>(grupos.map((g) => [g.usuarioId, g.total]))

  const detalle = (m: MateriaBase) => {
    const plan = m.planificaciones[0]
    return {
      id: m.id,
      nombre: m.nombre,
      fechaExamen: plan?.fechaExamen ?? null,
      ultimaActividad: plan?.updatedAt ?? null,
      evaluaciones: plan?.evaluaciones ?? [],
      observaciones: m.observaciones ?? [],
    }
  }

  const usuariosConTrabajo = usuarios.map((u) => {
    const mats = materias.filter((m) => m.usuarioId === u.id).map(detalle)
    const fechas = mats.map((m) => m.ultimaActividad).filter((f): f is Date => f !== null)
    fechas.sort((a, b) => b.getTime() - a.getTime())
    return {
      ...u,
      materias: mats,
      totalMaterias: mats.length,
      totalEvaluaciones: mats.reduce((acc, m) => acc + m.evaluaciones.length, 0),
      totalEstudiantes: estudiantes.get(u.id) ?? 0,
      ultimaActividad: fechas[0] ?? null,
    }
  })

  const huerfanas = materias.filter((m) => m.usuarioId === null).map(detalle)
  const sinDueno = {
    materias: huerfanas.length,
    evaluaciones: huerfanas.reduce((acc, m) => acc + m.evaluaciones.length, 0),
    estudiantes: estudiantes.get(null) ?? 0,
  }

  // Las cuentas pendientes de aprobación se cuentan aparte (no inflan los conteos por rol)
  const aprobadas = usuarios.filter((u) => !u.pendiente)
  const cuentas = {
    SUPERADMIN: aprobadas.filter((u) => u.rol === 'SUPERADMIN').length,
    ADMIN: aprobadas.filter((u) => u.rol === 'ADMIN').length,
    USUARIO: aprobadas.filter((u) => u.rol === 'USUARIO').length,
    desactivadas: aprobadas.filter((u) => !u.activo).length,
    pendientes: usuarios.filter((u) => u.pendiente).length,
  }

  return {
    totales: {
      cuentas,
      materias: materias.length,
      evaluaciones: usuariosConTrabajo.reduce((acc, u) => acc + u.totalEvaluaciones, 0) + sinDueno.evaluaciones,
      estudiantes: grupos.reduce((acc, g) => acc + g.total, 0),
    },
    usuarios: usuariosConTrabajo,
    sinDueno,
  }
}
