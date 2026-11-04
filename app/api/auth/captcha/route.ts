import { NextResponse } from 'next/server'
import { crearDesafio } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

// GET /api/auth/captcha (público) — una suma nueva para el login o el registro: { pregunta: "7 + 4", token }
export async function GET() {
  try {
    return NextResponse.json(crearDesafio(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo generar la verificación.' }, { status: 500 })
  }
}
