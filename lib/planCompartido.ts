// PDF del Plan de Acción compartido por WhatsApp: lo genera n8n (el mismo PDF del planificador)
// una sola vez y queda guardado en la base de datos para servirlo a todos los estudiantes.
import prisma from '@/lib/prisma'
import { direccionN8n } from '@/lib/codigoWhatsapp'

export async function obtenerPdfPlan(token: string): Promise<{ pdf: Buffer; materia: string; seccion: string } | { error: string; status: number }> {
  const plan = await prisma.planCompartido.findUnique({ where: { token } })
  if (!plan) return { error: 'No encontrado', status: 404 }
  if (plan.pdf) return { pdf: Buffer.from(plan.pdf), materia: plan.materia, seccion: plan.seccion }

  const base = await direccionN8n()
  if (!base) return { error: 'No hay dirección de n8n configurada.', status: 503 }
  try {
    const r = await fetch(`${base}/webhook/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'pdf', examenData: plan.datos }),
      signal: AbortSignal.timeout(50000),
    })
    const bytes = Buffer.from(await r.arrayBuffer())
    if (!r.ok || bytes.subarray(0, 4).toString() !== '%PDF') { // un PDF válido empieza por "%PDF"
      console.error('[Plan compartido] n8n no devolvió un PDF:', r.status, bytes.subarray(0, 200).toString())
      return { error: 'n8n no pudo generar el PDF del plan.', status: 502 }
    }
    await prisma.planCompartido.update({ where: { token }, data: { pdf: bytes } })
    return { pdf: bytes, materia: plan.materia, seccion: plan.seccion }
  } catch (e: any) {
    return { error: e?.name === 'TimeoutError' ? 'n8n tardó demasiado en generar el PDF (¿dormido en Render?).' : 'No se pudo generar el PDF.', status: 504 }
  }
}

export function nombreArchivoPlan(materia: string, seccion: string): string {
  return `Plan_${materia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40)}_Seccion_${seccion}.pdf`
}
