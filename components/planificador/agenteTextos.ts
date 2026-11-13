// Textos y formato del chat del agente (funciones puras, sin estado)
import { escaparHTML } from '@/components/planificador/utilidades';

export const TITULO_ACCION: Record<string, string> = { proponer_evaluaciones: 'evaluaciones', crear_rubrica: 'crear rúbrica', buscar_recursos: 'buscar recursos', reprogramar: 'cambiar fecha', ajustar_pesos: 'ajustar pesos', generar_plan_accion: 'plan de acción', generar_preguntas: 'preguntas', copiar_plan: 'copiar plan', mensaje_estudiantes: 'mensaje a estudiantes', cambiar_estado: 'cambiar estado', recordar_preferencia: 'recordar', navegar: 'abrir pantalla', agregar_estudiantes: 'agregar estudiantes', modificar_estudiantes: 'modificar estudiantes', cargar_notas: 'cargar notas', abrir_en_portal: 'abrir en la página de estudiantes', enviar_plan: 'enviar plan', eliminar_evaluaciones: 'eliminar evaluaciones', cambiar_materia: 'cambiar de materia', crear_examen: 'examen en línea', recordatorios: 'recordatorios' };
// El modelo a veces copia el registro interno ("[Propuse …]"): esas líneas no se muestran
export const CAMPO_REPETIDO = /^\s*(?:[-•*]|\d+[.)])?\s*(?:\*\*)?\s*(nombre|contenido|tema|estrategia|tipo de actividad|tipo|enfoque|peso|ponderaci[oó]n|fecha|hora|duraci[oó]n|grupos?|personas por grupo|modalidad|descripci[oó]n|objetivo|actividad|herramientas|entregables|criterios(?: de evaluaci[oó]n)?|temas por grupo|casos(?: por (?:grupo|estudiante))?|examen en l[ií]nea)\s*(?:\*\*)?\s*:/i;
export const sinCamposPropuesta = (t: string) => {
  const lineas = String(t || '').split('\n');
  const fuera = new Set<number>();
  lineas.forEach((l, i) => {
    if (CAMPO_REPETIDO.test(l)) { fuera.add(i); return; }
    // Encabezados de cada evaluación ("### Evaluación 4: …", "**#4 Refactorización…**", "4. **Refactorización…**") seguidos de campos
    if (/^\s*(#{1,4}\s*|\*\*|\d+[.)]\s*\*\*|[-•*]\s*\*\*)\s*(evaluaci[oó]n\s*)?#?\d*/i.test(l) && CAMPO_REPETIDO.test(lineas[i + 1] || '')) fuera.add(i);
    // Continuación de una descripción partida en varias líneas: la línea siguiente a un campo que no es otro campo ni está vacía
  });
  const res = lineas.filter((_, i) => !fuera.has(i)).join('\n');
  return res.replace(/\n{3,}/g, '\n\n').trim();
};
export const sinResumenes = (t: string) => String(t || '').replace(/^\s*\[(Propuse|Prepar[eé]|Gener[eé]|Abr[ií]|Consult[eé]|Cre[eé])[^\]\n]*\]\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
// Lo que se muestra del texto del agente: sin resúmenes copiados y, si trae una propuesta, sin repetir los campos de la tarjeta
export const textoVisible = (m: { contenido?: string; acciones?: { tipo: string }[] }) => {
  const t = sinResumenes(m.contenido || '');
  return (m.acciones || []).some(a => a.tipo === 'proponer_evaluaciones') ? sinCamposPropuesta(t) : t;
};
// Acciones del agente que no cambian datos: se ejecutan solas al llegar
export const ACCIONES_AUTOMATICAS = ['navegar'];
// Con el modo automático también se aplican solas estas (todas se pueden deshacer). Notas, estudiantes, mensajes,
// eliminar y cambiar de materia SIEMPRE piden confirmación.
export const ACCIONES_SEGURAS = ['crear_rubrica', 'buscar_recursos', 'reprogramar', 'ajustar_pesos', 'abrir_en_portal', 'cambiar_estado', 'recordar_preferencia', 'generar_plan_accion'];
export const CLAVE_MODO_AUTO = 'agenteModoAuto';
// "Aplicar todo" aplica de una vez las tarjetas pendientes de un mensaje, menos las que envían mensajes, borran o recargan
export const FUERA_DE_APLICAR_TODO = ['recordatorios', 'mensaje_estudiantes', 'enviar_plan', 'eliminar_evaluaciones', 'cambiar_materia', 'generar_preguntas', 'navegar', 'crear_examen'];
export const VISTA_DE_AGENTE: Record<string, string> = { dashboard: 'estadisticas', planificador: 'planificacion', calendario: 'calendario', estudiantes: 'estudiantes', entregas: 'entregas', papelera: 'papelera', perfil: 'perfil' };
export const NOMBRE_VISTA: Record<string, string> = { dashboard: 'el Dashboard', planificador: 'el Planificador', calendario: 'el Calendario', estudiantes: 'Estudiantes', entregas: 'la Bandeja de entregas', papelera: 'la Papelera', perfil: 'tu perfil' };
export const TIPO_PREGUNTA: Record<string, string> = { seleccion: 'Selección', verdadero_falso: 'V o F', desarrollo: 'Desarrollo', caso: 'Caso', practica: 'Práctica' };

// Texto que ve el profesor cuando el agente (n8n) no pudo responder
export function mensajeErrorAgente(error: any): string {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return '⏳ El agente tardó demasiado en responder. Intenta de nuevo en un momento.';
  if (error instanceof TypeError) return '⚠️ No se pudo conectar con el agente. Revisa tu conexión a internet e intenta de nuevo.';
  return '⚠️ El agente no pudo responder en este momento (el servicio de IA devolvió un error). Intenta de nuevo en un minuto.';
}
export function limpiarBloqueJSON(texto: string): string { return String(texto ?? '').replace(/```json\s*[\s\S]*?\s*```/gi, '').trim(); }
export const formatMessage = (text: string) => {
  if (!text) return ''; const t = escaparHTML(limpiarBloqueJSON(text));
  return t
    .replace(/^[-*] (.*)$/gm, '<div class="flex gap-2 ml-2 my-0.5"><span class="text-[color:var(--c-818cf8)]">•</span><span>$1</span></div>')
    .replace(/^### (.*)$/gm, '<h4 class="text-[color:var(--c-c0c0d0)] font-semibold mt-4 mb-1">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 class="text-[color:var(--c-d0d0d8)] font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.*)$/gm, '<h2 class="text-[color:var(--c-e0e0e8)] font-bold mt-5 mb-3">$1</h2>')
    .replace(/^---$/gm, '<hr class="border-[color:var(--c-313248)] my-4"/>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[color:var(--c-e0e0e8)] font-semibold">$1</strong>')
    .replace(/(<\/(?:div|h2|h3|h4)>|<hr[^>]*\/>)\n/g, '$1')
    .replace(/\n/g, '<br/>');
};
