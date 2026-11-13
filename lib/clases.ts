// Secciones de una materia con su código de clase (ej. "ISW-A7K2"): el estudiante lo escribe para unirse.
import crypto from 'crypto'
import prisma from '@/lib/prisma'

// Sin letras que se confunden (0/O, 1/I/L)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const azar = (n: number) => Array.from({ length: n }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('')

// Prefijo con las iniciales de la materia: "Ingeniería de Software" → ISW, "Redes" → RED
export function prefijoMateria(nombre: string): string {
  const palabras = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
    .filter(p => p && !['DE', 'DEL', 'LA', 'EL', 'Y', 'E', 'EN', 'LOS', 'LAS', 'PARA', 'I', 'II', 'III'].includes(p))
  if (!palabras.length) return 'CLS'
  // Iniciales de hasta 3 palabras; si son menos de 3 letras, se completa con la última palabra
  let p = palabras.slice(0, 3).map(w => w[0]).join('')
  const ultima = palabras[Math.min(palabras.length, 3) - 1]
  for (let i = 1; p.length < 3 && i < ultima.length; i++) p += ultima[i]
  return p.padEnd(3, 'X').slice(0, 3)
}

export async function nuevoCodigo(nombreMateria: string): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const codigo = `${prefijoMateria(nombreMateria)}-${azar(4)}`
    if (!(await prisma.seccionMateria.findUnique({ where: { codigo } }))) return codigo
  }
  return `CLS-${azar(6)}`
}

// La materia que manda el navegador, solo si es de ese profesor (si no, null = vale para todas sus materias)
export async function materiaPropia(usuarioId: string, materiaId: unknown): Promise<string | null> {
  const id = typeof materiaId === 'string' ? materiaId.trim() : ''
  if (!id) return null
  const m = await prisma.materia.findFirst({ where: { id, usuarioId }, select: { id: true } })
  return m?.id ?? null
}

// ¿El profesor ya tiene ese correo en esa materia? Un registro sin materia vale para todas, así que choca con cualquiera.
// (La base no lo puede impedir sola: en Postgres dos materiaId vacíos no cuentan como repetidos.)
export async function correoRepetido(usuarioId: string, email: string, materiaId: string | null, excluirId?: string): Promise<boolean> {
  const where: any = { usuarioId, email: email.trim().toLowerCase(), ...(excluirId ? { id: { not: excluirId } } : {}) }
  if (materiaId) where.OR = [{ materiaId }, { materiaId: null }]
  return !!(await prisma.estudiante.findFirst({ where, select: { id: true } }))
}

// Devuelve la sección (la crea con su código si todavía no existe)
export async function seccionConCodigo(materiaId: string, letra: string) {
  const l = String(letra || 'A').trim().toUpperCase().slice(0, 1)
  const existente = await prisma.seccionMateria.findUnique({ where: { materiaId_letra: { materiaId, letra: l } } })
  if (existente) return existente
  const materia = await prisma.materia.findUnique({ where: { id: materiaId }, select: { nombre: true } })
  try {
    return await prisma.seccionMateria.create({ data: { materiaId, letra: l, codigo: await nuevoCodigo(materia?.nombre || '') } })
  } catch (e: any) {
    if (e?.code === 'P2002') return prisma.seccionMateria.findUnique({ where: { materiaId_letra: { materiaId, letra: l } } })
    throw e
  }
}

export const normalizarCodigo = (c: string) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z0-9]{2,3})([A-Z0-9]{4,6})$/, '$1-$2')

// Filtro de estudiantes para una materia: los de esa materia y los cargados antes sin materia (valen para todas)
export const filtroMateria = (materiaId?: string | null) => (materiaId ? { OR: [{ materiaId: null }, { materiaId }] } : {})
