'use client';
// «Avisar cambios»: el plan del estudiante se actualiza solo, pero el correo sale cuando el profesor lo decide.
// El botón aparece solo si hay cambios sin avisar en la sección; abre una ventana con el resumen antes de enviar.
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BellRing, Loader2, Send, X } from 'lucide-react';
import { VentanaFlotante } from '@/components/planificador/ui';

interface Datos { cambios: { id: string; tipo: string; texto: string }[]; primeraVez: boolean; destinatarios: number }

export default function AvisarCambios({ materiaId, seccion, version, agregarNotificacion }: { materiaId: string | null; seccion: string; version: string; agregarNotificacion: (t: string) => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState<'' | 'enviar' | 'descartar'>('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!materiaId) return;
    const r = await fetch(`/api/planificaciones/cambios?materiaId=${encodeURIComponent(materiaId)}&seccion=${encodeURIComponent(seccion)}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setDatos(await r.json());
  }, [materiaId, seccion]);
  // Se vuelve a consultar poco después de cada cambio del plan (cuando ya se guardó)
  useEffect(() => { setDatos(null); }, [materiaId, seccion]);
  useEffect(() => { const t = setTimeout(cargar, 2500); return () => clearTimeout(t); }, [cargar, version]);

  const enviar = async (descartar = false) => {
    setEnviando(descartar ? 'descartar' : 'enviar'); setError('');
    try {
      const r = await fetch('/api/planificaciones/cambios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId, seccion, nota, descartar }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el aviso.');
      setAbierto(false); setNota('');
      agregarNotificacion(descartar ? `🔕 Cambios de la Sección ${seccion} marcados como avisados (no se envió nada).`
        : d.enviados ? `📣 Aviso enviado a ${d.enviados} estudiante(s) de la Sección ${seccion}.${d.sinDestino ? ` ${d.sinDestino} sin correo ni teléfono.` : ''}` : `📣 ${d.aviso || 'Listo.'}`);
      await cargar();
    } catch (e: any) { setError(e.message); } finally { setEnviando(''); }
  };

  const n = datos?.cambios.length || 0;
  if (!materiaId || !n) return null;
  const titulo = datos!.primeraVez ? `Publicar el plan a la Sección ${seccion}` : `Avisar cambios a la Sección ${seccion}`;

  return (
    <>
      <button type="button" onClick={() => { setAbierto(true); setError(''); }} title={titulo}
        className="whitespace-nowrap h-9 px-3 rounded-lg border border-[color:var(--c-818cf8)]/40 bg-[color:var(--c-818cf8)]/10 text-xs font-semibold text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/20 flex items-center gap-1.5 transition-colors">
        <BellRing className="w-3.5 h-3.5" />{datos!.primeraVez ? 'Publicar plan' : 'Avisar cambios'}<span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--c-818cf8)] text-white text-[10px] font-bold flex items-center justify-center">{n}</span>
      </button>
      <AnimatePresence>
        {abierto && (
          <VentanaFlotante onCerrar={() => !enviando && setAbierto(false)} ancho="max-w-lg">
            <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><BellRing className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">{titulo}</h3>
                  <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">{datos!.primeraVez ? 'Les llega un mensaje con su plan de evaluación.' : 'Les llega un solo mensaje con todos estos cambios.'} {datos!.destinatarios ? `${datos!.destinatarios} estudiante(s) lo recibirán.` : 'Nadie tiene correo o teléfono: lo verán al entrar a su cuenta.'}</p>
                </div>
                <button type="button" onClick={() => setAbierto(false)} disabled={!!enviando} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
              </div>
              <ul className="rounded-xl border border-[color:var(--c-2a2b3d)] bg-[color:var(--c-191a26)] divide-y divide-[color:var(--c-282a3f)] max-h-60 overflow-y-auto custom-scrollbar">
                {datos!.cambios.map(c => <li key={c.id} className="px-3.5 py-2.5 text-[13px] text-[color:var(--c-d0d0da)]">{c.texto}</li>)}
              </ul>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-1.5">Nota para tus estudiantes (opcional)</label>
                <textarea value={nota} onChange={(e) => setNota(e.target.value.slice(0, 500))} rows={2} placeholder="Ej.: Revisen la nueva fecha y traigan el avance impreso." className="w-full px-3 py-2 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-none" />
              </div>
              {error && <p className="text-xs text-red-300">{error}</p>}
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => enviar(true)} disabled={!!enviando} title="Los marca como avisados sin enviar nada" className="h-9 px-3 rounded-lg text-xs font-medium text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)] disabled:opacity-50 flex items-center gap-1.5">{enviando === 'descartar' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}No avisar estos cambios</button>
                <button type="button" onClick={() => enviar(false)} disabled={!!enviando} className="h-9 px-4 rounded-xl bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2">{enviando === 'enviar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Enviar a la Sección {seccion}</button>
              </div>
            </div>
          </VentanaFlotante>
        )}
      </AnimatePresence>
    </>
  );
}
