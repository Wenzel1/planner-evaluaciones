'use client';
// Flujo de n8n dibujado dentro de la app (sin enviarlo a ningún servidor): nodos, conexiones y ramas,
// con su configuración al tocar un nodo, comentarios por nodo y una revisión automática.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Maximize, MessageSquare, Minus, Plus, Trash2, X } from 'lucide-react';

export interface ComentarioNodo { nodo: string; texto: string }
export interface DatosN8n { comentarios: ComentarioNodo[] }
interface Nodo { name: string; type: string; position: [number, number]; parameters?: any; disabled?: boolean; notes?: string; credentials?: any }

const ANCHO = 190, ALTO = 64;
const categoria = (t: string) => {
  const x = t.toLowerCase();
  if (/trigger|webhook|schedule|cron|manual|start/.test(x)) return { c: '#30a46c', n: 'Disparador' };
  if (/langchain|openai|anthropic|gemini|agent|llm|embedding|vector/.test(x)) return { c: '#8e4ec6', n: 'IA' };
  if (/httprequest|http/.test(x)) return { c: '#3e63dd', n: 'HTTP' };
  if (/code|function/.test(x)) return { c: '#f76b15', n: 'Código' };
  if (/\.if$|switch|merge|filter|splitinbatches|wait|noop/.test(x)) return { c: '#e2a03f', n: 'Lógica' };
  return { c: '#7a8aa3', n: 'Acción' };
};
const tipoCorto = (t: string) => String(t || '').split('.').pop()!.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const SECRETO = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|Bearer\s+[A-Za-z0-9._-]{24,}|"(api[_-]?key|apikey|token|secret|password)"\s*:\s*"[^"{=$]{10,}")/i;

export function leerFlujo(texto: string): { nodos: Nodo[]; conexiones: any } | null {
  try {
    const j = JSON.parse(texto);
    const f = Array.isArray(j?.nodes) ? j : Array.isArray(j?.workflow?.nodes) ? j.workflow : Array.isArray(j?.data?.nodes) ? j.data : null;
    if (!f) return null;
    const nodos = (f.nodes as any[]).filter(n => n && typeof n.name === 'string').map(n => ({ ...n, position: Array.isArray(n.position) ? [Number(n.position[0]) || 0, Number(n.position[1]) || 0] : [0, 0] })) as Nodo[];
    return { nodos, conexiones: f.connections || {} };
  } catch { return null; }
}

