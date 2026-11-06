import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { requerirActor } from '@/lib/permisos'
import { registrarActividad } from '@/lib/actividad'

// Estudiantes de prueba: nombres de ejemplo con correos @demo.planificador, que la app NUNCA usa para enviar
// (ver destinoDe en lib/whatsappLotes.ts). Sirven para probar evaluaciones en grupo, notas y la página del estudiante
// sin gastar correos. Para probar los correos, el profesor se agrega a sí mismo con su correo real.
const DOMINIO = '@demo.planificador'
const NOMBRES = ['Ana', 'Luis', 'María', 'José', 'Carla', 'Pedro', 'Rosa', 'Iván', 'Elena', 'Raúl', 'Sofía', 'Miguel', 'Valentina', 'Andrés', 'Camila', 'Diego', 'Gabriela', 'Javier', 'Daniela', 'Carlos', 'Isabel', 'Ricardo', 'Paola', 'Fernando', 'Lucía', 'Alejandro', 'Mariana', 'Jorge', 'Victoria', 'Samuel']
const APELLIDOS = ['Pérez', 'González', 'Rodríguez', 'Hernández', 'García', 'Martínez', 'López', 'Díaz', 'Sánchez', 'Ramírez', 'Torres', 'Rojas', 'Morales', 'Castillo', 'Mendoza', 'Guerrero', 'Blanco', 'Medina', 'Vargas', 'Romero']

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '')

// POST /api/estudiantes/prueba  { cantidad, grupo } — crea estudiantes de ejemplo en esa sección
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const cantidad = Math.min(40, Math.max(1, parseInt(body.cantidad, 10) || 12))
    const grupo = String(body.grupo || 'A').trim().toUpperCase()
    if (!/^[A-Z]$/.test(grupo)) return NextResponse.json({ error: 'La sección debe ser una letra (A, B, C…).' }, { status: 400 })

    // Nombres distintos a los que ya tiene en esa sección
    const existentes = new Set((await prisma.estudiante.findMany({ where: { usuarioId: actor.id, grupo }, select: { nombre: true } })).map(e => e.nombre))
    const combinaciones: string[] = []
    for (const a of APELLIDOS) for (const n of NOMBRES) combinaciones.push(`${n} ${a}`)
    const libres = combinaciones.filter(n => !existentes.has(n)).sort(() => crypto.randomInt(3) - 1)
    const elegidos = libres.slice(0, cantidad)
    const datos = elegidos.map(nombre => ({ nombre, email: `${slug(nombre.split(' ')[0])}.${slug(nombre.split(' ')[1])}.${crypto.randomBytes(3).toString('hex')}${DOMINIO}`, grupo, usuarioId: actor.id, estado: 'ACTIVO' as const }))
    const r = await prisma.estudiante.createMany({ data: datos, skipDuplicates: true })
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Estudiante', detalle: `Creó ${r.count} estudiantes de prueba en la sección ${grupo}` })
    return NextResponse.json({ creados: r.count, grupo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron crear los estudiantes de prueba.' }, { status: 500 })
  }
}

// DELETE /api/estudiantes/prueba[?grupo=A] — borra los estudiantes de prueba (con sus notas de prueba)
export async function DELETE(request: Request) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error
    const grupo = (new URL(request.url).searchParams.get('grupo') || '').trim().toUpperCase()
    const r = await prisma.estudiante.deleteMany({ where: { usuarioId: actor.id, email: { endsWith: DOMINIO }, ...(grupo ? { grupo } : {}) } })
    await registrarActividad({ actor, accion: 'ELIMINAR', entidad: 'Estudiante', detalle: `Borró ${r.count} estudiantes de prueba${grupo ? ` de la sección ${grupo}` : ''}` })
    return NextResponse.json({ borrados: r.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudieron borrar los estudiantes de prueba.' }, { status: 500 })
  }
}
