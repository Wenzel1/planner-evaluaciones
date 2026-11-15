'use client';
// Corregir código: comentarios por línea o por bloque (como en GitHub) y, si se quiere, una versión corregida
// que se compara lado a lado con la del estudiante. También la usa el estudiante para ver la corrección (soloLectura).
import { useEffect, useMemo, useState } from 'react';
import { Columns2, MessageSquarePlus, PencilLine, Trash2, X } from 'lucide-react';
import hljs from 'highlight.js/lib/common';

export interface ComentarioLinea { desde: number; hasta: number; texto: string }
export interface DatosCodigo { comentarios: ComentarioLinea[]; corregido?: string | null }

const LENGUAJE: Record<string, string> = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', java: 'java', kt: 'kotlin', c: 'c', h: 'c',
  cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby', go: 'go', rs: 'rust', swift: 'swift', sql: 'sql', html: 'xml', xml: 'xml',
  css: 'css', scss: 'scss', yml: 'yaml', yaml: 'yaml', sh: 'bash', r: 'r', md: 'markdown', json: 'json', dart: 'dart', vue: 'xml',
};
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function colorear(linea: string, lenguaje: string | null): string {
  if (!lenguaje || !hljs.getLanguage(lenguaje)) return escapar(linea);
  try { return hljs.highlight(linea, { language: lenguaje, ignoreIllegals: true }).value; } catch { return escapar(linea); }
}

// Diferencias por líneas (LCS). Devuelve filas para mostrar lado a lado.
type Fila = { izq: { n: number; t: string } | null; der: { n: number; t: string } | null; tipo: 'igual' | 'cambio' | 'quitada' | 'agregada' };
function diferencias(a: string[], b: string[]): Fila[] {
  if (a.length * b.length > 4_000_000) return a.map((t, i) => ({ izq: { n: i + 1, t }, der: b[i] != null ? { n: i + 1, t: b[i] } : null, tipo: t === b[i] ? 'igual' : 'cambio' }));
  const m = a.length, n = b.length;
  const L: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const filas: Fila[] = []; let i = 0, j = 0;
  const quitadas: { n: number; t: string }[] = [], agregadas: { n: number; t: string }[] = [];
  const vaciar = () => {
    const k = Math.max(quitadas.length, agregadas.length);
    for (let x = 0; x < k; x++) { const q = quitadas[x] || null, g = agregadas[x] || null; filas.push({ izq: q, der: g, tipo: q && g ? 'cambio' : q ? 'quitada' : 'agregada' }); }
    quitadas.length = 0; agregadas.length = 0;
  };
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { vaciar(); filas.push({ izq: { n: i + 1, t: a[i] }, der: { n: j + 1, t: b[j] }, tipo: 'igual' }); i++; j++; }
    else if (j < n && (i >= m || L[i][j + 1] >= L[i + 1][j])) { agregadas.push({ n: j + 1, t: b[j] }); j++; }
    else { quitadas.push({ n: i + 1, t: a[i] }); i++; }
  }
  vaciar();
  return filas;
}

