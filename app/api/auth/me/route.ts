import { NextResponse } from 'next/server'
import { getActor } from '@/lib/authServer'

export async function GET(request: Request) {
  const actor = await getActor(request)
  if (!actor) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  return NextResponse.json(actor)
}
