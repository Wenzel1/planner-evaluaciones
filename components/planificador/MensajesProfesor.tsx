'use client';
// Mensajes del profesor, todo en un lugar: el chat de cada sección y UNA conversación privada por estudiante
// (cada mensaje lleva la etiqueta de la evaluación de la que se habla; es la misma conversación que se ve en el visor de entregas).
import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import BandejaChats, { type Conversacion } from '@/components/BandejaChats';
import ChatSeccion from '@/components/ChatSeccion';
import HiloPrivado from '@/components/HiloPrivado';
import Selector from '@/components/Selector';

interface Persona { id: string; nombre: string; grupo: string; cuentaId: string | null; avatarEn: string | null }
interface Hilo { estudiante: Persona; sinLeer: number; ultimo: { autor: string; texto: string; createdAt: string; evaluacionId: string; adjunto: { nombre: string; tipo: string | null } | null } }
interface Datos { hilos: Hilo[]; evaluaciones: { id: string; nombre: string; seccion: string }[]; estudiantes: Persona[] }

const hace = (d: string) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora'; if (min < 60) return `${min} min`;
  const h = Math.round(min / 60); if (h < 24) return `${h} h`;
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short' }).format(new Date(d));
};

export default function MensajesProfesor({ materiaId, secciones }: { materiaId: string | null; secciones: string[] }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [abiertos, setAbiertos] = useState<string[]>([]); // estudiantes a los que se les empezó a escribir (aún sin mensajes)
  const [abrir, setAbrir] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!materiaId) return;
    const r = await fetch(`/api/mensajes?materiaId=${encodeURIComponent(materiaId)}`, { cache: 'no-store' }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { setDatos(d); setError(''); } else setError(d.error || 'No se pudieron cargar los mensajes.');
  }, [materiaId]);
  useEffect(() => {
    setDatos(null); cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  if (!materiaId) return <p className="text-sm text-[color:var(--c-8a8b9e)]">Abre una materia para ver sus mensajes.</p>;

  const hilo = (p: Persona, h?: Hilo): Conversacion => {
    const evs = (datos?.evaluaciones || []).filter(e => e.seccion === (p.grupo || 'A').toUpperCase());
    const u = h?.ultimo;
    return {
      id: `priv:${p.id}`, tipo: 'privado', titulo: p.nombre, etiqueta: u ? hace(u.createdAt) : `Sec. ${p.grupo}`, detalle: `Sección ${p.grupo} · solo lo ven tú y el estudiante`, sinLeer: h?.sinLeer || 0,
      avatar: { id: p.cuentaId, version: p.avatarEn },
      subtitulo: u ? `${u.autor === 'PROFESOR' ? 'Tú: ' : ''}${u.texto || (u.adjunto ? (u.adjunto.tipo?.startsWith('audio/') ? '🎤 Nota de voz' : `📎 ${u.adjunto.nombre}`) : '')}` : 'Escríbele en privado',
      contenido: (
        <HiloPrivado yo="PROFESOR" cargarUrl={`/api/mensajes?materiaId=${encodeURIComponent(materiaId)}&estudianteId=${encodeURIComponent(p.id)}`}
          enviarUrl={(ev) => `/api/evaluaciones/${encodeURIComponent(ev)}/comentarios`} cuerpo={() => ({ estudianteId: p.id })}
          subidaUrl={(ev) => `/api/evaluaciones/${encodeURIComponent(ev)}/comentarios/subida`} subidaExtra={() => ({ estudianteId: p.id })}
          urlAdjunto={(m) => `/api/evaluaciones/${encodeURIComponent(m.evaluacionId)}/comentarios?estudianteId=${encodeURIComponent(p.id)}&adjunto=${encodeURIComponent(m.id)}`}
          evaluaciones={evs} evaluacionInicial={u?.evaluacionId} onLeidos={() => setDatos(d => (d ? { ...d, hilos: d.hilos.map(x => (x.estudiante.id === p.id ? { ...x, sinLeer: 0 } : x)) } : d))}
          vacio="Aún no se han escrito. Envíale un mensaje, un archivo o una nota de voz." />
      ),
    };
  };

  const conHilo = new Set((datos?.hilos || []).map(h => h.estudiante.id));
  const conversaciones: Conversacion[] = [
    ...secciones.map((s): Conversacion => ({
      id: `sec:${s}`, tipo: 'seccion', titulo: `Chat de la Sección ${s}`, subtitulo: 'Toda la sección', etiqueta: 'Grupo', detalle: 'Lo que escribes aquí lo ve toda la sección',
      contenido: <ChatSeccion incrustado modo="profesor" alto="contenedor" plegable={false} api="/api/secciones/chat" params={{ materiaId, seccion: s }} />,
    })),
    ...(datos?.estudiantes || []).filter(p => abiertos.includes(p.id) && !conHilo.has(p.id)).map(p => hilo(p)),
    ...(datos?.hilos || []).map(h => hilo(h.estudiante, h)),
  ];
  const sinHilo = (datos?.estudiantes || []).filter(p => !conHilo.has(p.id) && !abiertos.includes(p.id));

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)]">Mensajes</h2>
        <p className="text-sm text-[color:var(--c-8a8b9e)]">El chat de cada sección y tus conversaciones privadas con cada estudiante.</p>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <BandejaChats conversaciones={conversaciones} cargando={!datos && !error} abrir={abrir} alto="h-[calc(100dvh-210px)] min-h-[440px]"
        accion={nuevo ? (
          <div className="flex items-center gap-1.5">
            <Selector defaultValue="" onChange={(e) => { if (e.target.value) { setAbiertos(a => [...a, e.target.value]); setAbrir(`priv:${e.target.value}`); setNuevo(false); } }} className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-[13px] text-[color:var(--c-d0d0da)]">
              <option value="" disabled>{sinHilo.length ? '¿A qué estudiante?' : 'Ya tienes conversación con todos'}</option>
              {sinHilo.map(p => <option key={p.id} value={p.id}>{p.nombre} · Sec. {p.grupo}</option>)}
            </Selector>
            <button type="button" onClick={() => setNuevo(false)} aria-label="Cancelar" className="w-9 h-9 rounded-lg flex items-center justify-center text-[color:var(--c-8a8b9e)] hover:bg-[color:var(--c-232430)]"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setNuevo(true)} className="w-full h-9 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" />Escribir a un estudiante</button>
        )} />
    </div>
  );
}
