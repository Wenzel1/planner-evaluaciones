'use client';
// Vista previa de un archivo entregado, dentro del programa (tipo Drive):
//  PDF, imágenes, video y audio directo · Word/Excel/PowerPoint con el visor de Microsoft Office ·
//  código y texto con colores y números de línea · CSV como tabla · .zip con su lista de archivos.
// Lo que no se puede mostrar se abre en otra pestaña o se descarga.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Folder, ChevronRight, AlertCircle, ZoomIn, ZoomOut, ArrowLeft, Zap } from 'lucide-react';
import { categoria, estiloDe, extension, tamanoLegible } from './tiposArchivo';


import { conModo, enlacesGuardados, precargarArchivo, preconectar, type Enlaces } from './enlaces';
export { precargarArchivo };

export default function VistaArchivo({ fuente, nombre, tamano, compacta = false }: { fuente: string; nombre: string; tamano?: number | null; compacta?: boolean }) {
  const cat = categoria(nombre);
  // Word, Excel y PowerPoint se ven con el visor de Microsoft Office (por defecto). Word (.docx) y Excel (.xlsx)
  // tienen además una "Vista rápida" que los dibuja en el navegador, por si Office tarda.
  const ext = extension(nombre);
  const rapida = (cat === 'word' && ext === 'docx') || (cat === 'excel' && ext === 'xlsx');
  const [conOffice, setConOffice] = useState(true);
  useEffect(() => { setConOffice(true); }, [fuente]);
  const usaOffice = ['word', 'excel', 'powerpoint'].includes(cat) && (!rapida || conOffice);
  const [enlaces, setEnlaces] = useState<Enlaces | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    const g = enlacesGuardados.get(fuente);
    setEnlaces(g && g.hasta > Date.now() ? g.enlaces : null); setError('');
    if (['word', 'excel', 'powerpoint'].includes(cat)) preconectar('https://view.officeapps.live.com');
    precargarArchivo(fuente).then(e => { if (vivo) setEnlaces(e); }).catch(e => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [fuente, cat]);

  const est = estiloDe(nombre);
  const Icono = est.icono;
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Barra del archivo */}
      <div className={`flex items-center gap-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] flex-shrink-0 ${compacta ? 'px-2 py-1' : 'px-3 py-2'}`}>
        {!compacta && <span className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${est.fondo}`}><Icono className={`w-4 h-4 ${est.color}`} /></span>}
        <div className={`min-w-0 flex-1 ${compacta ? 'hidden' : ''}`}>
          <p className="text-sm font-medium text-[color:var(--c-e0e0ec)] truncate" title={nombre}>{nombre}</p>
          <p className="text-[10px] text-[color:var(--c-8a8b9e)]">{est.nombre}{tamano ? ` · ${tamanoLegible(tamano)}` : ''}{usaOffice ? ' · vista de Microsoft Office' : ''}</p>
        </div>
        {compacta && <span className="flex-1 text-[11px] text-[color:var(--c-6a6b7e)] truncate pl-1">{usaOffice ? 'Vista de Microsoft Office' : est.nombre}{tamano ? ` · ${tamanoLegible(tamano)}` : ''}</span>}
        {rapida && enlaces && (
          <button type="button" onClick={() => setConOffice(v => !v)} className="h-8 px-2.5 rounded-lg text-xs font-medium text-[color:var(--c-c7d2fe)] border border-[color:var(--c-313248)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5" title={conOffice ? 'Vista rápida: se dibuja en tu navegador, sin esperar a Microsoft' : 'Volver al visor de Microsoft Office'}>
            {conOffice ? <><Zap className="w-3.5 h-3.5" /><span className="hidden sm:inline">Vista rápida</span></> : <><ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ver con Microsoft Office</span><span className="sm:hidden">Office</span></>}
          </button>
        )}
        {enlaces && (
          <>
            <a href={enlaces.ver} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-lg text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5" title="Abrir en otra pestaña"><ExternalLink className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pestaña nueva</span></a>
            <a href={enlaces.descargar} className="h-8 px-2.5 rounded-lg text-xs font-medium text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5" title="Descargar"><Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Descargar</span></a>
          </>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-h-0 relative bg-[color:var(--c-12131d)]">
        {error ? <Aviso texto={error} />
          : !enlaces ? <Cargando />
          : cat === 'pdf' ? <MarcoConCarga key={enlaces.ver} src={enlaces.ver} titulo={nombre} texto="Abriendo PDF…" />
          : cat === 'word' && !usaOffice ? <VistaWord key={enlaces.ver} url={enlaces.ver} onFallo={() => setConOffice(true)} />
          : cat === 'excel' && !usaOffice ? <VistaExcel key={enlaces.ver} url={enlaces.ver} onFallo={() => setConOffice(true)} />
          : usaOffice ? <MarcoConCarga key={`office:${enlaces.ver}`} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(enlaces.ver)}`} titulo={nombre} texto="Abriendo documento con Microsoft Office…" />
          : cat === 'imagen' ? <VistaImagen url={enlaces.ver} nombre={nombre} />
          : cat === 'video' ? <div className="absolute inset-0 flex items-center justify-center p-4"><video src={enlaces.ver} controls className="max-w-full max-h-full rounded-lg" /></div>
          : cat === 'audio' ? <div className="absolute inset-0 flex items-center justify-center p-4"><audio src={enlaces.ver} controls className="w-full max-w-lg" /></div>
          : cat === 'codigo' || cat === 'texto' ? <VistaTexto url={conModo(fuente, 'texto')} ext={extension(nombre)} />
          : cat === 'csv' ? <VistaCsv url={conModo(fuente, 'texto')} />
          : cat === 'zip' ? <VistaZip fuente={fuente} />
          : <SinVista nombre={nombre} enlaces={enlaces} />}
      </div>
    </div>
  );
}

