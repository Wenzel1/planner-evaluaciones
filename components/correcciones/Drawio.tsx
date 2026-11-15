'use client';
// Diagramas de draw.io (casos de uso, UML, flujogramas, entidad-relación…).
// Editor: el editor gratuito de diagrams.net dentro de la ventana; la app le pasa el diagrama y recibe cada cambio.
// Si el editor no responde (sin conexión, o el navegador lo bloquea), queda la vista del diagrama y las
// observaciones escritas, que siempre funcionan. Vista: el visor de diagrams.net (solo lectura).
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, Loader2, PencilRuler } from 'lucide-react';

const EDITOR = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=dark&lang=es&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1';
export interface DatosDrawio { xml?: string | null; comentario?: string | null }

export function EditorDrawio({ xml, comentario, onCambio, onComentario }: { xml: string; comentario?: string | null; onCambio: (xml: string) => void; onComentario: (t: string) => void }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [modo, setModo] = useState<'editar' | 'ver'>('editar');
  const [listo, setListo] = useState(false);
  const [sinEditor, setSinEditor] = useState(false);
  const [actual, setActual] = useState(xml);
  const [nota, setNota] = useState(comentario || '');
  const listoRef = useRef(false);
  useEffect(() => {
    // Si en 15 s el editor no avisó que está listo, se pasa a la vista (y se explica por qué)
    const t = setTimeout(() => setSinEditor(s => { if (!listoRef.current) { setModo('ver'); return true; } return s; }), 15000);
    const recibir = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || typeof e.data !== 'string') return;
      let m: any; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === 'init') {
        marco.current?.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml, autosave: 1, title: 'Diagrama' }), '*');
        listoRef.current = true; setListo(true); setSinEditor(false);
      } else if ((m.event === 'autosave' || m.event === 'save') && typeof m.xml === 'string') { setActual(m.xml); onCambio(m.xml); }
    };
    window.addEventListener('message', recibir);
    return () => { window.removeEventListener('message', recibir); clearTimeout(t); };
  }, [xml]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)]">
          <button type="button" onClick={() => setModo('editar')} className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${modo === 'editar' ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]'}`}><PencilRuler className="w-3.5 h-3.5" />Editar el diagrama</button>
          <button type="button" onClick={() => setModo('ver')} className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${modo === 'ver' ? 'bg-[color:var(--c-818cf8)]/20 text-[color:var(--c-c7d2fe)]' : 'text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-272839)]'}`}><Eye className="w-3.5 h-3.5" />Ver</button>
          <span className="flex-1" />
          <a href={`https://app.diagrams.net/#R${encodeURIComponent(actual)}`} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-lg text-xs text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" />Abrir en diagrams.net</a>
        </div>
        {sinEditor && <p className="flex-shrink-0 px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border-b border-amber-500/25 flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />El editor de diagramas no respondió (revisa la conexión, o tu navegador lo bloquea). Puedes ver el diagrama y dejar tus observaciones a la derecha.</p>}
        <div className="relative flex-1 min-h-0">
          {/* El editor queda cargado aunque se mire la vista, para no perder lo editado */}
          <div className={modo === 'editar' ? 'absolute inset-0' : 'hidden'}>
            {!listo && !sinEditor && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)] bg-[color:var(--c-12131d)] z-10"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Abriendo el editor de diagramas…</div>}
            {sinEditor && !listo && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[color:var(--c-9a9bb0)] bg-[color:var(--c-12131d)] z-10">El editor no está disponible ahora. Usa «Ver» y las observaciones.</div>}
            <iframe ref={marco} src={EDITOR} title="Editor de diagramas" className="absolute inset-0 w-full h-full border-0 bg-[#1e1e1e]" />
          </div>
          {modo === 'ver' && <VistaDrawio key={actual.length} xml={actual} />}
        </div>
      </div>
      <aside className="w-[300px] flex-shrink-0 border-l border-[color:var(--c-282a3f)] bg-[color:var(--c-1d1e2e)] p-4 flex flex-col gap-2">
        <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Observaciones sobre el diagrama</p>
        <p className="text-[11px] text-[color:var(--c-8a8b9e)]">Lo verá el estudiante junto al diagrama corregido.</p>
        <textarea value={nota} onChange={(e) => { setNota(e.target.value.slice(0, 3000)); onComentario(e.target.value.slice(0, 3000)); }} placeholder="Ej.: Falta el actor «Profesor» y la relación «include» entre Entregar y Subir archivo." className="flex-1 min-h-[160px] w-full px-3 py-2 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/60 resize-none" />
      </aside>
    </div>
  );
}

// Vista de solo lectura (el estudiante ve el diagrama corregido)
export function VistaDrawio({ xml }: { xml: string }) {
  const src = `https://viewer.diagrams.net/?lightbox=1&nav=1&dark=1&layers=1#R${encodeURIComponent(xml)}`;
  return <iframe src={src} title="Diagrama" className="absolute inset-0 w-full h-full border-0 bg-[#1e1e1e]" />;
}
