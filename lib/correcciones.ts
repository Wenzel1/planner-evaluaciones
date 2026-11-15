// Correcciones del profesor sobre los archivos entregados (ver el modelo CorreccionArchivo)
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requerirActor, verificarAcceso } from '@/lib/permisos'
import { archivosDeEntrega } from '@/lib/entregas'

export const TIPOS_CORRECCION = ['PDF', 'IMAGEN', 'CODIGO', 'N8N', 'DRAWIO', 'WORD', 'EXCEL'] as const
export const carpetaCorrecciones = (entregaId: string) => `correcciones/${entregaId}/`

// La entrega, solo si es de una materia que el profesor puede leer o corregir
export async function entregaDelProfesor(request: Request, id: string, modo: 'leer' | 'escribir') {
  const { actor, error } = await requerirActor(request)
  if (error) return { error }
  const e = await prisma.entrega.findUnique({
    where: { id },
    include: { archivos: { orderBy: { createdAt: 'asc' } }, evaluacion: { select: { planificacion: { select: { materia: { select: { usuarioId: true } } } } } } },
  })
  if (!e) return { error: NextResponse.json({ error: 'Entrega no encontrada.' }, { status: 404 }) }
  const denegado = verificarAcceso(actor!, e.evaluacion.planificacion.materia.usuarioId, modo)
  return denegado ? { error: denegado } : { e, actor: actor!, archivos: archivosDeEntrega(e) }
}

// Lo que se devuelve de una corrección (sin la ruta interna del archivo)
export function vistaCorreccion(c: { id: string; archivoId: string; archivoNombre: string; tipo: string; datos: unknown; rutaCorregida: string | null; nombreCorregido: string | null; tipoCorregido: string | null; autorNombre: string | null; updatedAt: Date }) {
  return {
    id: c.id, archivoId: c.archivoId, archivoNombre: c.archivoNombre, tipo: c.tipo, datos: c.datos ?? null,
    archivo: c.rutaCorregida ? { nombre: c.nombreCorregido || c.archivoNombre, tipo: c.tipoCorregido } : null,
    autorNombre: c.autorNombre, actualizada: c.updatedAt,
  }
}
