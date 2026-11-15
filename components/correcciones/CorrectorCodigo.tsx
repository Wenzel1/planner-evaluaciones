'use client';
// Corregir código con Monaco, el editor de Visual Studio Code: colores, buscar y reemplazar, mini mapa, atajos…
// Comentarios por línea o por bloque (se ven como recuadros entre las líneas, como en GitHub), una versión
// corregida editable y la comparación lado a lado con el comparador de VS Code.
// Si Monaco no carga (sin conexión al servidor de librerías), se usa el editor sencillo de la app.
import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import { Columns2, MessageSquarePlus, PencilLine, Trash2 } from 'lucide-react';
import CodigoSimple, { type ComentarioLinea, type DatosCodigo } from './CodigoSimple';
export type { ComentarioLinea, DatosCodigo };

const LENGUAJE: Record<string, string> = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', java: 'java', kt: 'kotlin', c: 'c', h: 'c',
  cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby', go: 'go', rs: 'rust', swift: 'swift', sql: 'sql', html: 'html', xml: 'xml',
  css: 'css', scss: 'scss', yml: 'yaml', yaml: 'yaml', sh: 'shell', r: 'r', md: 'markdown', json: 'json', dart: 'dart', vue: 'html', bat: 'bat', ps1: 'powershell',
};
const OPCIONES = { fontSize: 13, minimap: { enabled: true }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, renderWhitespace: 'selection' as const, smoothScrolling: true, wordWrap: 'off' as const };

// ¿Cargó Monaco? (se comprueba una vez; si en 12 s no llega, se usa el editor sencillo)
let estadoMonaco: 'cargando' | 'listo' | 'fallo' = 'cargando';
const promesaMonaco = typeof window !== 'undefined'
  ? Promise.race([loader.init().then(() => { estadoMonaco = 'listo'; }), new Promise<void>((_, falla) => setTimeout(() => falla(new Error('tiempo')), 12000))]).catch(() => { if (estadoMonaco !== 'listo') estadoMonaco = 'fallo'; })
  : Promise.resolve();

export default function CorrectorCodigo(props: { texto: string; ext: string; datos?: DatosCodigo | null; onCambio?: (d: DatosCodigo) => void; soloLectura?: boolean }) {
  const [estado, setEstado] = useState(estadoMonaco);
  useEffect(() => { if (estado === 'cargando') promesaMonaco.then(() => setEstado(estadoMonaco === 'cargando' ? 'fallo' : estadoMonaco)); }, [estado]);
  if (estado === 'fallo') return <CodigoSimple {...props} />;
  if (estado === 'cargando') return <div className="absolute inset-0 flex items-center justify-center text-sm text-[color:var(--c-9a9bb0)]">Abriendo el editor de código…</div>;
  return <CodigoMonaco {...props} />;
}