export default function CorrectorCodigo({ texto, ext, datos, onCambio, soloLectura = false }: {
  texto: string; ext: string; datos?: DatosCodigo | null; onCambio?: (d: DatosCodigo) => void; soloLectura?: boolean;
}) {
  const lenguaje = LENGUAJE[ext] || null;
  const [estado, setEstado] = useState<DatosCodigo>({ comentarios: datos?.comentarios || [], corregido: datos?.corregido ?? null });
  const [vista, setVista] = useState<'comentarios' | 'editar' | 'diferencias'>(soloLectura && datos?.corregido && !(datos?.comentarios?.length) ? 'diferencias' : 'comentarios');
  const [sel, setSel] = useState<{ desde: number; hasta: number } | null>(null);
  const [nuevo, setNuevo] = useState('');
  useEffect(() => { if (!soloLectura) onCambio?.(estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineas = useMemo(() => texto.replace(/\r\n/g, '\n').split('\n').slice(0, 5000), [texto]);
  const coloreadas = useMemo(() => lineas.map(l => colorear(l, lenguaje)), [lineas, lenguaje]);
  const corregido = estado.corregido ?? null;
  const filas = useMemo(() => (corregido != null ? diferencias(lineas, corregido.replace(/\r\n/g, '\n').split('\n').slice(0, 5000)) : []), [lineas, corregido]);
  const comentariosEn = (n: number) => estado.comentarios.filter(c => c.hasta === n);
  const marcada = (n: number) => estado.comentarios.some(c => n >= c.desde && n <= c.hasta);

  const tocarLinea = (n: number, shift: boolean) => {
    if (soloLectura) return;
    if (shift && sel) setSel({ desde: Math.min(sel.desde, n), hasta: Math.max(sel.hasta, n) });
    else setSel(sel && sel.desde === n && sel.hasta === n ? null : { desde: n, hasta: n });
    setNuevo('');
  };
  const agregar = () => {
    const t = nuevo.trim(); if (!t || !sel) return;
    setEstado(e => ({ ...e, comentarios: [...e.comentarios, { ...sel, texto: t.slice(0, 2000) }].sort((a, b) => a.hasta - b.hasta) }));
    setSel(null); setNuevo('');
  };

  const Pestana = ({ id, I, t }: { id: typeof vista; I: any; t: string }) => (
    <button type="button" onClick={() => setVista(id)} className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${vista === id ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]'}`}><I className="w-3.5 h-3.5" />{t}</button>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <style>{ESTILO_HLJS}</style>
      <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
        <Pestana id="comentarios" I={MessageSquarePlus} t={`Comentarios (${estado.comentarios.length})`} />
        {!soloLectura && <Pestana id="editar" I={PencilLine} t="Editar el código" />}
        {corregido != null && <Pestana id="diferencias" I={Columns2} t="Original vs. corregido" />}
        <span className="flex-1" />
        {!soloLectura && vista === 'comentarios' && <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Toca un número de línea para comentar (Mayús + clic para varias)</span>}
        {!soloLectura && corregido != null && vista !== 'comentarios' && <button type="button" onClick={() => { setEstado(e => ({ ...e, corregido: null })); setVista('comentarios'); }} className="h-8 px-3 rounded-lg text-xs text-red-300 hover:bg-red-500/10">Descartar versión corregida</button>}
      </div>

      {vista === 'comentarios' && (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-[#0f1117] font-mono text-[12.5px] leading-[1.6]">
          <table className="min-w-full border-collapse"><tbody>
            {lineas.map((_, k) => {
              const n = k + 1; const enSel = sel && n >= sel.desde && n <= sel.hasta;
              return [
                <tr key={`l${n}`} className={enSel ? 'bg-[#3e63dd]/25' : marcada(n) ? 'bg-[#f76b15]/10' : ''}>
                  <td onClick={(e) => tocarLinea(n, e.shiftKey)} className={`select-none text-right pr-3 pl-3 w-[1%] whitespace-nowrap align-top text-[#5c6370] ${soloLectura ? '' : 'cursor-pointer hover:text-[#c7d2fe]'} ${marcada(n) ? 'border-l-2 border-[#f76b15]' : 'border-l-2 border-transparent'}`}>{n}</td>
                  <td className="pr-4 whitespace-pre text-[#d4d4d4] align-top hljs" dangerouslySetInnerHTML={{ __html: coloreadas[k] || ' ' }} />
                </tr>,
                ...comentariosEn(n).map((c, j) => (
                  <tr key={`c${n}-${j}`}><td /><td className="py-1.5 pr-4">
                    <div className="max-w-2xl rounded-lg border border-[#f76b15]/40 bg-[#1d1e2e] px-3 py-2 font-sans text-[13px] text-[color:var(--c-e0e0ec)] flex gap-2">
                      <span className="flex-1 whitespace-pre-wrap"><b className="text-[11px] text-[#f5a46b] block mb-0.5">{c.desde === c.hasta ? `Línea ${c.desde}` : `Líneas ${c.desde}–${c.hasta}`}</b>{c.texto}</span>
                      {!soloLectura && <button type="button" onClick={() => setEstado(e => ({ ...e, comentarios: e.comentarios.filter(x => x !== c) }))} aria-label="Quitar comentario" className="w-7 h-7 rounded-md flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-red-300 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td></tr>
                )),
                ...(sel && sel.hasta === n ? [
                  <tr key={`n${n}`}><td /><td className="py-1.5 pr-4">
                    <div className="max-w-2xl rounded-lg border border-[#3e63dd]/50 bg-[#1d1e2e] p-2 font-sans">
                      <p className="text-[11px] text-[#9fb2f7] mb-1">{sel.desde === sel.hasta ? `Comentario en la línea ${sel.desde}` : `Comentario en las líneas ${sel.desde}–${sel.hasta}`}</p>
                      <textarea autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); if (e.key === 'Escape') setSel(null); }} rows={2} placeholder="Ej.: Aquí falta validar que la lista no esté vacía" className="w-full px-2.5 py-2 rounded-md bg-[#12131d] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[#3e63dd] resize-y" />
                      <div className="flex justify-end gap-1.5 mt-1.5"><button type="button" onClick={() => setSel(null)} className="h-8 px-3 rounded-md text-xs text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]">Cancelar</button><button type="button" onClick={agregar} disabled={!nuevo.trim()} className="h-8 px-3 rounded-md bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Comentar</button></div>
                    </div>
                  </td></tr>,
                ] : []),
              ];
            })}
          </tbody></table>
        </div>
      )}

      {vista === 'editar' && (
        <div className="flex-1 min-h-0 flex flex-col bg-[#0f1117]">
          <p className="px-4 py-2 text-[11px] text-[color:var(--c-8a8b9e)] border-b border-[color:var(--c-282a3f)]">Corrige el código aquí. El original del estudiante no cambia: verá las dos versiones lado a lado.</p>
          <textarea value={corregido ?? texto} spellCheck={false} onChange={(e) => setEstado(s => ({ ...s, corregido: e.target.value.slice(0, 400_000) }))} onKeyDown={(e) => {
            if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const i = t.selectionStart; const v = t.value; setEstado(s => ({ ...s, corregido: v.slice(0, i) + '  ' + v.slice(t.selectionEnd) })); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = i + 2; }); }
          }} className="flex-1 min-h-0 w-full p-4 bg-transparent font-mono text-[12.5px] leading-[1.6] text-[#d4d4d4] outline-none resize-none custom-scrollbar" />
        </div>
      )}

      {vista === 'diferencias' && corregido != null && (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-[#0f1117] font-mono text-[12px] leading-[1.6]">
          <div className="grid grid-cols-2 sticky top-0 z-10 text-[11px] font-sans font-semibold text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1d1e2e)] border-b border-[color:var(--c-282a3f)]"><span className="px-3 py-1.5">Original del estudiante</span><span className="px-3 py-1.5 border-l border-[color:var(--c-282a3f)]">Corregido</span></div>
          <table className="w-full border-collapse table-fixed"><tbody>
            {filas.map((f, k) => (
              <tr key={k}>
                <td className={`w-10 text-right pr-2 text-[#5c6370] select-none align-top ${f.tipo === 'quitada' || (f.tipo === 'cambio' && f.izq) ? 'bg-[#e5484d]/15' : ''}`}>{f.izq?.n ?? ''}</td>
                <td className={`whitespace-pre-wrap break-all pr-2 align-top text-[#d4d4d4] ${f.tipo === 'quitada' || (f.tipo === 'cambio' && f.izq) ? 'bg-[#e5484d]/15' : ''}`}>{f.izq ? (f.tipo === 'igual' ? f.izq.t : <span className="text-[#ffa4a4]">{f.izq.t || ' '}</span>) : ''}</td>
                <td className={`w-10 text-right pr-2 text-[#5c6370] select-none align-top border-l border-[color:var(--c-282a3f)] ${f.tipo === 'agregada' || (f.tipo === 'cambio' && f.der) ? 'bg-[#30a46c]/15' : ''}`}>{f.der?.n ?? ''}</td>
                <td className={`whitespace-pre-wrap break-all pr-2 align-top text-[#d4d4d4] ${f.tipo === 'agregada' || (f.tipo === 'cambio' && f.der) ? 'bg-[#30a46c]/15' : ''}`}>{f.der ? (f.tipo === 'igual' ? f.der.t : <span className="text-[#9be9a8]">{f.der.t || ' '}</span>) : ''}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
      {soloLectura && !estado.comentarios.length && corregido == null && <div className="absolute inset-x-0 bottom-4 flex justify-center"><span className="text-xs text-[color:var(--c-8a8b9e)] flex items-center gap-1"><X className="w-3 h-3" />Sin comentarios</span></div>}
    </div>
  );
}

// Colores del código (tema oscuro)
const ESTILO_HLJS = `
.hljs-keyword,.hljs-selector-tag,.hljs-built_in,.hljs-meta .hljs-keyword{color:#c586c0}
.hljs-string,.hljs-attr .hljs-string,.hljs-template-tag{color:#ce9178}
.hljs-number,.hljs-literal{color:#b5cea8}
.hljs-comment{color:#6a9955;font-style:italic}
.hljs-title,.hljs-title.function_,.hljs-section{color:#dcdcaa}
.hljs-title.class_,.hljs-type{color:#4ec9b0}
.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-params,.hljs-property{color:#9cdcfe}
.hljs-tag,.hljs-name{color:#569cd6}
.hljs-meta{color:#d7ba7d}
`;
