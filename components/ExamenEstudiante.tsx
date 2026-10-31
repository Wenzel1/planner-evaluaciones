'use client';
// Examen en línea en la página del estudiante: aviso en la tarjeta (bloqueado / presentar / entregado / nota)
// y la ventana donde lo responde, con cronómetro y guardado automático.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Lock, Clock, CheckCircle2, AlertCircle, X, Send, Loader2, ChevronRight } from 'lucide-react';

export interface InfoExamen { tipo: string; duracionMin: number; preguntas: number; abre: string | null; cierra: string | null; estado: string; nota: number | null }
interface PreguntaEst { id: string; tipo: 'seleccion' | 'vf' | 'desarrollo' | 'informe'; enunciado: string; opciones?: string[]; puntos: number }
interface ExamenEst { tipo: string; instrucciones: string; duracionMin: number; preguntas: PreguntaEst[] }

const ZONA = 'America/Caracas';
const fFecha = (d: string, op: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, ...op }).format(new Date(d));
const fNota = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ','));
const reloj = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`; };
const TIPO: Record<string, string> = { seleccion: 'Selección simple', vf: 'Verdadero o falso', desarrollo: 'Desarrollo', informe: 'Informe', mixto: 'Mixto' };

// Estado actual (se recalcula con la hora, así el botón se habilita solo cuando llega la fecha)
export function estadoExamen(x: InfoExamen, ahora: number): string {
  if (['en_curso', 'entregado', 'calificado'].includes(x.estado)) return x.estado;
  if (!x.abre) return 'sin_fecha';
  if (ahora < new Date(x.abre).getTime()) return 'bloqueado';
  if (x.cierra && ahora > new Date(x.cierra).getTime()) return 'cerrado';
  return 'disponible';
}

// ---------- Franja en la tarjeta de la evaluación ----------
export function FranjaExamen({ info, token, evaluacionId, nombre, ahora, onCambio }: { info: InfoExamen; token: string; evaluacionId: string; nombre: string; ahora: number; onCambio: (cambio: Partial<InfoExamen>) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState(false);
  const est = estadoExamen(info, ahora);
  const base = 'mt-3 w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm';
  return (
    <>
      {est === 'bloqueado' || est === 'sin_fecha' ? (
        <div className={`${base} border-[#2a2b3d] bg-[#191a26] text-[#8a8b9e]`}>
          <Lock className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0">Examen en línea · {info.preguntas} preguntas · {info.duracionMin} min<span className="block text-[11px] text-[#6a6b7e]">{info.abre ? `Se abre el ${fFecha(info.abre, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}` : 'Tu profesor todavía no le puso fecha.'}</span></span>
        </div>
      ) : est === 'disponible' || est === 'en_curso' ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); setAbierto(true); }} className={`${base} border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 font-semibold`}>
          <FileCheck className="w-5 h-5 shrink-0" />
          <span className="flex-1 min-w-0">{est === 'en_curso' ? 'Continuar el examen' : 'Presentar examen'}<span className="block text-[11px] font-normal text-emerald-300/80">{info.preguntas} preguntas · {info.duracionMin} min{info.cierra && est === 'disponible' ? ` · puedes empezar hasta las ${fFecha(info.cierra, { hour: 'numeric', minute: '2-digit' })}` : ''}</span></span>
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : est === 'entregado' ? (
        <div className={`${base} border-[#818cf8]/30 bg-[#818cf8]/10 text-[#c7d2fe]`}><CheckCircle2 className="w-4 h-4 shrink-0" /><span>Examen entregado. Tu nota aparecerá cuando tu profesor la publique.</span></div>
      ) : est === 'calificado' ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); setResultado(true); }} className={`${base} border-[#2a2b3d] bg-[#1c1d2a] text-[#d0d0da] hover:border-[#818cf8]/50`}>
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" /><span className="flex-1">Examen calificado{info.nota != null ? `: ${fNota(info.nota)}/20` : ''}</span><span className="text-[11px] text-[#a5b4fc]">Ver resultado</span>
        </button>
      ) : (
        <div className={`${base} border-[#2a2b3d] bg-[#191a26] text-[#8a8b9e]`}><Lock className="w-4 h-4 shrink-0" /><span>El tiempo para presentar el examen ya pasó. Si no lo presentaste, habla con tu profesor.</span></div>
      )}
      {abierto && <VentanaExamen token={token} evaluacionId={evaluacionId} nombre={nombre} info={info} onCerrar={(cambio) => { setAbierto(false); if (cambio) onCambio(cambio); }} />}
      {resultado && <VentanaResultado token={token} evaluacionId={evaluacionId} nombre={nombre} onCerrar={() => setResultado(false)} />}
    </>
  );
}

