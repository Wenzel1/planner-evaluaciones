'use client';
// Bandeja de mensajes unificada (profesor y estudiante), como WhatsApp de escritorio:
// a la izquierda todas las conversaciones (chats de sección y privados) y a la derecha la que está abierta.
// En pantallas angostas se ve la lista y, al tocar una, la conversación con su flecha para volver.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Lock, MessageSquare, Search, Users } from 'lucide-react';
import Avatar from '@/components/Avatar';

export interface Conversacion {
  id: string;
  tipo: 'seccion' | 'privado';
  titulo: string;
  subtitulo: string;       // en la lista: último mensaje o descripción
  detalle?: string;        // en el encabezado de la conversación
  etiqueta?: string;       // texto pequeño a la derecha (materia, sección, hora…)
  sinLeer?: number;
  avatar?: { id?: string | null; version?: string | null };
  contenido: ReactNode;    // la conversación (ocupa todo el alto)
}

type Filtro = 'todos' | 'seccion' | 'privado';
const FILTROS: { id: Filtro; texto: string }[] = [{ id: 'todos', texto: 'Todos' }, { id: 'seccion', texto: 'Sección' }, { id: 'privado', texto: 'Privados' }];

export default function BandejaChats({ conversaciones, accion, cargando = false, abrir, alto = 'h-[calc(100dvh-150px)] min-h-[440px]' }: {
  conversaciones: Conversacion[]; accion?: ReactNode; cargando?: boolean; abrir?: string | null; alto?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = caja.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const dos = ancho >= 700;
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [buscar, setBuscar] = useState('');
  useEffect(() => { if (abrir) setSel(abrir); }, [abrir]);

  const q = buscar.trim().toLowerCase();
  const lista = conversaciones.filter(c => (filtro === 'todos' || c.tipo === filtro) && (!q || `${c.titulo} ${c.subtitulo} ${c.etiqueta || ''}`.toLowerCase().includes(q)));
  const actual = conversaciones.find(c => c.id === sel) || (dos ? lista[0] : undefined);
  const cuenta = (f: Filtro) => conversaciones.filter(c => f === 'todos' || c.tipo === f).reduce((t, c) => t + (c.sinLeer || 0), 0);

  const icono = (c: Conversacion, tam: number) => c.tipo === 'seccion'
    ? <span className="rounded-full bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-a5b4fc)] flex items-center justify-center flex-shrink-0" style={{ width: tam, height: tam }}><Users className="w-[45%] h-[45%]" /></span>
    : <Avatar id={c.avatar?.id} version={c.avatar?.version} nombre={c.titulo.replace(/^Prof\.\s*/, '')} tamano={tam} />;

  const columnaLista = (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-3 border-b border-[color:var(--c-282a3f)] space-y-2 flex-shrink-0">
        <div className="h-9 flex items-center gap-2 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-2a2b3d)] focus-within:border-[color:var(--c-818cf8)]/50">
          <Search className="w-3.5 h-3.5 text-[color:var(--c-6a6b7e)] flex-shrink-0" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar" className="flex-1 min-w-0 bg-transparent text-[13px] text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none" />
        </div>
        <div className="flex gap-1">
          {FILTROS.map(f => {
            const n = cuenta(f.id);
            return <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={`h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${filtro === f.id ? 'border-[color:var(--c-818cf8)]/45 bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-2a2b3d)] text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]'}`}>{f.texto}{n > 0 && <b className="min-w-[15px] h-[15px] px-1 rounded-full bg-[color:var(--c-818cf8)] text-white text-[9px] flex items-center justify-center">{n}</b>}</button>;
          })}
        </div>
        {accion}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {cargando && <li className="px-4 py-8 text-center text-xs text-[color:var(--c-8a8b9e)]">Cargando…</li>}
        {!cargando && lista.length === 0 && <li className="px-4 py-10 text-center text-sm text-[color:var(--c-8a8b9e)]">{q ? 'Nada coincide con tu búsqueda.' : 'No hay conversaciones aquí todavía.'}</li>}
        {lista.map(c => {
          const activa = c.id === actual?.id;
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setSel(c.id)} className={`w-full px-3 py-3 flex items-center gap-3 text-left border-l-2 transition-colors ${activa ? 'bg-[color:var(--c-818cf8)]/10 border-[color:var(--c-818cf8)]' : 'border-transparent hover:bg-[color:var(--c-818cf8)]/[0.04]'}`}>
                {icono(c, 40)}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><span className={`flex-1 min-w-0 text-[13px] truncate ${c.sinLeer ? 'font-semibold text-[color:var(--c-e0e0ec)]' : 'font-medium text-[color:var(--c-d0d0da)]'}`}>{c.titulo}</span>{c.etiqueta && <span className="text-[10px] text-[color:var(--c-6a6b7e)] flex-shrink-0 truncate max-w-[42%]">{c.etiqueta}</span>}</span>
                  <span className="flex items-center gap-2 mt-0.5"><span className="flex-1 min-w-0 text-[12px] text-[color:var(--c-8a8b9e)] truncate">{c.subtitulo}</span>{(c.sinLeer || 0) > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--c-818cf8)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{c.sinLeer}</span>}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const columnaChat = actual ? (
    <div className="h-full flex flex-col min-h-0">
      <div className="h-14 px-3 sm:px-4 flex items-center gap-3 border-b border-[color:var(--c-282a3f)] flex-shrink-0">
        {!dos && <button type="button" onClick={() => setSel(null)} aria-label="Volver a la lista" className="w-8 h-8 -ml-1 rounded-lg flex items-center justify-center text-[color:var(--c-b0b0c4)] hover:bg-[color:var(--c-232430)]"><ArrowLeft className="w-4 h-4" /></button>}
        {icono(actual, 36)}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--c-e0e0ec)] truncate">{actual.titulo}</p>
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] truncate">{actual.detalle || actual.etiqueta}</p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-[color:var(--c-6a6b7e)] flex-shrink-0">{actual.tipo === 'privado' ? <><Lock className="w-3 h-3" />Privado</> : <><Users className="w-3 h-3" />Toda la sección</>}</span>
      </div>
      <div key={actual.id} className="flex-1 min-h-0">{actual.contenido}</div>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-[color:var(--c-161722)]">
      <span className="w-14 h-14 rounded-2xl bg-[color:var(--c-818cf8)]/10 flex items-center justify-center"><MessageSquare className="w-7 h-7 text-[color:var(--c-a5b4fc)]" /></span>
      <p className="text-sm font-medium text-[color:var(--c-d0d0da)]">Tus mensajes</p>
      <p className="text-xs text-[color:var(--c-8a8b9e)] max-w-xs">Elige una conversación de la lista.</p>
    </div>
  );

  return (
    <div ref={caja} className={`${alto} rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden shadow-xl`}>
      {dos ? (
        <div className="h-full grid grid-cols-[310px_minmax(0,1fr)]">
          <div className="border-r border-[color:var(--c-282a3f)] min-h-0">{columnaLista}</div>
          <div className="min-h-0">{columnaChat}</div>
        </div>
      ) : sel && actual ? columnaChat : columnaLista}
    </div>
  );
}