// Marco (PDF u Office) con aviso de carga encima hasta que termina de abrir
function MarcoConCarga({ src, titulo, texto }: { src: string; titulo: string; texto: string }) {
  const [listo, setListo] = useState(false);
  return (
    <>
      <iframe src={src} title={titulo} onLoad={() => setListo(true)} className="absolute inset-0 w-full h-full bg-white" />
      {!listo && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color:var(--c-12131d)] text-sm text-[color:var(--c-8a8b9e)]"><span className="w-7 h-7 border-2 border-[color:var(--c-818cf8)]/30 border-t-[color:var(--c-818cf8)] rounded-full animate-spin" />{texto}</div>}
    </>
  );
}

function Cargando() {
  return <div className="absolute inset-0 flex items-center justify-center gap-3 text-sm text-[color:var(--c-8a8b9e)]"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)]/30 border-t-[color:var(--c-818cf8)] rounded-full animate-spin" />Abriendo…</div>;
}
function Aviso({ texto }: { texto: string }) {
  return <div className="absolute inset-0 flex items-center justify-center p-6"><p className="flex items-center gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 max-w-md"><AlertCircle className="w-4 h-4 flex-shrink-0" />{texto}</p></div>;
}
function SinVista({ nombre, enlaces }: { nombre: string; enlaces: Enlaces }) {
  const est = estiloDe(nombre); const Icono = est.icono;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <span className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${est.fondo}`}><Icono className={`w-8 h-8 ${est.color}`} /></span>
      <div>
        <p className="text-sm font-medium text-[color:var(--c-e0e0ec)]">Este tipo de archivo (.{extension(nombre) || '?'}) no tiene vista previa</p>
        <p className="text-xs text-[color:var(--c-8a8b9e)] mt-1">Ábrelo en otra pestaña o descárgalo para verlo con su programa.</p>
      </div>
      <div className="flex gap-2">
        <a href={enlaces.ver} target="_blank" rel="noopener noreferrer" className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] text-white text-sm font-semibold flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />Abrir en otra pestaña</a>
        <a href={enlaces.descargar} className="h-9 px-4 rounded-lg border border-[color:var(--c-313248)] text-[color:var(--c-c7d2fe)] text-sm font-medium flex items-center gap-1.5"><Download className="w-4 h-4" />Descargar</a>
      </div>
    </div>
  );
}

function VistaImagen({ url, nombre }: { url: string; nombre: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className={`absolute inset-0 overflow-auto flex ${zoom ? '' : 'items-center justify-center'} p-4`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={nombre} onClick={() => setZoom(z => !z)} className={`${zoom ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'} rounded-lg shadow-2xl`} />
      <button type="button" onClick={() => setZoom(z => !z)} className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center" title={zoom ? 'Ajustar a la ventana' : 'Tamaño real'}>{zoom ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}</button>
    </div>
  );
}

