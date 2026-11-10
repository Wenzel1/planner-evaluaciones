import { NextResponse } from 'next/server'
import { accesoPortal } from '@/lib/portalAcceso'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { estudianteDeToken, evaluacionDelEstudiante, enlaceValido } from '@/lib/entregas'
import { archivosConfigurados, subirArchivo, enlaceArchivo, borrarArchivo, MAX_ARCHIVO, EXTENSIONES } from '@/lib/almacenamiento'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/portal/:token/entrega  — el estudiante entrega (o vuelve a entregar) su trabajo de una evaluación.
// multipart: evaluacionId, archivo? , url?, comentario?   ·   JSON: { evaluacionId, url, comentario? }
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const esForm = (request.headers.get('content-type') || '').includes('multipart/form-data')
    const form = esForm ? await request.formData().catch(() => null) : null
    const body: any = esForm ? {} : await request.json().catch(() => ({}))
    const campo = (k: string) => (form ? form.get(k) : body[k])
    const ev = await evaluacionDelEstudiante(est, String(campo('evaluacionId') || ''))
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    if (!ev.aceptaEntregas || ev.estado === 'CANCELADA') return NextResponse.json({ error: 'Esta evaluación no recibe entregas.' }, { status: 400 })

    const comentario = String(campo('comentario') || '').trim().slice(0, 1000) || null
    const archivo = form?.get('archivo')
    const anterior = await prisma.entrega.findUnique({ where: { evaluacionId_estudianteId: { evaluacionId: ev.id, estudianteId: est.id } } })
    let datos: any
    if (archivo && typeof archivo !== 'string' && archivo.size > 0) {
      if (!archivosConfigurados()) return NextResponse.json({ error: 'La subida de archivos no está activada. Entrega un enlace (Drive, GitHub, Figma…).' }, { status: 400 })
      if (archivo.size > MAX_ARCHIVO) return NextResponse.json({ error: 'El archivo pesa más de 4 MB. Súbelo a Drive y entrega el enlace.' }, { status: 400 })
      const nombre = String(archivo.name || 'entrega').replace(/[\\/]/g, '_').slice(0, 120)
      const ext = (nombre.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
      if (!EXTENSIONES.includes(ext)) return NextResponse.json({ error: `No se aceptan archivos .${ext || '?'}. Comprime en .zip o entrega un enlace.` }, { status: 400 })
      const ruta = `${ev.id}/${est.id}/${crypto.randomBytes(6).toString('hex')}-${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')}`
      await subirArchivo(ruta, Buffer.from(await archivo.arrayBuffer()), archivo.type)
      if (anterior?.archivoRuta) borrarArchivo(anterior.archivoRuta)
      datos = { tipo: 'ARCHIVO', archivoRuta: ruta, archivoNombre: nombre, archivoTamano: archivo.size, url: null }
    } else {
      const url = enlaceValido(String(campo('url') || ''))
      if (!url) return NextResponse.json({ error: 'Pega un enlace válido (que empiece con https://) o sube un archivo.' }, { status: 400 })
      if (anterior?.archivoRuta) borrarArchivo(anterior.archivoRuta)
      datos = { tipo: 'ENLACE', url, archivoRuta: null, archivoNombre: null, archivoTamano: null }
    }
    const entrega = await prisma.entrega.upsert({
      where: { evaluacionId_estudianteId: { evaluacionId: ev.id, estudianteId: est.id } },
      create: { evaluacionId: ev.id, estudianteId: est.id, ...datos, comentario },
      update: { ...datos, comentario, entregadaEn: new Date(), devuelta: false },
    })
    return NextResponse.json({ entrega: { tipo: entrega.tipo, url: entrega.url, archivoNombre: entrega.archivoNombre, entregadaEn: entrega.entregadaEn, devuelta: false, devolucion: entrega.devolucion, comentario: entrega.comentario } })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message?.startsWith('No se pudo guardar') ? e.message : 'No se pudo guardar tu entrega. Intenta de nuevo.' }, { status: 500 })
  }
}

// GET /api/portal/:token/entrega?evaluacionId=…  — abre el archivo entregado por el estudiante (enlace temporal)
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('evaluacionId') || ''
    const e = await prisma.entrega.findUnique({ where: { evaluacionId_estudianteId: { evaluacionId: id, estudianteId: est.id } } })
    if (!e?.archivoRuta) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
    return NextResponse.redirect(await enlaceArchivo(e.archivoRuta, e.archivoNombre || undefined))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo abrir el archivo.' }, { status: 500 })
  }
}
