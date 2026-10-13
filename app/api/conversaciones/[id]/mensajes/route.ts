import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma';
import { requerirActor, verificarAcceso } from '@/lib/permisos';

// POST /api/conversaciones/:id/mensajes
export async function POST(
  request: Request, 
  context: { params: Promise<{ id: string }> } 
) {
  try {
    const { actor, error } = await requerirActor(request)
    if (error) return error

    // 💡 REGLA CLAVE: Desestructuramos el id esperando la promesa de context.params
    const { id } = await context.params;

    // La conversación debe pertenecer al usuario (o ser SUPERADMIN)
    const conversacion = await prisma.conversacion.findUnique({ where: { id }, select: { usuarioId: true } })
    if (!conversacion) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    const denegado = verificarAcceso(actor, conversacion.usuarioId, 'escribir')
    if (denegado) return denegado

    const body = await request.json()

    const mensaje = await prisma.mensaje.create({
      data: {
        rol: body.rol,
        contenido: body.contenido,
        completo: body.completo ?? true,
        conversacionId: id, // 🌟 Cambiado de params.id a id
      },
    })

    await prisma.conversacion.update({
      where: { id: id }, // 🌟 Cambiado de params.id a id
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(mensaje, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al agregar mensaje' }, { status: 500 })
  }
}
