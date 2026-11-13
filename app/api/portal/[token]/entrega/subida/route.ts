import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { accesoPortal } from '@/lib/portalAcceso'
import { estudianteDeToken, evaluacionDelEstudiante } from '@/lib/entregas'
import { archivosConfigurados, enlaceDeSubida, EXTENSIONES, MAX_ARCHIVO, extensionDe, nombreSeguro, tipoDeArchivo } from '@/lib/almacenamiento'
import { bloqueado, registrarFallo, minutosRestantes } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// POST /api/portal/:token/entrega/subida  { evaluacionId, nombre, tamano }
// Prepara la subida de UN archivo: devuelve un enlace firmado para que el navegador lo suba directo al almacenamiento
// (así se aceptan archivos de hasta 25 MB). Después, el archivo se registra en la entrega con POST /entrega.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    if (!archivosConfigurados()) return NextResponse.json({ error: 'La subida de archivos no está activada. Entrega un enlace (Drive, GitHub, Figma…).' }, { status: 400 })
    const clave = `subida:${est.id}`
    if (bloqueado(clave, 80)) return NextResponse.json({ error: `Subiste muchos archivos seguidos. Espera ${minutosRestantes(clave)} minuto(s).` }, { status: 429 })
    registrarFallo(clave)

    const body = await request.json().catch(() => ({}))
    const ev = await evaluacionDelEstudiante(est, String(body.evaluacionId || ''))
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    if (!ev.aceptaEntregas || ev.estado === 'CANCELADA') return NextResponse.json({ error: 'Esta evaluación no recibe entregas.' }, { status: 400 })

    const nombre = String(body.nombre || '').trim().slice(0, 150) || 'archivo'
    const tamano = Number(body.tamano) || 0
    const ext = extensionDe(nombre)
    if (!EXTENSIONES.includes(ext)) return NextResponse.json({ error: `No se aceptan archivos .${ext || '?'}. Comprímelo en .zip o entrega un enlace.` }, { status: 400 })
    if (tamano <= 0) return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
    if (tamano > MAX_ARCHIVO) return NextResponse.json({ error: `«${nombre}» pesa más de ${MAX_ARCHIVO / 1024 / 1024} MB. Súbelo a Drive y entrega el enlace.` }, { status: 400 })

    const ruta = `${ev.id}/${est.id}/${crypto.randomBytes(6).toString('hex')}-${nombreSeguro(nombre)}`
    return NextResponse.json({ ruta, subida: await enlaceDeSubida(ruta), tipo: tipoDeArchivo(nombre) })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message?.startsWith('No se pudo preparar') ? `${e.message} Revisa el bucket «entregas» en Supabase.` : 'No se pudo preparar la subida.' }, { status: 500 })
  }
}
