'use client';
// Excel (.xlsx): corregir valores, dejar notas en celdas (el triángulo rojo de Excel) y pintar celdas.
// Se genera una copia .xlsx corregida con ExcelJS, que conserva el formato. Los gráficos no se conservan (se avisa).
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
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
  const [conGraficos, setConGraficos] = useState(false);
  const original = useRef<ArrayBuffer | null>(null);

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

  if (error) return <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-red-300">{error}</div>;
  if (!hojas) return <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Abriendo el Excel…</div>;
  const hoja = hojas[activa];
  const clave = (f: number, c: number) => `${hoja.nombre}!${letraColumna(c)}${f + 1}`;
  const cSel = sel ? cambios[clave(sel.fila, sel.col)] || {} : {};
  const poner = (cambio: Partial<CambioCelda>) => {
    if (!sel) return;
    const k = clave(sel.fila, sel.col);
    setCambios(m => {
      const nuevo = { ...(m[k] || {}), ...cambio };
      if (nuevo.valor === undefined && !nuevo.nota && !nuevo.color) { const { [k]: _, ...resto } = m; return resto; }
      return { ...m, [k]: nuevo };
    });
  };
  const nCambios = Object.keys(cambios).length;

  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        {conGraficos && <p className="flex-shrink-0 px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border-b border-amber-500/25 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Este archivo tiene gráficos: la copia corregida no los incluirá (el original del estudiante sí los conserva).</p>}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-white">
          <table className="border-collapse text-[12px] text-gray-900">
            <thead><tr><th className="sticky top-0 left-0 z-20 bg-gray-100 border border-gray-300 w-10" />{hoja.columnas.map((w, c) => <th key={c} style={{ minWidth: w }} className="sticky top-0 z-10 bg-gray-100 border border-gray-300 font-medium text-gray-500 px-1">{letraColumna(c)}</th>)}</tr></thead>
            <tbody>
              {hoja.filas.map((fila, f) => (
                <tr key={f}>
                  <td className="sticky left-0 z-10 bg-gray-100 border border-gray-300 text-center text-gray-500 px-1">{f + 1}</td>
                  {fila.map((celda, c) => {
                    if (celda.oculta) return null;
                    const ch = cambios[clave(f, c)];
                    const esSel = sel?.fila === f && sel?.col === c;
                    return (
                      <td key={c} colSpan={celda.colSpan} rowSpan={celda.rowSpan} onClick={() => setSel({ fila: f, col: c })}
                        className={`relative border border-gray-200 px-1.5 py-0.5 cursor-cell whitespace-pre-wrap ${esSel ? 'outline outline-2 outline-[#3e63dd] -outline-offset-2' : ''}`}
                        style={{ ...celda.estilo, ...(ch?.color ? { backgroundColor: COLORES[ch.color].css } : {}) }}>
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
        {hojas.length > 1 && <div className="flex-shrink-0 flex gap-1 px-2 py-1.5 border-t border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] overflow-x-auto">{hojas.map((h, k) => <button key={h.nombre} type="button" onClick={() => { setActiva(k); setSel(null); }} className={`h-7 px-3 rounded-md text-xs whitespace-nowrap ${k === activa ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-272839)]'}`}>{h.nombre}</button>)}</div>}
      </div>

      <aside className="w-[300px] flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] flex flex-col min-h-0">
        {!sel ? (
          <div className="p-4 space-y-2">
            <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Corregir celdas</p>
            <p className="text-xs text-[color:var(--c-8a8b9e)]">Toca una celda para corregir su valor, dejarle una nota o pintarla. Los valores corregidos se ven en rojo.</p>
            <p className="text-xs text-[color:var(--c-b0b0c4)] pt-2">{nCambios} celda{nCambios === 1 ? '' : 's'} corregida{nCambios === 1 ? '' : 's'}</p>
          </div>
        ) : (
          <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
            <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Celda {letraColumna(sel.col)}{sel.fila + 1} <span className="text-[11px] font-normal text-[color:var(--c-8a8b9e)]">· {hoja.nombre}</span></p>
            <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Valor del estudiante: <span className="text-[color:var(--c-d0d0da)]">{hoja.filas[sel.fila]?.[sel.col]?.t || '(vacía)'}</span></p>
            <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Valor corregido</span>
              <input value={cSel.valor ?? ''} onChange={(e) => poner({ valor: e.target.value === '' ? undefined : e.target.value.slice(0, 500) })} placeholder="Deja vacío para no cambiarlo (=FÓRMULA también vale)" className="mt-1 w-full h-9 px-2.5 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60" /></label>
            <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Nota</span>
              <textarea value={cSel.nota ?? ''} onChange={(e) => poner({ nota: e.target.value.slice(0, 1000) || undefined })} rows={3} placeholder="Ej.: Esta fórmula debe sumar toda la columna" className="mt-1 w-full px-2.5 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-y" /></label>
            <div><span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)]">Color</span>
              <div className="mt-1 flex gap-1.5">
                {(Object.keys(COLORES) as (keyof typeof COLORES)[]).map(k => <button key={k} type="button" onClick={() => poner({ color: cSel.color === k ? null : k })} className={`h-8 px-3 rounded-lg text-xs font-medium text-gray-900 border-2 ${cSel.color === k ? 'border-white' : 'border-transparent'}`} style={{ background: COLORES[k].css }}>{k[0].toUpperCase() + k.slice(1)}</button>)}
              </div>
            </div>
            {cambios[clave(sel.fila, sel.col)] && <button type="button" onClick={() => setCambios(m => { const { [clave(sel.fila, sel.col)]: _, ...resto } = m; return resto; })} className="h-8 px-3 rounded-lg text-xs text-red-300 hover:bg-red-500/10 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Quitar la corrección de esta celda</button>}
          </div>
        )}
      </aside>
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
