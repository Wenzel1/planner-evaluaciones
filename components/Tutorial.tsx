'use client';

// Recorrido guiado para quien entra por primera vez: resalta cada parte de la pantalla y explica para qué sirve.
// Se abre solo la primera vez (por usuario y navegador), se puede omitir en cualquier paso y repetir con el botón "?".
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
    { titulo: `¡Bienvenido${primerNombre ? `, ${primerNombre}` : ''}! 👋`, texto: 'Te muestro en un minuto cómo funciona el Planificador de Evaluaciones. Si ya lo conoces, presiona «Omitir»; puedes volver a verlo cuando quieras con el botón ?.' },
    { objetivo: 'agente', titulo: 'Tu asistente con IA', texto: esMovil
        ? 'Toca el botón del chat para hablar con el asistente. Escríbele como a un colega: «recomiéndame 4 evaluaciones», «mueve la 2 al viernes» o «hazme el examen de la 3».'
        : 'Escríbele como a un colega: «recomiéndame 4 evaluaciones para la Sección A», «mueve la 2 al viernes» o «hazme el examen de la 3». Él te propone y tú decides; en modo automático aplica solo lo seguro.' },
    { objetivo: 'divisor', titulo: 'Ajusta el tamaño', texto: 'Arrastra esta barra para hacer el chat más ancho o más angosto. Con doble clic vuelve al tamaño normal.', opcional: true },
    { objetivo: 'materia', titulo: 'Tus materias', texto: 'Cambia de materia o crea una nueva. Cada materia tiene su propio plan de evaluaciones.', opcional: true },
    { objetivo: 'formularios', titulo: 'Crear evaluaciones a mano', texto: 'Llena el tema, la estrategia, el peso, la fecha y los grupos, y presiona Guardar. Lo que te proponga el asistente también aparece aquí para que lo revises antes. Cuando ya tienes evaluaciones, este espacio se pliega para no estorbar.' },
    { objetivo: 'secciones', titulo: 'Secciones', texto: 'Si das la misma materia a varios grupos (A, B, C…), cada sección tiene sus propias evaluaciones y estudiantes.', opcional: true },
    { objetivo: 'guardadas', titulo: 'Tus evaluaciones', texto: 'Cada tarjeta muestra lo esencial. Usa «Notas» para calificar y el lápiz para editar; en el menú ⋯ están la rúbrica, los recursos de estudio y el examen en línea. Toca el nombre para ver el detalle.' },
    { objetivo: 'pestanas', titulo: 'Más herramientas', texto: 'Dashboard con estadísticas, Calendario para ver y mover fechas, Estudiantes (cada uno tiene su página personal) y Papelera para recuperar lo borrado.' },
    { objetivo: 'ayuda', titulo: '¡Listo! 🎉', texto: 'Ya conoces lo principal. Cuando quieras repetir este recorrido, presiona este botón.' },
  ];
}

const ANCHO = 340;
const MARGEN = 12;

export default function Tutorial({ pasos, onTerminar, alCambiarPaso }: { pasos: PasoTutorial[]; onTerminar: () => void; alCambiarPaso?: (p: PasoTutorial) => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vista, setVista] = useState({ w: 1024, h: 768 });
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

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
    const alto = 230;
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
        <div className="absolute rounded-xl border-2 border-[#818cf8] pointer-events-none transition-all duration-300 ease-out"
          style={{ ...hueco, boxShadow: '0 0 0 9999px rgba(8, 9, 20, 0.72), 0 0 24px 4px rgba(129, 140, 248, 0.45)' }} />
      ) : (
        <div className="absolute inset-0 bg-[#080914]/75 transition-opacity duration-300" />
      )}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div key={i} className="absolute bg-[#1d1e2e] border border-[#3a3d5c] rounded-2xl shadow-2xl shadow-black/60 p-5 transition-all duration-300 ease-out animate-[aparecer_.25s_ease-out]"
        style={{ ...tarjeta, width: ancho }}>
        <style>{`@keyframes aparecer { from { opacity: 0; transform: ${hueco ? 'translateY(6px)' : 'translate(-50%, calc(-50% + 6px))'}; } }`}</style>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {i === 0 && <Sparkles className="w-5 h-5 text-[#a5b4fc] flex-shrink-0" />}
            <h2 id="tutorial-titulo" className="text-base font-semibold text-[#e8e8f2]">{paso.titulo}</h2>
          </div>
          {!ultimo && (
            <button onClick={onTerminar} className="flex items-center gap-1 text-xs text-[#9a9bb0] hover:text-white px-2 py-1 rounded-lg hover:bg-[#272839] flex-shrink-0" aria-label="Omitir el tutorial">
              Omitir <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-[#b8b8c8] leading-relaxed">{paso.texto}</p>
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center gap-1" aria-label={`Paso ${i + 1} de ${pasos.length}`}>
            {pasos.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-4 bg-[#818cf8]' : k < i ? 'w-1.5 bg-[#818cf8]/50' : 'w-1.5 bg-[#3a3d5c]'}`} />)}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={() => ir(i - 1, -1)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#272839] text-[#c0c0d0] hover:bg-[#2e2f42]">
                <ChevronLeft className="w-3.5 h-3.5" />Atrás
              </button>
            )}
            <button autoFocus onClick={() => (ultimo ? onTerminar() : ir(i + 1, 1))} className="flex items-center gap-1 px-3.5 py-1.5 text-xs rounded-lg bg-[#818cf8] hover:bg-[#6f7af0] text-white font-semibold">
              {i === 0 ? 'Empezar recorrido' : ultimo ? 'Terminar' : 'Siguiente'}{!ultimo && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(contenido, document.body);
}
