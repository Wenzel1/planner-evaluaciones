// Rúbricas por evaluación (se usan en la pantalla, al guardar en la base de datos y en el PDF del plan).
// Escala venezolana: por defecto la rúbrica vale 20 puntos.

export const NIVELES_RUBRICA = ['Excelente', 'Bueno', 'Regular', 'Deficiente'] as const
// Parte de los puntos del criterio que se obtiene en cada nivel
export const FACTOR_NIVEL = [1, 0.75, 0.5, 0.25] as const

export interface CriterioEval {
  nombre: string
  puntos: number
  descripciones: string[] // una por nivel, en el orden de NIVELES_RUBRICA
}
export interface RubricaEval {
  criterios: CriterioEval[]
}

const MAX_CRITERIOS = 8

// Limpia lo que venga (del navegador o de la base de datos). Devuelve null si no hay rúbrica útil.
export function normalizarRubrica(r: unknown): RubricaEval | null {
  if (!r || typeof r !== 'object') return null
  const lista = Array.isArray((r as any).criterios) ? (r as any).criterios : []
  const criterios: CriterioEval[] = lista.slice(0, MAX_CRITERIOS).map((c: any) => ({
    nombre: String(c?.nombre ?? '').trim().slice(0, 120),
    puntos: Math.max(0, Math.min(100, Math.round((Number(c?.puntos) || 0) * 2) / 2)),
    descripciones: NIVELES_RUBRICA.map((_, i) => String(Array.isArray(c?.descripciones) ? c.descripciones[i] ?? '' : '').trim().slice(0, 400)),
  })).filter((c: CriterioEval) => c.nombre)
  return criterios.length ? { criterios } : null
}

export function totalRubrica(r: RubricaEval | null | undefined): number {
  return (r?.criterios || []).reduce((t, c) => t + (Number(c.puntos) || 0), 0)
}

export function puntosNivel(puntos: number, nivel: number): number {
  return Math.round((Number(puntos) || 0) * FACTOR_NIVEL[nivel] * 2) / 2
}

