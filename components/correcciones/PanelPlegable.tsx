'use client';
// Panel lateral de los editores de corrección (comentarios, observaciones, nodo elegido…).
// Arranca plegado como una barrita con su icono y un contador, para que el archivo use todo el ancho.
// Se abre al tocarlo (o solo, cuando el editor lo pide al elegir algo) y se cierra con el botón o con Esc.
// Cada editor recuerda si lo dejaste abierto.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function usePanel(clave: string, defecto = false): [boolean, (v: boolean) => void] {
  const [abierto, setAbierto] = useState(defecto);
  useEffect(() => { try { const v = localStorage.getItem(`panel-correccion:${clave}`); if (v != null) setAbierto(v === '1'); } catch { /* sin almacenamiento */ } }, [clave]);
  const cambiar = useCallback((v: boolean) => { setAbierto(v); try { localStorage.setItem(`panel-correccion:${clave}`, v ? '1' : '0'); } catch { /* sin almacenamiento */ } }, [clave]);
  return [abierto, cambiar];
}

export default function PanelPlegable({ abierto, onCambiar, icono: I, titulo, contador, ancho = 320, children }: {
  abierto: boolean; onCambiar: (v: boolean) => void; icono: any; titulo: string; contador?: number | string | null; ancho?: number; children: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-dialogo-confirmar]')) return;
      const t = e.target as HTMLElement;
      if (t?.closest?.('input,textarea,[contenteditable=true],.monaco-editor')) return;
      e.stopPropagation(); onCambiar(false);
    };
    window.addEventListener('keydown', tecla, true); return () => window.removeEventListener('keydown', tecla, true);
  }, [abierto, onCambiar]);

  if (!abierto) {
    return (
      <button type="button" onClick={() => onCambiar(true)} title={`Mostrar: ${titulo}`}
        className="w-10 flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] hover:bg-[color:var(--c-232436)] flex flex-col items-center gap-2 pt-3 text-[color:var(--c-b0b0c4)] hover:text-[color:var(--c-e0e0ec)] transition-colors">
        <span className="relative">
          <I className="w-[18px] h-[18px]" />
          {contador ? <span className="absolute -top-2 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#f76b15] text-white text-[10px] font-bold flex items-center justify-center">{contador}</span> : null}
        </span>
        <span className="text-[11px] font-medium tracking-wide [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">{titulo}</span>
      </button>
    );
  }
  return (
    <aside style={{ width: ancho }} className="flex-shrink-0 max-w-[85%] border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] flex flex-col min-h-0">
      <div className="flex-shrink-0 h-10 flex items-center gap-2 pl-3 pr-1 border-b border-[color:var(--c-282a3f)]">
        <I className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
        <p className="flex-1 min-w-0 text-[12px] font-semibold text-[color:var(--c-d0d0da)] truncate">{titulo}{contador ? <span className="ml-1.5 text-[color:var(--c-8a8b9e)] font-normal">({contador})</span> : null}</p>
        <button type="button" onClick={() => onCambiar(false)} title="Ocultar el panel (Esc)" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </aside>
  );
}
