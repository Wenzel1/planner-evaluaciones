// Archivos y notas de voz adjuntos en los mensajes privados (profesor ↔ estudiante).
// Se suben directo al almacenamiento con un enlace firmado (como las entregas) y el mensaje guarda su ruta.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { archivosConfigurados, enlaceDeSubida, EXTENSIONES, MAX_ARCHIVO, extensionDe, nombreSeguro, tipoDeArchivo } from '@/lib/almacenamiento'

// Lo que se lee de cada mensaje (sin la ruta interna del archivo)
export const SELECT_COMENTARIO = { id: true, autor: true, texto: true, createdAt: true, adjuntoNombre: true, adjuntoTipo: true, adjuntoTamano: true, adjuntoDuracion: true } as const
export function vistaComentario(c: { id: string; autor: string; texto: string; createdAt: Date; adjuntoNombre: string | null; adjuntoTipo: string | null; adjuntoTamano: number | null; adjuntoDuracion: number | null }) {
  return {
    id: c.id, autor: c.autor, texto: c.texto, createdAt: c.createdAt,
    adjunto: c.adjuntoNombre ? { nombre: c.adjuntoNombre, tipo: c.adjuntoTipo, tamano: c.adjuntoTamano, duracion: c.adjuntoDuracion } : null,
  }
}

const carpeta = (evaluacionId: string, estudianteId: string) => `mensajes/${evaluacionId}/${estudianteId}/`

// Tipo de contenido: las notas de voz conservan su tipo de audio; lo demás, según la extensión
function tipoAdjunto(nombre: string, tipo: unknown): string {
  const m = /^audio\/(webm|mp4|ogg|mpeg|wav|x-m4a|aac)/.exec(String(tipo || ''))
  return m ? `audio/${m[1] === 'x-m4a' ? 'mp4' : m[1]}` : tipoDeArchivo(nombre)
}

// Prepara la subida de un adjunto: valida y devuelve el enlace firmado
export async function prepararAdjunto(evaluacionId: string, estudianteId: string, body: any): Promise<NextResponse> {
  if (!archivosConfigurados()) return NextResponse.json({ error: 'La subida de archivos no está activada.' }, { status: 400 })
  const nombre = String(body?.nombre || '').trim().slice(0, 150) || 'archivo'
  const tamano = Number(body?.tamano) || 0
  const ext = extensionDe(nombre)
  if (!EXTENSIONES.includes(ext)) return NextResponse.json({ error: `No se aceptan archivos .${ext || '?'}.` }, { status: 400 })
  if (tamano <= 0) return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
  if (tamano > MAX_ARCHIVO) return NextResponse.json({ error: `El archivo pesa más de ${MAX_ARCHIVO / 1024 / 1024} MB.` }, { status: 400 })
  const ruta = `${carpeta(evaluacionId, estudianteId)}${crypto.randomBytes(6).toString('hex')}-${nombreSeguro(nombre)}`
  return NextResponse.json({ ruta, subida: await enlaceDeSubida(ruta), tipo: tipoAdjunto(nombre, body?.tipo) })
}

// Datos del adjunto para guardar en el mensaje (solo rutas de la carpeta de ESA conversación)
export function datosAdjunto(evaluacionId: string, estudianteId: string, adj: any): { adjuntoRuta: string; adjuntoNombre: string; adjuntoTipo: string; adjuntoTamano: number; adjuntoDuracion: number | null } | null | 'invalido' {
  if (!adj) return null
  const ruta = String(adj.ruta || '')
  const nombre = String(adj.nombre || '').slice(0, 150)
  if (!ruta.startsWith(carpeta(evaluacionId, estudianteId)) || ruta.includes('..') || !nombre || !EXTENSIONES.includes(extensionDe(nombre))) return 'invalido'
  const duracion = Math.round(Number(adj.duracion) || 0)
  return { adjuntoRuta: ruta, adjuntoNombre: nombre, adjuntoTipo: tipoAdjunto(nombre, adj.tipo), adjuntoTamano: Math.max(0, Math.round(Number(adj.tamano) || 0)), adjuntoDuracion: duracion > 0 ? Math.min(duracion, 3600) : null }
}
