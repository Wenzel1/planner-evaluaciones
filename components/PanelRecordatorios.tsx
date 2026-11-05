'use client';
// Panel de recordatorios del profesor: estado del envío automático, cuándo se envían, próximas evaluaciones
// (con interruptor, nota y "Enviar ahora"), mensajes programados e historial de envíos con sus fallas.
import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, AlertTriangle, Send, Clock, X, ChevronDown, CalendarClock, Trash2, History, Settings2, RefreshCw } from 'lucide-react';

type Ventana = '7D' | '3D' | '1D' | '2H';
interface Pref { ventanas: Ventana[]; horaDesde: number; horaHasta: number; nota: string; avisarCambios: boolean }
interface Proxima { id: string; nombre: string; materia: string; seccion: string; fecha: string; estudiantes: number; apagada: boolean; nota: string; enviados: string[]; proximo: { cuando: string; cual: string } | null }
interface Lote { loteId: string; fecha: string; titulo: string; total: number; enviados: number; fallidos: number; pendientes: number; fallas: { nombre: string; error: string }[] }
interface Programado { id: string; seccion: string; texto: string; enviarEn: string; incluirEnlace: boolean }
interface Estado { ultima?: string; ok?: boolean; error?: string | null; mensajes?: number; noAutorizado?: { ultima: string; veces: number } }
interface Datos { pref: Pref; estado: Estado; proximas: Proxima[]; historial: Lote[]; programados: Programado[] }