export default function VisorN8n({ texto, datos, onCambio, soloLectura = false }: { texto: string; datos?: DatosN8n | null; onCambio?: (d: DatosN8n) => void; soloLectura?: boolean }) {
  const flujo = useMemo(() => leerFlujo(texto), [texto]);
  const [comentarios, setComentarios] = useState<ComentarioNodo[]>(datos?.comentarios || []);
  const [sel, setSel] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [vista, setVista] = useState({ x: 0, y: 0, z: 1 });
  const caja = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  useEffect(() => { if (!soloLectura) onCambio?.({ comentarios }); }, [comentarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const notas = flujo?.nodos.filter(n => /stickynote/i.test(n.type)) || [];
  const nodos = flujo?.nodos.filter(n => !/stickynote/i.test(n.type)) || [];
  // Conexiones: { origen: { main: [[{node, type, index}]], ai_tool: [...] } }
  const aristas = useMemo(() => {
    const lista: { de: string; a: string; salida: number; total: number; tipo: string }[] = [];
    for (const [de, porTipo] of Object.entries<any>(flujo?.conexiones || {})) {
      for (const [tipo, salidas] of Object.entries<any>(porTipo || {})) {
        (salidas || []).forEach((destinos: any[], salida: number) => (destinos || []).forEach(d => d?.node && lista.push({ de, a: d.node, salida, total: (salidas || []).length, tipo })));
      }
    }
    return lista;
  }, [flujo]);
  const porNombre = useMemo(() => new Map(nodos.map(n => [n.name, n])), [nodos]);

  // Revisión automática
  const avisos = useMemo(() => {
    const r: { t: string; nodo?: string }[] = [];
    if (!nodos.some(n => /trigger|webhook|schedule|cron|manual|start/i.test(n.type))) r.push({ t: 'El flujo no tiene un disparador (trigger): no arrancaría solo.' });
    const conectados = new Set(aristas.flatMap(a => [a.de, a.a]));
    nodos.filter(n => !conectados.has(n.name) && nodos.length > 1).forEach(n => r.push({ t: `«${n.name}» está suelto (sin conexiones).`, nodo: n.name }));
    nodos.filter(n => n.disabled).forEach(n => r.push({ t: `«${n.name}» está desactivado.`, nodo: n.name }));
    nodos.filter(n => /\d+$/.test(n.name) && n.name.replace(/\d+$/, '').trim().toLowerCase() === tipoCorto(n.type).toLowerCase()).forEach(n => r.push({ t: `«${n.name}» tiene el nombre por defecto: conviene ponerle uno que diga qué hace.`, nodo: n.name }));
    nodos.filter(n => SECRETO.test(JSON.stringify(n.parameters || {}))).forEach(n => r.push({ t: `«${n.name}» parece tener una clave o token escrito a mano (debería ir en las credenciales).`, nodo: n.name }));
    return r;
  }, [nodos, aristas]);

  const limites = useMemo(() => {
    const xs = [...nodos, ...notas].flatMap(n => [n.position[0], n.position[0] + (n.parameters?.width || ANCHO)]);
    const ys = [...nodos, ...notas].flatMap(n => [n.position[1], n.position[1] + (n.parameters?.height || ALTO)]);
    return xs.length ? { x: Math.min(...xs) - 60, y: Math.min(...ys) - 60, w: Math.max(...xs) - Math.min(...xs) + 120, h: Math.max(...ys) - Math.min(...ys) + 120 } : { x: 0, y: 0, w: 800, h: 400 };
  }, [nodos, notas]);
  const ajustar = () => {
    const r = caja.current?.getBoundingClientRect(); if (!r) return;
    const z = Math.min(1.4, Math.max(0.2, Math.min(r.width / limites.w, r.height / limites.h)));
    setVista({ z, x: (r.width - limites.w * z) / 2 - limites.x * z, y: (r.height - limites.h * z) / 2 - limites.y * z });
  };
  useEffect(() => { const t = setTimeout(ajustar, 30); return () => clearTimeout(t); }, [limites.w, limites.h]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flujo) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"><AlertTriangle className="w-8 h-8 text-amber-300" /><p className="text-sm text-[color:var(--c-d0d0da)]">Este archivo no parece un flujo de n8n.</p><p className="text-xs text-[color:var(--c-8a8b9e)]">Se espera el .json que se descarga desde n8n (menú del flujo → Download).</p></div>;

  const zoom = (f: number, cx?: number, cy?: number) => setVista(v => {
    const r = caja.current?.getBoundingClientRect(); const px = cx ?? (r ? r.width / 2 : 0), py = cy ?? (r ? r.height / 2 : 0);
    const z = Math.min(2.5, Math.max(0.15, v.z * f));
    return { z, x: px - (px - v.x) * (z / v.z), y: py - (py - v.y) * (z / v.z) };
  });
  const nodoSel = sel ? porNombre.get(sel) : null;
  const comentariosDe = (n: string) => comentarios.filter(c => c.nodo === n);
  const salidaY = (n: Nodo, salida: number, total: number) => n.position[1] + (total > 1 ? (ALTO / (total + 1)) * (salida + 1) : ALTO / 2);

  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
          <span className="text-xs text-[color:var(--c-b0b0c4)]">{nodos.length} nodo{nodos.length === 1 ? '' : 's'} · {aristas.length} conexion{aristas.length === 1 ? '' : 'es'}</span>
          <span className="flex-1" />
          <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Alejar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]"><Minus className="w-4 h-4" /></button>
          <button type="button" onClick={() => zoom(1.2)} aria-label="Acercar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]"><Plus className="w-4 h-4" /></button>
          <button type="button" onClick={ajustar} className="h-8 px-2.5 rounded-lg text-xs text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] flex items-center gap-1.5"><Maximize className="w-3.5 h-3.5" />Ajustar</button>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ } }} title="Pégalo en el lienzo de n8n (Ctrl+V) para probarlo" className="h-8 px-2.5 rounded-lg border border-[color:var(--c-313248)] text-xs text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5">{copiado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiado ? 'Copiado' : 'Copiar para n8n'}</button>
        </div>
        <div ref={caja} className="relative flex-1 min-h-0 overflow-hidden bg-[#13141b] cursor-grab active:cursor-grabbing touch-none"
          style={{ backgroundImage: 'radial-gradient(#2a2c3a 1px, transparent 1px)', backgroundSize: `${20 * vista.z}px ${20 * vista.z}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}
          onWheel={(e) => { const r = e.currentTarget.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); }}
          onPointerDown={(e) => { if ((e.target as Element).closest('[data-nodo]')) return; e.currentTarget.setPointerCapture(e.pointerId); arrastre.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }; }}
          onPointerMove={(e) => { const a = arrastre.current; if (a) setVista(v => ({ ...v, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y })); }}
          onPointerUp={() => { arrastre.current = null; }}>
          <svg className="absolute inset-0 w-full h-full">
            <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.z})`}>
              {notas.map((n, k) => <g key={`s${k}`}><rect x={n.position[0]} y={n.position[1]} width={n.parameters?.width || 240} height={n.parameters?.height || 160} rx={8} fill="#3a3520" stroke="#6b5f2a" /><foreignObject x={n.position[0] + 10} y={n.position[1] + 8} width={(n.parameters?.width || 240) - 20} height={(n.parameters?.height || 160) - 16}><div style={{ color: '#e8dca0', fontSize: 12, whiteSpace: 'pre-wrap', overflow: 'hidden', height: '100%', fontFamily: 'sans-serif' }}>{String(n.parameters?.content || '').replace(/[#*_`]/g, '')}</div></foreignObject></g>)}
              {aristas.map((a, k) => {
                const o = porNombre.get(a.de), d = porNombre.get(a.a); if (!o || !d) return null;
                const x1 = o.position[0] + ANCHO, y1 = salidaY(o, a.salida, a.total), x2 = d.position[0], y2 = d.position[1] + ALTO / 2;
                const dx = Math.max(60, Math.abs(x2 - x1) / 2);
                return <path key={k} d={`M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`} fill="none" stroke={a.tipo === 'main' ? '#7a7f99' : '#8e4ec6'} strokeWidth={2} strokeDasharray={a.tipo === 'main' ? undefined : '6 5'} markerEnd="url(#flecha)" />;
              })}
              <defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#7a7f99" /></marker></defs>
              {nodos.map(n => {
                const cat = categoria(n.type); const nc = comentariosDe(n.name).length; const conAviso = avisos.some(a => a.nodo === n.name);
                return (
                  <g key={n.name} data-nodo onClick={() => { setSel(n.name); setNuevo(''); }} style={{ cursor: 'pointer' }} opacity={n.disabled ? 0.45 : 1}>
                    <rect x={n.position[0]} y={n.position[1]} width={ANCHO} height={ALTO} rx={10} fill="#1f2130" stroke={sel === n.name ? '#9fb2f7' : conAviso ? '#e2a03f' : '#34374a'} strokeWidth={sel === n.name ? 2.5 : 1.5} />
                    <rect x={n.position[0]} y={n.position[1]} width={6} height={ALTO} rx={3} fill={cat.c} />
                    <text x={n.position[0] + 16} y={n.position[1] + 27} fill="#e6e8f0" fontSize={13} fontWeight={600} fontFamily="sans-serif">{n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}</text>
                    <text x={n.position[0] + 16} y={n.position[1] + 46} fill="#8a8ea6" fontSize={11} fontFamily="sans-serif">{cat.n} · {tipoCorto(n.type).slice(0, 22)}</text>
                    {nc > 0 && <g><circle cx={n.position[0] + ANCHO - 2} cy={n.position[1] + 2} r={11} fill="#f76b15" /><text x={n.position[0] + ANCHO - 2} y={n.position[1] + 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="sans-serif">{nc}</text></g>}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Panel lateral: revisión automática o el nodo elegido */}
      <aside className="w-[340px] flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] flex flex-col min-h-0">
        {!nodoSel ? (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Revisión automática</p>
            {avisos.length === 0 ? <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />No se ven problemas evidentes.</p>
              : <ul className="space-y-1.5">{avisos.map((a, k) => <li key={k}><button type="button" onClick={() => a.nodo && setSel(a.nodo)} className="w-full text-left text-[13px] text-amber-200 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{a.t}</button></li>)}</ul>}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] pt-2">Comentarios ({comentarios.length})</p>
            {comentarios.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)]">{soloLectura ? 'Tu profesor no dejó comentarios en los nodos.' : 'Toca un nodo para comentarlo.'}</p>
              : comentarios.map((c, k) => <button key={k} type="button" onClick={() => setSel(c.nodo)} className="w-full text-left rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2 text-[13px] text-[color:var(--c-e0e0ec)]"><b className="block text-[11px] text-[#f5a46b] mb-0.5">{c.nodo}</b>{c.texto}</button>)}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-4 border-b border-[color:var(--c-282a3f)] flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] break-words">{nodoSel.name}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)] break-all">{nodoSel.type}{nodoSel.disabled ? ' · desactivado' : ''}</p></div>
              <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {comentariosDe(nodoSel.name).map((c, k) => (
                <div key={k} className="rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2 text-[13px] text-[color:var(--c-e0e0ec)] flex gap-2"><MessageSquare className="w-4 h-4 text-[#f5a46b] flex-shrink-0 mt-0.5" /><span className="flex-1 whitespace-pre-wrap">{c.texto}</span>{!soloLectura && <button type="button" onClick={() => setComentarios(l => l.filter(x => x !== c))} aria-label="Quitar comentario" className="text-[color:var(--c-8a8b9e)] hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
              ))}
              {!soloLectura && (
                <div>
                  <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} rows={3} placeholder="Comentario sobre este nodo…" className="w-full px-3 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-y" />
                  <div className="flex justify-end mt-1.5"><button type="button" disabled={!nuevo.trim()} onClick={() => { setComentarios(l => [...l, { nodo: nodoSel.name, texto: nuevo.trim().slice(0, 2000) }]); setNuevo(''); }} className="h-8 px-3 rounded-lg bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Comentar</button></div>
                </div>
              )}
              {nodoSel.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-1">Nota del estudiante</p><p className="text-[13px] text-[color:var(--c-c0c0d0)] whitespace-pre-wrap">{nodoSel.notes}</p></div>}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-1">Configuración</p>
                {nodoSel.parameters?.jsCode || nodoSel.parameters?.pythonCode || nodoSel.parameters?.functionCode
                  ? <pre className="text-[11.5px] leading-relaxed text-[#d4d4d4] bg-[#0f1117] rounded-lg p-3 overflow-x-auto whitespace-pre">{nodoSel.parameters.jsCode || nodoSel.parameters.pythonCode || nodoSel.parameters.functionCode}</pre>
                  : <pre className="text-[11.5px] leading-relaxed text-[#c0c4d6] bg-[#0f1117] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(nodoSel.parameters || {}, null, 2)}</pre>}
                {nodoSel.credentials && <p className="mt-2 text-[11px] text-[color:var(--c-8a8b9e)]">Credenciales: {Object.values<any>(nodoSel.credentials).map(c => c?.name).filter(Boolean).join(', ') || 'sí'} (n8n no exporta las claves)</p>}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
