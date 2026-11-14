'use client';
// Lista desplegable con el estilo de la app (reemplaza al <select> del navegador, que no respeta el tema).
// Se usa igual que un <select>: mismas <option>, mismo value/defaultValue y el mismo onChange (e.target.value).
import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface Opcion { value: string; label: string; disabled?: boolean; grupo?: string }

const textoDe = (n: ReactNode): string => Children.toArray(n).map(x => (typeof x === 'string' || typeof x === 'number' ? String(x) : isValidElement(x) ? textoDe((x.props as any).children) : '')).join('');

function opcionesDe(children: ReactNode, grupo?: string): Opcion[] {
  const lista: Opcion[] = [];
  Children.toArray(children).forEach(n => {
    if (!isValidElement(n)) return;
    const p: any = n.props;
    if (n.type === 'option') lista.push({ value: String(p.value ?? textoDe(p.children)), label: textoDe(p.children), disabled: !!p.disabled, grupo });
    else if (n.type === 'optgroup') lista.push(...opcionesDe(p.children, p.label));
    else if (p?.children) lista.push(...opcionesDe(p.children, grupo)); // fragmentos
  });
  return lista;
}

export default function Selector({ value, defaultValue, onChange, className = '', disabled, children, title, ...resto }: {
  value?: string | number; defaultValue?: string | number; onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  className?: string; disabled?: boolean; children?: ReactNode; title?: string; 'aria-label'?: string;
}) {
  const opciones = opcionesDe(children);
  const [interno, setInterno] = useState(String(defaultValue ?? opciones[0]?.value ?? ''));
  const actual = value !== undefined ? String(value) : interno;
  const elegida = opciones.find(o => o.value === actual) ?? opciones[0];
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, arriba: false });
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const colocar = () => {
    const r = boton.current?.getBoundingClientRect(); if (!r) return;
    const alto = Math.min(320, opciones.length * 36 + 12);
    const arriba = r.bottom + alto + 8 > window.innerHeight && r.top > alto + 8;
    const ancho = Math.max(r.width, 200);
    setPos({ top: arriba ? r.top - alto - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - ancho - 8), width: ancho, arriba });
  };
  useLayoutEffect(() => { if (abierto) colocar(); }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!abierto) return;
    setActivo(Math.max(0, opciones.findIndex(o => o.value === actual)));
    const fuera = (e: MouseEvent) => { if (!boton.current?.contains(e.target as Node) && !lista.current?.contains(e.target as Node)) setAbierto(false); };
    const mover = (e: Event) => { if (lista.current && e.target instanceof Node && lista.current.contains(e.target)) return; setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', mover, true); window.addEventListener('resize', mover);
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('scroll', mover, true); window.removeEventListener('resize', mover); };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (abierto) lista.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView({ block: 'nearest' }); }, [activo, abierto]);

  const elegir = (o: Opcion) => {
    if (o.disabled) return;
    if (value === undefined) setInterno(o.value);
    if (o.value !== actual) onChange?.({ target: { value: o.value }, currentTarget: { value: o.value } });
    setAbierto(false); boton.current?.focus();
  };
  const teclado = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!abierto && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setAbierto(true); return; }
    if (!abierto) return;
    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(opciones.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = opciones[activo]; if (o) elegir(o); }
    else if (e.key === 'Tab') setAbierto(false);
  };

  return (
    <>
      <button ref={boton} type="button" disabled={disabled} title={title} aria-label={resto['aria-label']} aria-haspopup="listbox" aria-expanded={abierto}
        onClick={() => setAbierto(v => !v)} onKeyDown={teclado}
        className={`${className} inline-flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${abierto ? '!border-[color:var(--c-818cf8)]/60' : ''}`}>
        <span className="truncate min-w-0">{elegida?.label ?? ''}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[color:var(--c-8a8b9e)] transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && typeof document !== 'undefined' && createPortal(
        <div ref={lista} role="listbox" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[400] max-h-[320px] overflow-y-auto overscroll-contain custom-scrollbar rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1c1d2a)] shadow-2xl p-1.5">
          {opciones.map((o, i) => (
            <div key={`${o.grupo || ''}:${o.value}:${i}`}>
              {o.grupo && o.grupo !== opciones[i - 1]?.grupo && <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--c-6a6b7e)]">{o.grupo}</p>}
              <button type="button" role="option" aria-selected={o.value === actual} data-i={i} disabled={o.disabled}
                onMouseEnter={() => setActivo(i)} onClick={() => elegir(o)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[13px] transition-colors disabled:opacity-40 ${o.value === actual ? 'text-[color:var(--c-e0e0ec)] font-medium' : 'text-[color:var(--c-c0c0d0)]'} ${i === activo ? 'bg-[color:var(--c-818cf8)]/15' : ''}`}>
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {o.value === actual && <Check className="w-4 h-4 text-[color:var(--c-818cf8)] flex-shrink-0" />}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
