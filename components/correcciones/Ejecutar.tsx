'use client';
// «Ejecutar» el código entregado, con una terminal dentro de la ventana:
// Python (Pyodide), JavaScript y SQL (SQLite, con sql.js). Todo corre en el navegador, sin servidor y sin costo.
// Seguridad: el código del estudiante corre en un iframe aislado (sandbox sin allow-same-origin) y dentro de un
// worker: no ve la página, ni las cookies, ni puede llamar a la API con la sesión del profesor. «Detener» destruye el iframe.
import { useEffect, useRef, useState } from 'react';
import { Database, Keyboard, Loader2, Play, Square, Terminal, Trash2, X } from 'lucide-react';

export type LenguajeEjecutable = 'python' | 'javascript' | 'sql';
export function lenguajeEjecutable(ext: string): LenguajeEjecutable | null {
  if (ext === 'py') return 'python';
  if (ext === 'js' || ext === 'mjs') return 'javascript';
  if (ext === 'sql') return 'sql';
  return null;
}
const NOMBRE = { python: 'Python', javascript: 'JavaScript', sql: 'SQL (SQLite)' };

// Lo que corre dentro del worker (texto, porque se crea desde el iframe aislado)
const WORKER = String.raw`
let py = null, SQL = null;
const out = (t, tipo = 'out') => postMessage({ tipo, t: String(t) });
// El error de Python sin las líneas internas de Pyodide; «<exec>» es el archivo del estudiante
const limpiarTraza = (m) => {
  const l = m.replace(/^PythonError:\s*/, '').split(String.fromCharCode(10));
  const r = []; let saltar = false;
  for (const x of l) {
    if (/^\s*File "/.test(x)) saltar = !/"<exec>"/.test(x);
    else if (!/^\s/.test(x)) saltar = false;
    if (!saltar) r.push(x.replace('"<exec>"', '"archivo del estudiante"'));
  }
  return r.join(String.fromCharCode(10)).trim();
};
const texto = (x) => { if (typeof x === 'string') return x; if (x instanceof Error) return x.stack || x.message; try { return JSON.stringify(x); } catch { return String(x); } };
self.onmessage = async (e) => {
  const { lenguaje, codigo, entrada, preparar } = e.data;
  const lineas = entrada ? String(entrada).replace(/\r/g, '').split('\n') : [];
  let k = 0; let faltoEntrada = false;
  const siguiente = () => { if (k < lineas.length) return lineas[k++]; faltoEntrada = true; return null; };
  const t0 = performance.now();
  try {
    if (lenguaje === 'javascript') {
      self.console = {
        log: (...a) => out(a.map(texto).join(' ')), info: (...a) => out(a.map(texto).join(' ')), debug: (...a) => out(a.map(texto).join(' ')),
        warn: (...a) => out(a.map(texto).join(' '), 'warn'), error: (...a) => out(a.map(texto).join(' '), 'err'),
        table: (x) => out(JSON.stringify(x, null, 1)),
      };
      self.prompt = (m) => { if (m) out(m, 'in'); const v = siguiente(); if (v != null) out(v, 'in'); return v; };
      self.alert = (m) => out(texto(m));
      const r = (0, eval)(codigo);
      if (r && typeof r.then === 'function') await r;
    } else if (lenguaje === 'python') {
      if (!py) {
        out('Preparando Python (la primera vez tarda unos segundos)…', 'sis');
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
        py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
      }
      // La salida se junta por líneas; lo que queda sin salto (el texto de input("…")) va junto a lo que se «escribe»
      const salida = (tipo) => { const dec = new TextDecoder(); let resto = ''; return { write: (b) => { resto += dec.decode(b, { stream: true }); const partes = resto.split(String.fromCharCode(10)); resto = partes.pop(); for (const p of partes) out(p, tipo); return b.length; }, tomar: () => { const r = resto; resto = ''; return r; } }; };
      const so = salida('out'), se = salida('err');
      py.setStdout({ write: so.write }); py.setStderr({ write: se.write });
      py.setStdin({ stdin: () => { const pre = so.tomar(); const v = siguiente(); postMessage({ tipo: 'in', t: v == null ? '' : v, pre }); return v == null ? undefined : v; } });
      try { await py.loadPackagesFromImports(codigo); } catch {}
      const g = py.globals.get('dict')();
      try { await py.runPythonAsync(codigo, { globals: g }); }
      catch (err) { const a = so.tomar(); if (a) out(a); out(limpiarTraza(String(err.message || err)), 'err'); if (faltoEntrada) out('El programa pidió más datos con input() de los que escribiste en «Entrada».', 'warn'); postMessage({ tipo: 'fin', ms: performance.now() - t0, error: true }); return; }
      finally { g.destroy(); const a = so.tomar(), b = se.tomar(); if (a) out(a); if (b) out(b, 'err'); }
    } else if (lenguaje === 'sql') {
      if (!SQL) {
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js');
        SQL = await initSqlJs({ locateFile: (f) => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/' + f });
      }
      const db = new SQL.Database();
      // Lo propio de MySQL que SQLite no entiende y no cambia el resultado
      const adaptar = (s) => String(s || '').replace(/\bENGINE\s*=\s*\w+/gi, '').replace(/\b(DEFAULT\s+)?(CHARSET|CHARACTER\s+SET)\s*=?\s*\w+/gi, '').replace(/\bCOLLATE\s*=?\s*\w+/gi, '').replace(/\bAUTO_INCREMENT(\s*=\s*\d+)?/gi, '').replace(/\bUNSIGNED\b/gi, '');
      const correr = (sql, mostrar) => {
        let n = 0;
        for (const st of db.iterateStatements(adaptar(sql))) {
          n++;
          const consulta = st.getSQL().trim();
          const columnas = st.getColumnNames();
          const filas = [];
          while (st.step()) { if (filas.length < 500) filas.push(st.get()); }
          st.free();
          if (!mostrar) continue;
          if (columnas.length) postMessage({ tipo: 'tabla', consulta, columnas, filas });
          else out('✓ ' + consulta.split('\n')[0].slice(0, 90) + (db.getRowsModified() ? '  (' + db.getRowsModified() + ' filas)' : ''), 'sis');
        }
        return n;
      };
      if (preparar && preparar.trim()) { try { const n = correr(preparar, false); out('Base preparada (' + n + ' instrucciones).', 'sis'); } catch (err) { out('Error al preparar la base: ' + (err.message || err), 'err'); } }
      try { if (!correr(codigo, true)) out('No hay consultas para ejecutar.', 'sis'); }
      catch (err) {
        const m = String(err.message || err);
        out(m, 'err');
        if (/no such table/i.test(m)) out('La tabla no existe en esta base de prueba: créala en «Preparar la base» (CREATE TABLE … e INSERT …).', 'warn');
        postMessage({ tipo: 'fin', ms: performance.now() - t0, error: true }); return;
      }
      finally { db.close(); }
    }
    postMessage({ tipo: 'fin', ms: performance.now() - t0 });
  } catch (err) {
    out(texto(err), 'err');
    postMessage({ tipo: 'fin', ms: performance.now() - t0, error: true });
  }
};`;

