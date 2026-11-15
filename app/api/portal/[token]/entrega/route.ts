import { NextResponse } from 'next/server'
import { accesoPortal } from '@/lib/portalAcceso'
import prisma from '@/lib/prisma'
import { estudianteDeToken, evaluacionDelEstudiante, bloqueoDeEntrega, enlaceValido, archivosDeEntrega, archivosPublicos } from '@/lib/entregas'
import { borrarArchivo, extensionDe, EXTENSIONES, MAX_ARCHIVO, MAX_ARCHIVOS_POR_ENTREGA, tipoDeArchivo } from '@/lib/almacenamiento'
import { responderArchivo } from '@/lib/visorArchivos'

export const dynamic = 'force-dynamic'

const conArchivos = { archivos: { orderBy: { createdAt: 'asc' as const } } }

// Lo que ve el estudiante de su entrega
function vistaEntrega(e: any) {
  return {
    tipo: e.tipo, url: e.url, comentario: e.comentario, entregadaEn: e.entregadaEn, devuelta: e.devuelta, devolucion: e.devolucion,
    revisada: e.revisada, archivoNombre: e.archivoNombre, archivos: archivosPublicos(archivosDeEntrega(e)),
  }
}

// POST /api/portal/:token/entrega  { evaluacionId, archivos?: [{ ruta, nombre, tamano }], quitar?: [archivoId], url?, comentario? }
// El estudiante entrega (o corrige) su trabajo: archivos ya subidos con /entrega/subida, un enlace, o ambos.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const body: any = await request.json().catch(() => ({}))
    const ev = await evaluacionDelEstudiante(est, String(body.evaluacionId || ''))
    if (!ev) return NextResponse.json({ error: 'Evaluación no encontrada.' }, { status: 404 })
    if (!ev.aceptaEntregas || ev.estado === 'CANCELADA') return NextResponse.json({ error: 'Esta evaluación no recibe entregas.' }, { status: 400 })
    const bloqueo = bloqueoDeEntrega(ev)
    if (bloqueo) return NextResponse.json({ error: bloqueo }, { status: 403 })

    const comentario = String(body.comentario || '').trim().slice(0, 1000) || null
    const urlTexto = String(body.url || '').trim()
    const url = urlTexto ? enlaceValido(urlTexto) : null
    if (urlTexto && !url) return NextResponse.json({ error: 'El enlace no es válido (debe empezar con https://).' }, { status: 400 })

    // Archivos nuevos: solo rutas de SU carpeta para ESTA evaluación (las crea /entrega/subida)
    const carpeta = `${ev.id}/${est.id}/`
    const nuevos = (Array.isArray(body.archivos) ? body.archivos : []).slice(0, MAX_ARCHIVOS_POR_ENTREGA).map((a: any) => ({
      ruta: String(a?.ruta || ''), nombre: String(a?.nombre || 'archivo').slice(0, 150), tamano: Math.max(0, Math.round(Number(a?.tamano) || 0)),
    }))
    for (const a of nuevos) {
      if (!a.ruta.startsWith(carpeta) || a.ruta.includes('..')) return NextResponse.json({ error: 'Archivo no válido.' }, { status: 400 })
      if (!EXTENSIONES.includes(extensionDe(a.nombre)) || a.tamano > MAX_ARCHIVO) return NextResponse.json({ error: `«${a.nombre}» no se puede entregar.` }, { status: 400 })
    }
    const quitar = new Set<string>((Array.isArray(body.quitar) ? body.quitar : []).map((x: any) => String(x)))

    const anterior = await prisma.entrega.findUnique({ where: { evaluacionId_estudianteId: { evaluacionId: ev.id, estudianteId: est.id } }, include: conArchivos })
    const quedan = anterior ? archivosDeEntrega(anterior).filter(a => !quitar.has(a.id)) : []
    if (quedan.length + nuevos.length > MAX_ARCHIVOS_POR_ENTREGA) return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS_POR_ENTREGA} archivos por entrega. Comprime algunos en un .zip.` }, { status: 400 })
    if (!quedan.length && !nuevos.length && !url) return NextResponse.json({ error: 'Sube al menos un archivo o pega un enlace.' }, { status: 400 })

    const tipo = (quedan.length || nuevos.length) && url ? 'MIXTA' : url ? 'ENLACE' : 'ARCHIVO'
    const quitarPrincipal = !!anterior?.archivoRuta && quitar.has('principal')
    const entrega = await prisma.$transaction(async (tx) => {
      const e = await tx.entrega.upsert({
        where: { evaluacionId_estudianteId: { evaluacionId: ev.id, estudianteId: est.id } },
        create: { evaluacionId: ev.id, estudianteId: est.id, tipo, url, comentario },
        // Al corregir o cambiar la entrega vuelve a quedar "sin revisar" para el profesor
        update: { tipo, url, comentario, entregadaEn: new Date(), devuelta: false, revisada: false, revisadaEn: null, ...(quitarPrincipal ? { archivoRuta: null, archivoNombre: null, archivoTamano: null } : {}) },
      })
      if (anterior) await tx.entregaArchivo.deleteMany({ where: { entregaId: e.id, id: { in: [...quitar].filter(x => x !== 'principal') } } })
      if (nuevos.length) await tx.entregaArchivo.createMany({ data: nuevos.map((a: { ruta: string; nombre: string; tamano: number }) => ({ entregaId: e.id, ruta: a.ruta, nombre: a.nombre, tamano: a.tamano, tipo: tipoDeArchivo(a.nombre) })) })
      return tx.entrega.findUniqueOrThrow({ where: { id: e.id }, include: conArchivos })
    })
    // Los archivos que quitó se borran del almacenamiento
    if (anterior) for (const a of archivosDeEntrega(anterior)) if (quitar.has(a.id)) borrarArchivo(a.ruta)
    return NextResponse.json({ entrega: vistaEntrega(entrega) })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo guardar tu entrega. Intenta de nuevo.' }, { status: 500 })
  }
}

// GET /api/portal/:token/entrega?evaluacionId=…&archivoId=…[&modo=url|texto|zip|zipentrada]
// Abre (o muestra en el visor) un archivo de SU entrega. Sin archivoId abre el primero.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const sinAcceso = await accesoPortal(request, token)
    if (sinAcceso) return sinAcceso
    const est = await estudianteDeToken(token)
    if (!est) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    const q = new URL(request.url).searchParams
    const e = await prisma.entrega.findUnique({ where: { evaluacionId_estudianteId: { evaluacionId: q.get('evaluacionId') || '', estudianteId: est.id } }, include: conArchivos })
    const lista = e ? archivosDeEntrega(e) : []
    const archivo = q.get('archivoId') ? lista.find(a => a.id === q.get('archivoId')) : lista[0]
    if (!archivo) return NextResponse.json({ error: 'No hay archivo.' }, { status: 404 })
    return await responderArchivo(request, archivo)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'No se pudo abrir el archivo.' }, { status: 500 })
  }
}
