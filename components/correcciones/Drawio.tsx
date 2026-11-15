'use client';
// Diagramas de draw.io (casos de uso, UML, flujogramas, entidad-relación…).
// Editor: el editor gratuito de diagrams.net dentro de la ventana; la app le pasa el diagrama y recibe cada cambio.
// Vista: el visor de diagrams.net (solo lectura) para el estudiante.
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const EDITOR = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=dark&lang=es&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1';

export function EditorDrawio({ xml, onCambio }: { xml: string; onCambio: (xml: string) => void }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [listo, setListo] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSinConexion(s => s || !listo), 20000);
    const recibir = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || typeof e.data !== 'string') return;
      let m: any; try { m = JSON.parse(e.data); } catch { return; }
      if (m.event === 'init') {
        // Se carga el diagrama del estudiante; cada cambio llega solo (autosave), sin botones extra de draw.io
        marco.current?.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml, autosave: 1, title: 'Diagrama' }), '*');
        setListo(true);
      } else if ((m.event === 'autosave' || m.event === 'save') && typeof m.xml === 'string') onCambio(m.xml);
    };
    window.addEventListener('message', recibir);
    return () => { window.removeEventListener('message', recibir); clearTimeout(t); };
  }, [xml]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="absolute inset-0">
      {!listo && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-[color:var(--c-9a9bb0)] bg-[color:var(--c-12131d)] z-10"><Loader2 className="w-5 h-5 animate-spin text-[color:var(--c-818cf8)]" />Abriendo el editor de diagramas…{sinConexion && <span className="text-xs text-amber-300 max-w-sm text-center">diagrams.net está tardando en responder. Revisa tu conexión; si no abre, el diagrama igual se puede ver y descargar.</span>}</div>}
      <iframe ref={marco} src={EDITOR} title="Editor de diagramas" className="absolute inset-0 w-full h-full border-0 bg-[#1e1e1e]" />
    </div>
  );
}

// Vista de solo lectura (el estudiante ve el diagrama corregido)
export function VistaDrawio({ xml }: { xml: string }) {
  const src = `https://viewer.diagrams.net/?lightbox=1&nav=1&dark=1&layers=1#R${encodeURIComponent(xml)}`;
  return <iframe src={src} title="Diagrama" className="absolute inset-0 w-full h-full border-0 bg-[#1e1e1e]" />;
}
