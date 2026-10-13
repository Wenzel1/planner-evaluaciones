// lib/actividad.ts
// Registro de actividad (auditoría). Solo el SUPERADMIN puede consultarlo (ver /api/actividad).
// Si registrar falla, NUNCA se rompe la operación principal: solo se avisa en la consola del servidor.
import prisma from '@/lib/prisma'

export interface EntradaActividad {
  actor?: { id: string; nombre: string; rol: string } | null
  usuarioNombre?: string // para acciones sin sesión (ej. una solicitud de registro)
  accion: string
  entidad: string
  detalle?: string
}

export async function registrarActividad(entrada: EntradaActividad): Promise<void> {
  try {
    await prisma.actividad.create({
      data: {
        usuarioId: entrada.actor?.id ?? null,
        usuarioNombre: entrada.actor?.nombre ?? entrada.usuarioNombre ?? 'Visitante',
        usuarioRol: entrada.actor?.rol ?? null,
        accion: entrada.accion,
        entidad: entrada.entidad,
        detalle: entrada.detalle ? entrada.detalle.slice(0, 300) : null,
      },
    })
  } catch (e) {
    console.error('No se pudo registrar la actividad:', e)
  }
}
