// Corrección sugerida por la IA de las preguntas abiertas (desarrollo e informe) de un examen en línea.
// Devuelve puntos y un comentario corto por pregunta. El profesor siempre puede cambiarlos.
import { responder } from './modelos'
import { leerConfig } from '@/lib/configuracion'
import { esObjetiva, type Examen, type Correccion } from '@/lib/examen'

const SISTEMA = `Eres un profesor universitario justo y exigente que corrige respuestas de examen. Para cada pregunta recibes el enunciado, los puntos máximos, lo que se esperaba (guía del profesor) y la respuesta del estudiante.
Asigna puntos de 0 al máximo (puedes usar medios o cuartos de punto) según qué tanto cubre lo esperado, con claridad y sin errores conceptuales. Una respuesta vacía o fuera de tema vale 0. No premies el relleno.
Responde SOLO con JSON válido, sin texto antes ni después, con esta forma exacta:
[{"id":"p1","puntos":3.5,"comentario":"Una frase de retroalimentación para el estudiante (máx. 30 palabras)"}]`

export async function sugerirCorreccion(examen: Examen, respuestas: Record<string, any>, materia: string, rubrica?: string): Promise<Correccion> {
  const abiertas = examen.preguntas.filter(p => !esObjetiva(p))
  if (!abiertas.length) return {}
  const partes = abiertas.map(p => [
    `### Pregunta ${p.id} (máx. ${p.puntos} pts, ${p.tipo})`,
    `Enunciado: ${p.enunciado}`,
    `Se esperaba: ${p.esperado || '(sin guía: usa tu criterio experto)'}`,
    `Respuesta del estudiante: ${String(respuestas?.[p.id] ?? '').trim().slice(0, 6000) || '(vacía)'}`,
  ].join('\n'))
  const pedido = `Materia: ${materia}.${rubrica ? `\nRúbrica de la evaluación (úsala como referencia): ${rubrica}` : ''}\n\n${partes.join('\n\n')}`
  let cfg: any = {}
  try { cfg = (await leerConfig())?.chat || {} } catch { /* valores por defecto */ }
  let texto = ''
  for await (const ev of responder(SISTEMA, [{ rol: 'user', texto: pedido }], { temperatura: 0.2, maxTokens: 4096, sinHerramientas: true }, cfg.modelo)) {
    if (ev.t === 'texto') texto += ev.v
  }
  const json = texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1)
  let lista: any[] = []
  try { lista = JSON.parse(json) } catch { throw new Error('La IA no devolvió una corrección válida.') }
  const c: Correccion = {}
  for (const p of abiertas) {
    const x = lista.find(y => String(y?.id) === p.id)
    if (!x) continue
    const pts = Math.max(0, Math.min(p.puntos, Math.round(Number(x.puntos) * 4) / 4))
    c[p.id] = { puntos: Number.isFinite(pts) ? pts : null, comentario: String(x.comentario ?? '').slice(0, 300), fuente: 'ia' }
  }
  return c
}
