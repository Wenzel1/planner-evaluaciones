import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/avatar/:usuarioId?v=<versión> — la foto de perfil. Solo con sesión iniciada (lo exige proxy.ts).
// La dirección lleva la versión, así que el navegador la guarda y no la vuelve a pedir hasta que cambie.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const a = await prisma.avatarUsuario.findUnique({ where: { usuarioId: String(id || '') }, select: { imagen: true, tipo: true } })
    if (!a) return new NextResponse(null, { status: 404 })
    return new NextResponse(new Uint8Array(a.imagen), {
      headers: { 'Content-Type': a.tipo, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (e) {
    console.error(e)
    return new NextResponse(null, { status: 500 })
  }
}
