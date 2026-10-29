import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'
import { rubricaSugerida, puntosNivel, totalRubrica, type RubricaEval } from '@/lib/rubrica'
import { recalcularPromedios } from '@/lib/notas'
import { tokenDeEstudiante } from '@/lib/portal'

export const maxDuration = 60

// Datos de demostración para presentar la app: una materia de ejemplo con secciones A y B, estudiantes,
// notas con rúbrica, recursos, opiniones, "ya me preparé" y visitas. Todo queda marcado para borrarlo de una vez.
// Los estudiantes de ejemplo NO tienen teléfono: nunca se les envía WhatsApp.
const DOMINIO_DEMO = '@demo.planificador'
const codigoDemo = (usuarioId: string) => `DEMO-${usuarioId}`
const DIA = 86400000

const NOMBRES: Record<string, string[]> = {
  A: ['Daniela Gómez', 'Carlos Rodríguez', 'Ana María Pérez', 'José Hernández', 'Luisa Martínez', 'Pedro Salazar', 'Valentina Rojas', 'Miguel Torres'],
  B: ['Sofía Castillo', 'Andrés Medina', 'Gabriela Díaz', 'Luis Fernández', 'Camila Suárez', 'Diego Morales'],
}
// Nivel de rúbrica por criterio (0 Excelente … 3 Deficiente), variado para que haya notas distintas
const PERFILES = [[0, 0, 1, 0, 0, 1], [1, 2, 2, 1, 2, 2], [0, 1, 0, 0, 1, 0], [2, 3, 2, 2, 3, 2], [1, 1, 1, 0, 1, 1], [3, 2, 3, 3, 2, 3], [0, 0, 0, 1, 0, 0], [1, 2, 1, 1, 1, 2]]
const OPINIONES: (string | null)[] = [null, '¿Se puede mover la exposición una semana? Coincide con el parcial de Cálculo.', null, null, 'Me gustaría que el proyecto final fuera en parejas.', null, null, null]

function notaDe(r: RubricaEval, niveles: number[]): number {
  const total = totalRubrica(r) || 20
  const suma = r.criterios.reduce((t, c, i) => t + puntosNivel(c.puntos, niveles[i % niveles.length]), 0)
  return Math.round((suma / total) * 20 * 100) / 100
}
const aLas = (dias: number, hora: number) => { const d = new Date(Date.now() + dias * DIA); d.setUTCHours(hora + 4, 0, 0, 0); return d } // hora de Caracas (UTC-4)

async function borrarDemo(usuarioId: string) {
  const materias = await prisma.materia.findMany({ where: { usuarioId, codigo: codigoDemo(usuarioId) }, select: { id: true } })
  const est = await prisma.estudiante.findMany({ where: { usuarioId, email: { endsWith: DOMINIO_DEMO } }, select: { id: true } })
  if (materias.length) await prisma.materia.deleteMany({ where: { id: { in: materias.map(m => m.id) } } }) // borra en cascada plan, evaluaciones, notas, opiniones
  if (est.length) await prisma.estudiante.deleteMany({ where: { id: { in: est.map(e => e.id) } } })
  return { materias: materias.length, estudiantes: est.length }
}

