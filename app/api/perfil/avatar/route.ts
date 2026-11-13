import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActor } from '@/lib/authServer'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const TIPOS = ['image/webp', 'image/jpeg', 'image/png']
const MAX_BYTES = 300 * 1024 // la imagen llega recortada y comprimida (~15 KB); esto es solo un tope

// POST /api/perfil/avatar  { imagen: "data:image/webp;base64,…" } — sube o cambia la foto de perfil (profesor o estudiante)
export async function POST(request: Request) {
  try {
    const actor = await getActor(request)
    if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const clave = `avatar:${actor.id}`
    if (bloqueado(clave, 20)) return NextResponse.json({ error: `Cambiaste tu foto muchas veces. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    registrarFallo(clave)
    const body = await request.json().catch(() => ({}))
    const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.imagen || ''))
    if (!m || !TIPOS.includes(m[1])) return NextResponse.json({ error: 'Imagen no válida (usa JPG, PNG o WebP).' }, { status: 400 })
    const imagen = Buffer.from(m[2], 'base64')
    if (!imagen.length || imagen.length > MAX_BYTES) return NextResponse.json({ error: 'La imagen es demasiado grande.' }, { status: 400 })
    // Firma real del archivo (no solo lo que dice el texto)
    const esWebp = imagen.subarray(0, 4).toString('ascii') === 'RIFF' && imagen.subarray(8, 12).toString('ascii') === 'WEBP'
    const esJpg = imagen[0] === 0xff && imagen[1] === 0xd8
    const esPng = imagen.subarray(1, 4).toString('ascii') === 'PNG'
    if (!(esWebp || esJpg || esPng)) return NextResponse.json({ error: 'Imagen no válida.' }, { status: 400 })
    const tipo = esWebp ? 'image/webp' : esJpg ? 'image/jpeg' : 'image/png'
    const ahora = new Date()
    await prisma.$transaction([
      prisma.avatarUsuario.upsert({ where: { usuarioId: actor.id }, create: { usuarioId: actor.id, imagen, tipo }, update: { imagen, tipo } }),
      prisma.usuario.update({ where: { id: actor.id }, data: { avatarEn: ahora } }),
    ])
    return NextResponse.json({ avatarEn: ahora.toISOString() })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar tu foto.' }, { status: 500 })
  }
}

// DELETE /api/perfil/avatar — quita la foto (vuelven las iniciales)
export async function DELETE(request: Request) {
  try {
    const actor = await getActor(request)
    if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    await prisma.$transaction([
      prisma.avatarUsuario.deleteMany({ where: { usuarioId: actor.id } }),
      prisma.usuario.update({ where: { id: actor.id }, data: { avatarEn: null } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo quitar tu foto.' }, { status: 500 })
  }
}