export function textoPuntos(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

// ---------- Rúbrica sugerida según el tipo de actividad ----------
type Plantilla = [string, number, string, string, string, string][]

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function plantillaPara(texto: string, tema: string): Plantilla {
  const t = sinTildes(texto)
  if (/expos|presentac|oral|charla|ponencia|pitch|defensa/.test(t)) return [
    [`Dominio del tema (${tema})`, 6, 'Explica con seguridad y precisión, responde todas las preguntas.', 'Explica bien con pequeñas imprecisiones; responde la mayoría de preguntas.', 'Explica de forma parcial y depende de lo que lee.', 'No demuestra comprensión del tema.'],
    ['Organización y estructura', 4, 'Introducción, desarrollo y cierre claros; secuencia lógica.', 'Estructura clara con algún salto en la secuencia.', 'Estructura confusa en varias partes.', 'Sin estructura reconocible.'],
    ['Expresión oral', 4, 'Voz clara, buen ritmo, vocabulario técnico adecuado y contacto visual.', 'Se entiende bien; algunas muletillas o poco contacto visual.', 'Habla con dificultad o lee casi todo.', 'No se entiende o lee todo el tiempo.'],
    ['Material de apoyo', 3, 'Recursos visuales claros, legibles y que aportan al contenido.', 'Recursos adecuados con detalles por mejorar.', 'Recursos recargados o poco útiles.', 'Sin material o no aporta.'],
    ['Manejo del tiempo', 3, 'Cumple exactamente con el tiempo asignado.', 'Se pasa o le falta poco tiempo.', 'Se desvía bastante del tiempo.', 'No respeta el tiempo asignado.'],
  ]
  if (/debate|foro|mesa redonda|discusion|socializ/.test(t)) return [
    ['Argumentación', 6, 'Argumentos sólidos, con ejemplos y fuentes.', 'Argumentos válidos con poco respaldo.', 'Argumentos débiles o repetidos.', 'No argumenta su posición.'],
    [`Dominio del tema (${tema})`, 5, 'Usa los conceptos con precisión.', 'Usa los conceptos con errores menores.', 'Confunde varios conceptos.', 'No maneja los conceptos.'],
    ['Réplica y escucha', 5, 'Responde directamente a los argumentos del otro con respeto.', 'Responde a la mayoría de argumentos.', 'Responde poco o se sale del tema.', 'No escucha ni responde.'],
    ['Participación y respeto', 4, 'Participa activamente y respeta turnos.', 'Participa de forma adecuada.', 'Participa poco o interrumpe.', 'No participa o falta el respeto.'],
  ]
  if (/ensayo|informe|investigac|escrito|resumen|monografia|reporte|articulo|mapa|cuadro/.test(t)) return [
    [`Contenido (${tema})`, 7, 'Completo, preciso y con análisis propio.', 'Completo con poco análisis propio.', 'Incompleto o con errores conceptuales.', 'No desarrolla el tema.'],
    ['Organización', 4, 'Introducción, desarrollo y conclusión bien enlazados.', 'Bien organizado con transiciones débiles.', 'Organización confusa.', 'Sin organización.'],
    ['Fuentes y citas', 4, 'Fuentes confiables, bien citadas (APA u otra norma).', 'Fuentes adecuadas con errores de citación.', 'Pocas fuentes o mal citadas.', 'Sin fuentes o copia sin citar.'],
    ['Redacción y ortografía', 3, 'Redacción clara, sin errores.', 'Pocos errores que no afectan la lectura.', 'Errores frecuentes.', 'Errores que impiden entender.'],
    ['Entrega y formato', 2, 'A tiempo y con el formato pedido.', 'A tiempo con fallas menores de formato.', 'Tarde o con formato incompleto.', 'No cumple con la entrega.'],
  ]
  if (/proyecto|taller|practic|laborator|codigo|program|desarroll|implement|prototipo|caso/.test(t)) return [
    [`Funcionamiento / resultado (${tema})`, 7, 'Cumple todos los requisitos y funciona sin errores.', 'Cumple la mayoría de requisitos con fallas menores.', 'Cumple parcialmente o con fallas importantes.', 'No funciona o no cumple los requisitos.'],
    ['Aplicación de conceptos', 5, 'Aplica correctamente lo visto en clase y lo justifica.', 'Aplica los conceptos con errores menores.', 'Aplica pocos conceptos o con errores.', 'No aplica los conceptos.'],
    ['Calidad y organización', 4, 'Trabajo ordenado, claro y bien documentado.', 'Ordenado con documentación básica.', 'Desordenado o poco documentado.', 'Sin orden ni documentación.'],
    ['Explicación del trabajo', 4, 'Explica y defiende cada decisión con claridad.', 'Explica la mayoría de decisiones.', 'Explica con dificultad.', 'No puede explicar su trabajo.'],
  ]
  if (/examen|prueba|quiz|test|cuestionario|parcial|escrita/.test(t)) return [
    [`Dominio conceptual (${tema})`, 8, 'Responde con precisión y usa el vocabulario correcto.', 'Responde bien con imprecisiones menores.', 'Respuestas incompletas o con errores.', 'Respuestas incorrectas o en blanco.'],
    ['Procedimiento / razonamiento', 6, 'Muestra el procedimiento completo y correcto.', 'Procedimiento correcto con algún paso faltante.', 'Procedimiento con errores importantes.', 'Sin procedimiento.'],
    ['Aplicación a casos', 4, 'Resuelve los casos aplicando lo aprendido.', 'Resuelve la mayoría de casos.', 'Resuelve pocos casos.', 'No resuelve los casos.'],
    ['Presentación', 2, 'Respuestas ordenadas y legibles.', 'Mayormente ordenadas.', 'Poco ordenadas.', 'Ilegibles o desordenadas.'],
  ]
  return [
    [`Dominio del contenido (${tema})`, 7, 'Demuestra comprensión completa y precisa.', 'Comprensión buena con errores menores.', 'Comprensión parcial.', 'No demuestra comprensión.'],
    ['Aplicación', 5, 'Aplica lo aprendido de forma correcta y creativa.', 'Aplica lo aprendido correctamente.', 'Aplica con errores.', 'No aplica lo aprendido.'],
    ['Organización y claridad', 4, 'Trabajo claro, ordenado y completo.', 'Claro con detalles por mejorar.', 'Poco claro o incompleto.', 'Confuso o sin terminar.'],
    ['Responsabilidad', 4, 'Entrega a tiempo y cumple todas las indicaciones.', 'Entrega a tiempo con alguna indicación sin cumplir.', 'Entrega tarde o incompleto.', 'No entrega.'],
  ]
}

export function rubricaSugerida(ev: { nombre?: string | null; tipoActividad?: string | null; enfoque?: string | null; cantidadGrupos?: number | null; personasPorGrupo?: number | null }, total = 20): RubricaEval {
  const tema = String(ev.nombre ?? '').replace(/^(Evaluaci[oó]n\s*\d+\s*:\s*|Pr[aá]ctica:\s*|Te[oó]rica:\s*)+/i, '').trim().slice(0, 50) || 'tema'
  let filas = plantillaPara(`${ev.tipoActividad ?? ''} ${ev.enfoque ?? ''} ${ev.nombre ?? ''}`, tema)
  const enGrupo = (Number(ev.cantidadGrupos) || 0) > 1 || (Number(ev.personasPorGrupo) || 0) > 1
  if (enGrupo && !filas.some(f => /equipo|participaci/i.test(f[0]))) {
    filas = [...filas, ['Trabajo en equipo', 3, 'Todos participan y se reparten el trabajo de forma equitativa.', 'La mayoría participa activamente.', 'Participación desigual.', 'Un solo integrante hace el trabajo.']]
  }
  // Reparte los puntos para que la suma dé exactamente el total (de 0,5 en 0,5)
  const suma = filas.reduce((t, f) => t + f[1], 0)
  const criterios = filas.map(f => ({ nombre: f[0], puntos: Math.max(0.5, Math.round((f[1] / suma) * total * 2) / 2), descripciones: [f[2], f[3], f[4], f[5]] }))
  const dif = Math.round((total - criterios.reduce((t, c) => t + c.puntos, 0)) * 2) / 2
  if (dif !== 0) criterios[0].puntos = Math.max(0.5, criterios[0].puntos + dif)
  return { criterios }
}
