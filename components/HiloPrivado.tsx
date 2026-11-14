'use client';
// Conversación privada profesor ↔ estudiante en UN solo hilo (estilo WhatsApp).
// Cada mensaje pertenece a una evaluación: cuando cambia el tema aparece una etiqueta «Sobre: …»,
// y al escribir se elige sobre cuál evaluación se habla. La usan la cuenta del profesor y la del estudiante.
import { useEffect, useState } from 'react';
import { Send, Tag } from 'lucide-react';
import Selector from '@/components/Selector';
import { Burbuja, SeparadorDia, diaChat, useBajarAlFinal } from '@/components/Burbuja';
import { BotonAdjuntar, Grabadora, subirAdjunto, type Adjunto } from '@/components/MensajeAdjunto';

export interface MensajeHilo { id: string; autor: string; texto: string; createdAt: string; adjunto?: Adjunto | null; evaluacionId: string; evaluacion: string }

export default function HiloPrivado({ yo, cargarUrl, enviarUrl, cuerpo, subidaUrl, subidaExtra, urlAdjunto, evaluaciones, evaluacionInicial, onLeidos, vacio }: {
  yo: 'PROFESOR' | 'ESTUDIANTE';
  cargarUrl: string;
  enviarUrl: (evaluacionId: string) => string;
  cuerpo: (evaluacionId: string) => Record<string, string>;
  subidaUrl: (evaluacionId: string) => string;
  subidaExtra: (evaluacionId: string) => Record<string, string>;
  urlAdjunto: (m: MensajeHilo) => string;
  evaluaciones: { id: string; nombre: string }[];
  evaluacionInicial?: string;
  onLeidos?: () => void;
  vacio?: string;
}) {
  const [lista, setLista] = useState<MensajeHilo[] | null>(null);
  const [sobre, setSobre] = useState(evaluacionInicial || '');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ nombre: string; p: number } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    const cargar = (primera: boolean) => fetch(cargarUrl, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((d) => {
      if (!vivo || !Array.isArray(d)) { if (vivo && primera) setLista(l => l ?? []); return; }
      setLista(d);
      if (primera) { onLeidos?.(); setSobre(s => s || d[d.length - 1]?.evaluacionId || ''); }
    }).catch(() => { if (vivo && primera) setLista(l => l ?? []); });
    setLista(null); cargar(true);
    const t = setInterval(() => { if (!document.hidden) cargar(false); }, 20000);
    return () => { vivo = false; clearInterval(t); };
  }, [cargarUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const tema = evaluaciones.some(e => e.id === sobre) ? sobre : evaluaciones[0]?.id || '';
  const nombreTema = evaluaciones.find(e => e.id === tema)?.nombre || '';
  const desplazar = useBajarAlFinal([lista?.length, progreso?.nombre]);

  const publicar = async (extra: Record<string, unknown>) => {
    const r = await fetch(enviarUrl(tema), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cuerpo(tema), ...extra }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(d.error || 'No se pudo enviar.');
    desplazar.forzar(); setLista(l => [...(l || []), { ...d, evaluacionId: tema, evaluacion: nombreTema }]);
  };
  const enviar = async () => {
    const t = texto.trim(); if (t.length < 2 || !tema) return;
    setEnviando(true); setError('');
    try { await publicar({ texto: t }); setTexto(''); } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };
  const enviarAdjunto = async (archivo: File | Blob, nombre: string, duracion?: number) => {
    if (!tema) return;
    setEnviando(true); setError(''); setProgreso({ nombre, p: 0 });
    try {
      const adjunto = await subirAdjunto(subidaUrl(tema), subidaExtra(tema), archivo, nombre, (p) => setProgreso({ nombre, p }), duracion);
      await publicar({ texto: texto.trim(), adjunto }); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); setProgreso(null); }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div ref={desplazar.caja} onScroll={desplazar.onScroll} className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar bg-[color:var(--c-161722)] px-3 sm:px-8 py-3">
        {lista === null ? <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-8">Cargando…</p>
          : lista.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)] text-center py-10">{vacio || 'Aún no hay mensajes. Escribe el primero.'}</p>
          : lista.map((m, k) => {
            const prev = lista[k - 1];
            const nuevoDia = !prev || diaChat(prev.createdAt) !== diaChat(m.createdAt);
            const nuevoTema = !prev || prev.evaluacionId !== m.evaluacionId;
            const seguido = !!prev && !nuevoDia && !nuevoTema && prev.autor === m.autor && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
            return (
              <div key={m.id}>
                {nuevoDia && <SeparadorDia fecha={m.createdAt} />}
                {nuevoTema && (
                  <div className="flex justify-center my-2"><span className="max-w-[90%] inline-flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-full border border-[color:var(--c-818cf8)]/25 bg-[color:var(--c-818cf8)]/[0.07] text-[color:var(--c-a5b4fc)]"><Tag className="w-3 h-3 flex-shrink-0" /><span className="truncate">Sobre: {m.evaluacion}</span></span></div>
                )}
                <Burbuja mio={m.autor === yo} seguido={seguido} texto={m.texto} createdAt={m.createdAt} adjunto={m.adjunto} urlAdjunto={urlAdjunto(m)} />
              </div>
            );
          })}
        {progreso && <div className="flex justify-end mt-2"><div className="w-48 rounded-xl rounded-tr-sm bg-[#22406a] px-3 py-2"><p className="text-[11px] text-[#e9edf5]/80 truncate">Enviando {progreso.nombre}…</p><div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-white/70 transition-all" style={{ width: `${progreso.p}%` }} /></div></div></div>}
      </div>

      {/* Escribir: primero sobre qué evaluación, luego el mensaje */}
      <div className="flex-shrink-0 border-t border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] px-3 pt-2 pb-2.5 space-y-2">
        {evaluaciones.length === 0 ? <p className="text-xs text-[color:var(--c-8a8b9e)] py-2 text-center">Todavía no hay evaluaciones sobre las que escribir.</p> : (
          <>
            <div className="flex items-center gap-2 text-[11px] text-[color:var(--c-8a8b9e)]">
              <Tag className="w-3.5 h-3.5 flex-shrink-0" /><span className="flex-shrink-0">Sobre</span>
              <Selector value={tema} onChange={(e) => setSobre(e.target.value)} aria-label="Sobre qué evaluación" className="flex-1 min-w-0 h-7 px-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-2a2b3d)] text-[11px] text-[color:var(--c-d0d0da)]">
                {evaluaciones.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Selector>
            </div>
            <form onSubmit={(ev) => { ev.preventDefault(); enviar(); }} className="flex gap-1.5 items-center">
              {!grabando && (
                <div className="flex-1 min-w-0 flex items-center gap-1 h-11 pl-1 pr-3 rounded-full bg-[color:var(--c-232430)] border border-transparent focus-within:border-[color:var(--c-818cf8)]/50">
                  <BotonAdjuntar deshabilitado={enviando} onArchivo={(f) => enviarAdjunto(f, f.name)} />
                  <input value={texto} onChange={(ev) => setTexto(ev.target.value.slice(0, 1000))} placeholder="Escribe un mensaje" className="flex-1 min-w-0 h-full bg-transparent text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
                </div>
              )}
              {texto.trim().length >= 2 && !grabando
                ? <button type="submit" disabled={enviando} aria-label="Enviar" className="w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send className="w-4 h-4" /></button>
                : (
                  <div className={grabando ? 'flex-1 min-w-0 flex items-center' : 'w-11 h-11 rounded-full bg-[color:var(--c-818cf8)] flex items-center justify-center flex-shrink-0 [&_button]:!text-white [&_button:hover]:!bg-transparent'}>
                    <Grabadora deshabilitado={enviando} onGrabando={setGrabando} onListo={(audio, nombre, seg) => enviarAdjunto(audio, nombre, seg)} />
                  </div>
                )}
            </form>
          </>
        )}
        {error && <p className="text-[11px] text-red-300 px-1">{error}</p>}
      </div>
    </div>
  );
}
