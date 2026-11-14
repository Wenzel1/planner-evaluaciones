'use client';

// Recorrido guiado para quien entra por primera vez: resalta cada parte de la pantalla y explica para qué sirve.
// Se abre solo la primera vez (por usuario y navegador), se puede omitir en cualquier paso y repetir con el botón "?".
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export interface PasoTutorial {
  objetivo?: string;      // valor de data-tutorial del elemento a resaltar (sin objetivo = tarjeta centrada)
  titulo: string;
  texto: string;
  opcional?: boolean;     // si el elemento no está en pantalla (ej. en el celular), el paso se salta
}

export const claveTutorial = (usuarioId: string) => `tutorialVisto:${usuarioId}`;
export function tutorialVisto(usuarioId: string): boolean {
  try { return localStorage.getItem(claveTutorial(usuarioId)) === '1'; } catch { return true; } // sin almacenamiento: no molestar
}
export function marcarTutorialVisto(usuarioId: string) {
  try { localStorage.setItem(claveTutorial(usuarioId), '1'); } catch { /* sin almacenamiento */ }
}

export function pasosTutorial(nombre: string, esMovil: boolean): PasoTutorial[] {
  const primerNombre = String(nombre || '').trim().split(/\s+/)[0] || '';
  return [
    { titulo: `¡Bienvenido${primerNombre ? `, ${primerNombre}` : ''}! 👋`, texto: 'En 1 minuto te muestro lo esencial del Planificador: el asistente EvaPlanner, tus evaluaciones, las notas y lo que reciben tus estudiantes. Presiona «Omitir» si ya lo conoces; el botón ? lo repite cuando quieras.' },
    { objetivo: 'agente', titulo: 'EvaPlanner, tu asistente con IA', texto: esMovil
        ? 'Toca el botón del chat para abrirlo. EvaPlanner crea planes y evaluaciones con temas actuales (busca en Google), arma rúbricas, exámenes y recursos, mueve fechas, ajusta pesos, carga notas y escribe a tus estudiantes. Siempre te muestra lo que va a hacer antes de aplicarlo.'
        : 'EvaPlanner crea planes y evaluaciones con temas actuales (busca en Google cada vez), arma rúbricas, exámenes en línea y recursos de estudio, mueve fechas, ajusta pesos para que sumen 100 %, carga notas, agrega estudiantes y les escribe. Siempre te muestra lo que va a hacer antes de aplicarlo.' },
    { objetivo: 'chat-entrada', titulo: 'Pídeselo como a un colega', texto: 'Ejemplos: «Hazme un plan de 4 evaluaciones», «mueve la 2 al viernes», «crea la rúbrica de la 3», «hazme el examen de la 1 con 10 preguntas», «¿quiénes están en riesgo?». Usa el clip para adjuntar el programa de la materia (PDF o Word) o el micrófono para dictar.', opcional: true },
    { objetivo: 'formularios', titulo: 'Nueva evaluación', texto: 'Este es el botón principal: abre el formulario para crear una evaluación a mano. Si se la pides a EvaPlanner en el chat, su propuesta se abre aquí mismo para que la revises y la guardes.' },
    { objetivo: 'guardadas', titulo: 'Tus evaluaciones', texto: 'Toca una evaluación (o el botón ⤢) para ver su detalle en grande, con sus acciones. El menú ⋮ tiene las más usadas: editar, entregas y notas. El estado (Programada, Realizada…) se cambia con un clic. Las acciones de la sección (código de clase, copiar el plan, acta de notas) están en «Sección ▾».' },
    { objetivo: 'bandeja', titulo: 'Bandeja de entregas', texto: 'Aquí llegan al momento los trabajos que entregan tus estudiantes. Ábrelos dentro del programa (PDF, Word, Excel, PowerPoint, código, .zip…), pon la nota con la rúbrica, márcalos como revisados o devuélvelos para corregir, y pasa al siguiente con las flechas. También está en la pestaña «Entregas».', opcional: true },
    { objetivo: 'pestanas', titulo: 'Más pantallas', texto: '📥 Entregas: los trabajos de tus estudiantes. 💬 Mensajes: el chat de cada sección y tus conversaciones privadas. 📁 Materiales: guías y enlaces por unidades. 📅 Calendario, 👥 Estudiantes y 📊 Dashboard. La campana te avisa de lo importante.' },
    { objetivo: 'ayuda', titulo: '¡Listo! 🎉', texto: 'Para empezar, prueba en el chat: «Hazme un plan de 4 evaluaciones». Cuando quieras repetir este recorrido, presiona este botón.' },
  ];
}

