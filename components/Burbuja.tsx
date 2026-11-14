'use client';
// Burbuja de mensaje estilo WhatsApp (mensajes privados y chat de la sección): los míos a la derecha en azul,
// los demás a la izquierda en gris; la hora abajo a la derecha dentro de la burbuja.
import { useEffect, useRef, type ReactNode } from 'react';
import { CheckCheck } from 'lucide-react';
import { VerAdjunto, type Adjunto } from '@/components/MensajeAdjunto';

const hora = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
export const diaChat = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));

export function Burbuja({ mio, seguido, nombre, colorNombre, insignia, texto, createdAt, adjunto, urlAdjunto, pie }: {
  mio: boolean; seguido?: boolean; nombre?: string; colorNombre?: string; insignia?: ReactNode;
  texto: string; createdAt: string; adjunto?: Adjunto | null; urlAdjunto?: string; pie?: ReactNode;
}) {
  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'} ${seguido ? 'mt-0.5' : 'mt-2'}`}>
      <div className={`relative max-w-[82%] rounded-xl px-2.5 pt-1.5 pb-1 shadow-sm ${mio ? 'bg-[#22406a] text-[#e9edf5]' : 'bg-[color:var(--c-232430)] text-[color:var(--c-d0d0da)]'} ${!seguido ? (mio ? 'rounded-tr-sm' : 'rounded-tl-sm') : ''}`}>
        {!mio && !seguido && nombre && (
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[12px] font-semibold" style={colorNombre ? { color: colorNombre } : undefined}>{nombre}</span>{insignia}
          </div>
        )}
        {adjunto && urlAdjunto && <div className="my-1"><VerAdjunto adjunto={adjunto} mio={mio} url={urlAdjunto} /></div>}
        <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">
          {texto}
          <span className={`float-right ml-2.5 mt-1.5 text-[10px] leading-none flex items-center gap-0.5 ${mio ? 'text-[#e9edf5]/60' : 'text-[color:var(--c-6a6b7e)]'}`}>
            {pie}{hora(createdAt)}{mio && <CheckCheck className="w-3.5 h-3.5 ml-0.5" />}
          </span>
        </p>
      </div>
    </div>
  );
}

export function SeparadorDia({ fecha }: { fecha: string }) {
  return <div className="flex justify-center my-2.5"><span className="text-[11px] px-3 py-1 rounded-lg bg-[color:var(--c-232430)] text-[color:var(--c-8a8b9e)] first-letter:uppercase">{diaChat(fecha)}</span></div>;
}

// Baja al último mensaje SOLO dentro de la caja del chat (sin mover la página), si ya estaba abajo o si lo pide
export function useBajarAlFinal(deps: unknown[], activo = true) {
  const caja = useRef<HTMLDivElement>(null);
  const abajo = useRef(true);
  const onScroll = () => { const el = caja.current; if (el) abajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; };
  useEffect(() => {
    const el = caja.current; if (!el) return;
    if (!activo) { el.scrollTop = 0; return; }
    if (!abajo.current) return;
    el.scrollTop = el.scrollHeight;
    const t = setTimeout(() => { if (abajo.current) el.scrollTop = el.scrollHeight; }, 250); // por si cargan imágenes o audios
    return () => clearTimeout(t);
  }, [...deps, activo]); // eslint-disable-line react-hooks/exhaustive-deps
  return { caja, onScroll, forzar: () => { abajo.current = true; } };
}
