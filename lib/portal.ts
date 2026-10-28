// Portal del estudiante: cada estudiante tiene un enlace secreto (/e/<token>) con su plan, recursos y notas.
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { origenApp } from '@/lib/whatsappLotes'

// Una evaluación se abre (muestra descripción, recursos y rúbrica) estos días antes de su fecha
export const DIAS_APERTURA = 7
const DIA = 24 * 60 * 60 * 1000

export interface Recurso { titulo: string; url: string }

// Limpia la lista de recursos que llega del navegador. Solo http(s), máximo 10.
export function normalizarRecursos(r: unknown): Recurso[] | null {
  if (!Array.isArray(r)) return null
  const lista = r.slice(0, 10).map((x: any) => {
    let url = String(x?.url ?? '').trim().slice(0, 600)
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return null } catch { return null }
    return { titulo: String(x?.titulo ?? '').trim().slice(0, 120), url }
  }).filter(Boolean) as Recurso[]
  return lista.length ? lista : null
}

export function estaAbierta(ev: { fecha: Date | null; estado: string; abiertaManual: boolean }, ahora = Date.now()): { abierta: boolean; abreEl: Date | null } {
  if (ev.abiertaManual || ev.estado === 'REALIZADA' || !ev.fecha) return { abierta: true, abreEl: null }
  const abreEl = new Date(ev.fecha.getTime() - DIAS_APERTURA * DIA)
  return { abierta: ahora >= abreEl.getTime(), abreEl }
}

export function nuevoTokenPortal(): string {
  return crypto.randomBytes(18).toString('base64url') // 24 caracteres, imposible de adivinar
}

export const TOKEN_VALIDO = /^[A-Za-z0-9_-]{20,40}$/

// Devuelve el token del estudiante (lo crea si no tiene). Con nuevo=true lo cambia: el enlace viejo deja de servir.
export async function tokenDeEstudiante(estudianteId: string, nuevo = false): Promise<string> {
  if (!nuevo) {
    const e = await prisma.estudiante.findUnique({ where: { id: estudianteId }, select: { enlaceToken: true } })
    if (e?.enlaceToken) return e.enlaceToken
  }
  for (let i = 0; i < 3; i++) {
    const token = nuevoTokenPortal()
    try {
      await prisma.estudiante.update({ where: { id: estudianteId }, data: { enlaceToken: token } })
      return token
    } catch (e: any) { if (e?.code !== 'P2002') throw e }
  }
  throw new Error('No se pudo crear el enlace del estudiante')
}

// Tokens de varios estudiantes de una vez (crea los que falten)
export async function tokensDeEstudiantes(ids: string[]): Promise<Map<string, string>> {
  const existentes = await prisma.estudiante.findMany({ where: { id: { in: ids } }, select: { id: true, enlaceToken: true } })
  const mapa = new Map<string, string>()
  for (const e of existentes) mapa.set(e.id, e.enlaceToken || (await tokenDeEstudiante(e.id)))
  return mapa
}

export function urlPortal(request: Request, token: string): string {
  return `${origenApp(request)}/e/${token}`
}