// Recorrido corto la primera vez que se entra a cada pestaña
export function pasosDeVista(vista: string | null): PasoTutorial[] {
  switch (vista) {
    case 'calendario': return [
      { objetivo: 'cal-nav', titulo: 'Tu calendario', texto: 'Cambia de mes con las flechas (en el teléfono, deslizando). Toca una sección para ocultarla o mostrarla. Si dos evaluaciones de la misma sección chocan, se marca en rojo.' },
      { objetivo: 'cal-grid', titulo: 'Mueve fechas arrastrando', texto: 'Arrastra una evaluación a otro día para cambiar su fecha; si ya está guardada, te pregunta si avisar a los estudiantes. Toca un día para ver sus evaluaciones y ábrelas en el planificador.', opcional: true },
      { objetivo: 'cal-recordatorios', titulo: 'Recordatorios', texto: 'Decide cuándo reciben el aviso tus estudiantes (1 semana, 3 días, 1 día, 2 horas) y en qué horario. También puedes enviar uno al instante o programar un mensaje.' },
      { objetivo: 'cal-exportar', titulo: 'Llévalo a tu calendario', texto: 'Descarga las fechas para Google Calendar o el calendario del celular.', opcional: true },
    ];
    case 'estudiantes': return [
      { objetivo: 'est-agregar', titulo: 'Tus estudiantes', texto: 'Agrégalos uno a uno con su correo y su sección. A ese correo les llegan el plan, los recordatorios y sus notas.' },
      { objetivo: 'est-importar', titulo: 'Desde Excel', texto: 'Descarga la plantilla, llénala y súbela para cargar toda la lista de una vez.', opcional: true },
    ];
    case 'estadisticas': return [
      { objetivo: 'dash-titulo', titulo: 'Dashboard', texto: 'El resumen de la materia: evaluaciones realizadas y pendientes, promedio, estudiantes en riesgo y cómo se reparten las estrategias. Se actualiza solo con tus cambios.' },
    ];
    case 'papelera': return [
      { titulo: 'Papelera', texto: 'Lo que eliminas (evaluaciones, estudiantes, materias) se guarda aquí 30 días. Puedes restaurarlo tal como estaba, con sus notas.' },
    ];
    default: return [];
  }
}

const ANCHO = 340;
const MARGEN = 12;

