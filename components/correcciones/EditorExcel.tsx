'use client';
// Excel (.xlsx): corregir valores, dejar notas en celdas (el triángulo rojo de Excel) y pintar celdas.
// Se genera una copia .xlsx corregida con ExcelJS, que conserva el formato. Los gráficos no se conservan (se avisa).
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, StickyNote, Trash2 } from 'lucide-react';
import PanelPlegable, { usePanel } from './PanelPlegable';
import { bajarOriginal } from './comun';
import { leerExcel, letraColumna, type Hoja } from '@/components/entregas/VistaArchivo';

export interface CambioCelda { valor?: string; nota?: string; color?: 'rojo' | 'verde' | 'amarillo' | null }
export interface DatosExcel { cambios: Record<string, CambioCelda> } // clave: "Hoja!B4"
const COLORES = { rojo: { argb: 'FFFFC7CE', css: '#ffc7ce' }, verde: { argb: 'FFC6EFCE', css: '#c6efce' }, amarillo: { argb: 'FFFFEB9C', css: '#ffeb9c' } } as const;

export default function EditorExcel({ fuente, datos, onCambio }: { fuente: string; datos?: DatosExcel | null; onCambio: (d: DatosExcel, exportar: () => Promise<Blob>) => void }) {
  const [hojas, setHojas] = useState<Hoja[] | null>(null);
  const [error, setError] = useState('');
  const [activa, setActiva] = useState(0);
  const [cambios, setCambios] = useState<Record<string, CambioCelda>>(datos?.cambios || {});
  const [sel, setSel] = useState<{ fila: number; col: number } | null>(null);
  const [editando, setEditando] = useState<string | null>(null); // texto mientras se escribe en la celda
  const [conGraficos, setConGraficos] = useState(false);
  const [panel, setPanel] = usePanel('excel');
  const original = useRef<ArrayBuffer | null>(null);
  const rejilla = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const buf = await bajarOriginal(fuente);
        original.current = buf;
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buf.slice(0));
        if (vivo) setConGraficos(Object.keys(zip.files).some(f => f.startsWith('xl/charts/')));
        const h = await leerExcel(buf.slice(0));
        if (vivo) { if (!h.length) setError('El libro no tiene hojas visibles.'); else setHojas(h); }
      } catch (e: any) { if (vivo) setError(e?.message || 'No se pudo abrir el Excel.'); }
    })();
    return () => { vivo = false; };
  }, [fuente]);
  useEffect(() => { onCambio({ cambios }, () => exportarXlsx(original.current!, cambios)); }, [cambios]); // eslint-disable-line react-hooks/exhaustive-deps
  // La celda elegida siempre a la vista
  useEffect(() => { if (sel) rejilla.current?.querySelector<HTMLElement>(`[data-celda="${sel.fila}-${sel.col}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [sel]);

  if (error) return <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-red-300">{error}</div>;
  if (!hojas) return <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Abriendo el Excel…</div>;
  const hoja = hojas[activa];
  const nFilas = hoja.filas.length, nCols = hoja.columnas.length;
  const clave = (f: number, c: number) => `${hoja.nombre}!${letraColumna(c)}${f + 1}`;
  const textoOriginal = (f: number, c: number) => hoja.filas[f]?.[c]?.t ?? '';
  const cSel = sel ? cambios[clave(sel.fila, sel.col)] || {} : {};
  const ponerEn = (f: number, c: number, cambio: Partial<CambioCelda>) => {
    const k = clave(f, c);
    setCambios(m => {
      const nuevo = { ...(m[k] || {}), ...cambio };
      if (nuevo.valor !== undefined && nuevo.valor === textoOriginal(f, c)) delete nuevo.valor; // igual al del estudiante: no es corrección
      if (nuevo.valor === undefined && !nuevo.nota && !nuevo.color) { const { [k]: _, ...resto } = m; return resto; }
      return { ...m, [k]: nuevo };
    });
  };
  const poner = (cambio: Partial<CambioCelda>) => { if (sel) ponerEn(sel.fila, sel.col, cambio); };
  const quitar = (f: number, c: number) => setCambios(m => { const { [clave(f, c)]: _, ...resto } = m; return resto; });
  const valorVisible = (f: number, c: number) => cambios[clave(f, c)]?.valor ?? textoOriginal(f, c);

  // Moverse saltando las celdas tapadas por una combinación
  const mover = (df: number, dc: number) => {
    if (!sel) { setSel({ fila: 0, col: 0 }); return; }
    let f = sel.fila, c = sel.col;
    do { f += df; c += dc; } while (f >= 0 && c >= 0 && f < nFilas && c < nCols && hoja.filas[f]?.[c]?.oculta);
    if (f >= 0 && c >= 0 && f < nFilas && c < nCols) setSel({ fila: f, col: c });
  };
  const confirmar = (df = 0, dc = 0) => {
    if (sel && editando !== null) ponerEn(sel.fila, sel.col, { valor: editando.slice(0, 500) });
    setEditando(null);
    if (df || dc) mover(df, dc);
    if (df || dc) requestAnimationFrame(() => rejilla.current?.focus());
  };
  const cancelar = () => { setEditando(null); requestAnimationFrame(() => rejilla.current?.focus()); };
  const teclaRejilla = (e: React.KeyboardEvent) => {
    if (editando !== null) return;
    const k = e.key;
    if (!sel) { if (k.startsWith('Arrow')) { e.preventDefault(); setSel({ fila: 0, col: 0 }); } return; }
    if (k === 'ArrowDown') { e.preventDefault(); mover(1, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); mover(-1, 0); }
    else if (k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { e.preventDefault(); mover(0, 1); }
    else if (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { e.preventDefault(); mover(0, -1); }
    else if (k === 'Enter') { e.preventDefault(); mover(e.shiftKey ? -1 : 1, 0); }
    else if (k === 'F2') { e.preventDefault(); setEditando(valorVisible(sel.fila, sel.col)); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); quitar(sel.fila, sel.col); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setEditando(k); }
  };
  const teclaEdicion = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); confirmar(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); confirmar(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  };
  const nCambios = Object.keys(cambios).length;
  const enEstaHoja = Object.entries(cambios).filter(([k]) => k.startsWith(`${hoja.nombre}!`));
  const selCorregida = sel ? cambios[clave(sel.fila, sel.col)] : undefined;

  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        {conGraficos && <p className="flex-shrink-0 px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border-b border-amber-500/25 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Este archivo tiene gráficos: la copia corregida no los incluirá (el original del estudiante sí los conserva).</p>}
        {/* Barra de fórmulas, como en Excel */}
        <div className="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
          <span className="w-16 h-8 rounded-md border border-[color:var(--c-313248)] bg-[color:var(--c-191a26)] text-[12px] font-semibold text-[color:var(--c-d0d0da)] flex items-center justify-center flex-shrink-0">{sel ? `${letraColumna(sel.col)}${sel.fila + 1}` : '—'}</span>
          <span className="text-[13px] italic text-[color:var(--c-6a6b7e)] flex-shrink-0">fx</span>
          <input disabled={!sel} data-barra-formulas="" value={editando ?? (sel ? valorVisible(sel.fila, sel.col) : '')}
            onFocus={() => { if (sel && editando === null) setEditando(valorVisible(sel.fila, sel.col)); }}
            onChange={(e) => setEditando(e.target.value)} onKeyDown={teclaEdicion}
            onBlur={(e) => { if (editando !== null && e.relatedTarget !== editor.current) confirmar(); }}
            placeholder={sel ? '' : 'Elige una celda'} spellCheck={false}
            className={`flex-1 min-w-0 h-8 px-2.5 rounded-md bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] outline-none focus:border-[#3e63dd] ${selCorregida?.valor !== undefined && editando === null ? 'text-[#ff8f86] font-semibold' : 'text-[color:var(--c-e0e0ec)]'}`} />
          {sel && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {(Object.keys(COLORES) as (keyof typeof COLORES)[]).map(k => <button key={k} type="button" title={`Pintar de ${k}`} onClick={() => poner({ color: cSel.color === k ? null : k })} className={`w-6 h-6 rounded-md border-2 ${cSel.color === k ? 'border-white' : 'border-transparent'}`} style={{ background: COLORES[k].css }} />)}
              <button type="button" onClick={() => setPanel(true)} title="Nota de la celda" className={`h-8 px-2 rounded-md text-xs flex items-center gap-1 ${cSel.nota ? 'text-[#ff8f86]' : 'text-[color:var(--c-b0b0c4)]'} hover:bg-[color:var(--c-272839)]`}><StickyNote className="w-3.5 h-3.5" />Nota</button>
              {selCorregida && <button type="button" onClick={() => quitar(sel.fila, sel.col)} title="Quitar la corrección de esta celda (Supr)" className="w-8 h-8 rounded-md flex items-center justify-center text-red-300 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          )}
        </div>
        <div ref={rejilla} tabIndex={0} onKeyDown={teclaRejilla} className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-white outline-none">
          <table className="border-collapse text-[12px] text-gray-900">
            <thead><tr><th className="sticky top-0 left-0 z-20 bg-gray-100 border border-gray-300 w-10" />{hoja.columnas.map((w, c) => <th key={c} style={{ minWidth: w }} className={`sticky top-0 z-10 border border-gray-300 font-medium px-1 ${sel?.col === c ? 'bg-[#dbe4ff] text-[#3e63dd]' : 'bg-gray-100 text-gray-500'}`}>{letraColumna(c)}</th>)}</tr></thead>
            <tbody>
              {hoja.filas.map((fila, f) => (
                <tr key={f}>
                  <td className={`sticky left-0 z-10 border border-gray-300 text-center px-1 ${sel?.fila === f ? 'bg-[#dbe4ff] text-[#3e63dd]' : 'bg-gray-100 text-gray-500'}`}>{f + 1}</td>
                  {fila.map((celda, c) => {
                    if (celda.oculta) return null;
                    const ch = cambios[clave(f, c)];
                    const esSel = sel?.fila === f && sel?.col === c;
                    return (
                      <td key={c} data-celda={`${f}-${c}`} colSpan={celda.colSpan} rowSpan={celda.rowSpan}
                        onMouseDown={() => { if (!esSel) { if (editando !== null) confirmar(); setSel({ fila: f, col: c }); } }}
                        onDoubleClick={() => { setSel({ fila: f, col: c }); setEditando(valorVisible(f, c)); }}
                        className={`relative border border-gray-200 px-1.5 py-0.5 cursor-cell whitespace-pre-wrap ${esSel ? 'outline outline-2 outline-[#3e63dd] -outline-offset-2' : ''}`}
                        style={{ ...celda.estilo, ...(ch?.color ? { backgroundColor: COLORES[ch.color].css } : {}) }}>
                        {esSel && editando !== null && (
                          <input ref={editor} autoFocus value={editando} onChange={(e) => setEditando(e.target.value)} spellCheck={false} onKeyDown={teclaEdicion}
                            onFocus={(e) => { const n = e.target.value.length; e.target.setSelectionRange(n, n); }}
                            onBlur={(e) => { if ((e.relatedTarget as HTMLElement | null)?.dataset?.barraFormulas === undefined) confirmar(); }}
                            className="absolute inset-0 w-full h-full min-w-[120px] px-1.5 text-[12px] text-[#c0362c] font-semibold bg-white outline outline-2 outline-[#3e63dd] -outline-offset-2 z-10" />
                        )}
                        {ch?.valor !== undefined ? <span className="text-[#c0362c] font-semibold">{ch.valor}</span> : celda.t}
                        {ch?.nota && <span className="absolute top-0 right-0 w-0 h-0 border-l-[7px] border-l-transparent border-t-[7px] border-t-[#e5484d]" title={ch.nota} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {hoja.recortada && <p className="p-2 text-xs text-gray-500">Se muestran las primeras filas y columnas.</p>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-t border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] overflow-x-auto sin-barra">
          {hojas.length > 1 && hojas.map((h, k) => <button key={h.nombre} type="button" onClick={() => { confirmar(); setActiva(k); setSel(null); }} className={`h-7 px-3 rounded-md text-xs whitespace-nowrap ${k === activa ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]'}`}>{h.nombre}</button>)}
          <span className="flex-1" />
          <span className="text-[11px] text-[color:var(--c-6a6b7e)] whitespace-nowrap">Escribe sobre una celda o haz doble clic · Enter baja · Tab a la derecha · Supr quita la corrección</span>
        </div>
      </div>

      <PanelPlegable abierto={panel} onCambiar={setPanel} icono={StickyNote} titulo="Notas y correcciones" contador={nCambios || null} ancho={300}>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {sel ? (
            <>
              <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Celda {letraColumna(sel.col)}{sel.fila + 1} <span className="text-[11px] font-normal text-[color:var(--c-8a8b9e)]">· {hoja.nombre}</span></p>
              <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Valor del estudiante: <span className="text-[color:var(--c-d0d0da)]">{textoOriginal(sel.fila, sel.col) || '(vacía)'}</span></p>
              <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Nota</span>
                <textarea value={cSel.nota ?? ''} onChange={(e) => poner({ nota: e.target.value.slice(0, 1000) || undefined })} rows={3} placeholder="Ej.: Esta fórmula debe sumar toda la columna" className="mt-1 w-full px-2.5 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-y" /></label>
            </>
          ) : <p className="text-xs text-[color:var(--c-8a8b9e)]">Elige una celda para dejarle una nota (en Excel se ve como el triángulo rojo).</p>}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] pt-2">Corregidas en esta hoja ({enEstaHoja.length})</p>
          {enEstaHoja.length === 0 ? <p className="text-xs text-[color:var(--c-6a6b7e)]">Ninguna todavía.</p> : enEstaHoja.map(([k, ch]) => {
            const ref = k.slice(k.lastIndexOf('!') + 1); const m = ref.match(/^([A-Z]+)(\d+)$/);
            const col = m ? m[1].split('').reduce((a, l) => a * 26 + l.charCodeAt(0) - 64, 0) - 1 : 0, fila = m ? Number(m[2]) - 1 : 0;
            return (
              <button key={k} type="button" onClick={() => { setSel({ fila, col }); rejilla.current?.focus(); }} className="w-full text-left rounded-lg border border-[color:var(--c-313248)] px-3 py-2 hover:border-[color:var(--c-818cf8)]/50">
                <b className="text-[11px] text-[color:var(--c-c7d2fe)]">{ref}</b>
                {ch.valor !== undefined && <span className="text-[12px] text-[color:var(--c-b0b0c4)]"> · {textoOriginal(fila, col) || '(vacía)'} → <span className="text-[#ff8f86] font-semibold">{ch.valor || '(vacía)'}</span></span>}
                {ch.nota && <span className="block text-[12px] text-[color:var(--c-d0d0da)] mt-0.5">{ch.nota}</span>}
              </button>
            );
          })}
        </div>
      </PanelPlegable>
    </div>
  );
}

async function exportarXlsx(original: ArrayBuffer, cambios: Record<string, CambioCelda>): Promise<Blob> {
  const ExcelJS: any = (await import('exceljs')).default ?? (await import('exceljs'));
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(original.slice(0));
  for (const [clave, c] of Object.entries(cambios)) {
    const i = clave.lastIndexOf('!'); const hoja = libro.getWorksheet(clave.slice(0, i)); if (!hoja) continue;
    const celda = hoja.getCell(clave.slice(i + 1));
    if (c.valor !== undefined) {
      const v = c.valor.trim();
      celda.value = v.startsWith('=') ? { formula: v.slice(1) } : v !== '' && !isNaN(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : v;
      celda.font = { ...(celda.font || {}), color: { argb: 'FFC0362C' }, bold: true };
    }
    if (c.nota) celda.note = { texts: [{ text: c.nota }], margins: { insetmode: 'auto' } };
    if (c.color) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES[c.color].argb } };
  }
  const bytes = await libro.xlsx.writeBuffer();
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
