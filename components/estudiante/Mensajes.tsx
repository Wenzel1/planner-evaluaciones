'use client';
// Mensajes del estudiante, todo en un lugar: el chat de cada sección y UNA conversación privada con cada profesor
// (cada mensaje lleva la etiqueta de la evaluación de la que se habla).
import BandejaChats, { type Conversacion } from '@/components/BandejaChats';
import ChatSeccion from '@/components/ChatSeccion';
import HiloPrivado from '@/components/HiloPrivado';
import { type Resumen, limpiar } from './comun';

export default function Mensajes({ datos, onLeidos }: { datos: Resumen; onLeidos: (token: string) => void }) {
  const conversaciones: Conversacion[] = [];
  // Chats de sección (uno por clase y materia)
  for (const g of datos.grupos) {
    conversaciones.push({
      id: `sec:${g.clave}`, tipo: 'seccion', titulo: `Sección ${g.seccion} · ${g.materia}`, subtitulo: 'Con tu profesor y tus compañeros', etiqueta: 'Grupo', detalle: `Prof. ${g.profesor} · lo ven todos en tu sección`,
      contenido: <ChatSeccion incrustado modo="estudiante" alto="contenedor" plegable={false} api={`/api/portal/${encodeURIComponent(g.token)}/chat`} params={{ materiaId: g.materiaId }} />,
    });
  }
  // Una conversación privada por profesor (por clase)
  const vistos = new Set<string>();
  for (const g of datos.grupos) {
    if (vistos.has(g.token)) continue;
    vistos.add(g.token);
    const evs = datos.evaluaciones.filter(e => e.token === g.token && e.estado !== 'CANCELADA');
    const base = `/api/portal/${encodeURIComponent(g.token)}/comentarios`;
    const nuevos = evs.reduce((t, e) => t + e.mensajesNuevos, 0);
    const total = evs.reduce((t, e) => t + e.mensajes, 0);
    const materias = [...new Set(datos.grupos.filter(x => x.token === g.token).map(x => x.materia))].join(', ');
    conversaciones.push({
      id: `priv:${g.token}`, tipo: 'privado', titulo: `Prof. ${g.profesor}`, subtitulo: nuevos ? `${nuevos} mensaje${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'}` : total ? `${total} mensaje${total === 1 ? '' : 's'}` : 'Escríbele en privado', etiqueta: materias, detalle: `${materias} · solo lo ve tu profesor`, sinLeer: nuevos,
      contenido: (
        <HiloPrivado yo="ESTUDIANTE" cargarUrl={`${base}?todas=1`} enviarUrl={() => base} cuerpo={(ev) => ({ evaluacionId: ev })}
          subidaUrl={() => `${base}/subida`} subidaExtra={(ev) => ({ evaluacionId: ev })}
          urlAdjunto={(m) => `${base}?evaluacionId=${encodeURIComponent(m.evaluacionId)}&adjunto=${encodeURIComponent(m.id)}`}
          evaluaciones={evs.map(e => ({ id: e.id, nombre: limpiar(e.nombre) }))}
          onLeidos={() => onLeidos(g.token)} vacio="¿Tienes una duda? Escríbele a tu profesor: solo él la ve." />
      ),
    });
  }
  // Primero lo que tiene mensajes nuevos
  conversaciones.sort((a, b) => (b.sinLeer || 0) - (a.sinLeer || 0));

  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--c-8a8b9e)]">El chat de tu sección y tus conversaciones privadas con cada profesor.</p>
      <BandejaChats conversaciones={conversaciones} />
    </div>
  );
}
