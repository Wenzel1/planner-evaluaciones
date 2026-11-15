'use client';
// Corregir sobre un PDF o una imagen: lápiz, resaltador, texto y sellos encima de cada página.
// Las marcas se guardan como datos (para seguir editándolas) y se genera un PDF corregido con pdf-lib.
// El archivo original del estudiante no se toca.
import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Highlighter, Loader2, PenLine, Redo2, Stamp, Type, Undo2, X } from 'lucide-react';
import { bajarOriginal } from './comun';

type Punto = [number, number]; // coordenadas relativas al ANCHO de la página (0 a 1), para que no dependan del zoom
export type Marca =
  | { tipo: 'trazo' | 'resaltado'; color: string; grosor: number; puntos: Punto[] }
  | { tipo: 'texto'; x: number; y: number; texto: string; color: string }
  | { tipo: 'sello'; x: number; y: number; sello: Sello };
type Sello = 'ok' | 'mal' | 'duda' | 'bien' | 'revisar';
export interface DatosAnotacion { paginas: Record<string, Marca[]> }
type Herramienta = 'lapiz' | 'resaltador' | 'texto' | 'sello' | 'borrador';

const COLORES = [{ c: '#e5484d', n: 'Rojo' }, { c: '#30a46c', n: 'Verde' }, { c: '#3e63dd', n: 'Azul' }];
const AMARILLO = '#ffd60a';
const SELLOS: { id: Sello; t: string; c: string }[] = [
  { id: 'ok', t: '✓', c: '#30a46c' }, { id: 'mal', t: '✗', c: '#e5484d' }, { id: 'duda', t: '?', c: '#f76b15' },
  { id: 'bien', t: 'Bien', c: '#30a46c' }, { id: 'revisar', t: 'Revisar', c: '#e5484d' },
];
const MAX_PAGINAS = 60;

interface Pagina { url: string; ancho: number; alto: number } // imagen de la página y su tamaño en puntos

