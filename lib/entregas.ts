// Entregas de trabajos y comentarios privados: comprobaciones compartidas.
import prisma from '@/lib/prisma'
import { TOKEN_VALIDO } from '@/lib/portal'

// El estudiante dueño del token (activo, con un profesor activo)
export async function estudianteDeToken(token: string) {
  if (!TOKEN_VALIDO.test(String(token || ''))) return null
  const est = await prisma.estudiante.findUnique({ where: { enlaceToken: token }, select: { id: true, nombre: true, grupo: true, estado: true, usuarioId: true, materiaId: true, usuario: { select: { activo: true } } } })
  if (!est || est.estado !== 'ACTIVO' || !est.usuarioId || est.usuario?.activo === false) return null
  return est
}

// La evaluación, solo si es de su profesor, de su sección (y de su materia si se unió a una)
export async function evaluacionDelEstudiante(est: { usuarioId: string | null; grupo: string; materiaId: string | null }, evaluacionId: string) {
  const ev = await prisma.evaluacion.findUnique({
    where: { id: String(evaluacionId || '') },
    select: { id: true, nombre: true, fecha: true, estado: true, grupoSeccion: true, aceptaEntregas: true, planificacion: { select: { materiaId: true, materia: { select: { usuarioId: true, nombre: true } } } } },
  })
  if (!ev || ev.planificacion.materia.usuarioId !== est.usuarioId || (ev.grupoSeccion || 'A') !== (est.grupo || 'A')) return null
  if (est.materiaId && ev.planificacion.materiaId !== est.materiaId) return null
  return ev
}

export const esTarde = (entregadaEn: Date | string, fecha: Date | string | null) => !!fecha && new Date(entregadaEn).getTime() > new Date(fecha).getTime() + 60_000

// Enlace válido (http/https)
export function enlaceValido(u: string): string | null {
  try { const x = new URL(String(u || '').trim()); return x.protocol === 'http:' || x.protocol === 'https:' ? x.toString().slice(0, 600) : null } catch { return null }
}

// Archivos de una entrega: los de la tabla EntregaArchivo y, si es una entrega antigua, su único archivo (id "principal")
export interface ArchivoEntrega { id: string; nombre: string; tamano: number | null; tipo: string | null; ruta: string }
export function archivosDeEntrega(e: { archivoRuta?: string | null; archivoNombre?: string | null; archivoTamano?: number | null; archivos?: { id: string; nombre: string; tamano: number; tipo: string | null; ruta: string }[] }): ArchivoEntrega[] {
  const lista: ArchivoEntrega[] = []
  if (e.archivoRuta) lista.push({ id: 'principal', nombre: e.archivoNombre || 'archivo', tamano: e.archivoTamano ?? null, tipo: null, ruta: e.archivoRuta })
  for (const a of e.archivos || []) lista.push({ id: a.id, nombre: a.nombre, tamano: a.tamano, tipo: a.tipo, ruta: a.ruta })
  return lista
}
// Lo que se envía al navegador (sin la ruta interna del almacenamiento)
export const archivosPublicos = (lista: ArchivoEntrega[]) => lista.map(({ ruta, ...a }) => a)