// ---------- Texto y código ----------
const textosGuardados = new Map<string, { texto?: string; cortado?: boolean }>();
function useTexto(url: string | null) {
  const [estado, setEstado] = useState<{ texto?: string; cortado?: boolean; error?: string } | null>(() => (url && textosGuardados.get(url)) || null);
  useEffect(() => {
    if (!url) return;
    const g = textosGuardados.get(url);
    if (g) { setEstado(g); return; }
    let vivo = true; setEstado(null);
    fetch(url, { cache: 'no-store' }).then(async r => { const d = await r.json().catch(() => ({})); if (r.ok) textosGuardados.set(url, { texto: d.texto, cortado: d.cortado }); if (!vivo) return; setEstado(r.ok ? { texto: d.texto, cortado: d.cortado } : { error: d.error || 'No se pudo leer el archivo.' }); }).catch(() => vivo && setEstado({ error: 'No se pudo leer el archivo.' }));
    return () => { vivo = false; };
  }, [url]);
  return estado;
}

function VistaTexto({ url, ext }: { url: string; ext: string }) {
  const estado = useTexto(url);
  if (!estado) return <Cargando />;
  if (estado.error) return <Aviso texto={estado.error} />;
  return <BloqueCodigo texto={estado.texto || ''} ext={ext} cortado={estado.cortado} />;
}

const PALABRAS = new Set(('abstract and as async await break case catch class const continue def default del do elif else enum except export extends false final finally fn for from func function go if implements import in instanceof interface is lambda let match mod module mut namespace new nil none not null or package pass private protected pub public raise return self static struct super switch this throw throws true try type typeof use var void while with yield '
  + 'select from where insert into update delete create table alter drop join left right inner outer on group by order having limit values set primary key foreign references not null and or as distinct count sum avg min max index view begin end commit rollback int integer varchar text boolean date timestamp float double decimal char string bool').split(/\s+/));
const COMENTARIO_HASH = new Set(['py', 'sh', 'yml', 'yaml', 'rb', 'r', 'puml', 'uml']);

