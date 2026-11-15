'use client';
// Flujos de n8n con un editor del mismo estilo (React Flow, libre y gratuito), sin servidor y sin enviar nada fuera:
// mover nodos, conectar y desconectar, renombrar, desactivar, borrar o agregar nodos, editar su configuración,
// deshacer y rehacer, comentarios por nodo y revisión automática. Guarda un .json que se importa tal cual en n8n.
// No ejecuta el flujo: para probarlo está «Copiar para n8n».
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, useReactFlow, MarkerType, type Node, type Edge, type NodeProps, type Connection, type NodeChange, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, Bot, Box, Brain, CheckCircle2, Clock, Code2, Copy, Database, Filter, GitBranch, Globe, Hourglass, Mail, Merge, MessageCircle, MessageSquare, MousePointerClick, Plus, Power, Redo2, Repeat, Reply, Sparkles, Split, SquarePen, Trash2, Undo2, Webhook, Wrench, X } from 'lucide-react';

export interface ComentarioNodo { nodo: string; texto: string }
export interface DatosN8n { comentarios: ComentarioNodo[]; flujo?: string | null } // flujo: el .json corregido (si se editó)
interface NodoN8n { name: string; type: string; position: [number, number]; parameters?: any; disabled?: boolean; notes?: string; credentials?: any; [k: string]: any }
interface Flujo { base: any; nodos: NodoN8n[]; conexiones: Record<string, Record<string, { node: string; type: string; index: number }[][]>> }

export function leerFlujo(texto: string): Flujo | null {
  try {
    const j = JSON.parse(texto);
    const f = Array.isArray(j?.nodes) ? j : Array.isArray(j?.workflow?.nodes) ? j.workflow : Array.isArray(j?.data?.nodes) ? j.data : null;
    if (!f) return null;
    const nodos = (f.nodes as any[]).filter(n => n && typeof n.name === 'string').map(n => ({ ...n, position: Array.isArray(n.position) ? [Number(n.position[0]) || 0, Number(n.position[1]) || 0] : [0, 0] })) as NodoN8n[];
    return { base: f, nodos, conexiones: JSON.parse(JSON.stringify(f.connections || {})) };
  } catch { return null; }
}
const aTexto = (f: Flujo) => JSON.stringify({ ...f.base, nodes: f.nodos, connections: f.conexiones }, null, 2);

// ---------- Aspecto de cada tipo de nodo ----------
const t = (n: NodoN8n) => String(n.type || '').toLowerCase();
const esNota = (n: NodoN8n) => /stickynote/.test(t(n));
const esDisparador = (n: NodoN8n) => /trigger|webhook|schedule|cron|manual|start$|\.start/.test(t(n)) && !/respondtowebhook/.test(t(n));
const esAgente = (n: NodoN8n) => /langchain\.(agent|chain)/.test(t(n));
const esSubnodo = (n: NodoN8n) => /langchain\.(lmchat|lm|embeddings|memory|tool|vectorstore|outputparser|retriever|textsplitter|documentloader)/.test(t(n));
function aspecto(n: NodoN8n): { I: any; c: string } {
  const x = t(n);
  if (/webhook/.test(x) && !/respond/.test(x)) return { I: Webhook, c: '#ff6d5a' };
  if (/respondtowebhook/.test(x)) return { I: Reply, c: '#ff6d5a' };
  if (/schedule|cron|interval/.test(x)) return { I: Clock, c: '#30a46c' };
  if (/manualtrigger|\.start/.test(x)) return { I: MousePointerClick, c: '#30a46c' };
  if (/memory/.test(x)) return { I: Brain, c: '#8e4ec6' };
  if (/\.tool|tool[a-z]/.test(x) && /langchain/.test(x)) return { I: Wrench, c: '#8e4ec6' };
  if (/langchain|openai|anthropic|gemini|ollama|mistral/.test(x)) return { I: esAgente(n) ? Bot : Sparkles, c: '#8e4ec6' };
  if (/httprequest/.test(x)) return { I: Globe, c: '#3e63dd' };
  if (/code|function/.test(x)) return { I: Code2, c: '#f76b15' };
  if (/\.if$|\.if\b/.test(x)) return { I: GitBranch, c: '#2bb3a3' };
  if (/switch/.test(x)) return { I: Split, c: '#2bb3a3' };
  if (/merge/.test(x)) return { I: Merge, c: '#2bb3a3' };
  if (/filter/.test(x)) return { I: Filter, c: '#2bb3a3' };
  if (/splitinbatches|loop/.test(x)) return { I: Repeat, c: '#2bb3a3' };
  if (/wait/.test(x)) return { I: Hourglass, c: '#7a8aa3' };
  if (/\.set$|editfields/.test(x)) return { I: SquarePen, c: '#3e63dd' };
  if (/mail|gmail|outlook/.test(x)) return { I: Mail, c: '#e2a03f' };
  if (/slack|telegram|discord|whatsapp|teams|chat/.test(x)) return { I: MessageCircle, c: '#e2a03f' };
  if (/sheets|airtable|postgres|mysql|supabase|mongo|redis|notion|database|sqlite/.test(x)) return { I: Database, c: '#30a46c' };
  return { I: Box, c: '#7a8aa3' };
}
const tipoCorto = (tipo: string) => String(tipo || '').split('.').pop()!.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const SECRETO = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|Bearer\s+[A-Za-z0-9._-]{24,}|"(api[_-]?key|apikey|token|secret|password)"\s*:\s*"[^"{=$]{10,}")/i;
const TIPOS_AI = ['ai_languageModel', 'ai_tool', 'ai_memory'];
const NOMBRE_AI: Record<string, string> = { ai_languageModel: 'Modelo', ai_tool: 'Herramienta', ai_memory: 'Memoria' };

