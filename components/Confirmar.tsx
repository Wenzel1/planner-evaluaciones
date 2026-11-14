'use client';
// Cuadro de confirmación propio de la app (reemplaza al window.confirm del navegador).
// Uso: if (!(await confirmar('¿Borrar esto?'))) return;
//      o confirmar({ titulo, mensaje, boton, peligro })
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface OpcionesConfirmar { titulo?: string; mensaje: string; boton?: string; cancelar?: string; peligro?: boolean }

const PELIGRO = /borrar|eliminar|quitar|rechazar|salir|cancelar tu|se perder|reemplaz|dejará de funcionar/i;

function Cuadro({ o, responder, alTerminar }: { o: OpcionesConfirmar; responder: (v: boolean) => void; alTerminar: () => void }) {
  const [visible, setVisible] = useState(true);
  const respondido = useRef(false);
  const aceptar = useRef<HTMLButtonElement>(null);
  const cerrar = (v: boolean) => { if (respondido.current) return; respondido.current = true; responder(v); setVisible(false); }; // responde al instante; la salida se anima aparte
  useEffect(() => {
    aceptar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(false); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  const peligro = o.peligro ?? PELIGRO.test(`${o.titulo || ''} ${o.mensaje}`);
  const Icono = peligro ? AlertTriangle : HelpCircle;
  return (
    <AnimatePresence onExitComplete={alTerminar}>
      {visible && (
        <motion.div key="fondo" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(false); }}>
          <motion.div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="w-full max-w-sm rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] shadow-2xl p-5">
            <div className="flex gap-3.5">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${peligro ? 'bg-[#e8a0a0]/12 text-[#e8a0a0]' : 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-a5b4fc)]'}`}><Icono className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 id="confirmar-titulo" className="text-[15px] font-semibold text-[color:var(--c-e0e0ec)]">{o.titulo || (peligro ? '¿Seguro?' : 'Confirmar')}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--c-a0a0b4)] whitespace-pre-line">{o.mensaje}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => cerrar(false)} className="h-9 px-4 rounded-xl text-[13px] font-medium text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-282a3f)] transition-colors">{o.cancelar || 'Cancelar'}</button>
              <button ref={aceptar} type="button" onClick={() => cerrar(true)}
                className={`h-9 px-4 rounded-xl text-[13px] font-semibold transition-colors ${peligro ? 'bg-[#c96a6a] hover:bg-[#b85c5c] text-white' : 'bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white'}`}>
                {o.boton || (peligro ? 'Sí, continuar' : 'Aceptar')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function confirmar(o: string | OpcionesConfirmar): Promise<boolean> {
  const op: OpcionesConfirmar = typeof o === 'string' ? { mensaje: o } : o;
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise(resolve => {
    const nodo = document.createElement('div');
    document.body.appendChild(nodo);
    const raiz = createRoot(nodo);
    raiz.render(<Cuadro o={op} responder={resolve} alTerminar={() => setTimeout(() => { raiz.unmount(); nodo.remove(); }, 0)} />);
  });
}