function CodigoMonaco({ texto, ext, datos, onCambio, soloLectura = false }: { texto: string; ext: string; datos?: DatosCodigo | null; onCambio?: (d: DatosCodigo) => void; soloLectura?: boolean }) {
  const lenguaje = LENGUAJE[ext] || 'plaintext';
  const original = useMemo(() => texto.replace(/\r\n/g, '\n'), [texto]);
  const [estado, setEstado] = useState<DatosCodigo>({ comentarios: datos?.comentarios || [], corregido: datos?.corregido ?? null });
  const [vista, setVista] = useState<'comentarios' | 'editar' | 'diferencias'>(soloLectura && datos?.corregido && !(datos?.comentarios?.length) ? 'diferencias' : 'comentarios');
  const [sel, setSel] = useState<{ desde: number; hasta: number } | null>(null);
  const [nuevo, setNuevo] = useState('');
  const editor = useRef<any>(null);
  const zonas = useRef<string[]>([]);
  useEffect(() => { if (!soloLectura) onCambio?.(estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Los comentarios se dibujan como recuadros entre las líneas (zonas del editor) y las líneas comentadas se marcan
  const decoraciones = useRef<any>(null);
  const pintar = () => {
    const ed = editor.current; if (!ed) return;
    ed.changeViewZones((acc: any) => {
      zonas.current.forEach(z => acc.removeZone(z)); zonas.current = [];
      for (const c of estado.comentarios) {
        const nodo = document.createElement('div');
        nodo.style.cssText = 'padding:4px 0 6px 0;';
        const caja = document.createElement('div');
        caja.style.cssText = 'max-width:640px;border:1px solid rgba(247,107,21,.45);background:#1d1e2e;border-radius:8px;padding:6px 10px;font:13px/1.45 Inter,system-ui,sans-serif;color:#e0e0ec;white-space:pre-wrap;';
        const titulo = document.createElement('div'); titulo.style.cssText = 'font-size:11px;font-weight:600;color:#f5a46b;margin-bottom:2px;';
        titulo.textContent = c.desde === c.hasta ? `Línea ${c.desde}` : `Líneas ${c.desde}–${c.hasta}`;
        const cuerpo = document.createElement('div'); cuerpo.textContent = c.texto;
        caja.append(titulo, cuerpo); nodo.append(caja);
        const lineas = Math.max(2, Math.ceil(c.texto.length / 85) + c.texto.split('\n').length);
        zonas.current.push(acc.addZone({ afterLineNumber: c.hasta, heightInLines: lineas + 1, domNode: nodo }));
      }
    });
    const monaco = (window as any).monaco;
    if (monaco && decoraciones.current) decoraciones.current.set(estado.comentarios.map(c => ({ range: new monaco.Range(c.desde, 1, c.hasta, 1), options: { isWholeLine: true, className: 'linea-comentada', linesDecorationsClassName: 'margen-comentado' } })));
  };
  useEffect(() => { pintar(); }, [estado.comentarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const montar = (ed: any) => {
    editor.current = ed;
    decoraciones.current = ed.createDecorationsCollection([]);
    // Tocar un número de línea elige esa línea (con Mayús, un bloque); también sirve seleccionar texto
    ed.onMouseDown((e: any) => {
      if (soloLectura) return;
      const n = e.target?.position?.lineNumber; if (!n) return;
      if (e.target.type === 3 /* números de línea */ || e.target.type === 2 /* margen */) {
        setSel(s => (e.event.shiftKey && s ? { desde: Math.min(s.desde, n), hasta: Math.max(s.hasta, n) } : { desde: n, hasta: n }));
      }
    });
    ed.onDidChangeCursorSelection((e: any) => {
      if (soloLectura) return;
      const s = e.selection; if (s.startLineNumber !== s.endLineNumber || s.startColumn !== s.endColumn) setSel({ desde: Math.min(s.startLineNumber, s.endLineNumber), hasta: Math.max(s.startLineNumber, s.endLineNumber) });
    });
    pintar();
  };
  const agregar = () => {
    const t = nuevo.trim(); if (!t || !sel) return;
    setEstado(e => ({ ...e, comentarios: [...e.comentarios, { ...sel, texto: t.slice(0, 2000) }].sort((a, b) => a.hasta - b.hasta) }));
    setSel(null); setNuevo('');
  };
  const ir = (n: number) => { editor.current?.revealLineInCenter(n); editor.current?.setSelection({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: 1 }); };
  const corregido = estado.corregido ?? null;

  const Pestana = ({ id, I, t }: { id: typeof vista; I: any; t: string }) => (
    <button type="button" onClick={() => setVista(id)} className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${vista === id ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]'}`}><I className="w-3.5 h-3.5" />{t}</button>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <style>{'.linea-comentada{background:rgba(247,107,21,.10)}.margen-comentado{background:#f76b15;width:3px!important;margin-left:3px}'}</style>
      <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
        <Pestana id="comentarios" I={MessageSquarePlus} t={`Comentarios (${estado.comentarios.length})`} />
        {!soloLectura && <Pestana id="editar" I={PencilLine} t="Editar el código" />}
        {corregido != null && <Pestana id="diferencias" I={Columns2} t="Original vs. corregido" />}
        <span className="flex-1" />
        {!soloLectura && vista === 'comentarios' && <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Selecciona líneas o toca su número para comentar</span>}
        {!soloLectura && corregido != null && vista !== 'comentarios' && <button type="button" onClick={() => { setEstado(e => ({ ...e, corregido: null })); setVista('comentarios'); }} className="h-8 px-3 rounded-lg text-xs text-red-300 hover:bg-red-500/10">Descartar versión corregida</button>}
      </div>
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0">
          {vista === 'comentarios' && <Editor height="100%" theme="vs-dark" language={lenguaje} value={original} onMount={montar} options={{ ...OPCIONES, readOnly: true, glyphMargin: true, lineDecorationsWidth: 8 }} />}
          {vista === 'editar' && <Editor height="100%" theme="vs-dark" language={lenguaje} value={corregido ?? original} onChange={(v) => setEstado(s => ({ ...s, corregido: String(v ?? '').slice(0, 400_000) }))} options={OPCIONES} />}
          {vista === 'diferencias' && corregido != null && <DiffEditor height="100%" theme="vs-dark" language={lenguaje} original={original} modified={corregido} options={{ ...OPCIONES, readOnly: true, renderSideBySide: true, originalEditable: false }} />}
        </div>
        {vista === 'comentarios' && (
          <aside className="w-[300px] flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] flex flex-col min-h-0">
            {!soloLectura && (
              <div className="p-3 border-b border-[color:var(--c-282a3f)]">
                {sel ? (
                  <>
                    <p className="text-[11px] text-[#9fb2f7] mb-1">{sel.desde === sel.hasta ? `Comentario en la línea ${sel.desde}` : `Comentario en las líneas ${sel.desde}–${sel.hasta}`}</p>
                    <textarea autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); }} rows={3} placeholder="Ej.: Aquí falta validar que la lista no esté vacía" className="w-full px-2.5 py-2 rounded-md bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[#3e63dd] resize-y" />
                    <div className="flex justify-end gap-1.5 mt-1.5"><button type="button" onClick={() => setSel(null)} className="h-8 px-3 rounded-md text-xs text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]">Cancelar</button><button type="button" onClick={agregar} disabled={!nuevo.trim()} className="h-8 px-3 rounded-md bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Comentar</button></div>
                  </>
                ) : <p className="text-xs text-[color:var(--c-8a8b9e)]">Selecciona una o varias líneas en el código (o toca su número) para comentarlas.</p>}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {estado.comentarios.length === 0 && <p className="text-xs text-[color:var(--c-6a6b7e)]">{soloLectura ? 'Sin comentarios.' : 'Aún no hay comentarios.'}</p>}
              {estado.comentarios.map((c, k) => (
                <div key={k} className="rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <button type="button" onClick={() => ir(c.desde)} className="flex-1 text-left"><b className="block text-[11px] text-[#f5a46b] mb-0.5">{c.desde === c.hasta ? `Línea ${c.desde}` : `Líneas ${c.desde}–${c.hasta}`}</b><span className="text-[13px] text-[color:var(--c-e0e0ec)] whitespace-pre-wrap">{c.texto}</span></button>
                    {!soloLectura && <button type="button" onClick={() => setEstado(e => ({ ...e, comentarios: e.comentarios.filter(x => x !== c) }))} aria-label="Quitar comentario" className="text-[color:var(--c-8a8b9e)] hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