// Nodos que se pueden agregar desde el editor
const NUEVOS: { n: string; type: string; parameters?: any }[] = [
  { n: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { path: 'nuevo' } }, { n: 'Horario', type: 'n8n-nodes-base.scheduleTrigger' },
  { n: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', parameters: { url: '' } }, { n: 'Code', type: 'n8n-nodes-base.code', parameters: { jsCode: '// Tu código aquí\nreturn $input.all();' } },
  { n: 'If', type: 'n8n-nodes-base.if' }, { n: 'Switch', type: 'n8n-nodes-base.switch' }, { n: 'Merge', type: 'n8n-nodes-base.merge' },
  { n: 'Edit Fields', type: 'n8n-nodes-base.set' }, { n: 'Wait', type: 'n8n-nodes-base.wait' }, { n: 'Send Email', type: 'n8n-nodes-base.emailSend' },
  { n: 'AI Agent', type: '@n8n/n8n-nodes-langchain.agent' }, { n: 'OpenAI Chat Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi' },
];

// ---------- Nodo con el estilo de n8n ----------
type DatosNodo = { n: NodoN8n; salidas: number; comentarios: number; aviso: boolean; elegido: boolean; ramas: string[] };
const NodoVisual = memo(function NodoVisual({ data, selected }: NodeProps<Node<DatosNodo>>) {
  const { n, salidas, comentarios, aviso, ramas } = data;
  const { I, c } = aspecto(n);
  const agente = esAgente(n), sub = esSubnodo(n), disparador = esDisparador(n);
  const ancho = agente ? 200 : sub ? 80 : 100, alto = sub ? 80 : 100;
  const radio = sub ? '50%' : disparador ? '40px 10px 10px 40px' : '10px';
  return (
    <div style={{ width: ancho }} className="relative flex flex-col items-center">
      <div style={{ width: ancho, height: alto, borderRadius: radio, opacity: n.disabled ? 0.45 : 1 }}
        className={`relative flex items-center justify-center bg-[#2e2e33] border-2 ${selected ? 'border-[#ff6d5a] shadow-[0_0_0_4px_rgba(255,109,90,.25)]' : aviso ? 'border-[#e2a03f]' : 'border-[#55555c]'} transition-colors`}>
        <I style={{ color: c, width: sub ? 30 : 40, height: sub ? 30 : 40 }} strokeWidth={1.7} />
        {n.disabled && <span className="absolute inset-0 flex items-center justify-center"><span className="w-[120%] h-0.5 bg-[#9a9aa0] rotate-[-30deg]" /></span>}
        {comentarios > 0 && <span className="absolute -top-2.5 -right-2.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#f76b15] text-white text-[11px] font-bold flex items-center justify-center shadow">{comentarios}</span>}
        {/* Entradas y salidas */}
        {!disparador && !sub && <Handle type="target" position={Position.Left} id="in" className="!w-3 !h-3 !bg-[#9a9aa0] !border-2 !border-[#2e2e33]" />}
        {!sub && Array.from({ length: Math.max(1, salidas) }).map((_, i) => (
          <Handle key={i} type="source" position={Position.Right} id={`out-${i}`} style={{ top: `${((i + 1) / (Math.max(1, salidas) + 1)) * 100}%` }} className="!w-3 !h-3 !bg-[#9a9aa0] !border-2 !border-[#2e2e33]">
            {ramas[i] && <span className="absolute left-4 -top-2 text-[10px] text-[#b5b5bb] whitespace-nowrap pointer-events-none">{ramas[i]}</span>}
          </Handle>
        ))}
        {agente && TIPOS_AI.map((tipo, i) => (
          <Handle key={tipo} type="target" position={Position.Bottom} id={tipo} style={{ left: `${(i + 1) * 25}%` }} className="!w-3 !h-3 !rotate-45 !rounded-none !bg-[#8e4ec6] !border-2 !border-[#2e2e33]">
            <span className="absolute top-3 -left-4 -rotate-45 text-[9px] text-[#b9a3d6] whitespace-nowrap pointer-events-none">{NOMBRE_AI[tipo]}</span>
          </Handle>
        ))}
        {sub && <Handle type="source" position={Position.Top} id="ai-out" className="!w-3 !h-3 !rotate-45 !rounded-none !bg-[#8e4ec6] !border-2 !border-[#2e2e33]" />}
      </div>
      <p className="mt-1.5 max-w-[160px] text-center text-[12px] font-medium leading-tight text-[#e6e6ea] break-words">{n.name}</p>
      <p className="max-w-[160px] text-center text-[10px] leading-tight text-[#8f8f96] truncate">{tipoCorto(n.type)}</p>
    </div>
  );
});
const NotaVisual = memo(function NotaVisual({ data }: NodeProps<Node<DatosNodo>>) {
  const p = data.n.parameters || {};
  return <div style={{ width: p.width || 240, height: p.height || 160 }} className="rounded-md bg-[#fff5c2]/90 border border-[#e6d27a] p-3 overflow-hidden text-[12px] text-[#4d4520] whitespace-pre-wrap">{String(p.content || '').replace(/[#*_`]/g, '')}</div>;
});
const tiposNodo = { n8n: NodoVisual, nota: NotaVisual };

export default function EditorN8n(props: { texto: string; datos?: DatosN8n | null; onCambio?: (d: DatosN8n) => void; soloLectura?: boolean }) {
  return <ReactFlowProvider><Lienzo {...props} /></ReactFlowProvider>;
}

function Lienzo({ texto, datos, onCambio, soloLectura = false }: { texto: string; datos?: DatosN8n | null; onCambio?: (d: DatosN8n) => void; soloLectura?: boolean }) {
  const original = useMemo(() => leerFlujo(texto), [texto]);
  const corregidoInicial = useMemo(() => (datos?.flujo ? leerFlujo(datos.flujo) : null), [datos?.flujo]);
  const [flujo, setFlujo] = useState<Flujo | null>(corregidoInicial || original);
  const [editado, setEditado] = useState(!!corregidoInicial);
  const [verOriginal, setVerOriginal] = useState(false);
  const [historial, setHistorial] = useState<{ atras: Flujo[]; adelante: Flujo[] }>({ atras: [], adelante: [] });
  const [comentarios, setComentarios] = useState<ComentarioNodo[]>(datos?.comentarios || []);
  const [sel, setSel] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [rfNodos, setRfNodos] = useState<Node<DatosNodo>[]>([]);
  const rf = useReactFlow();
  const mostrado = verOriginal && original ? original : flujo;

  useEffect(() => { if (!soloLectura && flujo) onCambio?.({ comentarios, flujo: editado ? aTexto(flujo) : null }); }, [comentarios, flujo, editado]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = useCallback((f: (x: Flujo) => Flujo) => {
    setFlujo(prev => { if (!prev) return prev; setHistorial(h => ({ atras: [...h.atras.slice(-60), prev], adelante: [] })); return f(prev); });
    setEditado(true);
  }, []);
  const deshacer = () => setHistorial(h => { if (!h.atras.length || !flujo) return h; const p = h.atras[h.atras.length - 1]; setFlujo(p); return { atras: h.atras.slice(0, -1), adelante: [flujo, ...h.adelante] }; });
  const rehacer = () => setHistorial(h => { if (!h.adelante.length || !flujo) return h; const s = h.adelante[0]; setFlujo(s); return { atras: [...h.atras, flujo], adelante: h.adelante.slice(1) }; });

  // Revisión automática
  const avisos = useMemo(() => {
    if (!mostrado) return [];
    const nodos = mostrado.nodos.filter(n => !esNota(n));
    const r: { t: string; nodo?: string }[] = [];
    if (!nodos.some(esDisparador)) r.push({ t: 'El flujo no tiene un disparador (trigger): no arrancaría solo.' });
    const conectados = new Set<string>();
    for (const [de, porTipo] of Object.entries(mostrado.conexiones)) for (const salidas of Object.values(porTipo || {})) for (const l of salidas || []) for (const d of l || []) { conectados.add(de); conectados.add(d.node); }
    nodos.filter(n => !conectados.has(n.name) && nodos.length > 1).forEach(n => r.push({ t: `«${n.name}» está suelto (sin conexiones).`, nodo: n.name }));
    nodos.filter(n => n.disabled).forEach(n => r.push({ t: `«${n.name}» está desactivado.`, nodo: n.name }));
    nodos.filter(n => /\d+$/.test(n.name) && n.name.replace(/\d+$/, '').trim().toLowerCase() === tipoCorto(n.type).toLowerCase()).forEach(n => r.push({ t: `«${n.name}» tiene el nombre por defecto: conviene ponerle uno que diga qué hace.`, nodo: n.name }));
    nodos.filter(n => SECRETO.test(JSON.stringify(n.parameters || {}))).forEach(n => r.push({ t: `«${n.name}» parece tener una clave o token escrito a mano (debería ir en las credenciales).`, nodo: n.name }));
    return r;
  }, [mostrado]);

  // Flujo → nodos y conexiones de React Flow
  const aristas: Edge[] = useMemo(() => {
    if (!mostrado) return [];
    const l: Edge[] = [];
    for (const [de, porTipo] of Object.entries(mostrado.conexiones)) {
      for (const [tipo, salidas] of Object.entries(porTipo || {})) {
        (salidas || []).forEach((destinos, salida) => (destinos || []).forEach((d, k) => {
          if (!d?.node) return;
          const ai = tipo !== 'main';
          l.push({
            id: `${de}|${tipo}|${salida}|${d.node}|${k}`, source: de, target: d.node,
            sourceHandle: ai ? 'ai-out' : `out-${salida}`, targetHandle: ai ? tipo : 'in', type: 'default',
            style: { stroke: ai ? '#8e4ec6' : '#8a8a90', strokeWidth: 2, strokeDasharray: ai ? '6 5' : undefined },
            markerEnd: ai ? undefined : { type: MarkerType.ArrowClosed, color: '#8a8a90', width: 18, height: 18 },
            deletable: !soloLectura && !verOriginal,
          });
        }));
      }
    }
    return l;
  }, [mostrado, soloLectura, verOriginal]);
  useEffect(() => {
    if (!mostrado) return;
    setRfNodos(mostrado.nodos.map(n => {
      const salidasMain = mostrado.conexiones[n.name]?.main?.length || 0;
      const porTipo = /\.if$|\.if\b/.test(t(n)) ? 2 : 1;
      const ramas = /\.if$|\.if\b/.test(t(n)) ? ['true', 'false'] : /switch/.test(t(n)) ? Array.from({ length: Math.max(salidasMain, 2) }, (_, i) => `${i}`) : [];
      return {
        id: n.name, type: esNota(n) ? 'nota' : 'n8n', position: { x: n.position[0], y: n.position[1] }, zIndex: esNota(n) ? -1 : 0,
        draggable: !soloLectura && !verOriginal, selectable: true,
        data: { n, salidas: Math.max(salidasMain, porTipo, ramas.length), comentarios: comentarios.filter(c => c.nodo === n.name).length, aviso: avisos.some(a => a.nodo === n.name), elegido: sel === n.name, ramas },
        selected: sel === n.name,
      };
    }));
  }, [mostrado, comentarios, avisos, sel, soloLectura, verOriginal]);
  useEffect(() => { const x = setTimeout(() => rf.fitView({ padding: 0.2, duration: 300 }), 60); return () => clearTimeout(x); }, [verOriginal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flujo) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"><AlertTriangle className="w-8 h-8 text-amber-300" /><p className="text-sm text-[color:var(--c-d0d0da)]">Este archivo no parece un flujo de n8n.</p><p className="text-xs text-[color:var(--c-8a8b9e)]">Se espera el .json que se descarga desde n8n (menú del flujo → Download).</p></div>;

  const editable = !soloLectura && !verOriginal;
  const alCambiarNodos = (cambios: NodeChange<Node<DatosNodo>>[]) => {
    setRfNodos(ns => applyNodeChanges(cambios, ns));
    if (!editable) return;
    const fin = cambios.filter(c => c.type === 'position' && !c.dragging && c.position) as any[];
    if (fin.length) cambiar(f => ({ ...f, nodos: f.nodos.map(n => { const c = fin.find(x => x.id === n.name); return c ? { ...n, position: [Math.round(c.position.x), Math.round(c.position.y)] } : n; }) }));
  };
  const conectar = (c: Connection) => {
    if (!editable || !c.source || !c.target || c.source === c.target) return;
    cambiar(f => {
      const con = JSON.parse(JSON.stringify(f.conexiones));
      if (c.sourceHandle === 'ai-out') {
        const tipo = c.targetHandle || 'ai_tool';
        con[c.source] ||= {}; con[c.source][tipo] ||= [[]]; con[c.source][tipo][0].push({ node: c.target, type: tipo, index: 0 });
      } else {
        const salida = Number(String(c.sourceHandle || 'out-0').replace('out-', '')) || 0;
        con[c.source] ||= {}; con[c.source].main ||= [];
        while (con[c.source].main.length <= salida) con[c.source].main.push([]);
        if (!con[c.source].main[salida].some((d: any) => d.node === c.target)) con[c.source].main[salida].push({ node: c.target, type: 'main', index: 0 });
      }
      return { ...f, conexiones: con };
    });
  };
  const quitarAristas = (lista: Edge[]) => {
    if (!editable || !lista.length) return;
    cambiar(f => {
      const con = JSON.parse(JSON.stringify(f.conexiones));
      for (const e of lista) {
        const [de, tipo, salida, a] = e.id.split('|');
        const l = con[de]?.[tipo]?.[Number(salida)];
        if (l) con[de][tipo][Number(salida)] = l.filter((d: any) => d.node !== a);
      }
      return { ...f, conexiones: con };
    });
  };
  const quitarNodo = (nombre: string) => {
    cambiar(f => {
      const con: Flujo['conexiones'] = {};
      for (const [de, porTipo] of Object.entries(f.conexiones)) {
        if (de === nombre) continue;
        con[de] = Object.fromEntries(Object.entries(porTipo || {}).map(([tipo, salidas]) => [tipo, (salidas || []).map(l => (l || []).filter(d => d.node !== nombre))]));
      }
      return { ...f, nodos: f.nodos.filter(n => n.name !== nombre), conexiones: con };
    });
    setComentarios(l => l.filter(c => c.nodo !== nombre)); setSel(null);
  };
  const renombrar = (viejo: string, nuevoNombre: string) => {
    const nn = nuevoNombre.trim().slice(0, 80);
    if (!nn || nn === viejo || flujo.nodos.some(n => n.name === nn)) return false;
    cambiar(f => {
      const con: Flujo['conexiones'] = {};
      for (const [de, porTipo] of Object.entries(f.conexiones)) con[de === viejo ? nn : de] = Object.fromEntries(Object.entries(porTipo || {}).map(([tipo, salidas]) => [tipo, (salidas || []).map(l => (l || []).map(d => (d.node === viejo ? { ...d, node: nn } : d)))]));
      return { ...f, nodos: f.nodos.map(n => (n.name === viejo ? { ...n, name: nn } : n)), conexiones: con };
    });
    setComentarios(l => l.map(c => (c.nodo === viejo ? { ...c, nodo: nn } : c))); setSel(nn);
    return true;
  };
  const cambiarNodo = (nombre: string, cambio: Partial<NodoN8n>) => cambiar(f => ({ ...f, nodos: f.nodos.map(n => (n.name === nombre ? { ...n, ...cambio } : n)) }));
  const agregarNodo = (p: typeof NUEVOS[number]) => {
    let nombre = p.n; let k = 1; while (flujo.nodos.some(n => n.name === nombre)) nombre = `${p.n} ${++k}`;
    const centro = rf.screenToFlowPosition({ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 });
    cambiar(f => ({ ...f, nodos: [...f.nodos, { id: crypto.randomUUID?.() || String(Date.now()), name: nombre, type: p.type, typeVersion: 1, position: [Math.round(centro.x), Math.round(centro.y)], parameters: p.parameters || {} }] }));
    setSel(nombre); setAgregando(false);
  };

  const nodoSel = sel ? mostrado?.nodos.find(n => n.name === sel) : null;
  const comentariosDe = (n: string) => comentarios.filter(c => c.nodo === n);
  const boton = 'h-8 px-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-30';

  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-1 flex-wrap px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
          <span className="text-xs text-[color:var(--c-b0b0c4)] mr-1">{(mostrado?.nodos || []).filter(n => !esNota(n)).length} nodos · {aristas.length} conexiones</span>
          {editable && <>
            <button type="button" onClick={deshacer} disabled={!historial.atras.length} title="Deshacer" className={`${boton} text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]`}><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={rehacer} disabled={!historial.adelante.length} title="Rehacer" className={`${boton} text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]`}><Redo2 className="w-4 h-4" /></button>
            <div className="relative">
              <button type="button" onClick={() => setAgregando(v => !v)} className={`${boton} text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10`}><Plus className="w-4 h-4" />Agregar nodo</button>
              {agregando && <div className="absolute left-0 top-9 z-20 w-56 max-h-80 overflow-y-auto rounded-xl border border-[color:var(--c-313248)] bg-[color:var(--c-1c1d2a)] shadow-2xl p-1">{NUEVOS.map(p => { const { I, c } = aspecto({ name: p.n, type: p.type, position: [0, 0] }); return <button key={p.type} type="button" onClick={() => agregarNodo(p)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]"><I className="w-4 h-4" style={{ color: c }} />{p.n}</button>; })}</div>}
            </div>
          </>}
          {original && (editado || corregidoInicial) && (
            <div className="flex items-center rounded-lg border border-[color:var(--c-313248)] p-0.5 ml-1">
              <button type="button" onClick={() => setVerOriginal(false)} className={`h-7 px-2.5 rounded-md text-[11px] font-medium ${!verOriginal ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)]'}`}>Corregido</button>
              <button type="button" onClick={() => setVerOriginal(true)} className={`h-7 px-2.5 rounded-md text-[11px] font-medium ${verOriginal ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)]'}`}>Original del estudiante</button>
            </div>
          )}
          <span className="flex-1" />
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(mostrado ? aTexto(mostrado) : texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ } }} title="Pégalo en el lienzo de n8n (Ctrl+V) para probarlo" className={`${boton} border border-[color:var(--c-313248)] text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10`}>{copiado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiado ? 'Copiado' : 'Copiar para n8n'}</button>
        </div>
        <div className="relative flex-1 min-h-0 bg-[#1f1f22]">
          <ReactFlow nodes={rfNodos} edges={aristas} nodeTypes={tiposNodo} onNodesChange={alCambiarNodos} onConnect={conectar} onEdgesDelete={quitarAristas}
            onNodeClick={(_, n) => { setSel(n.id); setNuevo(''); }} onPaneClick={() => { setSel(null); setAgregando(false); }}
            onNodesDelete={(ns) => { if (editable) ns.forEach(n => quitarNodo(n.id)); }}
            nodesConnectable={editable} nodesDraggable={editable} elementsSelectable deleteKeyCode={editable ? ['Delete', 'Backspace'] : null}
            fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2.5} proOptions={{ hideAttribution: true }} colorMode="dark">
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="#3a3a40" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" nodeColor={(n: any) => aspecto(n.data.n).c} maskColor="rgba(0,0,0,.55)" style={{ background: '#2a2a2e' }} />
          </ReactFlow>
        </div>
      </div>

      {/* Panel: revisión automática o el nodo elegido */}
      <aside className="w-[340px] flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] flex flex-col min-h-0">
        {!nodoSel ? (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Revisión automática</p>
            {avisos.length === 0 ? <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />No se ven problemas evidentes.</p>
              : <ul className="space-y-1.5">{avisos.map((a, k) => <li key={k}><button type="button" onClick={() => a.nodo && setSel(a.nodo)} className="w-full text-left text-[13px] text-amber-200 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{a.t}</button></li>)}</ul>}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] pt-2">Comentarios ({comentarios.length})</p>
            {comentarios.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)]">{soloLectura ? 'Tu profesor no dejó comentarios en los nodos.' : 'Toca un nodo para comentarlo o editarlo.'}</p>
              : comentarios.map((c, k) => <button key={k} type="button" onClick={() => setSel(c.nodo)} className="w-full text-left rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2 text-[13px] text-[color:var(--c-e0e0ec)]"><b className="block text-[11px] text-[#f5a46b] mb-0.5">{c.nodo}</b>{c.texto}</button>)}
            {editable && <p className="text-[11px] text-[color:var(--c-6a6b7e)] pt-2 leading-relaxed">Arrastra los nodos para moverlos, une sus puntos para conectarlos y usa Supr para borrar el nodo o la conexión elegida.</p>}
          </div>
        ) : (
          <PanelNodo key={nodoSel.name} n={nodoSel} editable={editable} soloLectura={soloLectura} comentarios={comentariosDe(nodoSel.name)} nuevo={nuevo} setNuevo={setNuevo}
            onCerrar={() => setSel(null)} onRenombrar={(x) => renombrar(nodoSel.name, x)} onCambio={(c) => cambiarNodo(nodoSel.name, c)} onBorrar={() => quitarNodo(nodoSel.name)}
            onComentar={() => { const x = nuevo.trim(); if (x) { setComentarios(l => [...l, { nodo: nodoSel.name, texto: x.slice(0, 2000) }]); setNuevo(''); } }}
            onQuitarComentario={(c) => setComentarios(l => l.filter(x => x !== c))} />
        )}
      </aside>
    </div>
  );
}

function PanelNodo({ n, editable, soloLectura, comentarios, nuevo, setNuevo, onCerrar, onRenombrar, onCambio, onBorrar, onComentar, onQuitarComentario }: {
  n: NodoN8n; editable: boolean; soloLectura: boolean; comentarios: ComentarioNodo[]; nuevo: string; setNuevo: (s: string) => void;
  onCerrar: () => void; onRenombrar: (x: string) => boolean; onCambio: (c: Partial<NodoN8n>) => void; onBorrar: () => void; onComentar: () => void; onQuitarComentario: (c: ComentarioNodo) => void;
}) {
  const [nombre, setNombre] = useState(n.name);
  const [params, setParams] = useState(JSON.stringify(n.parameters || {}, null, 2));
  const [errorParams, setErrorParams] = useState('');
  const codigo = n.parameters?.jsCode != null ? 'jsCode' : n.parameters?.pythonCode != null ? 'pythonCode' : n.parameters?.functionCode != null ? 'functionCode' : null;
  const { I, c } = aspecto(n);
  const campo = 'w-full px-2.5 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60';
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="p-4 border-b border-[color:var(--c-282a3f)] flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-lg bg-[#2e2e33] border border-[#55555c] flex items-center justify-center flex-shrink-0"><I className="w-5 h-5" style={{ color: c }} /></span>
        <div className="min-w-0 flex-1">
          {editable ? <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => { if (!onRenombrar(nombre)) setNombre(n.name); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="w-full bg-transparent text-sm font-semibold text-[color:var(--c-e0e0ec)] outline-none border-b border-transparent focus:border-[color:var(--c-818cf8)]" />
            : <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] break-words">{n.name}</p>}
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] break-all">{n.type}{n.disabled ? ' · desactivado' : ''}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {editable && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onCambio({ disabled: !n.disabled })} className="h-8 px-2.5 rounded-lg border border-[color:var(--c-313248)] text-xs text-[color:var(--c-c0c0d0)] hover:bg-[color:var(--c-272839)] flex items-center gap-1.5"><Power className="w-3.5 h-3.5" />{n.disabled ? 'Activar' : 'Desactivar'}</button>
            <button type="button" onClick={onBorrar} className="h-8 px-2.5 rounded-lg text-xs text-red-300 hover:bg-red-500/10 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Borrar nodo</button>
          </div>
        )}
        {comentarios.map((x, k) => (
          <div key={k} className="rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2 text-[13px] text-[color:var(--c-e0e0ec)] flex gap-2"><MessageSquare className="w-4 h-4 text-[#f5a46b] flex-shrink-0 mt-0.5" /><span className="flex-1 whitespace-pre-wrap">{x.texto}</span>{!soloLectura && <button type="button" onClick={() => onQuitarComentario(x)} aria-label="Quitar comentario" className="text-[color:var(--c-8a8b9e)] hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
        ))}
        {!soloLectura && (
          <div>
            <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} rows={3} placeholder="Comentario sobre este nodo…" className={`${campo} resize-y`} />
            <div className="flex justify-end mt-1.5"><button type="button" disabled={!nuevo.trim()} onClick={onComentar} className="h-8 px-3 rounded-lg bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Comentar</button></div>
          </div>
        )}
        {n.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-1">Nota del estudiante</p><p className="text-[13px] text-[color:var(--c-c0c0d0)] whitespace-pre-wrap">{n.notes}</p></div>}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-1">{codigo ? 'Código' : 'Configuración'}</p>
          {codigo ? (
            <textarea value={String(n.parameters[codigo] ?? '')} readOnly={!editable} onChange={(e) => onCambio({ parameters: { ...n.parameters, [codigo]: e.target.value } })} spellCheck={false} rows={12} className={`${campo} font-mono text-[11.5px] leading-relaxed bg-[#0f1117] resize-y`} />
          ) : (
            <>
              <textarea value={params} readOnly={!editable} spellCheck={false} rows={10} onChange={(e) => { setParams(e.target.value); setErrorParams(''); }}
                onBlur={() => { if (!editable) return; try { onCambio({ parameters: JSON.parse(params || '{}') }); } catch { setErrorParams('El texto no es un JSON válido: revisa comas y comillas.'); } }}
                className={`${campo} font-mono text-[11.5px] leading-relaxed bg-[#0f1117] resize-y`} />
              {errorParams && <p className="text-[11px] text-red-300 mt-1">{errorParams}</p>}
            </>
          )}
          {n.credentials && <p className="mt-2 text-[11px] text-[color:var(--c-8a8b9e)]">Credenciales: {Object.values<any>(n.credentials).map(x => x?.name).filter(Boolean).join(', ') || 'sí'} (n8n no exporta las claves)</p>}
        </div>
      </div>
    </div>
  );
}
