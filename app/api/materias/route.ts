import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requerirActor, quiereTodos } from '@/lib/permisos';
import { registrarActividad } from '@/lib/actividad';
import { seccionConCodigo } from '@/lib/clases';

// GET /api/materias — Listar las materias del usuario (ADMIN/SUPERADMIN pueden pedir ?todos=1)
export async function GET(request: Request) {
  try {
    const { actor, error } = await requerirActor(request);
    if (error) return error;
    const todos = quiereTodos(request, actor);

    const materias = await prisma.materia.findMany({
      where: todos ? {} : { usuarioId: actor.id },
      include: {
        ...(todos ? { usuario: { select: { id: true, nombre: true, email: true } } } : {}),
        planificaciones: {
          orderBy: { createdAt: 'desc' },
          include: {
            evaluaciones: true,
            rubrica: { include: { niveles: true } },
            _count: { select: { comentarios: true, conversaciones: true } },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(materias);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al obtener materias' }, { status: 500 });
  }
}

// POST /api/materias — Crear (queda a nombre del usuario que la crea)
export async function POST(request: Request) {
  try {
    const { actor, error } = await requerirActor(request);
    if (error) return error;

    const body = await request.json();
    const nombre = String(body.nombre ?? '').trim().slice(0, 120);
    if (!nombre) return NextResponse.json({ error: 'El nombre de la materia es obligatorio.' }, { status: 400 });
    const materia = await prisma.materia.create({
      data: {
        nombre,
        descripcion: body.descripcion || null,
        codigo: body.codigo || null,
        usuarioId: actor.id,
      },
    });
    await registrarActividad({ actor, accion: 'CREAR', entidad: 'Materia', detalle: `Materia "${materia.nombre}"` });
    // Secciones elegidas al crearla (cada una con su código de clase)
    const letras = (Array.isArray(body.secciones) ? body.secciones : []).map((l: any) => String(l).toUpperCase()).filter((l: string) => /^[A-Z]$/.test(l)).slice(0, 8);
    for (const l of letras) await seccionConCodigo(materia.id, l).catch(() => null);
    return NextResponse.json(materia, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código ya existe' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear materia' }, { status: 500 });
  }
}

// PATCH /api/materias  { id, abrir: true } — marca la materia como la última abierta en la cuenta,
// para que la computadora y el teléfono abran la misma al entrar.
export async function PATCH(request: Request) {
  try {
    const { actor, error } = await requerirActor(request);
    if (error) return error;
    const body = await request.json().catch(() => ({}));
    if (!body.id || body.abrir !== true) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 });
    const r = await prisma.materia.updateMany({ where: { id: String(body.id), usuarioId: actor.id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: r.count > 0 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudo marcar la materia.' }, { status: 500 });
  }
}
