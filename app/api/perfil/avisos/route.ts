import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getActor } from '@/lib/authServer'

export const dynamic = 'force-dynamic'

// PATCH /api/perfil/avisos  { avisos: boolean } — el estudiante decide si quiere recibir avisos por correo o WhatsApp
export async function PATCH(request: Request) {
  try {
    const actor = await getActor(request)
    if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const avisos = body.avisos !== false
    await prisma.usuario.update({ where: { id: actor.id }, data: { avisosCorreo: avisos } })
    return NextResponse.json({ avisos })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar tu preferencia.' }, { status: 500 })
  }
}
