// Datos y utilidades compartidas por las pestañas del panel del estudiante
import type { EntregaInfo } from '@/components/EntregaEstudiante';

export interface Grupo { clave: string; claseId: string; token: string; materiaId: string; materia: string; profesor: string; seccion: string; promedio: number | null; pesoEvaluado: number; puntos: number; total: number }
export interface EvalResumen {
  grupo: string; claseId: string; token: string; materia: string; profesor: string;
  id: string; nombre: string; tipoActividad: string | null; fecha: string | null; duracion: number | null; peso: number | null; estado: string;
  abierta: boolean; abreEl?: string | null; nota: { puntaje: number; observaciones: string | null } | null;
  aceptaEntregas: boolean; entrega: EntregaInfo | null; examen: { estado: string } | null;
  mensajes: number; mensajesNuevos: number;
}
export interface Resumen { grupos: Grupo[]; evaluaciones: EvalResumen[]; archivos: boolean; generado: string }
export type AbrirEvaluacion = (ev: { claseId: string; materiaId?: string; evaluacionId: string }) => void;

// Un color fijo por materia (para el calendario y las listas)
const COLORES = ['#4f8bf0', '#22a06b', '#e2a03f', '#2bb3a3', '#d9665b', '#7a8aa3', '#3fb6d8', '#c27ba0'];
export const colorDe = (grupos: Grupo[], clave: string) => COLORES[Math.max(0, grupos.findIndex(g => g.clave === clave)) % COLORES.length];

const ZONA = 'America/Caracas';
export const fechaCorta = (d: string | Date) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
export const fechaHora = (d: string | Date) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
export const diasHasta = (d: string | Date) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
export function cuandoTexto(d: string | Date | null): string {
  if (!d) return 'Sin fecha';
  const n = diasHasta(d);
  if (n < -1) return `hace ${-n} días`;
  if (n === -1) return 'ayer';
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}
export const textoNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));
export const limpiar = (t: string) => String(t || '').replace(/^Evaluaci[oó]n\s*\d+\s*:\s*/i, '');

// Estado de la entrega de una evaluación (solo las que reciben entregas)
export type EstadoEntrega = 'por_corregir' | 'revisada' | 'entregada' | 'atrasada' | 'pendiente' | 'bloqueada';
export function estadoEntrega(e: EvalResumen): EstadoEntrega | null {
  if (!e.aceptaEntregas || e.estado === 'CANCELADA') return null;
  if (e.entrega?.devuelta) return 'por_corregir';
  if (e.entrega?.revisada) return 'revisada';
  if (e.entrega) return 'entregada';
  if (!e.abierta) return 'bloqueada'; // todavía no se abre: no se puede entregar (no cuenta como pendiente ni atrasada)
  if (e.fecha && new Date(e.fecha).getTime() < Date.now()) return 'atrasada';
  return 'pendiente';
}
export const ESTADO_ENTREGA: Record<EstadoEntrega, { texto: string; clase: string }> = {
  por_corregir: { texto: 'Por corregir', clase: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  revisada: { texto: 'Revisada', clase: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  entregada: { texto: 'Entregada · por revisar', clase: 'bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-c7d2fe)] border-[color:var(--c-818cf8)]/30' },
  atrasada: { texto: 'Atrasada', clase: 'bg-red-500/10 text-red-300 border-red-500/30' },
  pendiente: { texto: 'Pendiente', clase: 'bg-[color:var(--c-272839)] text-[color:var(--c-b0b0c4)] border-[color:var(--c-313248)]' },
  bloqueada: { texto: 'Bloqueada', clase: 'bg-transparent text-[color:var(--c-6a6b7e)] border-[color:var(--c-313248)]' },
};

// Enlace para agregar una evaluación a Google Calendar
export function enlaceGoogle(e: EvalResumen): string | null {
  if (!e.fecha) return null;
  const ini = new Date(e.fecha); const fin = new Date(ini.getTime() + (e.duracion || 60) * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${limpiar(e.nombre)} · ${e.materia}`, dates: `${f(ini)}/${f(fin)}`, details: `Evaluación de ${e.materia} (Prof. ${e.profesor})${e.peso ? ` · ${e.peso}% de la nota` : ''}` });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// Cuánto necesita en lo que falta para aprobar con 10 (sobre 20)
export function paraAprobar(g: Grupo): { texto: string; tono: 'ok' | 'aviso' | 'mal' | 'neutro' } {
  if (g.pesoEvaluado <= 0) return { texto: 'Aún no tienes notas en esta materia.', tono: 'neutro' };
  const falta = Math.max(0, 100 - g.pesoEvaluado);
  if (falta <= 0) return g.puntos >= 10 ? { texto: `Nota final: ${textoNota(g.puntos)}. ¡Aprobaste!`, tono: 'ok' } : { texto: `Nota final: ${textoNota(g.puntos)}. Habla con tu profesor.`, tono: 'mal' };
  const necesita = (10 - g.puntos) / (falta / 100);
  if (necesita <= 0) return { texto: `Ya tienes los puntos para aprobar (llevas ${textoNota(g.puntos)} de 20).`, tono: 'ok' };
  if (necesita > 20) return { texto: `Con lo que falta (${falta}%) ya no alcanza para el 10. Habla con tu profesor.`, tono: 'mal' };
  return { texto: `Necesitas ${textoNota(Math.round(necesita * 10) / 10)} de promedio en lo que falta (${falta}% de la nota) para aprobar.`, tono: necesita > 14 ? 'aviso' : 'neutro' };
}
