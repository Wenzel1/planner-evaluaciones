'use client';
// Chat de la sección: profesor y estudiantes de una materia y sección. Sobrio, con archivos y notas de voz.
// En la vista del profesor también aparecen (solo para él) las observaciones de los administradores y las opiniones del plan.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Sparkles, Trash2, ShieldCheck, ThumbsUp, Lightbulb, X, Loader2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { VerAdjunto, BotonAdjuntar, Grabadora, subirAdjunto, type Adjunto } from '@/components/MensajeAdjunto';

interface Item {
  id: string; tipo: 'MENSAJE' | 'OBSERVACION' | 'OPINION'; autorTipo: 'PROFESOR' | 'ESTUDIANTE' | 'ADMIN' | 'SUPERADMIN';
  autorNombre: string; avatar: { id: string; v: string } | null; mio: boolean; texto: string; createdAt: string;
  adjunto: Adjunto | null; deAcuerdo?: boolean; referencia?: string | null;
}

const qs = (p: Record<string, string>) => new URLSearchParams(p).toString();
const hora = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const dia = (d: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));

// Formato mínimo para el resumen de la IA: **negrita** y viñetas
function Texto({ t }: { t: string }) {
  return <>{t.split('\n').map((linea, i) => {
    const partes = linea.replace(/^\s*[-*]\s+/, '• ').split(/(\*\*[^*]+\*\*)/g);
    return <p key={i} className={linea.trim() ? '' : 'h-1.5'}>{partes.map((p, k) => (p.startsWith('**') ? <strong key={k} className="text-[color:var(--c-e0e0ec)]">{p.slice(2, -2)}</strong> : <span key={k}>{p}</span>))}</p>;
  })}</>;
}