export default function AnotadorPdf({ fuente, tipo, inicial, onCambio }: {
  fuente: string; tipo: 'PDF' | 'IMAGEN'; inicial?: DatosAnotacion | null;
  onCambio: (datos: DatosAnotacion, exportar: () => Promise<Blob>) => void;
}) {
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState<DatosAnotacion>(inicial && inicial.paginas ? inicial : { paginas: {} });
  const [historial, setHistorial] = useState<{ atras: DatosAnotacion[]; adelante: DatosAnotacion[] }>({ atras: [], adelante: [] });
  const [herr, setHerr] = useState<Herramienta>('lapiz');
  const [color, setColor] = useState(COLORES[0].c);
  const [sello, setSello] = useState<Sello>('ok');
  const [trazando, setTrazando] = useState<{ pagina: number; marca: Extract<Marca, { puntos: Punto[] }> } | null>(null);
  const [escribiendo, setEscribiendo] = useState<{ pagina: number; x: number; y: number; texto: string } | null>(null);
  const original = useRef<ArrayBuffer | null>(null);

  // Carga y dibuja las páginas (PDF con pdf.js; imagen tal cual)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const buf = await bajarOriginal(fuente);
        original.current = buf;
        if (tipo === 'IMAGEN') {
          const url = URL.createObjectURL(new Blob([buf]));
          const img = await new Promise<HTMLImageElement>((ok, falla) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falla(new Error('No se pudo abrir la imagen.')); i.src = url; });
          if (vivo) setPaginas([{ url, ancho: img.naturalWidth, alto: img.naturalHeight }]);
          return;
        }
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
        const lista: Pagina[] = [];
        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGINAS); n++) {
          const pag = await doc.getPage(n);
          const base = pag.getViewport({ scale: 1 });
          const vista = pag.getViewport({ scale: Math.min(2, 1600 / base.width) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(vista.width); canvas.height = Math.round(vista.height);
          await pag.render({ canvasContext: canvas.getContext('2d')!, viewport: vista }).promise;
          lista.push({ url: canvas.toDataURL('image/jpeg', 0.85), ancho: base.width, alto: base.height });
          if (!vivo) return;
          if (n === 1 || n % 4 === 0) setPaginas([...lista]); // se van mostrando mientras cargan
        }
        if (vivo) setPaginas(lista);
      } catch (e: any) { if (vivo) setError(e?.message || 'No se pudo abrir el archivo.'); }
    })();
    return () => { vivo = false; };
  }, [fuente, tipo]);

  // Cada cambio se avisa con la función que genera el PDF corregido (se llama al guardar)
  useEffect(() => { onCambio(datos, () => exportarPdf(original.current!, tipo, paginas || [], datos)); }, [datos, paginas]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (nuevo: DatosAnotacion) => { setHistorial(h => ({ atras: [...h.atras.slice(-60), datos], adelante: [] })); setDatos(nuevo); };
  const agregar = (pagina: number, m: Marca) => cambiar({ paginas: { ...datos.paginas, [pagina]: [...(datos.paginas[pagina] || []), m] } });
  const quitar = (pagina: number, k: number) => cambiar({ paginas: { ...datos.paginas, [pagina]: (datos.paginas[pagina] || []).filter((_, j) => j !== k) } });
  const deshacer = () => setHistorial(h => { if (!h.atras.length) return h; const prev = h.atras[h.atras.length - 1]; setDatos(prev); return { atras: h.atras.slice(0, -1), adelante: [datos, ...h.adelante] }; });
  const rehacer = () => setHistorial(h => { if (!h.adelante.length) return h; const sig = h.adelante[0]; setDatos(sig); return { atras: [...h.atras, datos], adelante: h.adelante.slice(1) }; });
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); }
    };
    window.addEventListener('keydown', tecla); return () => window.removeEventListener('keydown', tecla);
  });

  const punto = (e: React.PointerEvent<SVGSVGElement>): Punto => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width];
  };
  const abajo = (pagina: number) => (e: React.PointerEvent<SVGSVGElement>) => {
    if (herr === 'borrador') return;
    const [x, y] = punto(e);
    if (herr === 'texto') { setEscribiendo({ pagina, x, y, texto: '' }); return; }
    if (herr === 'sello') { agregar(pagina, { tipo: 'sello', x, y, sello }); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    setTrazando({ pagina, marca: herr === 'resaltador' ? { tipo: 'resaltado', color: AMARILLO, grosor: 0.018, puntos: [[x, y]] } : { tipo: 'trazo', color, grosor: 0.0028, puntos: [[x, y]] } });
  };
  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!trazando) return;
    const p = punto(e);
    const u = trazando.marca.puntos[trazando.marca.puntos.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 0.0015) return;
    setTrazando({ ...trazando, marca: { ...trazando.marca, puntos: [...trazando.marca.puntos, p] } });
  };
  const arriba = () => { if (trazando && trazando.marca.puntos.length > 1) agregar(trazando.pagina, trazando.marca); setTrazando(null); };

  if (error) return <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-300">{error}</div>;
  const nMarcas = Object.values(datos.paginas).reduce((t, l) => t + l.length, 0);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Herramientas */}
      <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
        {([['lapiz', PenLine, 'Lápiz'], ['resaltador', Highlighter, 'Resaltador'], ['texto', Type, 'Texto'], ['sello', Stamp, 'Sello'], ['borrador', Eraser, 'Borrar marca']] as const).map(([id, I, t]) => (
          <button key={id} type="button" onClick={() => setHerr(id)} title={t} aria-pressed={herr === id} className={`h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${herr === id ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)] border border-[color:var(--c-818cf8)]/40' : 'text-[color:var(--c-b0b0c4)] border border-transparent hover:bg-[color:var(--c-272839)]'}`}><I className="w-4 h-4" /><span className="hidden sm:inline">{t}</span></button>
        ))}
        <span className="w-px h-6 bg-[color:var(--c-313248)] mx-1" />
        {(herr === 'lapiz' || herr === 'texto') && COLORES.map(c => <button key={c.c} type="button" onClick={() => setColor(c.c)} title={c.n} aria-label={c.n} className={`w-7 h-7 rounded-full border-2 ${color === c.c ? 'border-white' : 'border-transparent'}`} style={{ background: c.c }} />)}
        {herr === 'sello' && SELLOS.map(s => <button key={s.id} type="button" onClick={() => setSello(s.id)} className={`h-8 min-w-8 px-2 rounded-lg text-sm font-bold border ${sello === s.id ? 'border-white/70 bg-white/10' : 'border-[color:var(--c-313248)]'}`} style={{ color: s.c }}>{s.t}</button>)}
        {herr === 'borrador' && <span className="text-xs text-[color:var(--c-8a8b9e)]">Toca una marca para quitarla</span>}
        <span className="flex-1" />
        <button type="button" onClick={deshacer} disabled={!historial.atras.length} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
        <button type="button" onClick={rehacer} disabled={!historial.adelante.length} title="Rehacer (Ctrl+Y)" aria-label="Rehacer" className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)] disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
        <span className="text-[11px] text-[color:var(--c-6a6b7e)] pl-1">{nMarcas} marca{nMarcas === 1 ? '' : 's'}</span>
      </div>

      {/* Páginas */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[color:var(--c-12131d)] py-5 px-3">
        {!paginas ? <div className="h-full flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Preparando el documento…</div> : (
          <div className="mx-auto max-w-[900px] space-y-5">
            {paginas.map((p, n) => {
              const alto = p.alto / p.ancho; // en unidades de ancho
              const marcas = datos.paginas[n] || [];
              return (
                <div key={n} className="relative shadow-2xl bg-white select-none">
                  <img src={p.url} alt={`Página ${n + 1}`} className="block w-full h-auto pointer-events-none" draggable={false} />
                  <svg viewBox={`0 0 1 ${alto}`} preserveAspectRatio="none" className={`absolute inset-0 w-full h-full touch-none ${herr === 'borrador' ? 'cursor-pointer' : herr === 'texto' ? 'cursor-text' : 'cursor-crosshair'}`}
                    onPointerDown={abajo(n)} onPointerMove={mover} onPointerUp={arriba} onPointerLeave={arriba}>
                    {marcas.map((m, k) => <DibujoMarca key={k} m={m} borrable={herr === 'borrador'} onBorrar={() => quitar(n, k)} />)}
                    {trazando?.pagina === n && <DibujoMarca m={trazando.marca} />}
                  </svg>
                  {escribiendo?.pagina === n && (
                    <form onSubmit={(e) => { e.preventDefault(); const t = escribiendo.texto.trim(); if (t) agregar(n, { tipo: 'texto', x: escribiendo.x, y: escribiendo.y, texto: t.slice(0, 300), color }); setEscribiendo(null); }}
                      className="absolute z-10 flex items-center gap-1" style={{ left: `${escribiendo.x * 100}%`, top: `${(escribiendo.y / alto) * 100}%` }}>
                      <input autoFocus value={escribiendo.texto} onChange={(e) => setEscribiendo({ ...escribiendo, texto: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setEscribiendo(null); }}
                        placeholder="Escribe y presiona Enter" className="h-8 w-56 px-2 rounded-md border-2 bg-white text-sm outline-none" style={{ borderColor: color, color }} />
                      <button type="submit" aria-label="Poner texto" className="w-8 h-8 rounded-md bg-white border border-black/10 flex items-center justify-center" style={{ color }}><Check className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setEscribiendo(null)} aria-label="Cancelar" className="w-8 h-8 rounded-md bg-white border border-black/10 flex items-center justify-center text-gray-500"><X className="w-4 h-4" /></button>
                    </form>
                  )}
                  <span className="absolute -bottom-4 right-0 text-[10px] text-[color:var(--c-6a6b7e)]">{n + 1}/{paginas.length}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const camino = (puntos: Punto[]) => puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`).join(' ');

function DibujoMarca({ m, borrable, onBorrar }: { m: Marca; borrable?: boolean; onBorrar?: () => void }) {
  const eventos = borrable ? { onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); onBorrar?.(); }, style: { cursor: 'pointer' } } : { style: { pointerEvents: 'none' as const } };
  if ('puntos' in m) return <path d={camino(m.puntos)} fill="none" stroke={m.color} strokeWidth={m.grosor} strokeLinecap="round" strokeLinejoin="round" opacity={m.tipo === 'resaltado' ? 0.38 : 1} {...eventos} />;
  if (m.tipo === 'texto') return <text x={m.x} y={m.y + 0.018} fontSize={0.019} fontFamily="Helvetica, Arial, sans-serif" fontWeight={600} fill={m.color} {...eventos}>{m.texto}</text>;
  const s = SELLOS.find(x => x.id === m.sello) || SELLOS[0];
  const corto = s.t.length === 1;
  return (
    <g {...eventos}>
      {corto ? <text x={m.x} y={m.y + 0.02} fontSize={0.045} fontWeight={800} textAnchor="middle" fill={s.c}>{s.t}</text>
        : <><rect x={m.x - 0.045} y={m.y - 0.012} width={0.09} height={0.032} rx={0.006} fill="none" stroke={s.c} strokeWidth={0.003} /><text x={m.x} y={m.y + 0.011} fontSize={0.018} fontWeight={800} textAnchor="middle" fill={s.c}>{s.t.toUpperCase()}</text></>}
    </g>
  );
}

// ---------- PDF corregido (pdf-lib) ----------
async function exportarPdf(original: ArrayBuffer, tipo: 'PDF' | 'IMAGEN', paginas: Pagina[], datos: DatosAnotacion): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, LineCapStyle } = await import('pdf-lib');
  let doc: any;
  if (tipo === 'PDF') doc = await PDFDocument.load(original, { ignoreEncryption: true });
  else {
    doc = await PDFDocument.create();
    const png = await aPng(original);
    const img = await doc.embedPng(png);
    const p = doc.addPage([img.width, img.height]);
    p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const fuente = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  // Solo caracteres que la fuente puede escribir (WinAnsi: letras con tilde y ñ sí; emojis no)
  const seguro = (t: string) => [...t].map(ch => { try { fuente.encodeText(ch); return ch; } catch { return '?'; } }).join('');
  doc.getPages().forEach((pag: any, n: number) => {
    const marcas = datos.paginas[n] || [];
    if (!marcas.length) return;
    const { width: W, height: H } = pag.getSize();
    for (const m of marcas) {
      if ('puntos' in m) {
        const d = m.puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W).toFixed(2)} ${(y * W).toFixed(2)}`).join(' ');
        pag.drawSvgPath(d, { x: 0, y: H, borderColor: color(m.color), borderWidth: m.grosor * W, borderOpacity: m.tipo === 'resaltado' ? 0.38 : 1, borderLineCap: LineCapStyle.Round });
      } else if (m.tipo === 'texto') {
        const tam = 0.019 * W;
        pag.drawText(seguro(m.texto), { x: m.x * W, y: H - m.y * W - tam * 0.95, size: tam, font: fuente, color: color(m.color) });
      } else {
        const s = SELLOS.find(x => x.id === m.sello) || SELLOS[0];
        const c = color(s.c); const cx = m.x * W, cy = H - m.y * W;
        if (s.id === 'ok') pag.drawSvgPath(`M ${-0.018 * W} 0 L ${-0.005 * W} ${0.014 * W} L ${0.02 * W} ${-0.016 * W}`, { x: cx, y: cy, borderColor: c, borderWidth: 0.006 * W, borderLineCap: LineCapStyle.Round });
        else if (s.id === 'mal') pag.drawSvgPath(`M ${-0.015 * W} ${-0.015 * W} L ${0.015 * W} ${0.015 * W} M ${0.015 * W} ${-0.015 * W} L ${-0.015 * W} ${0.015 * W}`, { x: cx, y: cy, borderColor: c, borderWidth: 0.006 * W, borderLineCap: LineCapStyle.Round });
        else if (s.id === 'duda') { const tam = 0.045 * W; pag.drawText('?', { x: cx - fuente.widthOfTextAtSize('?', tam) / 2, y: cy - tam * 0.35, size: tam, font: fuente, color: c }); }
        else {
          const t = s.t.toUpperCase(); const tam = 0.018 * W; const ancho = 0.09 * W;
          pag.drawRectangle({ x: cx - ancho / 2, y: cy - 0.02 * W, width: ancho, height: 0.032 * W, borderColor: c, borderWidth: 0.003 * W });
          pag.drawText(t, { x: cx - fuente.widthOfTextAtSize(t, tam) / 2, y: cy - 0.011 * W, size: tam, font: fuente, color: c });
        }
      }
    }
  });
  void paginas;
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// Cualquier imagen (jpg, webp, gif…) a PNG para incrustarla en el PDF
async function aPng(datos: ArrayBuffer): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(new Blob([datos]));
  try {
    const img = await new Promise<HTMLImageElement>((ok, falla) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falla(new Error('Imagen no válida.')); i.src = url; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    const blob: Blob = await new Promise((ok, falla) => c.toBlob(b => (b ? ok(b) : falla(new Error('No se pudo convertir la imagen.'))), 'image/png'));
    return blob.arrayBuffer();
  } finally { URL.revokeObjectURL(url); }
}