// El iframe aislado: crea el worker y pasa los mensajes en ambos sentidos
const MARCO = `<!doctype html><meta charset="utf-8"><script>
const enviar = (d) => parent.postMessage(Object.assign({ __ejecutar: true }, d), '*');
const fuente = ${JSON.stringify(WORKER)};
let w = null;
try { w = new Worker(URL.createObjectURL(new Blob([fuente], { type: 'text/javascript' }))); }
catch (e1) { try { w = new Worker('data:text/javascript;charset=utf-8,' + encodeURIComponent(fuente)); } catch (e2) { enviar({ tipo: 'err', t: 'Tu navegador no permitió ejecutar el código aislado: ' + (e2 && e2.message || e2) }); enviar({ tipo: 'fin', ms: 0, error: true }); } }
if (w) {
  w.onmessage = (e) => enviar(e.data);
  w.onerror = (e) => { enviar({ tipo: 'err', t: e.message || 'Error al ejecutar' }); enviar({ tipo: 'fin', ms: 0, error: true }); };
  addEventListener('message', (e) => { if (e.source === parent) w.postMessage(e.data); });
}
enviar({ tipo: 'listo' });
<\/script>`;

type Linea = { tipo: 'out' | 'err' | 'warn' | 'sis' | 'in'; t: string; pre?: string } | { tipo: 'tabla'; consulta: string; columnas: string[]; filas: any[][] };