export default function ChatSeccion({ modo, api, params, titulo }: { modo: 'profesor' | 'estudiante'; api: string; params: Record<string, string>; titulo?: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [estudiantes, setEstudiantes] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ nombre: string; p: number } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<{ cargando: boolean; texto?: string; error?: string } | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const pegadoAbajo = useRef(true);
  const consulta = qs(params);

  const cargar = useCallback(async () => {
    const r = await fetch(`${api}?${consulta}`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) { if (r) setItems(i => i ?? []); return; }
    const d = await r.json();
    setItems(d.items || []); if (typeof d.estudiantes === 'number') setEstudiantes(d.estudiantes);
  }, [api, consulta]);
  useEffect(() => {
    setItems(null); setResumen(null); pegadoAbajo.current = true;
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 15000);
    return () => clearInterval(t);
  }, [cargar]);
  // Baja solo si ya estaba abajo (no interrumpe a quien está leyendo mensajes viejos)
  useEffect(() => { const el = lista.current; if (el && pegadoAbajo.current) el.scrollTop = el.scrollHeight; }, [items?.length, progreso]);

  const publicar = async (cuerpo: Record<string, unknown>) => {
    const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, ...cuerpo }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
    pegadoAbajo.current = true;
    await cargar();
  };
  const enviar = async () => {
    const t = texto.trim(); if (!t) return;
    setEnviando(true); setError('');
    try { await publicar({ texto: t }); setTexto(''); } catch (e: any) { setError(e.message); } finally { setEnviando(false); }
  };
  const enviarAdjunto = async (archivo: File | Blob, nombre: string, duracion?: number) => {
    setEnviando(true); setError(''); setProgreso({ nombre, p: 0 });
    try {
      const adjunto = await subirAdjunto(`${api}/subida`, params, archivo, nombre, (p) => setProgreso({ nombre, p }), duracion);
      await publicar({ texto: texto.trim(), adjunto }); setTexto('');
    } catch (e: any) { setError(e.message); } finally { setEnviando(false); setProgreso(null); }
  };
  const borrar = async (id: string) => {
    if (!window.confirm('¿Borrar este mensaje del chat? Lo dejarán de ver todos.')) return;
    const r = await fetch(`${api}?${consulta}&id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (r?.ok) setItems(l => (l || []).filter(m => m.id !== id));
  };
  const resumir = async () => {
    setResumen({ cargando: true });
    const r = await fetch(`${api}/resumen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setResumen(r?.ok ? { cargando: false, texto: d.texto } : { cargando: false, error: d.error || 'No se pudo resumir.' });
  };

  const urlAdjunto = (id: string) => `${api}?${consulta}&adjunto=${encodeURIComponent(id)}`;
  const mensajesEst = (items || []).filter(m => m.autorTipo === 'ESTUDIANTE').length;

  return (
    <section className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
      {/* Encabezado */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[color:var(--c-282a3f)]">
        <MessageSquare className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">{titulo || `Chat de la Sección ${params.seccion || ''}`}</h2>
          <p className="text-[11px] text-[color:var(--c-8a8b9e)]">{modo === 'profesor' ? `${estudiantes ?? '…'} estudiante${estudiantes === 1 ? '' : 's'} · lo que escribes aquí lo ve toda la sección` : 'Lo ven tu profesor y tus compañeros de sección'}</p>
        </div>
        {modo === 'profesor' && (
          <button type="button" onClick={resumir} disabled={resumen?.cargando || !mensajesEst} title={mensajesEst ? 'La IA resume quejas, recomendaciones y dudas de tus estudiantes' : 'Aún no hay mensajes de estudiantes'} className="h-8 px-3 rounded-lg border border-[color:var(--c-313248)] text-xs font-medium text-[color:var(--c-c7d2fe)] hover:border-[color:var(--c-414258)] flex items-center gap-1.5 disabled:opacity-40">
            {resumen?.cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}Resumir con IA
          </button>
        )}
      </div>

      {/* Resumen de la IA */}
      {resumen && !resumen.cargando && (
        <div className="mx-4 mt-3 rounded-xl border border-[color:var(--c-818cf8)]/25 bg-[color:var(--c-818cf8)]/[0.06] px-4 py-3 text-[13px] text-[color:var(--c-c0c0d0)] leading-relaxed relative">
          <button type="button" onClick={() => setResumen(null)} aria-label="Cerrar el resumen" className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)]"><X className="w-3.5 h-3.5" /></button>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-a5b4fc)] mb-1.5 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Resumen de lo que dicen tus estudiantes</p>
          {resumen.error ? <p className="text-red-300">{resumen.error}</p> : <div className="space-y-0.5 pr-6"><Texto t={resumen.texto || ''} /></div>}
        </div>
      )}

      {/* Mensajes */}
      <div ref={lista} onScroll={(e) => { const el = e.currentTarget; pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="max-h-[440px] min-h-[160px] overflow-y-auto px-4 py-3">
        {items === null ? <p className="text-xs text-[color:var(--c-8a8b9e)] text-center py-8">Cargando…</p>
          : items.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)] text-center py-8">{modo === 'profesor' ? 'Aún no hay mensajes. Escribe un aviso para toda la sección.' : 'Aún no hay mensajes. Escribe tu duda: la ve tu profesor y tus compañeros.'}</p>
          : items.map((m, i) => {
            const prev = items[i - 1];
            const nuevoDia = !prev || dia(prev.createdAt) !== dia(m.createdAt);
            const seguido = !!prev && !nuevoDia && prev.tipo === 'MENSAJE' && m.tipo === 'MENSAJE' && prev.autorNombre === m.autorNombre && prev.autorTipo === m.autorTipo && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
            const especial = m.tipo !== 'MENSAJE';
            return (
              <div key={m.id}>
                {nuevoDia && <div className="flex items-center gap-3 my-3"><span className="flex-1 h-px bg-[color:var(--c-282a3f)]" /><span className="text-[10px] uppercase tracking-wider text-[color:var(--c-6a6b7e)]">{dia(m.createdAt)}</span><span className="flex-1 h-px bg-[color:var(--c-282a3f)]" /></div>}
                <div className={`group flex gap-3 rounded-lg px-2 -mx-2 ${seguido ? 'py-0.5' : 'pt-2.5 pb-1'} ${especial ? (m.tipo === 'OBSERVACION' ? 'bg-amber-500/[0.05]' : 'bg-[color:var(--c-818cf8)]/[0.04]') : 'hover:bg-white/[0.02]'}`}>
                  <div className="w-8 flex-shrink-0">
                    {!seguido && (m.tipo === 'OBSERVACION'
                      ? <span className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-amber-300" /></span>
                      : <Avatar id={m.avatar?.id} version={m.avatar?.v} nombre={m.autorNombre} tamano={32} />)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!seguido && (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[color:var(--c-e0e0ec)]">{m.mio ? 'Tú' : m.autorNombre}</span>
                        {m.autorTipo === 'PROFESOR' && <span className="text-[10px] font-medium px-1.5 py-px rounded bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]">Profesor(a)</span>}
                        {m.tipo === 'OBSERVACION' && <span className="text-[10px] font-semibold px-1.5 py-px rounded bg-amber-500/15 text-amber-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{m.autorTipo === 'SUPERADMIN' ? 'Superadmin' : 'Administrador'}</span>}
                        {m.tipo === 'OPINION' && <span className={`text-[10px] font-medium px-1.5 py-px rounded flex items-center gap-1 ${m.deAcuerdo ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{m.deAcuerdo ? <ThumbsUp className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}{m.deAcuerdo ? 'De acuerdo con el plan' : 'Sugerencia sobre el plan'}</span>}
                        <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{hora(m.createdAt)}</span>
                        {especial && modo === 'profesor' && <span className="text-[10px] text-[color:var(--c-6a6b7e)]">· solo tú lo ves</span>}
                      </div>
                    )}
                    {m.referencia && <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Sobre «{m.referencia}»</p>}
                    {m.adjunto && <div className="mt-1"><VerAdjunto adjunto={m.adjunto} mio={false} url={urlAdjunto(m.id)} /></div>}
                    {m.texto && <p className="text-[13px] text-[color:var(--c-c0c0d0)] whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>}
                  </div>
                  {modo === 'profesor' && m.tipo === 'MENSAJE' && (
                    <button type="button" onClick={() => borrar(m.id)} title="Borrar mensaje" aria-label="Borrar mensaje" className="self-start mt-1 w-7 h-7 rounded-lg flex items-center justify-center text-[color:var(--c-6a6b7e)] hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            );
          })}
        {progreso && <div className="ml-11 mt-2 w-56"><p className="text-[11px] text-[color:var(--c-c7d2fe)] truncate">Enviando {progreso.nombre}…</p><div className="mt-1 h-1 rounded-full bg-[color:var(--c-282a3f)] overflow-hidden"><div className="h-full bg-[color:var(--c-818cf8)] transition-all" style={{ width: `${progreso.p}%` }} /></div></div>}
      </div>

      {/* Escribir */}
      <div className="px-3 py-2.5 border-t border-[color:var(--c-282a3f)]">
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-1.5 items-center flex-wrap">
          {!grabando && <BotonAdjuntar deshabilitado={enviando} onArchivo={(f) => enviarAdjunto(f, f.name)} />}
          {!grabando && <input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 2000))} placeholder={modo === 'profesor' ? 'Escribe a toda la sección…' : 'Escribe a tu sección…'} className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]" />}
          {texto.trim() && !grabando
            ? <button type="submit" disabled={enviando} aria-label="Enviar" className="w-10 h-10 rounded-xl bg-[color:var(--c-818cf8)] text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send className="w-4 h-4" /></button>
            : <Grabadora deshabilitado={enviando} onGrabando={setGrabando} onListo={(audio, nombre, seg) => enviarAdjunto(audio, nombre, seg)} />}
        </form>
        {error && <p className="text-[11px] text-red-300 mt-1.5">{error}</p>}
      </div>
    </section>
  );
}
