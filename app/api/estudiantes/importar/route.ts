import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, bloquearSiSuperadmin } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

const MAX_FILAS = 500
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GRUPOS = ['A', 'B', 'C', 'D']

// POST /api/estudiantes/importar  { estudiantes: [{ nombre, email, telefono, grupo }] }
// Misma validación que al crear uno por uno. Las filas inválidas o repetidas se omiten y se informa el motivo.
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const bloqueado = bloquearSiSuperadmin(actor)
    if (bloqueado) return bloqueado

    const body = await request.json()
    const filas: any[] | null = Array.isArray(body.estudiantes) ? body.estudiantes : null
    if (!filas || filas.length === 0) return NextResponse.json({ error: 'No hay estudiantes para importar.' }, { status: 400 })
    if (filas.length > MAX_FILAS) return NextResponse.json({ error: `Máximo ${MAX_FILAS} estudiantes por importación.` }, { status: 400 })

    const omitidos: { fila: number; motivo: string }[] = []
    const vistos = new Set<string>()
    const validos: { fila: number; nombre: string; email: string; telefono: string; grupo: string }[] = []

    filas.forEach((f, i) => {
      const fila = i + 1
      const nombre = String(f?.nombre ?? '').trim()
      const email = String(f?.email ?? '').trim().toLowerCase()
      const telefono = String(f?.telefono ?? '').trim()
      const grupo = String(f?.grupo ?? '').trim().toUpperCase() || 'A'

      let motivo = ''
      if (nombre.length < 3) motivo = 'El nombre debe tener al menos 3 caracteres.'
      else if (!EMAIL.test(email)) motivo = 'El correo electrónico no es válido.'
      else if (telefono.length < 7) motivo = 'El teléfono debe tener al menos 7 dígitos.'
      else if (!GRUPOS.includes(grupo)) motivo = 'Grupo no válido (usa A, B, C o D).'
      else if (vistos.has(email)) motivo = 'Correo repetido dentro del archivo.'

      if (motivo) { omitidos.push({ fila, motivo }); return }
      vistos.add(email)
      validos.push({ fila, nombre, email, telefono, grupo })
    })

    // Los que el profesor ya tiene registrados
    const existentes = validos.length
      ? await prisma.estudiante.findMany({ where: { usuarioId: actor.id, email: { in: validos.map((v) => v.email) } }, select: { email: true } })
      : []
    const yaTiene = new Set(existentes.map((e) => e.email))
    const nuevos = validos.filter((v) => {
      if (yaTiene.has(v.email)) { omitidos.push({ fila: v.fila, motivo: 'Ya tienes un estudiante con ese correo.' }); return false }
      return true
    })

    let creados = 0
    if (nuevos.length > 0) {
      const r = await prisma.estudiante.createMany({
        data: nuevos.map(({ fila, ...d }) => ({ ...d, estado: 'ACTIVO' as const, usuarioId: actor.id })),
        skipDuplicates: true,
      })
      creados = r.count
    }
    if (creados > 0) await registrarActividad({ actor, accion: 'CREAR', entidad: 'Estudiante', detalle: `Importó ${creados} estudiante(s) desde un archivo CSV` })

    omitidos.sort((a, b) => a.fila - b.fila)
    return NextResponse.json({ creados, omitidos })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al importar estudiantes.' }, { status: 500 })
  }
}
