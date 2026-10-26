// PDF del Plan de Acción compartido por WhatsApp: se genera en el propio servidor (pdf-lib)
// una sola vez y queda guardado en la base de datos para servirlo a todos los estudiantes.
import prisma from '@/lib/prisma'
import { generarPdfPlan, nombreArchivoPdf } from '@/lib/pdfPlan'

export async function obtenerPdfPlan(token: string): Promise<{ pdf: Buffer; materia: string; seccion: string } | { error: string; status: number }> {
  const plan = await prisma.planCompartido.findUnique({ where: { token } })
  if (!plan) return { error: 'No encontrado', status: 404 }
  if (plan.pdf) return { pdf: Buffer.from(plan.pdf), materia: plan.materia, seccion: plan.seccion }
  try {
    const datos: any = plan.datos || {}
    const bytes = Buffer.from(await generarPdfPlan({ ...datos, seccion: plan.seccion }))
    await prisma.planCompartido.update({ where: { token }, data: { pdf: bytes } })
    return { pdf: bytes, materia: plan.materia, seccion: plan.seccion }
  } catch (e) {
    console.error('[Plan compartido] No se pudo generar el PDF:', e)
    return { error: 'No se pudo generar el PDF del plan.', status: 500 }
  }
}

export function nombreArchivoPlan(materia: string, seccion: string): string {
  return nombreArchivoPdf(materia, seccion)
}