const VENTANAS: { v: Ventana; t: string }[] = [{ v: '7D', t: '1 semana antes' }, { v: '3D', t: '3 días antes' }, { v: '1D', t: '1 día antes' }, { v: '2H', t: '2 horas antes' }];
const ZONA = 'America/Caracas';
const f = (d: string, op: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, ...op }).format(new Date(d));
const fechaCorta = (d: string) => f(d, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function hace(d?: string) {
  if (!d) return 'nunca';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'hace un momento'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
const hora12 = (h: number) => (h === 0 || h === 24 ? '12 a. m.' : h === 12 ? '12 p. m.' : h < 12 ? `${h} a. m.` : `${h - 12} p. m.`);
// Valor para <input type="datetime-local"> en la hora de Venezuela
function aLocal(d: Date) { const p = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d); return p.replace(' ', 'T'); }

const tarjeta = 'rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)]';
const titulo = 'text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] flex items-center gap-1.5';
const campo = 'bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-lg px-2.5 py-1.5 text-sm text-[color:var(--c-d8d8e2)] outline-none focus:border-[color:var(--c-818cf8)]';

export default function PanelRecordatorios({ onCerrar, notificar, enfoque, seccionActiva = 'A' }: { onCerrar: () => void; notificar: (m: string) => void; enfoque?: string; seccionActiva?: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [abiertoLote, setAbiertoLote] = useState<string | null>(null);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(enfoque || null);
  const [prog, setProg] = useState({ seccion: seccionActiva, texto: '', enviarEn: aLocal(new Date(Date.now() + 86400000)).slice(0, 11) + '07:00', incluirEnlace: true });
  const [programando, setProgramando] = useState(false);

  const cargar = async () => {
    setError('');
    try {
      const r = await fetch('/api/recordatorios', { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar.');
      setDatos(d);
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (enfoque && datos) setTimeout(() => document.getElementById(`rec-${enfoque}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150); }, [!!datos]);

  const guardar = async (cuerpo: any) => {
    const r = await fetch('/api/recordatorios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { notificar(`⚠️ ${d.error || 'No se pudo guardar.'}`); return; }
    await cargar();
  };
  const cambiarPref = (cambio: Partial<Pref>) => { if (!datos) return; setDatos({ ...datos, pref: { ...datos.pref, ...cambio } }); guardar({ pref: cambio }); };
  const enviarAhora = async (p: Proxima) => {
    setEnviando(p.id); setConfirmar(null);
    try {
      const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'enviar', evaluacionId: p.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar.');
      notificar(d.ok ? `📣 Recordatorio de «${p.nombre}» enviado a ${d.total} estudiante(s).` : `⚠️ ${d.error || 'Hubo fallas al enviar.'}`);
      await cargar();
    } catch (e: any) { notificar(`⚠️ ${e.message}`); }
    finally { setEnviando(null); }
  };
  const programar = async () => {
    setProgramando(true);
    try {
      const cuando = new Date(`${prog.enviarEn}:00-04:00`); // hora de Venezuela
      const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'programar', seccion: prog.seccion, texto: prog.texto, enviarEn: cuando.toISOString(), incluirEnlace: prog.incluirEnlace }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo programar.');
      notificar(`🗓️ Mensaje programado para el ${fechaCorta(cuando.toISOString())}.`);
      setProg(p => ({ ...p, texto: '' }));
      await cargar();
    } catch (e: any) { notificar(`⚠️ ${e.message}`); }
    finally { setProgramando(false); }
  };
  const cancelarProgramado = async (id: string) => {
    const r = await fetch(`/api/recordatorios?programado=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) { notificar('⚠️ No se pudo cancelar.'); return; }
    await cargar();
  };

  // ¿El envío automático está funcionando? (cron-job.org llama cada 15 min)
  const est = datos?.estado || {};
  const minutos = est.ultima ? (Date.now() - new Date(est.ultima).getTime()) / 60000 : Infinity;
  const claveMala = !!est.noAutorizado && (!est.ultima || new Date(est.noAutorizado.ultima) > new Date(est.ultima));
  const funciona = minutos < 40 && !claveMala;
  const secciones = [...new Set([seccionActiva, ...(datos?.proximas || []).map(p => p.seccion)])].sort();
  const lista = datos ? [...datos.proximas].sort((a, b) => (a.id === enfoque ? -1 : b.id === enfoque ? 1 : 0)) : [];

  return (
    <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[color:var(--c-313248)]">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center"><Bell className="w-[18px] h-[18px] text-[color:var(--c-a5b4fc)]" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Recordatorios</h3>
          <p className="text-xs text-[color:var(--c-8a8b9e)]">Avisos automáticos a tus estudiantes antes de cada evaluación</p>
        </div>
        <button type="button" onClick={cargar} title="Actualizar" className="p-2 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><RefreshCw className="w-4 h-4" /></button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {!datos && !error && <div className="flex items-center justify-center gap-2 py-10 text-sm text-[color:var(--c-8a8b9e)]"><span className="w-4 h-4 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" />Cargando…</div>}
        {datos && (<>
          {/* Estado del envío automático */}
          <div className={`rounded-2xl border px-4 py-3 ${funciona ? 'border-emerald-500/30 bg-emerald-500/[0.07]' : 'border-red-500/35 bg-red-500/[0.07]'}`}>
            <div className="flex items-start gap-3">
              {funciona ? <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0 text-sm">
                {funciona ? (
                  <p className="text-emerald-200"><strong>El envío automático está funcionando.</strong> Última revisión {hace(est.ultima)}{est.mensajes ? ` · ${est.mensajes} mensaje(s) enviados en esa pasada` : ''}.</p>
                ) : (<>
                  <p className="text-red-200 font-semibold">El envío automático no está funcionando.</p>
                  <p className="text-[13px] text-red-100/90 mt-1">
                    {claveMala ? <>cron-job.org llamó {hace(est.noAutorizado!.ultima)} con una <strong>clave que no coincide</strong> con <code>RECORDATORIOS_CLAVE</code> en Vercel. Pon la misma clave en los dos lados.</>
                      : est.ultima ? <>La última revisión fue {hace(est.ultima)}. Revisa en cron-job.org que el trabajo siga <strong>activo</strong> (se desactiva solo si falla varias veces).</>
                      : <>Todavía no ha llegado ninguna llamada de cron-job.org. Crea o reactiva el trabajo que llama cada 15 minutos a <code>/api/recordatorios/ejecutar</code>.</>}
                  </p>
                  <p className="text-[12px] text-[color:var(--c-8a8b9e)] mt-1.5">Mientras tanto puedes enviar cada recordatorio a mano con «Enviar ahora».</p>
                </>)}
                {est.ok === false && est.error && <p className="text-[12px] text-amber-300 mt-1.5">Último problema al enviar: {est.error}</p>}
              </div>
            </div>
          </div>

          {/* Cuándo se envían */}
          <div className={`${tarjeta} p-4 space-y-3`}>
            <p className={titulo}><Settings2 className="w-3.5 h-3.5" />Cuándo se envían</p>
            <div className="flex flex-wrap gap-1.5">
              {VENTANAS.map(({ v, t }) => {
                const on = datos.pref.ventanas.includes(v);
                return <button key={v} type="button" onClick={() => cambiarPref({ ventanas: on ? datos.pref.ventanas.filter(x => x !== v) : [...datos.pref.ventanas, v] })}
                  className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-[color:var(--c-818cf8)]/15 border-[color:var(--c-818cf8)]/50 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>{on ? '✓ ' : ''}{t}</button>;
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--c-b0b0c4)]">
              <span>Solo entre</span>
              <select value={datos.pref.horaDesde} onChange={(e) => cambiarPref({ horaDesde: Number(e.target.value) })} className={campo}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hora12(h)}</option>)}</select>
              <span>y</span>
              <select value={datos.pref.horaHasta} onChange={(e) => cambiarPref({ horaHasta: Number(e.target.value) })} className={campo}>{Array.from({ length: 24 }, (_, h) => h + 1).filter(h => h > datos.pref.horaDesde).map(h => <option key={h} value={h}>{hora12(h)}</option>)}</select>
              <span className="text-xs text-[color:var(--c-6a6b7e)]">(el de 2 horas antes sale siempre)</span>
            </div>
            <input defaultValue={datos.pref.nota} onBlur={(e) => { if (e.target.value.trim() !== datos.pref.nota) cambiarPref({ nota: e.target.value.trim() }); }} maxLength={300} placeholder="Nota para todos los recordatorios (opcional). Ej.: Lleguen 10 minutos antes." className={`${campo} w-full`} />
            <label className="flex items-center gap-2 text-sm text-[color:var(--c-b0b0c4)] cursor-pointer select-none">
              <input type="checkbox" checked={datos.pref.avisarCambios} onChange={(e) => cambiarPref({ avisarCambios: e.target.checked })} className="accent-[#818cf8]" />
              Avisar a los estudiantes cuando reprogramo o cancelo una evaluación
            </label>
          </div>

          {/* Próximas evaluaciones */}
          <div className={`${tarjeta} overflow-hidden`}>
            <p className={`${titulo} px-4 pt-4 pb-2`}><CalendarClock className="w-3.5 h-3.5" />Próximas evaluaciones (30 días)</p>
            {lista.length === 0 && <p className="px-4 pb-4 text-sm text-[color:var(--c-8a8b9e)]">No hay evaluaciones con fecha en los próximos 30 días.</p>}
            <div className="divide-y divide-[color:var(--c-2a2b3d)]">
              {lista.map(p => (
                <div key={p.id} id={`rec-${p.id}`} className={`px-4 py-3 ${p.id === enfoque ? 'bg-[color:var(--c-818cf8)]/[0.06]' : ''}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => guardar({ evaluacion: { id: p.id, apagada: !p.apagada } })} title={p.apagada ? 'Encender recordatorios' : 'Apagar recordatorios de esta evaluación'}
                      className={`mt-0.5 relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${p.apagada ? 'bg-[color:var(--c-3a3b52)]' : 'bg-[color:var(--c-818cf8)]'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${p.apagada ? 'left-0.5' : 'left-[18px]'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${p.apagada ? 'text-[color:var(--c-6a6b7e)]' : 'text-[color:var(--c-e0e0ec)]'}`}>{p.nombre}</p>
                      <p className="text-xs text-[color:var(--c-8a8b9e)]">{p.materia} · Sec. {p.seccion} · {fechaCorta(p.fecha)} · {p.estudiantes} estudiante(s)</p>
                      <p className="text-xs mt-1 flex flex-wrap items-center gap-1.5">
                        {p.apagada ? <span className="flex items-center gap-1 text-[color:var(--c-8a8b9e)]"><BellOff className="w-3 h-3" />Recordatorios apagados</span>
                          : p.proximo ? <span className="flex items-center gap-1 text-[color:var(--c-a5b4fc)]"><Clock className="w-3 h-3" />Próximo: {p.proximo.cual} · {fechaCorta(p.proximo.cuando)}</span>
                          : <span className="text-[color:var(--c-8a8b9e)]">No quedan recordatorios por enviar</span>}
                        {p.enviados.map(t => <span key={t} className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[10px]">✓ {t}</span>)}
                      </p>
                      {notaAbierta === p.id ? (
                        <input autoFocus defaultValue={p.nota} maxLength={300} placeholder="Nota solo para esta evaluación. Ej.: Traigan laptop" onBlur={(e) => { setNotaAbierta(null); if (e.target.value.trim() !== p.nota) guardar({ evaluacion: { id: p.id, nota: e.target.value } }); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={`${campo} w-full mt-2 text-xs`} />
                      ) : (
                        <button type="button" onClick={() => setNotaAbierta(p.id)} className="mt-1 text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-c7d2fe)]">{p.nota ? <>📝 {p.nota}</> : '+ Agregar nota a este recordatorio'}</button>
                      )}
                    </div>
                    {confirmar === p.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button type="button" onClick={() => enviarAhora(p)} className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-[color:var(--c-818cf8)] text-white">Sí, enviar</button>
                        <button type="button" onClick={() => setConfirmar(null)} className="h-8 px-2 rounded-lg text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]">No</button>
                      </div>
                    ) : (
                      <button type="button" disabled={enviando === p.id || !p.estudiantes} onClick={() => setConfirmar(p.id)} title={`Enviar el recordatorio ahora a la Sección ${p.seccion}`}
                        className="h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 flex-shrink-0 border border-[color:var(--c-313248)] text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 disabled:opacity-40">
                        {enviando === p.id ? <span className="w-3.5 h-3.5 border-2 border-[color:var(--c-a5b4fc)] border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}<span className="hidden sm:inline">Enviar ahora</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mensajes programados */}
          <div className={`${tarjeta} p-4 space-y-3`}>
            <p className={titulo}><Clock className="w-3.5 h-3.5" />Mensaje programado</p>
            <textarea value={prog.texto} onChange={(e) => setProg({ ...prog, texto: e.target.value })} rows={2} maxLength={1000} placeholder="Ej.: Mañana traigan el diagrama impreso. Usa {nombre} para personalizar." className={`${campo} w-full resize-none`} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select value={prog.seccion} onChange={(e) => setProg({ ...prog, seccion: e.target.value })} className={campo}>{secciones.map(s => <option key={s} value={s}>Sección {s}</option>)}</select>
              <input type="datetime-local" value={prog.enviarEn} min={aLocal(new Date())} onChange={(e) => setProg({ ...prog, enviarEn: e.target.value })} className={campo} />
              <label className="flex items-center gap-1.5 text-xs text-[color:var(--c-b0b0c4)] cursor-pointer"><input type="checkbox" checked={prog.incluirEnlace} onChange={(e) => setProg({ ...prog, incluirEnlace: e.target.checked })} className="accent-[#818cf8]" />Con enlace a su página</label>
              <button type="button" disabled={programando || prog.texto.trim().length < 3 || !prog.enviarEn} onClick={programar} className="ml-auto h-8 px-3 rounded-lg text-xs font-semibold bg-[color:var(--c-818cf8)] text-white disabled:opacity-40 flex items-center gap-1.5">
                {programando ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}Programar
              </button>
            </div>
            {datos.programados.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {datos.programados.map(p => (
                  <li key={p.id} className="flex items-start gap-2 text-xs rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-2a2b3d)] px-3 py-2">
                    <span className="text-[color:var(--c-a5b4fc)] whitespace-nowrap">{fechaCorta(p.enviarEn)} · Sec. {p.seccion}</span>
                    <span className="flex-1 min-w-0 text-[color:var(--c-c0c0cc)] break-words">{p.texto}</span>
                    <button type="button" onClick={() => cancelarProgramado(p.id)} title="Cancelar" className="text-[color:var(--c-6a6b7e)] hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Historial */}
          <div className={`${tarjeta} overflow-hidden`}>
            <p className={`${titulo} px-4 pt-4 pb-2`}><History className="w-3.5 h-3.5" />Historial (30 días)</p>
            {datos.historial.length === 0 && <p className="px-4 pb-4 text-sm text-[color:var(--c-8a8b9e)]">Todavía no se ha enviado ningún recordatorio.</p>}
            <div className="divide-y divide-[color:var(--c-2a2b3d)]">
              {datos.historial.map(l => (
                <div key={l.loteId} className="px-4 py-2.5">
                  <button type="button" onClick={() => setAbiertoLote(abiertoLote === l.loteId ? null : l.loteId)} disabled={!l.fallidos} className="w-full flex items-center gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[color:var(--c-d0d0da)] truncate">{l.titulo}</p>
                      <p className="text-[11px] text-[color:var(--c-8a8b9e)]">{fechaCorta(l.fecha)}</p>
                    </div>
                    <span className="text-xs text-emerald-300 whitespace-nowrap">✓ {l.enviados}/{l.total}</span>
                    {l.pendientes > 0 && <span className="text-xs text-amber-300 whitespace-nowrap">⏳ {l.pendientes}</span>}
                    {l.fallidos > 0 && <span className="text-xs text-red-300 whitespace-nowrap flex items-center gap-1">✗ {l.fallidos}<ChevronDown className={`w-3.5 h-3.5 transition-transform ${abiertoLote === l.loteId ? 'rotate-180' : ''}`} /></span>}
                  </button>
                  {abiertoLote === l.loteId && (
                    <ul className="mt-2 space-y-1">{l.fallas.map((x, i) => <li key={i} className="text-xs text-red-200/90"><strong>{x.nombre}:</strong> {x.error}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}