// Resaltado sencillo (sin librerías): comentarios, textos, números y palabras clave
function resaltar(texto: string, ext: string) {
  const hash = COMENTARIO_HASH.has(ext);
  const sql = ext === 'sql';
  const re = new RegExp(String.raw`(\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->` + (sql ? String.raw`|--[^\n]*` : String.raw`|\/\/[^\n]*`) + (hash ? String.raw`|#[^\n]*` : '') + String.raw`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`' + String.raw`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)`, 'g');
  const piezas: { t: string; c?: string }[] = [];
  let ultimo = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) piezas.push({ t: texto.slice(ultimo, m.index) });
    const s = m[0];
    const c = /^(\/\*|\/\/|<!--|--|#)/.test(s) ? 'text-emerald-500/80 italic'
      : /^["'`]/.test(s) ? 'text-amber-300'
      : /^\d/.test(s) ? 'text-sky-300'
      : PALABRAS.has(sql ? s.toLowerCase() : s) ? 'text-violet-300 font-semibold'
      : undefined;
    piezas.push({ t: s, c });
    ultimo = m.index + s.length;
  }
  if (ultimo < texto.length) piezas.push({ t: texto.slice(ultimo) });
  return piezas;
}

export function BloqueCodigo({ texto, ext, cortado }: { texto: string; ext: string; cortado?: boolean }) {
  const lineas = useMemo(() => texto.split('\n').length, [texto]);
  const piezas = useMemo(() => (texto.length < 250_000 ? resaltar(texto, ext) : [{ t: texto }]), [texto, ext]);
  return (
    <div className="absolute inset-0 overflow-auto">
      {cortado && <p className="sticky top-0 z-10 text-[11px] text-amber-200 bg-amber-500/15 border-b border-amber-500/25 px-3 py-1.5">Se muestra solo el comienzo (archivo grande). Descárgalo para verlo completo.</p>}
      <div className="flex min-w-max font-mono text-[12.5px] leading-[1.6]">
        <pre aria-hidden className="select-none text-right pr-3 pl-3 py-3 text-[color:var(--c-5f6074)] bg-[color:var(--c-161722)] border-r border-[color:var(--c-282a3f)] sticky left-0">{Array.from({ length: lineas }, (_, i) => i + 1).join('\n')}</pre>
        <pre className="py-3 px-4 text-[color:var(--c-d0d0da)] whitespace-pre">{piezas.map((p, i) => (p.c ? <span key={i} className={p.c}>{p.t}</span> : p.t))}</pre>
      </div>
    </div>
  );
}

// ---------- CSV como tabla ----------
function filasCsv(texto: string): string[][] {
  const sep = (texto.split('\n')[0].match(/;/g)?.length || 0) > (texto.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';
  const filas: string[][] = []; let fila: string[] = []; let campo = ''; let comillas = false;
  for (let i = 0; i < texto.length && filas.length < 500; i++) {
    const ch = texto[i];
    if (comillas) { if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') comillas = false; else campo += ch; continue; }
    if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
function VistaCsv({ url }: { url: string }) {
  const estado = useTexto(url);
  const filas = useMemo(() => (estado?.texto ? filasCsv(estado.texto) : []), [estado?.texto]);
  if (!estado) return <Cargando />;
  if (estado.error) return <Aviso texto={estado.error} />;
  const [cab, ...resto] = filas;
  return (
    <div className="absolute inset-0 overflow-auto p-3">
      <table className="text-xs border-collapse min-w-full">
        <thead className="sticky top-0"><tr>{(cab || []).map((c, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-[color:var(--c-e0e0ec)] bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] whitespace-nowrap">{c}</th>)}</tr></thead>
        <tbody>{resto.map((f, i) => <tr key={i} className="odd:bg-[color:var(--c-161722)]">{f.map((c, j) => <td key={j} className="px-3 py-1.5 text-[color:var(--c-c0c0d0)] border border-[color:var(--c-282a3f)] whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
      </table>
      {filas.length >= 500 && <p className="text-[11px] text-[color:var(--c-8a8b9e)] mt-2">Se muestran las primeras 500 filas.</p>}
    </div>
  );
}

// ---------- .zip: lista de archivos y vista de cada uno ----------
function VistaZip({ fuente }: { fuente: string }) {
  const [lista, setLista] = useState<{ ruta: string; carpeta: boolean; tamano: number | null }[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(conModo(fuente, 'zip'), { cache: 'no-store' }).then(async r => { const d = await r.json().catch(() => ({})); if (!vivo) return; if (r.ok) setLista(d.entradas || []); else setError(d.error || 'No se pudo abrir el .zip.'); }).catch(() => vivo && setError('No se pudo abrir el .zip.'));
    return () => { vivo = false; };
  }, [fuente]);
  if (error) return <Aviso texto={error} />;
  if (!lista) return <Cargando />;
  if (abierto) {
    return (
      <div className="absolute inset-0 flex flex-col">
        <button type="button" onClick={() => setAbierto(null)} className="flex items-center gap-1.5 px-3 py-2 text-xs text-[color:var(--c-c7d2fe)] border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] hover:underline"><ArrowLeft className="w-3.5 h-3.5" />Volver al .zip · <span className="font-mono text-[color:var(--c-d0d0da)] truncate">{abierto}</span></button>
        <div className="flex-1 relative"><VistaTexto url={conModo(fuente, 'zipentrada', `&entrada=${encodeURIComponent(abierto)}`)} ext={extension(abierto)} /></div>
      </div>
    );
  }
  const archivos = lista.filter(e => !e.carpeta).sort((a, b) => a.ruta.localeCompare(b.ruta));
  return (
    <div className="absolute inset-0 overflow-auto p-3">
      <p className="text-[11px] text-[color:var(--c-8a8b9e)] mb-2 px-1">{archivos.length} archivo(s) dentro del .zip · toca uno de texto o código para verlo</p>
      <ul className="rounded-xl border border-[color:var(--c-282a3f)] divide-y divide-[color:var(--c-282a3f)] overflow-hidden">
        {archivos.map(e => {
          const partes = e.ruta.split('/'); const nombre = partes.pop() || e.ruta; const carpeta = partes.join('/');
          const est = estiloDe(nombre); const Icono = est.icono;
          const legible = ['codigo', 'texto', 'csv'].includes(categoria(nombre));
          return (
            <li key={e.ruta}>
              <button type="button" disabled={!legible} onClick={() => setAbierto(e.ruta)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[color:var(--c-818cf8)]/5 disabled:hover:bg-transparent disabled:cursor-default">
                <Icono className={`w-4 h-4 flex-shrink-0 ${est.color}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-sm text-[color:var(--c-d0d0da)] truncate block">{nombre}</span>
                  {carpeta && <span className="text-[10px] text-[color:var(--c-6a6b7e)] flex items-center gap-1 truncate"><Folder className="w-3 h-3" />{carpeta}</span>}
                </span>
                {e.tamano != null && <span className="text-[10px] text-[color:var(--c-6a6b7e)]">{tamanoLegible(e.tamano)}</span>}
                {legible && <ChevronRight className="w-4 h-4 text-[color:var(--c-5f6074)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Descarga del archivo para dibujarlo en el navegador (se guarda para no bajarlo dos veces) ----------
const bajados = new Map<string, ArrayBuffer>();
async function bajar(url: string): Promise<ArrayBuffer> {
  const g = bajados.get(url);
  if (g) return g;
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo descargar.');
  const b = await r.arrayBuffer();
  if (bajados.size > 6) bajados.delete(bajados.keys().next().value as string);
  bajados.set(url, b);
  return b;
}

// ---------- Word (.docx) como hoja, dentro del programa ----------
function VistaWord({ url, onFallo }: { url: string; onFallo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ renderAsync }, datos] = await Promise.all([import('docx-preview'), bajar(url)]);
        if (!vivo || !ref.current) return;
        ref.current.innerHTML = '';
        await renderAsync(datos, ref.current, ref.current, {
          className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, experimental: true,
          renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true,
          renderComments: false, renderChanges: false, renderAltChunks: false, useBase64URL: true,
        });
        if (!vivo || !ref.current) return;
        // Seguridad: los enlaces del documento solo abren páginas web, en otra pestaña
        ref.current.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (/^(https?:|mailto:|#)/i.test(href)) { if (!href.startsWith('#')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); } }
          else a.removeAttribute('href');
        });
        ref.current.querySelectorAll('script, iframe, object, embed').forEach(n => n.remove());
        // En pantallas angostas la hoja se achica para que entre completa
        const hoja = ref.current.querySelector('section.docx') as HTMLElement | null;
        const envoltura = ref.current.querySelector('.docx-wrapper') as HTMLElement | null;
        const ancho = caja.current?.clientWidth || 0;
        if (hoja && envoltura && ancho && hoja.offsetWidth + 32 > ancho) (envoltura.style as any).zoom = String(Math.max(0.35, (ancho - 24) / (hoja.offsetWidth + 8)));
        setListo(true);
      } catch { if (vivo) onFallo(); }
    })();
    return () => { vivo = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={caja} className="absolute inset-0 overflow-auto vista-docx">
      <style>{`.vista-docx .docx-wrapper{background:transparent!important;padding:20px 8px 4px!important}.vista-docx .docx-wrapper>section.docx{box-shadow:0 4px 24px rgba(0,0,0,.35)!important;margin-bottom:20px!important;border-radius:4px}`}</style>
      <div ref={ref} />
      {!listo && <Cargando />}
    </div>
  );
}

// ---------- Excel (.xlsx) como cuadrícula con pestañas de hojas ----------
interface Celda { t: string; estilo?: React.CSSProperties; colSpan?: number; rowSpan?: number; oculta?: boolean }
interface Hoja { nombre: string; columnas: number[]; filas: Celda[][]; recortada: boolean }
const MAX_FILAS = 1000, MAX_COLUMNAS = 60;
const letraColumna = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const colorArgb = (c: any) => (c?.argb && /^[0-9A-F]{8}$/i.test(c.argb) ? `#${c.argb.slice(2)}` : undefined);

function textoCelda(cell: any): string {
  try {
    const v = cell.value;
    if (v instanceof Date) return v.toLocaleDateString('es-VE', { timeZone: 'UTC' });
    if (v && typeof v === 'object' && 'result' in v) { const r = (v as any).result; return r instanceof Date ? r.toLocaleDateString('es-VE', { timeZone: 'UTC' }) : r == null ? '' : typeof r === 'object' && r.error ? String(r.error) : String(r); }
    return cell.text ?? (v == null ? '' : String(v));
  } catch { return ''; }
}

async function leerExcel(datos: ArrayBuffer): Promise<Hoja[]> {
  const ExcelJS: any = (await import('exceljs')).default ?? (await import('exceljs'));
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(datos);
  return libro.worksheets.filter((ws: any) => ws.state !== 'hidden' && ws.state !== 'veryHidden').map((ws: any) => {
    const totalFilas = Math.min(ws.actualRowCount ? ws.rowCount : 0, MAX_FILAS);
    const totalCols = Math.min(ws.columnCount || 0, MAX_COLUMNAS);
    const filas: Celda[][] = [];
    for (let r = 1; r <= totalFilas; r++) {
      const fila = ws.getRow(r); const celdas: Celda[] = [];
      for (let c = 1; c <= totalCols; c++) {
        const cell = fila.getCell(c);
        const f = cell.font || {}; const a = cell.alignment || {};
        const fondo = cell.fill?.type === 'pattern' && cell.fill.pattern === 'solid' ? colorArgb(cell.fill.fgColor) : undefined;
        celdas.push({ t: textoCelda(cell), estilo: { fontWeight: f.bold ? 700 : undefined, fontStyle: f.italic ? 'italic' : undefined, textDecoration: f.underline ? 'underline' : undefined, color: colorArgb(f.color), background: fondo, textAlign: a.horizontal === 'center' || a.horizontal === 'right' ? a.horizontal : typeof cell.value === 'number' ? 'right' : undefined, whiteSpace: a.wrapText ? 'pre-wrap' : 'nowrap' } });
      }
      filas.push(celdas);
    }
    // Celdas combinadas
    for (const rango of (ws.model?.merges || []) as string[]) {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rango); if (!m) continue;
      const col = (l: string) => [...l].reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const [c1, r1, c2, r2] = [col(m[1]), +m[2] - 1, col(m[3]), +m[4] - 1];
      if (r1 >= filas.length || c1 >= totalCols) continue;
      const base = filas[r1][c1]; base.colSpan = Math.min(c2, totalCols - 1) - c1 + 1; base.rowSpan = Math.min(r2, filas.length - 1) - r1 + 1;
      for (let r = r1; r <= Math.min(r2, filas.length - 1); r++) for (let c = c1; c <= Math.min(c2, totalCols - 1); c++) if (r !== r1 || c !== c1) filas[r][c].oculta = true;
    }
    const columnas = Array.from({ length: totalCols }, (_, k) => Math.round(Math.min(400, Math.max(40, ((ws.getColumn(k + 1).width as number) || 9) * 7.5))));
    return { nombre: ws.name, columnas, filas, recortada: ws.rowCount > MAX_FILAS || ws.columnCount > MAX_COLUMNAS };
  });
}

function VistaExcel({ url, onFallo }: { url: string; onFallo: () => void }) {
  const [hojas, setHojas] = useState<Hoja[] | null>(null);
  const [activa, setActiva] = useState(0);
  useEffect(() => {
    let vivo = true;
    bajar(url).then(leerExcel).then(h => { if (vivo) { if (!h.length) onFallo(); else setHojas(h); } }).catch(() => vivo && onFallo());
    return () => { vivo = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!hojas) return <Cargando />;
  const h = hojas[Math.min(activa, hojas.length - 1)];
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      <div className="flex-1 overflow-auto">
        {h.filas.length === 0 ? <p className="p-6 text-sm text-slate-500">Esta hoja está vacía.</p> : (
          <table className="border-collapse text-[12px] text-slate-800" style={{ tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 44 }} />{h.columnas.map((w, k) => <col key={k} style={{ width: w }} />)}</colgroup>
            <thead className="sticky top-0 z-10"><tr><th className="bg-slate-100 border border-slate-300 sticky left-0 z-20" />{h.columnas.map((_, k) => <th key={k} className="bg-slate-100 border border-slate-300 font-medium text-slate-500 h-6">{letraColumna(k)}</th>)}</tr></thead>
            <tbody>{h.filas.map((f, r) => (
              <tr key={r}>
                <td className="bg-slate-100 border border-slate-300 text-center text-slate-500 sticky left-0">{r + 1}</td>
                {f.map((c, k) => (c.oculta ? null : <td key={k} colSpan={c.colSpan} rowSpan={c.rowSpan} style={c.estilo} className="border border-slate-200 px-1.5 h-[22px] overflow-hidden text-ellipsis">{c.t}</td>))}
              </tr>
            ))}</tbody>
          </table>
        )}
        {h.recortada && <p className="p-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-200">Se muestran las primeras {MAX_FILAS} filas y {MAX_COLUMNAS} columnas. Descarga el archivo para verlo completo.</p>}
      </div>
      {/* Pestañas de las hojas */}
      <div className="flex gap-0.5 px-2 pt-1 bg-slate-100 border-t border-slate-300 overflow-x-auto flex-shrink-0">
        {hojas.map((x, k) => <button key={k} type="button" onClick={() => setActiva(k)} className={`px-3 h-7 text-xs whitespace-nowrap rounded-t-md ${k === activa ? 'bg-white text-emerald-700 font-semibold border border-b-0 border-slate-300' : 'text-slate-600 hover:bg-slate-200'}`}>{x.nombre}</button>)}
      </div>
    </div>
  );
}