export default function TerminalEjecucion({ lenguaje, obtenerCodigo, etiqueta, onCerrar }: { lenguaje: LenguajeEjecutable; obtenerCodigo: () => string; etiqueta: string; onCerrar: () => void }) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [listo, setListo] = useState(false);
  const [entrada, setEntrada] = useState('');
  const [preparar, setPreparar] = useState('');
  const [verExtra, setVerExtra] = useState(false);
  const [alto, setAlto] = useState(260);
  const marco = useRef<HTMLIFrameElement | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0); // al detener, se crea un iframe nuevo
  const pendiente = useRef<any>(null);
  const tiempo = useRef<any>(null);
  const codigo = obtenerCodigo();
  const pideEntrada = lenguaje === 'python' ? /\binput\s*\(/.test(codigo) : lenguaje === 'javascript' ? /\bprompt\s*\(/.test(codigo) : false;

  useEffect(() => { try { setPreparar(localStorage.getItem('ejecutar:sql-preparar') || ''); } catch { /* */ } }, []);
  useEffect(() => { if (pideEntrada || lenguaje === 'sql') setVerExtra(true); }, [pideEntrada, lenguaje]);
  useEffect(() => { caja.current?.scrollTo({ top: caja.current.scrollHeight }); }, [lineas]);

  useEffect(() => {
    const recibir = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || !e.data?.__ejecutar) return;
      const d = e.data;
      if (d.tipo === 'listo') { setListo(true); if (pendiente.current) { marco.current?.contentWindow?.postMessage(pendiente.current, '*'); pendiente.current = null; } return; }
      if (d.tipo === 'fin') {
        clearTimeout(tiempo.current); setCorriendo(false);
        setLineas(l => [...l, { tipo: 'sis', t: `${d.error ? 'Terminó con errores' : 'Terminó'} · ${(d.ms / 1000).toFixed(2).replace('.', ',')} s` }]);
        return;
      }
      setLineas(l => (l.length > 3000 ? l : [...l, d.tipo === 'tabla' ? { tipo: 'tabla', consulta: d.consulta, columnas: d.columnas, filas: d.filas } : { tipo: d.tipo, t: d.t, pre: d.pre }]));
    };
    window.addEventListener('message', recibir); return () => window.removeEventListener('message', recibir);
  }, []);

  const ejecutar = () => {
    const msg = { lenguaje, codigo: obtenerCodigo(), entrada, preparar: lenguaje === 'sql' ? preparar : '' };
    if (lenguaje === 'sql') try { localStorage.setItem('ejecutar:sql-preparar', preparar); } catch { /* */ }
    setLineas([{ tipo: 'sis', t: `▶ Ejecutando ${etiqueta} · ${NOMBRE[lenguaje]}` }]);
    setCorriendo(true);
    clearTimeout(tiempo.current);
    tiempo.current = setTimeout(() => detener('Se detuvo: pasó más de 1 minuto (¿un bucle infinito?).'), 60_000);
    if (listo) marco.current?.contentWindow?.postMessage(msg, '*'); else pendiente.current = msg;
  };
  const detener = (motivo = 'Detenido.') => {
    clearTimeout(tiempo.current);
    setCorriendo(false); setListo(false); pendiente.current = null;
    setLineas(l => [...l, { tipo: 'warn', t: motivo }]);
    setVersion(v => v + 1);
  };
  useEffect(() => () => clearTimeout(tiempo.current), []);

  const arrastrar = (e: React.PointerEvent) => {
    const y0 = e.clientY, a0 = alto;
    const mover = (ev: PointerEvent) => setAlto(Math.min(Math.max(140, a0 - (ev.clientY - y0)), window.innerHeight * 0.75));
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };
  const color = { out: 'text-[#d4d4d8]', err: 'text-[#ff8a80]', warn: 'text-amber-300', sis: 'text-[#7d8bb5]', in: 'text-emerald-300' } as const;
  const campo = 'w-full px-2 py-1.5 rounded-md bg-[#0b0c10] border border-[#2a2b38] text-[12px] font-mono text-[#d4d4d8] outline-none focus:border-[#3e63dd] resize-y';

  return (
    <div style={{ height: alto }} className="flex-shrink-0 flex flex-col border-t border-[color:var(--c-282a3f)] bg-[#0f1015]">
      <iframe key={version} ref={marco} sandbox="allow-scripts" srcDoc={MARCO} title="Ejecución aislada" className="hidden" />
      <div onPointerDown={arrastrar} className="h-1.5 cursor-ns-resize hover:bg-[color:var(--c-818cf8)]/30 flex-shrink-0" title="Arrastra para cambiar el alto" />
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 pb-1.5">
        <Terminal className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />
        <span className="text-[12px] font-semibold text-[color:var(--c-d0d0da)]">Terminal</span>
        <span className="text-[11px] text-[color:var(--c-6a6b7e)]">· {NOMBRE[lenguaje]} · {etiqueta}</span>
        <span className="flex-1" />
        {(lenguaje === 'sql' || lenguaje === 'python' || lenguaje === 'javascript') && (
          <button type="button" onClick={() => setVerExtra(v => !v)} className={`h-7 px-2 rounded-md text-[11px] flex items-center gap-1 ${verExtra ? 'bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-8a8b9e)] hover:bg-white/5'}`}>
            {lenguaje === 'sql' ? <Database className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}{lenguaje === 'sql' ? 'Preparar la base' : 'Entrada'}
          </button>
        )}
        <button type="button" onClick={() => setLineas([])} title="Limpiar" className="w-7 h-7 rounded-md flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" /></button>
        {corriendo
          ? <button type="button" onClick={() => detener()} className="h-7 px-2.5 rounded-md bg-red-500/15 text-red-300 text-[11px] font-semibold flex items-center gap-1"><Square className="w-3 h-3 fill-current" />Detener</button>
          : <button type="button" onClick={ejecutar} className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1"><Play className="w-3 h-3 fill-current" />Ejecutar</button>}
        <button type="button" onClick={() => { if (corriendo) detener(); onCerrar(); }} title="Cerrar la terminal" className="w-7 h-7 rounded-md flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-white/5"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 min-h-0 flex">
        {verExtra && (
          <div className="w-[300px] max-w-[45%] flex-shrink-0 px-3 pb-2 flex flex-col gap-1 border-r border-[#22232e]">
            {lenguaje === 'sql' ? (
              <>
                <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Se ejecuta antes del archivo, en una base vacía: crea aquí las tablas y datos de ejemplo.</p>
                <textarea value={preparar} onChange={(e) => setPreparar(e.target.value)} spellCheck={false} placeholder={"CREATE TABLE estudiantes (nombre TEXT, seccion TEXT, nota REAL);\nINSERT INTO estudiantes VALUES ('Ana','A',15),('Luis','A',10);"} className={`${campo} flex-1 min-h-0`} />
              </>
            ) : (
              <>
                <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Lo que escribiría el usuario: una línea por cada {lenguaje === 'python' ? 'input()' : 'prompt()'}.</p>
                <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} spellCheck={false} placeholder={'15\n10\nAna'} className={`${campo} flex-1 min-h-0`} />
              </>
            )}
          </div>
        )}
        <div ref={caja} className="flex-1 min-w-0 overflow-auto custom-scrollbar px-3 pb-2 font-mono text-[12.5px] leading-relaxed">
          {lineas.length === 0 && <p className="text-[#5d6280] text-[12px]">Pulsa «Ejecutar» para correr {etiqueta}. Corre aislado en tu navegador: no toca la app ni tu sesión.</p>}
          {lineas.map((l, k) => l.tipo === 'tabla' ? (
            <div key={k} className="my-2">
              <p className="text-[#7d8bb5] text-[11px] mb-1 whitespace-pre-wrap">{l.consulta.slice(0, 300)}</p>
              <div className="overflow-x-auto"><table className="border-collapse text-[12px]">
                <thead><tr>{l.columnas.map((c, i) => <th key={i} className="border border-[#2a2b38] bg-[#1a1b24] px-2 py-0.5 text-left text-[#c7d2fe] font-semibold">{c}</th>)}</tr></thead>
                <tbody>{l.filas.length === 0 ? <tr><td colSpan={l.columnas.length} className="border border-[#2a2b38] px-2 py-0.5 text-[#6a6b7e]">(sin filas)</td></tr> : l.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className="border border-[#2a2b38] px-2 py-0.5 text-[#d4d4d8]">{v == null ? <span className="text-[#6a6b7e]">NULL</span> : String(v)}</td>)}</tr>)}</tbody>
              </table></div>
              {l.filas.length >= 500 && <p className="text-[11px] text-[#6a6b7e]">Se muestran las primeras 500 filas.</p>}
            </div>
          ) : <pre key={k} className={`whitespace-pre-wrap break-words ${color[l.tipo]}`}>{l.pre ? <span className={color.out}>{l.pre}</span> : null}{l.t}</pre>)}
          {corriendo && <p className="text-[#7d8bb5] flex items-center gap-1.5 text-[12px]"><Loader2 className="w-3.5 h-3.5 animate-spin" />corriendo…</p>}
        </div>
      </div>
    </div>
  );
}
