'use client';
// Vista previa de un archivo entregado, dentro del programa (tipo Drive):
//  PDF, imágenes, video y audio directo · Word/Excel/PowerPoint con el visor de Microsoft Office ·
//  código y texto con colores y números de línea · CSV como tabla · .zip con su lista de archivos.
// Lo que no se puede mostrar se abre en otra pestaña o se descarga.
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Folder, ChevronRight, AlertCircle, ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { categoria, estiloDe, extension, tamanoLegible } from './tiposArchivo';

interface Enlaces { ver: string; descargar: string }

// fuente: dirección que entrega el archivo (ya con ?archivoId=…); se le agrega &modo=…
const conModo = (fuente: string, modo: string, extra = '') => `${fuente}${fuente.includes('?') ? '&' : '?'}modo=${modo}${extra}`;

export default function VistaArchivo({ fuente, nombre, tamano }: { fuente: string; nombre: string; tamano?: number | null }) {
  const cat = categoria(nombre);
  const [enlaces, setEnlaces] = useState<Enlaces | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setEnlaces(null); setError('');
    fetch(conModo(fuente, 'url'), { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo abrir el archivo.'); return d; })
      .then(d => { if (vivo) setEnlaces({ ver: d.ver, descargar: d.descargar }); })
      .catch(e => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [fuente]);

  const est = estiloDe(nombre);
  const Icono = est.icono;
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Barra del archivo */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] flex-shrink-0">
        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${est.fondo}`}><Icono className={`w-4 h-4 ${est.color}`} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[color:var(--c-e0e0ec)] truncate" title={nombre}>{nombre}</p>
          <p className="text-[10px] text-[color:var(--c-8a8b9e)]">{est.nombre}{tamano ? ` · ${tamanoLegible(tamano)}` : ''}{['word', 'excel', 'powerpoint'].includes(cat) ? ' · vista de Microsoft Office' : ''}</p>
        </div>
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
          : cat === 'pdf' ? <iframe key={enlaces.ver} src={enlaces.ver} title={nombre} className="absolute inset-0 w-full h-full bg-white" />
          : ['word', 'excel', 'powerpoint'].includes(cat) ? <iframe key={enlaces.ver} src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(enlaces.ver)}`} title={nombre} className="absolute inset-0 w-full h-full bg-white" />
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
function useTexto(url: string | null) {
  const [estado, setEstado] = useState<{ texto?: string; cortado?: boolean; error?: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let vivo = true; setEstado(null);
    fetch(url, { cache: 'no-store' }).then(async r => { const d = await r.json().catch(() => ({})); if (!vivo) return; setEstado(r.ok ? { texto: d.texto, cortado: d.cortado } : { error: d.error || 'No se pudo leer el archivo.' }); }).catch(() => vivo && setEstado({ error: 'No se pudo leer el archivo.' }));
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
