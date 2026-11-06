// La descripción de una evaluación viene como texto con secciones en mayúsculas
// (OBJETIVO:, ACTIVIDAD:, HERRAMIENTAS:, ENTREGABLES:, CRITERIOS DE EVALUACIÓN:, CASOS POR ESTUDIANTE:…).
// Esta función la separa en partes. La usan la vista del profesor, la página del estudiante y la exportación a Excel.

export const TITULOS_DESCRIPCION = ['OBJETIVO', 'ACTIVIDAD', 'HERRAMIENTAS', 'ENTREGABLES', 'CRITERIOS DE EVALUACIÓN', 'CRITERIOS DE EVALUACION', 'CRITERIOS', 'TEMAS POR GRUPO', 'CASOS POR GRUPO', 'CASOS POR ESTUDIANTE', 'GRUPOS', 'RECURSOS', 'INSTRUCCIONES'];

export function partesDescripcion(texto: string): { titulo: string; cuerpo: string }[] {
  const t = String(texto || '').replace(/\*\*/g, '').trim();
  const re = new RegExp(`(^|\\n|\\.\\s|\\s)(${TITULOS_DESCRIPCION.join('|')})\\s*:`, 'g');
  const cortes: { i: number; fin: number; titulo: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) cortes.push({ i: m.index + m[1].length, fin: re.lastIndex, titulo: m[2] });
  if (cortes.length < 2) return [{ titulo: '', cuerpo: t }];
  const partes = cortes.map((c, k) => ({ titulo: c.titulo.replace('CRITERIOS DE EVALUACION', 'CRITERIOS DE EVALUACIÓN'), cuerpo: t.slice(c.fin, k + 1 < cortes.length ? cortes[k + 1].i : t.length).trim() }));
  const antes = t.slice(0, cortes[0].i).trim();
  return antes ? [{ titulo: '', cuerpo: antes }, ...partes] : partes;
}
