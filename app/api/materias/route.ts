import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/materias — Listar todas
export async function GET() {
  try {
    const materias = await prisma.materia.findMany({
      include: {
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

// POST /api/materias — Crear
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const materia = await prisma.materia.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || null,
        codigo: body.codigo || null,
      },
    });
    return NextResponse.json(materia, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código ya existe' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear materia' }, { status: 500 });
  }
}