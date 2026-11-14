'use client';

// Avisos que el profesor recibe en la campanita y contadores de las pestañas (se consultan cada minuto):
// cuentas por aprobar (admin), observaciones de los administradores, opiniones de los estudiantes,
// alertas del día, y entregas, mensajes y solicitudes de los estudiantes con cuenta.
import { useEffect, useRef, useState } from 'react';
import { ObservacionRecibida, OpinionEstudiante, UsuarioSesion } from '@/components/planificador/tipos';
import { limpiarTexto } from '@/components/planificador/utilidades';

export function useAvisosProfesor({ usuario, vista, puedeAdministrar, esSuperadmin, agregarNotificacion }: {
  usuario?: UsuarioSesion | null; vista: string; puedeAdministrar: boolean; esSuperadmin: boolean; agregarNotificacion: (mensaje: string) => void;
}) {
  // Cantidad de cuentas esperando aprobación (para el contador rojo de la pestaña Usuarios)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const recuperacionesPrevias = useRef<number | null>(null);
  const actualizarContadores = async () => {
    try {
      const r = await fetch('/api/usuarios');
      if (!r.ok) return;
      const d = await r.json();
      const registros = (d.usuarios || []).filter((u: any) => u.pendiente).length;
      let recuperaciones = 0;
      if (esSuperadmin) {
        const rr = await fetch('/api/recuperaciones');
        if (rr.ok) recuperaciones = (await rr.json()).length;
        const previas = recuperacionesPrevias.current;
        if (recuperaciones > 0 && (previas === null || recuperaciones > previas)) agregarNotificacion(`🔑 ${recuperaciones} solicitud(es) de recuperación de contraseña esperan tu atención en Usuarios.`);
        recuperacionesPrevias.current = recuperaciones;
      }
      setSolicitudesPendientes(registros + recuperaciones);
    } catch { /* se intenta de nuevo en el siguiente ciclo */ }
  };
  useEffect(() => {
    if (!puedeAdministrar) return;
    actualizarContadores();
    const t = setInterval(actualizarContadores, 60000);
    return () => clearInterval(t);
  }, [puedeAdministrar, vista]);

  // Observaciones que dejan los administradores sobre el trabajo de esta cuenta (se consultan cada minuto)
  const [observaciones, setObservaciones] = useState<ObservacionRecibida[]>([]);
  const observacionesVistas = useRef<Set<string> | null>(null);
  const cargarObservaciones = async () => {
    try {
      const r = await fetch('/api/observaciones');
      if (!r.ok) return;
      const lista: ObservacionRecibida[] = await r.json();
      setObservaciones(lista);
      const sinLeer = lista.filter(o => !o.leida);
      if (observacionesVistas.current === null) {
        observacionesVistas.current = new Set(sinLeer.map(o => o.id));
        if (sinLeer.length > 0) agregarNotificacion(`💬 Tienes ${sinLeer.length} observación(es) sin leer en el Planificador.`);
      } else {
        sinLeer.filter(o => !observacionesVistas.current!.has(o.id)).forEach(o => {
          observacionesVistas.current!.add(o.id);
          agregarNotificacion(`💬 ${o.autorNombre} dejó una observación${o.evaluacionNombre ? ` sobre «${limpiarTexto(o.evaluacionNombre)}»` : ''}.`);
        });
      }
    } catch { /* sin conexión: se intenta de nuevo en el siguiente ciclo */ }
  };
  useEffect(() => {
    if (!usuario || usuario.rol === 'SUPERADMIN') return;
    cargarObservaciones();
    const t = setInterval(cargarObservaciones, 60000);
    return () => clearInterval(t);
  }, [usuario?.id]);
  const marcarObservacionLeida = async (id?: string) => {
    await fetch('/api/observaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { todas: true }) });
    await cargarObservaciones();
  };
  // Opiniones de los estudiantes sobre el plan (desde su página personal); se consultan cada minuto
  const [opiniones, setOpiniones] = useState<OpinionEstudiante[]>([]);
  const opinionesVistas = useRef<Set<string> | null>(null);
  const cargarOpiniones = async () => {
    try {
      const r = await fetch('/api/opiniones');
      if (!r.ok) return;
      const lista: OpinionEstudiante[] = await r.json();
      setOpiniones(lista);
      const nuevas = lista.filter(o => !o.leida);
      const clave = (o: OpinionEstudiante) => `${o.id}-${o.fecha}`;
      if (opinionesVistas.current === null) {
        opinionesVistas.current = new Set(nuevas.map(clave));
        if (nuevas.length > 0) agregarNotificacion(`🗳️ ${nuevas.length} opinión(es) nueva(s) de tus estudiantes sobre el plan.`);
      } else {
        nuevas.filter(o => !opinionesVistas.current!.has(clave(o))).forEach(o => {
          opinionesVistas.current!.add(clave(o));
          agregarNotificacion(o.deAcuerdo ? `👍 ${o.estudiante} está de acuerdo con el plan.` : `💬 ${o.estudiante} dejó una sugerencia sobre el plan.`);
        });
      }
    } catch { /* sin conexión: se intenta en el siguiente ciclo */ }
  };
  useEffect(() => {
    if (!usuario) return;
    cargarOpiniones();
    // Alertas del día: evaluaciones sin rúbrica o recursos, notas sin cargar, pesos que no suman 100%, estudiantes sin abrir su página
    (async () => {
      const clave = `alertas_${usuario.id}_${new Date().toDateString()}`;
      try { if (localStorage.getItem(clave)) return; } catch { /* sin almacenamiento */ }
      const r = await fetch('/api/recordatorios?solo=alertas').catch(() => null);
      if (!r?.ok) return;
      const d = await r.json().catch(() => ({}));
      const lista: { tipo: string; texto: string }[] = Array.isArray(d.alertas) ? d.alertas : [];
      const ICONO: Record<string, string> = { rubrica: '📋', recursos: '📚', notas: '📝', pesos: '⚖️', portal: '👀' };
      lista.slice(0, 6).forEach(a => agregarNotificacion(`${ICONO[a.tipo] || '🔔'} ${a.texto}`));
      if (lista.length > 6) agregarNotificacion(`🔔 Y ${lista.length - 6} pendiente(s) más.`);
      try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
    })();
    const t = setInterval(cargarOpiniones, 60000);
    return () => clearInterval(t);
  }, [usuario?.id]);
  // Entregas, mensajes y solicitudes nuevas de los estudiantes (cuentas de estudiante): aviso en la campanita
  const [solicitudesEstudiantes, setSolicitudesEstudiantes] = useState(0);
  const [entregasSinRevisar, setEntregasSinRevisar] = useState(0); // contador rojo de la pestaña Entregas
  useEffect(() => {
    const alCambiar = () => fetch('/api/entregas/novedades?desde=' + encodeURIComponent(new Date().toISOString())).then(r => r.ok ? r.json() : null).then(d => { if (d && typeof d.pendientes === 'number') setSolicitudesEstudiantes(d.pendientes); if (d && typeof d.sinRevisar === 'number') setEntregasSinRevisar(d.sinRevisar); }).catch(() => {});
    window.addEventListener('estudiantes-cambiaron', alCambiar);
    window.addEventListener('entregas-cambiaron', alCambiar);
    return () => { window.removeEventListener('estudiantes-cambiaron', alCambiar); window.removeEventListener('entregas-cambiaron', alCambiar); };
  }, []);
  useEffect(() => {
    if (!usuario) return;
    let desde = new Date().toISOString();
    const revisar = async () => {
      try {
        const r = await fetch(`/api/entregas/novedades?desde=${encodeURIComponent(desde)}`);
        if (!r.ok) return;
        const d = await r.json();
        desde = d.ahora || new Date().toISOString();
        (d.entregas || []).slice(0, 5).forEach((x: any) => agregarNotificacion(`📥 ${x.estudiante} entregó «${limpiarTexto(x.evaluacion)}».`));
        (d.mensajes || []).slice(0, 5).forEach((x: any) => agregarNotificacion(`💬 ${x.estudiante} te escribió sobre «${limpiarTexto(x.evaluacion)}»: ${x.texto}`));
        (d.solicitudes || []).slice(0, 5).forEach((x: any) => agregarNotificacion(`🙋 ${x.estudiante} pidió unirse a ${x.materia ? `${x.materia}, ` : ''}Sección ${x.seccion}. Acéptalo en la pestaña Estudiantes.`));
        if (typeof d.pendientes === 'number') setSolicitudesEstudiantes(d.pendientes);
        if (typeof d.sinRevisar === 'number') setEntregasSinRevisar(d.sinRevisar);
        (d.chat || []).slice(0, 5).forEach((x: any) => agregarNotificacion(`💬 ${x.estudiante} escribió en el chat de la Sección ${x.seccion}: ${x.texto}`));
        if ((d.entregas || []).length) window.dispatchEvent(new Event('entregas-cambiaron')); // la bandeja se actualiza sola
      } catch { /* sin conexión: siguiente ciclo */ }
    };
    revisar();
    const t = setInterval(revisar, 60000);
    return () => clearInterval(t);
  }, [usuario?.id]);
  const borrarOpiniones = async (ids: string[]) => {
    const r = await fetch('/api/opiniones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => null);
    if (!r?.ok) { agregarNotificacion('⚠️ No se pudieron borrar las opiniones.'); return; }
    setOpiniones(prev => prev.filter(o => !ids.includes(o.id)));
    agregarNotificacion(ids.length === 1 ? '🗑️ Opinión borrada.' : `🗑️ ${ids.length} opiniones borradas.`);
  };
  const marcarOpinionesVistas = async (id?: string) => {
    await fetch('/api/opiniones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { todas: true }) }).catch(() => {});
    await cargarOpiniones();
  };
  return { borrarOpiniones, marcarObservacionLeida, marcarOpinionesVistas, observaciones, opiniones, solicitudesEstudiantes, solicitudesPendientes, entregasSinRevisar };
}
