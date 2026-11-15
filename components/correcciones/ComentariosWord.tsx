'use client';
// Word (.docx): la profesora toca un párrafo y escribe su comentario. Al guardar se genera una copia del .docx
// con COMENTARIOS REALES de Word (globos en el margen) que el estudiante abre en Word, LibreOffice o Google Docs.
// No se toca el texto ni el formato del estudiante: solo se agregan los comentarios.
import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Trash2, X } from 'lucide-react';
import { bajarOriginal } from './comun';
import PanelPlegable, { usePanel } from './PanelPlegable';

export interface ComentarioParrafo { indice: number; extracto: string; texto: string }
export interface DatosWord { comentarios: ComentarioParrafo[] }
const normal = (t: string) => String(t || '').replace(/\s+/g, ' ').trim();

export default function ComentariosWord({ fuente, datos, autor, onCambio }: {
  fuente: string; datos?: DatosWord | null; autor: string;
  onCambio: (d: DatosWord, exportar: () => Promise<Blob>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const original = useRef<ArrayBuffer | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [comentarios, setComentarios] = useState<ComentarioParrafo[]>(datos?.comentarios || []);
  const [sel, setSel] = useState<{ indice: number; extracto: string } | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [panel, setPanel] = usePanel('word');
  // Al tocar un párrafo, el panel se abre solo
  useEffect(() => { if (sel && !panel) setPanel(true); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ renderAsync }, buf] = await Promise.all([import('docx-preview'), bajarOriginal(fuente)]);
        original.current = buf;
        if (!vivo || !ref.current) return;
        await renderAsync(buf.slice(0), ref.current, ref.current, { inWrapper: true, ignoreWidth: false, renderHeaders: false, renderFooters: false, renderFootnotes: false, renderEndnotes: false, renderComments: false, breakPages: true, experimental: true, useBase64URL: true, className: 'docx' });
        ref.current.querySelectorAll('script, iframe, object, embed').forEach(n => n.remove());
        // Cada párrafo del cuerpo se puede tocar para comentarlo
        ref.current.querySelectorAll<HTMLElement>('section.docx p').forEach((p, i) => {
          p.dataset.indice = String(i);
          p.style.cursor = 'pointer';
          p.addEventListener('click', () => { setSel({ indice: i, extracto: normal(p.textContent || '').slice(0, 300) }); setNuevo(''); });
        });
        if (vivo) setCargando(false);
      } catch (e: any) { if (vivo) { setError(e?.message || 'No se pudo abrir el documento.'); setCargando(false); } }
    })();
    return () => { vivo = false; };
  }, [fuente]);

  // Resalta los párrafos comentados y el elegido
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('section.docx p').forEach((p, i) => {
      const comentado = comentarios.some(c => c.indice === i);
      p.style.outline = sel?.indice === i ? '2px solid #3e63dd' : comentado ? '2px solid #f76b15' : '';
      p.style.outlineOffset = '2px';
      p.style.background = comentado ? 'rgba(247,107,21,0.08)' : '';
    });
  }, [comentarios, sel, cargando]);

  useEffect(() => { onCambio({ comentarios }, () => exportarDocx(original.current!, comentarios, autor)); }, [comentarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const agregar = () => {
    const t = nuevo.trim(); if (!t || !sel) return;
    setComentarios(l => [...l, { ...sel, texto: t.slice(0, 2000) }].sort((a, b) => a.indice - b.indice));
    setSel(null); setNuevo('');
  };
  const ir = (i: number) => ref.current?.querySelector(`[data-indice="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="absolute inset-0 flex">
      <div className="relative flex-1 min-w-0 overflow-auto custom-scrollbar bg-[#e9e9ec]">
        {cargando && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-600"><Loader2 className="w-5 h-5 animate-spin" />Abriendo el documento…</div>}
        {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-red-600">{error}</div>}
        <div ref={ref} className="min-h-full [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-6" />
      </div>
      <PanelPlegable abierto={panel} onCambiar={setPanel} icono={MessageSquarePlus} titulo="Comentarios de Word" contador={comentarios.length || null} ancho={340}>
        <div className="px-4 py-3 border-b border-[color:var(--c-282a3f)]">
          <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Toca un párrafo del documento para comentarlo. El estudiante los verá como comentarios en el margen de Word.</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
          {sel && (
            <div className="rounded-lg border border-[#3e63dd]/50 bg-[#3e63dd]/[0.06] p-3">
              <div className="flex items-start gap-2"><p className="flex-1 text-[11px] text-[#9fb2f7] line-clamp-3">«{sel.extracto || '(párrafo vacío)'}»</p><button type="button" onClick={() => setSel(null)} aria-label="Cancelar" className="text-[color:var(--c-8a8b9e)]"><X className="w-3.5 h-3.5" /></button></div>
              <textarea autoFocus value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); }} rows={3} placeholder="Ej.: Falta citar la fuente de este dato" className="mt-2 w-full px-2.5 py-2 rounded-md bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[#3e63dd] resize-y" />
              <div className="flex justify-end mt-1.5"><button type="button" onClick={agregar} disabled={!nuevo.trim()} className="h-8 px-3 rounded-md bg-[color:var(--c-818cf8)] text-white text-xs font-semibold disabled:opacity-50">Comentar</button></div>
            </div>
          )}
          {comentarios.length === 0 && !sel && <p className="text-xs text-[color:var(--c-6a6b7e)]">Aún no hay comentarios.</p>}
          {comentarios.map((c, k) => (
            <div key={k} className="rounded-lg border border-[#f76b15]/35 bg-[#f76b15]/[0.06] px-3 py-2">
              <button type="button" onClick={() => ir(c.indice)} className="block w-full text-left text-[11px] text-[#f5a46b] line-clamp-2 mb-1">«{c.extracto || '(párrafo vacío)'}»</button>
              <div className="flex gap-2"><p className="flex-1 text-[13px] text-[color:var(--c-e0e0ec)] whitespace-pre-wrap">{c.texto}</p><button type="button" onClick={() => setComentarios(l => l.filter(x => x !== c))} aria-label="Quitar comentario" className="text-[color:var(--c-8a8b9e)] hover:text-red-300 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button></div>
            </div>
          ))}
        </div>
      </PanelPlegable>
    </div>
  );
}

// ---------- Copia del .docx con los comentarios (JSZip + XML) ----------
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
async function exportarDocx(original: ArrayBuffer, comentarios: ComentarioParrafo[], autor: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(original);
  const docTxt = await zip.file('word/document.xml')!.async('string');
  const doc = new DOMParser().parseFromString(docTxt, 'application/xml');
  const parrafos = Array.from(doc.getElementsByTagNameNS(W, 'p'));
  const textoDe = (p: Element) => normal(Array.from(p.getElementsByTagNameNS(W, 't')).map(t => t.textContent || '').join(''));
  const textos = parrafos.map(textoDe);

  // comments.xml (se crea si no existe; si existe, se siguen sus números)
  let comTxt = await zip.file('word/comments.xml')?.async('string');
  const com = new DOMParser().parseFromString(comTxt || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${W}"></w:comments>`, 'application/xml');
  const raiz = com.documentElement;
  let id = Math.max(-1, ...Array.from(com.getElementsByTagNameNS(W, 'comment')).map(c => Number(c.getAttributeNS(W, 'id') ?? c.getAttribute('w:id')) || 0)) + 1;
  const iniciales = autor.split(/\s+/).map(x => x[0] || '').join('').slice(0, 3).toUpperCase() || 'P';
  const fecha = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const el = (d: Document, nombre: string, attrs: Record<string, string> = {}) => { const e = d.createElementNS(W, `w:${nombre}`); for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W, `w:${k}`, v); return e; };

  for (const c of comentarios) {
    // El párrafo: el de igual texto más cercano a su posición (por si la vista y el archivo cuentan distinto)
    let k = -1; let mejor = Infinity;
    const objetivo = normal(c.extracto);
    textos.forEach((t, i) => { if (objetivo && (t === objetivo || t.startsWith(objetivo.slice(0, 120)))) { const d = Math.abs(i - c.indice); if (d < mejor) { mejor = d; k = i; } } });
    if (k < 0) k = Math.min(Math.max(0, c.indice), parrafos.length - 1);
    const p = parrafos[k]; if (!p) continue;
    const n = String(id++);
    const inicio = el(doc, 'commentRangeStart', { id: n });
    const pPr = Array.from(p.childNodes).find(x => (x as Element).localName === 'pPr');
    if (pPr && pPr.nextSibling) p.insertBefore(inicio, pPr.nextSibling); else if (pPr) p.appendChild(inicio); else p.insertBefore(inicio, p.firstChild);
    p.appendChild(el(doc, 'commentRangeEnd', { id: n }));
    const r = el(doc, 'r'); r.appendChild(el(doc, 'commentReference', { id: n })); p.appendChild(r);
    // El comentario
    const nodo = el(com, 'comment', { id: n, author: autor || 'Profesor', date: fecha, initials: iniciales });
    c.texto.split('\n').forEach(linea => {
      const cp = el(com, 'p'); const cr = el(com, 'r'); const ct = el(com, 't'); ct.setAttribute('xml:space', 'preserve'); ct.textContent = linea; cr.appendChild(ct); cp.appendChild(cr); nodo.appendChild(cp);
    });
    raiz.appendChild(nodo);
  }
  const ser = new XMLSerializer();
  zip.file('word/document.xml', ser.serializeToString(doc));
  zip.file('word/comments.xml', ser.serializeToString(com));
  // Relación y tipo de contenido de comments.xml (si faltaban)
  if (!comTxt) {
    const relRuta = 'word/_rels/document.xml.rels';
    let rels = await zip.file(relRuta)?.async('string') || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    if (!/relationships\/comments"/.test(rels)) rels = rels.replace('</Relationships>', '<Relationship Id="rIdComentariosProfesor" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');
    zip.file(relRuta, rels);
    let tipos = await zip.file('[Content_Types].xml')!.async('string');
    if (!/\/word\/comments\.xml/.test(tipos)) tipos = tipos.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
    zip.file('[Content_Types].xml', tipos);
  }
  comTxt = undefined;
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