function Capa({ children }: { children: React.ReactNode }) {
  return createPortal(<div className="fixed inset-0 z-[90] bg-[#12131c] overflow-y-auto">{children}</div>, document.body);
}

// ---------- Ventana del examen ----------
function VentanaExamen({ token, evaluacionId, nombre, info, onCerrar }: { token: string; evaluacionId: string; nombre: string; info: InfoExamen; onCerrar: (cambio?: Partial<InfoExamen>) => void }) {
  const url = `/api/portal/${encodeURIComponent(token)}/examen`;
  const [fase, setFase] = useState<'confirmar' | 'cargando' | 'respondiendo' | 'entregando' | 'listo' | 'error'>(info.estado === 'en_curso' ? 'cargando' : 'confirmar');
  const [examen, setExamen] = useState<ExamenEst | null>(null);
  const [resp, setResp] = useState<Record<string, any>>({});
  const [limite, setLimite] = useState(0);
  const [desfase, setDesfase] = useState(0); // diferencia entre el reloj del servidor y el del celular
  const [ahora, setAhora] = useState(Date.now());
  const [guardado, setGuardado] = useState<'ok' | 'guardando' | 'pendiente' | 'sin-conexion'>('ok');
  const [mensaje, setMensaje] = useState('');
  const [final, setFinal] = useState<{ nota: number | null; publicada: boolean; tarde: boolean } | null>(null);
  const respRef = useRef(resp); respRef.current = resp;
  const sucio = useRef(false);
  const entregado = useRef(false);

  const iniciar = async () => {
    setFase('cargando');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, accion: 'iniciar' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo abrir el examen.');
      setExamen(d.examen); setResp(d.respuestas || {}); setLimite(new Date(d.limite).getTime()); setDesfase(new Date(d.ahora).getTime() - Date.now());
      setFase('respondiendo');
    } catch (e: any) { setMensaje(e instanceof TypeError ? 'Sin conexión. Revisa tu internet e intenta de nuevo.' : e.message); setFase('error'); }
  };
  useEffect(() => { if (info.estado === 'en_curso') iniciar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!sucio.current || entregado.current) return;
    sucio.current = false; setGuardado('guardando');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, accion: 'guardar', respuestas: respRef.current }) });
      if (!r.ok) throw new Error();
      setGuardado('ok');
    } catch { sucio.current = true; setGuardado('sin-conexion'); }
  };
  const entregar = async (porTiempo = false) => {
    if (entregado.current) return;
    if (!porTiempo) {
      const faltan = (examen?.preguntas || []).filter(p => respRef.current[p.id] == null || respRef.current[p.id] === '').length;
      if (!window.confirm(faltan ? `Te faltan ${faltan} pregunta(s) por responder. ¿Entregar de todas formas?` : '¿Entregar el examen? Ya no podrás cambiar tus respuestas.')) return;
    }
    entregado.current = true; setFase('entregando');
    for (let intento = 0; intento < 4; intento++) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluacionId, accion: 'entregar', respuestas: respRef.current }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok && r.status !== 409) throw new Error(d.error || 'error');
        setFinal({ nota: d.nota ?? null, publicada: !!d.publicada, tarde: !!d.tarde }); setFase('listo');
        return;
      } catch { await new Promise(res => setTimeout(res, 2000 * (intento + 1))); }
    }
    entregado.current = false; setFase('respondiendo'); setGuardado('sin-conexion');
    alert('No se pudo entregar por falta de conexión. Tus respuestas siguen guardadas: revisa tu internet y pulsa "Entregar" otra vez.');
  };

  // Reloj, guardado automático y entrega al acabarse el tiempo
  useEffect(() => {
    if (fase !== 'respondiendo') return;
    const t = setInterval(() => {
      const n = Date.now() + desfase; setAhora(n);
      if (n >= limite) entregar(true);
    }, 1000);
    const g = setInterval(guardar, 15000);
    const salir = (e: BeforeUnloadEvent) => { if (!entregado.current) { guardar(); e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', salir);
    return () => { clearInterval(t); clearInterval(g); window.removeEventListener('beforeunload', salir); };
  }, [fase, limite, desfase]); // eslint-disable-line react-hooks/exhaustive-deps
  const responder = (id: string, v: any) => { setResp(prev => ({ ...prev, [id]: v })); sucio.current = true; setGuardado('pendiente'); };
  useEffect(() => { if (guardado !== 'pendiente') return; const t = setTimeout(guardar, 2500); return () => clearTimeout(t); }, [resp]); // eslint-disable-line react-hooks/exhaustive-deps

  const restante = limite - ahora;
  const respondidas = (examen?.preguntas || []).filter(p => resp[p.id] != null && resp[p.id] !== '').length;

  if (fase === 'confirmar') return (
    <Capa>
      <div className="min-h-full flex items-center justify-center p-5">
        <div className="max-w-md w-full rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-6 space-y-4">
          <FileCheck className="w-10 h-10 text-[#a5b4fc]" />
          <h2 className="text-lg font-bold text-white">{nombre}</h2>
          <ul className="text-sm text-[#c0c0d0] space-y-1.5">
            <li>• {info.preguntas} preguntas ({TIPO[info.tipo] || info.tipo})</li>
            <li>• Tienes <b className="text-white">{info.duracionMin} minutos</b> desde que empieces. El tiempo corre aunque cierres la página.</li>
            <li>• Tus respuestas se guardan solas. Al acabarse el tiempo se entrega automáticamente.</li>
            <li>• Solo puedes presentarlo una vez.</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => onCerrar()} className="flex-1 h-11 rounded-xl border border-[#313248] text-[#c0c0d0] hover:text-white">Ahora no</button>
            <button type="button" onClick={iniciar} className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold">Empezar</button>
          </div>
        </div>
      </div>
    </Capa>
  );
  if (fase === 'cargando' || fase === 'entregando') return (
    <Capa><div className="min-h-full flex flex-col items-center justify-center gap-3 text-[#c0c0d0]"><Loader2 className="w-8 h-8 animate-spin text-[#a5b4fc]" />{fase === 'entregando' ? 'Entregando tu examen…' : 'Abriendo el examen…'}</div></Capa>
  );
  if (fase === 'error') return (
    <Capa><div className="min-h-full flex items-center justify-center p-5"><div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#1c1d2a] p-6 space-y-4 text-center">
      <AlertCircle className="w-10 h-10 text-red-300 mx-auto" /><p className="text-sm text-[#d0d0da]">{mensaje}</p>
      <div className="flex gap-2"><button type="button" onClick={() => onCerrar()} className="flex-1 h-11 rounded-xl border border-[#313248] text-[#c0c0d0]">Cerrar</button><button type="button" onClick={iniciar} className="flex-1 h-11 rounded-xl bg-[#818cf8] text-white font-semibold">Reintentar</button></div>
    </div></div></Capa>
  );
  if (fase === 'listo') return (
    <Capa><div className="min-h-full flex items-center justify-center p-5"><div className="max-w-md w-full rounded-2xl border border-emerald-500/30 bg-[#1c1d2a] p-6 space-y-4 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
      <h2 className="text-lg font-bold text-white">¡Examen entregado!</h2>
      {final?.tarde && <p className="text-xs text-amber-300">Se acabó el tiempo: se entregó con lo que habías respondido.</p>}
      {final?.publicada && final.nota != null ? <p className="text-3xl font-bold text-white">{fNota(final.nota)}<span className="text-base text-[#8a8b9e]">/20</span></p> : <p className="text-sm text-[#c0c0d0]">Tu profesor revisará tus respuestas. La nota aparecerá en esta página.</p>}
      <button type="button" onClick={() => onCerrar(final?.publicada ? { estado: 'calificado', nota: final.nota } : { estado: 'entregado' })} className="w-full h-11 rounded-xl bg-[#818cf8] text-white font-semibold">Volver a mi página</button>
    </div></div></Capa>
  );

  return (
    <Capa>
      <div className="sticky top-0 z-10 bg-[#12131c]/95 backdrop-blur border-b border-[#24253a]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{nombre}</p>
            <p className="text-[11px] text-[#8a8b9e]">{respondidas} de {examen?.preguntas.length} respondidas · {guardado === 'ok' ? 'Guardado ✓' : guardado === 'guardando' ? 'Guardando…' : guardado === 'sin-conexion' ? <span className="text-amber-300">Sin conexión: se guardará al volver</span> : 'Cambios sin guardar'}</p>
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-bold ${restante < 60000 ? 'bg-red-500/20 text-red-300 animate-pulse' : restante < 300000 ? 'bg-amber-500/15 text-amber-300' : 'bg-[#1c1d2a] text-white'}`}><Clock className="w-4 h-4" />{reloj(restante)}</span>
        </div>
        <div className="h-1 bg-[#1c1d2a]"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${examen ? (respondidas / examen.preguntas.length) * 100 : 0}%` }} /></div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {examen?.instrucciones && <p className="text-sm text-[#a8a9bc] italic">{examen.instrucciones}</p>}
        {examen?.preguntas.map((p, i) => (
          <div key={p.id} className="rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 shrink-0 rounded-lg bg-[#818cf8]/15 text-[#a5b4fc] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <p className="flex-1 text-[15px] text-white leading-relaxed whitespace-pre-wrap">{p.enunciado}</p>
              <span className="text-[11px] text-[#8a8b9e] whitespace-nowrap">{fNota(p.puntos)} pts</span>
            </div>
            {(p.tipo === 'seleccion' || p.tipo === 'vf') ? (
              <div className="space-y-2 sm:pl-10">
                {(p.opciones || []).map((o, k) => {
                  const valor = p.tipo === 'vf' ? (k === 0 ? 1 : 0) : k;
                  const marcada = resp[p.id] === valor;
                  return (
                    <button key={k} type="button" onClick={() => responder(p.id, valor)} className={`w-full text-left flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${marcada ? 'border-[#818cf8] bg-[#818cf8]/15 text-white' : 'border-[#2a2b3d] bg-[#191a26] text-[#c0c0d0] hover:border-[#3a3b52]'}`}>
                      <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${marcada ? 'border-[#818cf8]' : 'border-[#4a4b62]'}`}>{marcada && <span className="w-2.5 h-2.5 rounded-full bg-[#818cf8]" />}</span>
                      {p.tipo === 'seleccion' && <span className="text-[#6a6b7e]">{'abcdef'[k]})</span>}{o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="sm:pl-10">
                <textarea value={resp[p.id] || ''} onChange={(e) => responder(p.id, e.target.value)} rows={p.tipo === 'informe' ? 12 : 6} placeholder={p.tipo === 'informe' ? 'Escribe tu informe aquí…' : 'Escribe tu respuesta…'} className="w-full rounded-xl border border-[#2a2b3d] bg-[#191a26] px-3.5 py-3 text-sm text-white leading-relaxed outline-none focus:border-[#818cf8]/60 resize-y" />
                <p className="text-right text-[11px] text-[#6a6b7e] mt-1">{String(resp[p.id] || '').trim().split(/\s+/).filter(Boolean).length} palabras</p>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => entregar(false)} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold flex items-center justify-center gap-2"><Send className="w-4 h-4" />Entregar examen</button>
        <p className="text-center text-[11px] text-[#6a6b7e] pb-6">Si se va el internet, no cierres esta página: tus respuestas se guardan y se envían al volver.</p>
      </div>
    </Capa>
  );
}

// ---------- Resultado (cuando el profesor publicó la nota) ----------
function VentanaResultado({ token, evaluacionId, nombre, onCerrar }: { token: string; evaluacionId: string; nombre: string; onCerrar: () => void }) {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/portal/${encodeURIComponent(token)}/examen?evaluacionId=${encodeURIComponent(evaluacionId)}`).then(r => r.json()).then(x => { if (x.error) setError(x.error); else setD(x); }).catch(() => setError('Sin conexión.'));
  }, [token, evaluacionId]);
  const res = d?.resultado;
  return (
    <Capa>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-lg font-bold text-white">{nombre}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-[#8a8b9e] hover:text-white hover:bg-[#1c1d2a]"><X className="w-5 h-5" /></button>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : !d ? <Loader2 className="w-6 h-6 animate-spin text-[#a5b4fc]" /> : !res ? <p className="text-sm text-[#c0c0d0]">Tu nota todavía no está publicada.</p> : (
          <>
            <div className="rounded-2xl border border-[#2a2b3d] bg-[#1c1d2a] p-5 text-center">
              <p className={`text-4xl font-bold ${res.nota >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{fNota(res.nota)}<span className="text-lg text-[#8a8b9e]">/20</span></p>
              {res.comentario && <p className="mt-2 text-sm text-[#c0c0d0]">💬 {res.comentario}</p>}
            </div>
            <ol className="space-y-2">
              {res.preguntas.map((p: any, i: number) => (
                <li key={p.id} className="rounded-xl border border-[#2a2b3d] bg-[#1c1d2a] px-4 py-3 flex items-start gap-3 text-sm">
                  <span className="text-[#6a6b7e]">{i + 1}.</span>
                  <span className="flex-1 text-[#c0c0d0]">{p.comentario || (p.obtenidos === p.puntos ? 'Correcta' : p.obtenidos === 0 ? 'Incorrecta' : 'Parcial')}</span>
                  <span className={`font-semibold ${p.obtenidos === p.puntos ? 'text-emerald-300' : p.obtenidos ? 'text-amber-300' : 'text-red-300'}`}>{p.obtenidos == null ? '—' : fNota(p.obtenidos)}/{fNota(p.puntos)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Capa>
  );
}
