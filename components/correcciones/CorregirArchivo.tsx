'use client';
// «Corregir sobre el archivo»: la herramienta que corresponde al tipo de archivo (PDF, imagen, código, n8n, draw.io, Word, Excel).
// Guarda la corrección (y, cuando aplica, una copia corregida). El original del estudiante no se toca.
// Dos formas: «incrustado» (dentro del visor de entregas, al abrir el archivo) o ventana completa.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, PenLine, Save, Trash2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { confirmar } from '@/components/Confirmar';
import { type Correccion, type TipoCorreccion, NOMBRE_TIPO, extension, guardarCorreccion, nombreCorregido, subirCorregido, textoOriginal } from './comun';

const Cargando = () => <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)]"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Abriendo…</div>;
const AnotadorPdf = dynamic(() => import('./AnotadorPdf'), { ssr: false, loading: Cargando });
const CorrectorCodigo = dynamic(() => import('./CorrectorCodigo'), { ssr: false, loading: Cargando });
const EditorN8n = dynamic(() => import('./EditorN8n'), { ssr: false, loading: Cargando });
const ComentariosWord = dynamic(() => import('./ComentariosWord'), { ssr: false, loading: Cargando });
const EditorExcel = dynamic(() => import('./EditorExcel'), { ssr: false, loading: Cargando });
const EditorDrawio = dynamic(() => import('./Drawio').then(m => m.EditorDrawio), { ssr: false, loading: Cargando });