// POST /api/demo  { accion: 'crear' | 'borrar' } — solo afecta la cuenta de quien lo usa
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))

    if (body.accion === 'borrar') {
      const r = await borrarDemo(actor.id)
      await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Demo', detalle: `Borró los datos de demostración (${r.estudiantes} estudiantes)` })
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.accion !== 'crear') return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })

    const existe = await prisma.materia.findFirst({ where: { usuarioId: actor.id, codigo: codigoDemo(actor.id) }, select: { id: true } })
    if (existe) return NextResponse.json({ error: 'Ya tienes los datos de demostración. Bórralos primero si quieres crearlos de nuevo.' }, { status: 409 })
    await borrarDemo(actor.id) // por si quedaron estudiantes sueltos de una demo anterior

    const materia = await prisma.materia.create({ data: { nombre: 'Ingeniería de Software (Demo)', codigo: codigoDemo(actor.id), usuarioId: actor.id } })
    const plan = await prisma.planificacion.create({ data: { materiaId: materia.id, fechaExamen: new Date(), duracionMinutos: 90 } })

    const base = [
      { nombre: 'Patrones de diseño', tipoActividad: 'Ensayo', enfoque: 'Teórico', peso: 25, dias: -12, hora: 9, duracion: 90, estado: 'REALIZADA',
        descripcion: 'Ensayo individual de 3 páginas sobre los patrones Singleton, Observer y Strategy:\n- Qué problema resuelve cada uno\n- Un ejemplo de uso real\n- Ventajas y desventajas' },
      { nombre: 'Testing y TDD', tipoActividad: 'Taller práctico', enfoque: 'Práctico', peso: 25, dias: -2, hora: 9, duracion: 120, estado: 'REALIZADA',
        descripcion: 'Taller en el laboratorio: escribir pruebas unitarias primero y luego el código (ciclo rojo-verde-refactor) para una calculadora de notas.' },
      { nombre: 'Arquitectura de Microservicios', tipoActividad: 'Exposición grupal', enfoque: 'Práctico', peso: 25, dias: 3, hora: 10, duracion: 20, estado: 'PROGRAMADA', grupos: 3, porGrupo: 4,
        descripcion: 'En grupos de 4, presentarán una arquitectura de microservicios para un caso real:\n- Diagrama de servicios\n- Comunicación entre servicios\n- Ventajas y desventajas frente a un monolito',
        recursos: [
          { titulo: 'Microservicios — Martin Fowler', url: 'https://martinfowler.com/articles/microservices.html' },
          { titulo: 'Estilo de arquitectura de microservicios — Microsoft Learn', url: 'https://learn.microsoft.com/es-es/azure/architecture/guide/architecture-styles/microservices' },
          { titulo: 'draw.io (para el diagrama)', url: 'https://www.drawio.com/' },
        ] },
      { nombre: 'Proyecto final: despliegue con Docker', tipoActividad: 'Proyecto', enfoque: 'Práctico', peso: 25, dias: 20, hora: 8, duracion: 30, estado: 'PROGRAMADA',
        descripcion: 'Contenerizar y desplegar la aplicación del curso con Docker y docker-compose. Se entrega el repositorio y una demo en vivo.' },
    ]

    let orden = 0
    const evaluaciones: Record<string, { id: string; rubrica: RubricaEval | null }[]> = { A: [], B: [] }
    for (const seccion of ['A', 'B']) {
      for (const [i, e] of base.entries()) {
        const rubrica = rubricaSugerida({ nombre: e.nombre, tipoActividad: e.tipoActividad, cantidadGrupos: (e as any).grupos ?? null })
        const creada = await prisma.evaluacion.create({
          data: {
            planificacionId: plan.id, nombre: `Evaluación ${i + 1}: ${e.nombre}`, tipoPregunta: 'DESARROLLO', nivelBloom: 'APLICAR',
            peso: e.peso, tiempoEstimadoMinutos: e.duracion, tipoActividad: e.tipoActividad, enfoque: e.enfoque, descripcion: e.descripcion,
            cantidadGrupos: (e as any).grupos ?? null, personasPorGrupo: (e as any).porGrupo ?? null, orden: orden++, grupoSeccion: seccion,
            fecha: aLas(e.dias + (seccion === 'B' ? 1 : 0), e.hora), estado: e.estado, estadoEn: e.estado === 'REALIZADA' ? new Date() : null,
            rubrica: rubrica as any, recursos: ((e as any).recursos ?? undefined) as any,
          } as any,
          select: { id: true },
        })
        evaluaciones[seccion].push({ id: creada.id, rubrica })
      }
    }

    const ahora = Date.now()
    let indice = 0
    const creados: string[] = []
    for (const seccion of ['A', 'B']) {
      for (const [k, nombre] of NOMBRES[seccion].entries()) {
        const usuarioEmail = `${nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '.')}${DOMINIO_DEMO}`
        const visto = k % 4 !== 3 // 3 de cada 4 abrieron su página
        const est = await prisma.estudiante.create({
          data: {
            nombre, email: usuarioEmail, telefono: null, grupo: seccion, usuarioId: actor.id,
            ...(visto ? { portalVisitas: 1 + (k % 3), portalPrimeraVisita: new Date(ahora - (5 + k) * DIA), portalUltimaVisita: new Date(ahora - (k % 3) * DIA - k * 3600000) } : {}),
          } as any,
          select: { id: true },
        })
        creados.push(est.id)
        await tokenDeEstudiante(est.id) // ya tiene su enlace listo para "ver su página"

        // Nota de la evaluación 1 (con rúbrica); la 2 ya se hizo pero aún no tiene nota
        const ev1 = evaluaciones[seccion][0]
        const niveles = PERFILES[indice % PERFILES.length]
        await prisma.calificacion.create({
          data: {
            estudianteId: est.id, evaluacionId: ev1.id, puntaje: notaDe(ev1.rubrica!, niveles),
            detalle: ev1.rubrica!.criterios.map((_, i) => niveles[i % niveles.length]) as any,
            observaciones: indice % 3 === 0 ? 'Buen análisis. Cuida las citas en formato APA.' : null,
          } as any,
        })
        // "Ya me preparé" para la exposición: más o menos la mitad
        if (k % 2 === 0) await prisma.preparacionEvaluacion.create({ data: { estudianteId: est.id, evaluacionId: evaluaciones[seccion][2].id } })
        // Opiniones sobre el plan (algunos no opinan)
        if (k % 4 !== 3) {
          const comentario = OPINIONES[indice % OPINIONES.length]
          await prisma.opinionPlan.create({ data: { estudianteId: est.id, materiaId: materia.id, deAcuerdo: !comentario, comentario, leida: indice > 3 } })
        }
        indice++
      }
    }
    await recalcularPromedios(creados)
    await prisma.planificacion.update({ where: { id: plan.id }, data: { duracionMinutos: 90 } }) // la deja como la más reciente
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Demo', detalle: `Creó datos de demostración (${creados.length} estudiantes, 8 evaluaciones)` })
    return NextResponse.json({ ok: true, estudiantes: creados.length, evaluaciones: 8 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron crear los datos de demostración. Si ya ejecutaste "npx prisma db push", intenta de nuevo.' }, { status: 500 })
  }
}