export default function Tutorial({ pasos, onTerminar, alCambiarPaso, etiquetaInicio = 'Empezar recorrido' }: { pasos: PasoTutorial[]; onTerminar: () => void; alCambiarPaso?: (p: PasoTutorial) => void; etiquetaInicio?: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vista, setVista] = useState({ w: 1024, h: 768 });
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;
  // Alto REAL de la tarjeta (antes se suponía 230 px y con textos largos quedaba cortada fuera de la pantalla)
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const [altoTarjeta, setAltoTarjeta] = useState(230);
  useLayoutEffect(() => { const h = tarjetaRef.current?.offsetHeight; if (h && Math.abs(h - altoTarjeta) > 2) setAltoTarjeta(h); });

  const elemento = useCallback((p?: PasoTutorial) => {
    if (!p?.objetivo) return null;
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${p.objetivo}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 ? el : null;
  }, []);

  // Avanza/retrocede saltando los pasos opcionales cuyo elemento no está en pantalla
  const ir = useCallback((destino: number, dir: 1 | -1) => {
    let n = destino;
    while (n > 0 && n < pasos.length - 1 && pasos[n].opcional && !elemento(pasos[n])) n += dir;
    setI(Math.max(0, Math.min(pasos.length - 1, n)));
  }, [pasos, elemento]);

  useEffect(() => { alCambiarPaso?.(paso); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lleva el elemento a la vista y sigue su posición (por si la pantalla se mueve o cambia de tamaño)
  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => {
      if (!vivo) return;
      setVista({ w: window.innerWidth, h: window.innerHeight });
      const el = elemento(paso);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = elemento(paso);
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: r.height > window.innerHeight * 0.7 ? 'start' : 'center', behavior: 'smooth' }); }
    medir();
    const t1 = setTimeout(medir, 120), t2 = setTimeout(medir, 450);
    const intervalo = setInterval(medir, 400);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { vivo = false; clearTimeout(t1); clearTimeout(t2); clearInterval(intervalo); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [i, paso, elemento]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTerminar();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ultimo ? onTerminar() : ir(i + 1, 1); }
      else if (e.key === 'ArrowLeft' && i > 0) ir(i - 1, -1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [i, ultimo, ir, onTerminar]);

  if (typeof document === 'undefined') return null;

  // Recuadro resaltado (un poco más grande que el elemento) y posición de la tarjeta
  const hueco = rect ? { top: Math.max(4, rect.top - 6), left: Math.max(4, rect.left - 6), width: Math.min(vista.w - 8, rect.width + 12), height: Math.min(vista.h - 8, rect.height + 12) } : null;
  const ancho = Math.min(ANCHO, vista.w - MARGEN * 2);
  let tarjeta: React.CSSProperties;
  if (!hueco) tarjeta = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  else {
    const alto = altoTarjeta;
    const derecha = vista.w - (hueco.left + hueco.width), izquierda = hueco.left;
    const abajo = vista.h - (hueco.top + hueco.height), arriba = hueco.top;
    const clampX = (x: number) => Math.max(MARGEN, Math.min(vista.w - ancho - MARGEN, x));
    const clampY = (y: number) => Math.max(MARGEN, Math.min(vista.h - alto - MARGEN, y));
    if (hueco.height > vista.h * 0.5 && Math.max(derecha, izquierda) > ancho + MARGEN * 2) {
      // Elemento alto (el chat, la lista): la tarjeta va al lado
      tarjeta = { top: clampY(hueco.top + hueco.height / 2 - alto / 2), left: derecha >= izquierda ? hueco.left + hueco.width + MARGEN : hueco.left - ancho - MARGEN };
    } else if (abajo >= alto + MARGEN || abajo >= arriba) {
      tarjeta = { top: Math.min(vista.h - alto - MARGEN, hueco.top + hueco.height + MARGEN), left: clampX(hueco.left) };
    } else {
      tarjeta = { top: Math.max(MARGEN, hueco.top - alto - MARGEN), left: clampX(hueco.left) };
    }
  }

  const contenido = (
    <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo">
      {/* Fondo oscuro con un "hueco" sobre el elemento explicado; bloquea los clics mientras dura el recorrido */}
      {hueco ? (
        <div className="absolute rounded-xl border-2 border-[color:var(--c-818cf8)] pointer-events-none transition-all duration-300 ease-out"
          style={{ ...hueco, boxShadow: '0 0 0 9999px rgba(8, 9, 20, 0.72), 0 0 24px 4px rgba(129, 140, 248, 0.45)' }} />
      ) : (
        <div className="absolute inset-0 bg-[color:var(--c-080914)]/75 transition-opacity duration-300" />
      )}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div key={i} ref={tarjetaRef} className="absolute bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-3a3d5c)] rounded-2xl shadow-2xl shadow-black/60 p-5 transition-all duration-300 ease-out animate-[aparecer_.25s_ease-out]"
        style={{ ...tarjeta, width: ancho, maxHeight: vista.h - MARGEN * 2, overflowY: 'auto' }}>
        <style>{`@keyframes aparecer { from { opacity: 0; transform: ${hueco ? 'translateY(6px)' : 'translate(-50%, calc(-50% + 6px))'}; } }`}</style>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {i === 0 && <Sparkles className="w-5 h-5 text-[color:var(--c-a5b4fc)] flex-shrink-0" />}
            <h2 id="tutorial-titulo" className="text-base font-semibold text-[color:var(--c-e8e8f2)]">{paso.titulo}</h2>
          </div>
          {!ultimo && (
            <button onClick={onTerminar} className="flex items-center gap-1 text-xs text-[color:var(--c-9a9bb0)] hover:text-[color:var(--c-blanco)] px-2 py-1 rounded-lg hover:bg-[color:var(--c-272839)] flex-shrink-0" aria-label="Omitir el tutorial">
              Omitir <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-[color:var(--c-b8b8c8)] leading-relaxed">{paso.texto}</p>
        <div className="flex items-center justify-between mt-4 gap-3">
          {pasos.length > 1 ? (
            <div className="flex-1 min-w-0 max-w-[110px]" aria-label={`Paso ${i + 1} de ${pasos.length}`}>
              <p className="text-[11px] text-[color:var(--c-8a8b9e)] tabular-nums mb-1">Paso {i + 1} de {pasos.length}</p>
              <div className="h-1 rounded-full bg-[color:var(--c-3a3d5c)] overflow-hidden"><div className="h-full rounded-full bg-[color:var(--c-818cf8)] transition-all duration-300" style={{ width: `${((i + 1) / pasos.length) * 100}%` }} /></div>
            </div>
          ) : <span />}
          <div className="flex items-center gap-2 flex-shrink-0">
            {i > 0 && (
              <button onClick={() => ir(i - 1, -1)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[color:var(--c-272839)] text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-2e2f42)]">
                <ChevronLeft className="w-3.5 h-3.5" />Atrás
              </button>
            )}
            <button autoFocus onClick={() => (ultimo ? onTerminar() : ir(i + 1, 1))} className="flex items-center gap-1 px-3.5 py-1.5 text-xs rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6f7af0)] text-white font-semibold">
              {ultimo ? (pasos.length === 1 ? 'Entendido' : 'Terminar') : i === 0 ? etiquetaInicio : 'Siguiente'}{!ultimo && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(contenido, document.body);
}