export default function CorregirArchivo({ entregaId, archivo, tipo, fuente, previa, autor, onCerrar, onGuardada, incrustado = false, onSucio }: {
  entregaId: string; archivo: { id: string; nombre: string }; tipo: TipoCorreccion; fuente: string; previa: Correccion | null; autor: string;
  onCerrar?: () => void; onGuardada: (c: Correccion | null) => void;
  incrustado?: boolean; onSucio?: (sucio: boolean) => void; // incrustado: vive dentro del visor y no se cierra al guardar
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState<string>('');
  const [cambiado, setCambiado] = useState(false);
  const [guardadaHace, setGuardadaHace] = useState(false);
  const [version, setVersion] = useState(0); // al quitar la corrección, el editor vuelve a empezar
  const [base, setBase] = useState<Correccion | null>(previa);
  const actual = useRef<{ datos: any; exportar?: () => Promise<Blob>; xml?: string }>({ datos: previa?.datos ?? null });
  const primera = useRef(true);
  const ultimo = useRef<string | null>(null);
  const ext = extension(archivo.nombre);

  useEffect(() => { onSucio?.(cambiado); }, [cambiado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onSucio?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Código, n8n y draw.io se trabajan como texto
  useEffect(() => {
    if (!['CODIGO', 'N8N', 'DRAWIO'].includes(tipo)) return;
    let vivo = true;
    textoOriginal(fuente).then(t => { if (vivo) setTexto(t); }).catch(e => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [fuente, tipo]);

  // Solo cuenta como cambio si los datos son distintos de los últimos (los editores avisan también al cargar)
  const cambio = (datos: any, exportar?: () => Promise<Blob>) => {
    actual.current = { ...actual.current, datos, exportar };
    const firma = JSON.stringify(datos ?? null);
    if (primera.current || ultimo.current === null) { primera.current = false; ultimo.current = firma; return; }
    if (firma !== ultimo.current) { ultimo.current = firma; setCambiado(true); setGuardadaHace(false); }
  };

  const cerrar = async () => {
    if (guardando) return;
    if (cambiado && !(await confirmar({ titulo: 'Salir sin guardar', mensaje: 'Tienes cambios en la corrección que no guardaste. ¿Salir de todas formas?', boton: 'Salir sin guardar' }))) return;
    onCerrar?.();
  };
  useEffect(() => {
    if (incrustado) return; // dentro del visor, el visor decide qué hacen Esc y las flechas
    // Mientras se corrige, Esc y las flechas no llegan al visor de entregas (no cambian de estudiante por detrás)
    const tecla = (e: KeyboardEvent) => {
      const escribiendo = !!(e.target as HTMLElement)?.closest('input,textarea');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopPropagation(); return; }
      if (e.key === 'Escape' && !escribiendo) { e.stopPropagation(); cerrar(); }
    };
    window.addEventListener('keydown', tecla, true); return () => window.removeEventListener('keydown', tecla, true);
  });
  // Ctrl+S guarda
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (cambiado && !guardando) guardar(); } };
    window.addEventListener('keydown', tecla); return () => window.removeEventListener('keydown', tecla);
  });

  const guardar = async () => {
    setGuardando('Guardando…'); setError('');
    try {
      let datos = actual.current.datos;
      let subido: any;
      let sinCopia = false; // la corrección ya no tiene copia (p. ej. se deshizo la edición del código)
      if (['PDF', 'IMAGEN', 'WORD', 'EXCEL'].includes(tipo) && actual.current.exportar) {
        setGuardando('Generando la copia corregida…');
        const blob = await actual.current.exportar();
        const nombre = nombreCorregido(archivo.nombre, tipo === 'IMAGEN' ? 'pdf' : ext);
        setGuardando('Subiendo…');
        subido = await subirCorregido(entregaId, new File([blob], nombre, { type: blob.type }), nombre);
      } else if (tipo === 'DRAWIO') {
        // El diagrama editado (si se editó) y las observaciones escritas
        const xml = actual.current.xml ?? (datos?.xml as string | undefined);
        const comentario = String(datos?.comentario || '').trim() || null;
        if (actual.current.xml) {
          const nombre = nombreCorregido(archivo.nombre, 'drawio');
          subido = await subirCorregido(entregaId, new File([actual.current.xml], nombre, { type: 'application/xml' }), nombre);
        }
        datos = { xml: xml && xml.length < 800_000 ? xml : null, comentario };
      } else if (tipo === 'CODIGO' || tipo === 'N8N') {
        // El código o el flujo corregido, si se editó (se guarda también como archivo para descargarlo)
        const corregido = tipo === 'CODIGO' ? datos?.corregido : datos?.flujo;
        if (corregido != null) {
          const nombre = nombreCorregido(archivo.nombre);
          subido = await subirCorregido(entregaId, new File([corregido], nombre, { type: tipo === 'N8N' ? 'application/json' : 'text/plain' }), nombre);
          if (tipo === 'N8N' && corregido.length > 800_000) datos = { ...datos, flujo: null };
        } else sinCopia = true;
      }
      setGuardando('Guardando…');
      const c = await guardarCorreccion(entregaId, { archivoId: archivo.id, tipo, datos, ...(subido ? { archivo: subido } : sinCopia ? { archivo: null } : {}) });
      setCambiado(false);
      ultimo.current = JSON.stringify(actual.current.datos ?? null);
      actual.current = { ...actual.current, xml: undefined };
      setBase(c);
      onGuardada(c);
      if (incrustado) { setGuardadaHace(true); setTimeout(() => setGuardadaHace(false), 2500); }
      else onCerrar?.();
    } catch (e: any) { setError(e.message || 'No se pudo guardar.'); } finally { setGuardando(''); }
  };
  const quitar = async () => {
    if (!(await confirmar({ titulo: 'Quitar corrección', mensaje: 'Se borra tu corrección de este archivo (las marcas y la copia corregida). El archivo del estudiante no cambia.', boton: 'Quitar' }))) return;
    setGuardando('Quitando…');
    try {
      const r = await fetch(`/api/entregas/${encodeURIComponent(entregaId)}/correcciones?archivoId=${encodeURIComponent(archivo.id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('No se pudo quitar.');
      onGuardada(null);
      if (incrustado) {
        // El editor vuelve a abrir el archivo limpio
        actual.current = { datos: null }; primera.current = true; ultimo.current = null;
        setBase(null); setCambiado(false); setVersion(v => v + 1);
      } else onCerrar?.();
    } catch (e: any) { setError(e.message); } finally { setGuardando(''); }
  };

  const necesitaTexto = ['CODIGO', 'N8N', 'DRAWIO'].includes(tipo);
  const datosBase = base?.datos;
  const cuerpo = necesitaTexto && texto == null ? (error ? <p className="absolute inset-0 flex items-center justify-center text-sm text-red-300 p-6 text-center">{error}</p> : <Cargando />)
    : tipo === 'PDF' || tipo === 'IMAGEN' ? <AnotadorPdf key={version} fuente={fuente} tipo={tipo} inicial={datosBase} onCambio={cambio} />
    : tipo === 'CODIGO' ? <CorrectorCodigo key={version} texto={texto!} ext={ext} datos={datosBase} onCambio={(d) => cambio(d)} />
    : tipo === 'N8N' ? <EditorN8n key={version} texto={texto!} datos={datosBase} onCambio={(d) => cambio(d)} />
    : tipo === 'WORD' ? <ComentariosWord key={version} fuente={fuente} datos={datosBase} autor={autor} onCambio={cambio} />
    : tipo === 'EXCEL' ? <EditorExcel key={version} fuente={fuente} datos={datosBase} onCambio={cambio} />
    : tipo === 'DRAWIO' ? <EditorDrawio key={version} xml={(datosBase?.xml as string) || texto!} comentario={datosBase?.comentario}
        onCambio={(xml) => { actual.current = { ...actual.current, xml }; setCambiado(true); }}
        onComentario={(t) => { actual.current = { ...actual.current, datos: { ...(actual.current.datos || {}), comentario: t } }; setCambiado(true); }} />
    : null;

  const botonGuardar = (
    <button type="button" onClick={guardar} disabled={!!guardando || !cambiado} title="Guardar corrección (Ctrl+S)"
      className={`${incrustado ? 'h-8 px-3 rounded-lg text-xs' : 'h-9 px-4 rounded-xl text-sm'} bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white font-semibold flex items-center gap-1.5 disabled:opacity-45 flex-shrink-0`}>
      {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span className={incrustado ? '' : 'hidden sm:inline'}>{guardando || 'Guardar corrección'}</span>
    </button>
  );
  const botonQuitar = base && (
    <button type="button" onClick={quitar} disabled={!!guardando} className="h-8 px-2.5 rounded-lg text-xs font-medium text-red-300 hover:bg-red-500/10 flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Quitar corrección</span></button>
  );

  if (incrustado) {
    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)] min-w-0">
          <PenLine className="w-4 h-4 text-[color:var(--c-a5b4fc)] flex-shrink-0" />
          <p className="min-w-0 flex-1 text-[12px] text-[color:var(--c-9a9bb0)] truncate">
            <span className="text-[color:var(--c-d0d0da)] font-medium">Corrección · {NOMBRE_TIPO[tipo]}</span>
            {cambiado ? <span className="text-amber-300"> · cambios sin guardar</span> : guardadaHace ? <span className="text-emerald-300"> · guardada</span> : base ? ' · guardada antes' : ' · el original del estudiante no se modifica'}
          </p>
          {guardadaHace && <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />}
          {error && <span className="text-xs text-red-300 max-w-[220px] truncate" title={error}>{error}</span>}
          {botonQuitar}
          {botonGuardar}
        </div>
        <div className="relative flex-1 min-h-0">{cuerpo}</div>
      </div>
    );
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-[400] bg-[color:var(--c-12131d)] flex flex-col">
      <div className="flex-shrink-0 h-14 flex items-center gap-3 px-3 sm:px-4 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-161722)]">
        <span className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><PenLine className="w-4 h-4 text-[color:var(--c-a5b4fc)]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">Corregir · {archivo.nombre}</p>
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{NOMBRE_TIPO[tipo]} · el original del estudiante no se modifica{cambiado ? ' · cambios sin guardar' : ''}</p>
        </div>
        {error && <span className="hidden md:block text-xs text-red-300 max-w-[260px] truncate" title={error}>{error}</span>}
        {botonQuitar}
        {botonGuardar}
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-e0e0ec)] hover:bg-[color:var(--c-272839)]"><X className="w-5 h-5" /></button>
      </div>
      {error && <p className="md:hidden px-4 py-2 text-xs text-red-300 border-b border-red-500/20">{error}</p>}
      <div className="relative flex-1 min-h-0">{cuerpo}</div>
    </motion.div>,
    document.body,
  );
}
