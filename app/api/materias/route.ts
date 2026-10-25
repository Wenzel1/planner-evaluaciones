import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requerirActor, quiereTodos } from '@/lib/permisos';
import { registrarActividad } from '@/lib/actividad';

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
    return NextResponse.json(materia, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código ya existe' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear materia' }, { status: 500 });
  }
}
