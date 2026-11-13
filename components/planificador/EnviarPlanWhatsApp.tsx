'use client';

import { Eye, Search, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeccionExamen } from '@/components/planificador/tipos';
import { haceCuanto, medioEnvio, pedirConCache, porCorreo } from '@/components/planificador/utilidades';

/** ¿El estudiante puede recibir avisos por el canal activo? (correo válido, o teléfono de 7+ dígitos) */
export const puedeRecibir = (e: { email?: string | null; telefono?: string | null }) => porCorreo() ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e.email || '').trim()) : String(e.telefono || '').replace(/\D/g, '').length >= 7;

// ============================================
// ENVIAR EL PLAN DE ACCIÓN POR WHATSAPP (estudiantes de la sección)
// ============================================
// WhatsApp gratis (sin API): abre el WhatsApp del profesor con el mensaje ya escrito; él solo pulsa "Enviar".
// 0412-123.4567 → 584121234567 (mismo criterio que el servidor). '' si no parece un número válido.
export function telefonoWa(t: string | null | undefined, pais = '58'): string {
  let tel = String(t || '').replace(/\D/g, '');
  if (tel.startsWith('00')) tel = tel.slice(2);
  if (!tel.startsWith(pais)) { if (tel.startsWith('0')) tel = pais + tel.slice(1); else if (tel.length === 10) tel = pais + tel; }
  return tel.length >= 11 && tel.length <= 15 ? tel : '';
}
export const enlaceWa = (telefono: string, texto: string) => `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;

export const MENSAJE_PLAN_DEFECTO = 'Hola {nombre} 👋\nYa está listo tu plan de evaluación de *{materia}* (sección {seccion}).\n\nAquí lo ves completo, con los recursos para estudiar y tus notas:\n{enlace}';

export function EnviarPlanWhatsApp({ seccion, lista, materia, fechaExamen, onCerrar, agregarNotificacion }: {
  seccion: string; lista: SeccionExamen[]; materia: string; fechaExamen: Date | string;
  onCerrar: () => void; agregarNotificacion: (m: string) => void;
}) {
  interface EstudianteFila { id: string; nombre: string; email?: string | null; telefono: string | null; estado?: string; portalUltimaVisita?: string | null }
  interface EnvioFila { id: string; estudianteId: string | null; nombre: string; estado: string; error: string | null }
  const [estudiantes, setEstudiantes] = useState<EstudianteFila[] | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [buscar, setBuscar] = useState('');
  const [mensaje, setMensaje] = useState(MENSAJE_PLAN_DEFECTO);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [loteId, setLoteId] = useState<string | null>(null);
  const [envios, setEnvios] = useState<EnvioFila[]>([]);
  const tieneTelefono = (e: EstudianteFila) => puedeRecibir(e); // según el canal: correo o teléfono

  useEffect(() => {
    let vivo = true;
    setEstudiantes(null); setErrorCarga('');
    pedirConCache(`/api/estudiantes?grupo=${encodeURIComponent(seccion)}`)
      .then((d: any) => {
        if (!vivo) return;
        const activos: EstudianteFila[] = (Array.isArray(d) ? d : []).filter((e: any) => String(e.estado || 'ACTIVO').toUpperCase() === 'ACTIVO');
        setEstudiantes(activos);
        setMarcados(activos.filter(tieneTelefono).map(e => e.id)); // por defecto: todos los que pueden recibirlo
      })
      .catch((e: any) => { if (vivo) setErrorCarga(e.message); });
    return () => { vivo = false; };
  }, [seccion]);

  // Seguimiento del envío: n8n manda de a uno, así que se consulta el avance cada 2,5 s
  useEffect(() => {
    if (!loteId) return;
    let vivo = true; let vueltas = 0;
    const consultar = async () => {
      vueltas++;
      const r = await fetch(`/api/whatsapp/envios?lote=${encodeURIComponent(loteId)}`).catch(() => null);
      const d = r && r.ok ? await r.json().catch(() => null) : null;
      if (!vivo) return;
      const items: EnvioFila[] = d?.items || [];
      if (items.length) setEnvios(items);
      const pendientes = items.filter(i => i.estado === 'PENDIENTE').length;
      if ((items.length && pendientes === 0) || vueltas > 300) {
        clearInterval(t);
        const ok = items.filter(i => i.estado === 'ENVIADO').length;
        if (items.length) agregarNotificacion(`📤 Plan de la sección ${seccion}: ${ok} de ${items.length} enviado(s) por ${medioEnvio()}.`);
      }
    };
    const t = setInterval(consultar, 2500);
    consultar();
    return () => { vivo = false; clearInterval(t); };
  }, [loteId]);

  const abrirWhatsApp = async (e: EstudianteFila) => {
    const ventana = window.open('', '_blank'); // se abre ya (si se abre después de esperar, el navegador la bloquea)
    try {
      const r = await fetch(`/api/estudiantes/${encodeURIComponent(e.id)}/enlace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || 'No se pudo obtener el enlace del estudiante.');
      const plantilla = mensaje.includes('{enlace}') ? mensaje : `${mensaje}\n\n{enlace}`;
      const texto = plantilla.replace(/\{nombre\}/g, e.nombre.trim().split(/\s+/)[0] || '').replace(/\{materia\}/g, materia).replace(/\{seccion\}/g, seccion).replace(/\{enlace\}/g, d.url);
      const url = enlaceWa(telefonoWa(e.telefono), texto);
      if (ventana) ventana.location.href = url; else window.open(url, '_blank');
    } catch (err: any) { ventana?.close(); setError(err.message); }
  };
  const visibles = (estudiantes || []).filter(e => !buscar.trim() || e.nombre.toLowerCase().includes(buscar.trim().toLowerCase()));
  const elegibles = (estudiantes || []).filter(tieneTelefono);
  const todosMarcados = elegibles.length > 0 && elegibles.every(e => marcados.includes(e.id));
  const sinTelefono = (estudiantes || []).length - elegibles.length;
  const alternar = (id: string) => setMarcados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const enviar = async () => {
    if (marcados.length === 0 || enviando) return;
    setEnviando(true); setError('');
    try {
      const r = await fetch('/api/whatsapp/enviar-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seccion, estudianteIds: marcados, mensaje, materia,
          plan: {
            materia, fechaExamen: new Date(fechaExamen).toISOString(),
            secciones: lista.map(s => ({
              nombre: s.nombre, tipoActividad: s.tipoActividad, peso: s.peso, fecha: s.fecha ? new Date(s.fecha).toISOString() : null,
              descripcion: s.descripcion, enfoque: s.enfoque, tiempoEstimadoMinutos: s.tiempoEstimadoMinutos,
              cantidadGrupos: s.cantidadGrupos, personasPorGrupo: s.personasPorGrupo, rubrica: s.rubrica ?? null,
            })),
          },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar el plan.');
      setLoteId(d.loteId);
      agregarNotificacion(`📤 Enviando el plan a ${d.total} estudiante(s) de la sección ${seccion}...`);
    } catch (e: any) {
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor.' : e.message);
    } finally {
      setEnviando(false);
    }
  };

  const enviados = envios.filter(e => e.estado === 'ENVIADO').length;
  const fallidos = envios.filter(e => e.estado === 'FALLIDO').length;
  const pendientes = envios.filter(e => e.estado === 'PENDIENTE').length;

  return (
    <div className="w-full rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1c1d2a)] text-[color:var(--c-d0d0da)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[color:var(--c-313248)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0"><Send className="w-5 h-5 text-emerald-300" /></div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--c-blanco)]">Enviar plan por {medioEnvio()} · Sección {seccion}</h3>
          <p className="text-xs text-[color:var(--c-8a8b9e)]">Cada estudiante activo del grupo {seccion} recibe el enlace a su página personal</p>
        </div>
        <button onClick={onCerrar} className="ml-auto p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)] hover:bg-[color:var(--c-272839)] rounded-lg" aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>

      {loteId ? (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3"><p className="text-xl font-bold text-emerald-300">{enviados}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)]">Enviados</p></div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3"><p className="text-xl font-bold text-amber-300">{pendientes}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)]">En cola</p></div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3"><p className="text-xl font-bold text-red-300">{fallidos}</p><p className="text-[11px] text-[color:var(--c-8a8b9e)]">Fallidos</p></div>
          </div>
          {pendientes > 0 && <p className="text-xs text-[color:var(--c-8a8b9e)]">{porCorreo() ? 'Se están enviando los correos. Puedes cerrar esta ventana: el envío continúa.' : 'Se envían de a uno, con unos segundos entre cada mensaje para que WhatsApp no lo tome como spam. Puedes cerrar esta ventana: el envío continúa.'}</p>}
          <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-[color:var(--c-282a3f)] border border-[color:var(--c-282a3f)] rounded-xl">
            {envios.map(e => (
              <div key={e.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <span className="w-5 text-center">{e.estado === 'ENVIADO' ? '✅' : e.estado === 'FALLIDO' ? '❌' : '⏳'}</span>
                <span className="flex-1 truncate">{e.nombre}</span>
                {e.error && <span className="text-[11px] text-red-300 truncate max-w-[50%]" title={e.error}>{e.error}</span>}
              </div>
            ))}
            {envios.length === 0 && <div className="px-3 py-6 text-center text-xs text-[color:var(--c-8a8b9e)]">Preparando el envío...</div>}
          </div>
          <div className="flex justify-end"><button onClick={onCerrar} className="px-4 py-2 text-sm rounded-xl bg-[color:var(--c-272839)] hover:bg-[color:var(--c-2e2f42)] text-[color:var(--c-d0d0da)]">Cerrar</button></div>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {errorCarga && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{errorCarga}</p>}
          {!estudiantes && !errorCarga && <div className="py-8 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando estudiantes de la sección {seccion}...</div>}
          {estudiantes && estudiantes.length === 0 && (
            <div className="py-8 text-center text-sm text-[color:var(--c-8a8b9e)]">No hay estudiantes activos en el grupo {seccion}. Agrégalos en la pestaña Estudiantes.</div>
          )}
          {estudiantes && estudiantes.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={todosMarcados} onChange={() => setMarcados(todosMarcados ? [] : elegibles.map(e => e.id))} className="w-4 h-4 accent-[color:var(--c-818cf8)]" />
                  Todos ({elegibles.length})
                </label>
                {elegibles.some(e => !e.portalUltimaVisita) && elegibles.some(e => e.portalUltimaVisita) && (
                  <button type="button" onClick={() => setMarcados(elegibles.filter(e => !e.portalUltimaVisita).map(e => e.id))} className="text-xs text-[color:var(--c-a5b4fc)] hover:text-[color:var(--c-blanco)] underline" title="Para reenviarles el enlace solo a quienes no lo han visto">
                    Solo los que no la han abierto ({elegibles.filter(e => !e.portalUltimaVisita).length})
                  </button>
                )}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-[color:var(--c-6a6b7e)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar estudiante..." className="w-full bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/50" />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-[color:var(--c-282a3f)] border border-[color:var(--c-282a3f)] rounded-xl">
                {visibles.map(e => {
                  const ok = tieneTelefono(e);
                  return (
                    <label key={e.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${ok ? 'cursor-pointer hover:bg-[color:var(--c-232438)]' : 'opacity-50 cursor-not-allowed'}`}>
                      <input type="checkbox" disabled={!ok} checked={ok && marcados.includes(e.id)} onChange={() => alternar(e.id)} className="w-4 h-4 accent-[color:var(--c-818cf8)]" />
                      <span className="flex-1 truncate">{e.nombre}</span>
                      {e.portalUltimaVisita ? <span className="text-[10px] text-emerald-300 flex items-center gap-1 whitespace-nowrap" title="Ya abrió su página"><Eye className="w-3 h-3" />{haceCuanto(e.portalUltimaVisita, Date.now())}</span> : <span className="text-[10px] text-[color:var(--c-6a6b7e)] whitespace-nowrap">sin abrir</span>}
                      {telefonoWa(e.telefono) && (
                        <button type="button" title={`Abrir WhatsApp con el mensaje para ${e.nombre} (gratis: lo envías tú desde tu WhatsApp)`} aria-label={`WhatsApp a ${e.nombre}`}
                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); abrirWhatsApp(e); }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 whitespace-nowrap">WhatsApp</button>
                      )}
                      <span className="text-[11px] text-[color:var(--c-8a8b9e)]">{ok ? (porCorreo() ? `✉️ ${e.email}` : `📞 …${(e.telefono || '').replace(/\D/g, '').slice(-4)}`) : (porCorreo() ? 'Sin correo' : 'Sin teléfono')}</span>
                    </label>
                  );
                })}
              </div>
              {sinTelefono > 0 && <p className="text-[11px] text-amber-300">{sinTelefono} estudiante(s) sin {porCorreo() ? 'correo válido' : 'teléfono'} no recibirán el enlace (puedes copiárselo desde la pestaña Estudiantes).</p>}
              <div>
                <label className="text-[11px] font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5">Mensaje</label>
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} maxLength={900}
                  className="w-full bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2 text-sm text-[color:var(--c-e0e0ec)] outline-none focus:border-[color:var(--c-818cf8)]/50 resize-none custom-scrollbar" />
                <p className="text-[10px] text-[color:var(--c-6a6b7e)] mt-1">{'{nombre}'} se cambia por el nombre de cada estudiante y {'{enlace}'} por SU enlace personal; {'{materia}'} y {'{seccion}'} también se reemplazan. Si quitas {'{enlace}'}, se agrega al final.</p>
              </div>
              {error && <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button onClick={onCerrar} className="px-4 py-2 text-sm rounded-xl bg-[color:var(--c-272839)] hover:bg-[color:var(--c-2e2f42)] text-[color:var(--c-b0b0c4)]">Cancelar</button>
                <button onClick={enviar} disabled={marcados.length === 0 || enviando}
                  className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {enviando ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Preparando enlaces...</>) : (<><Send className="w-4 h-4" />Enviar a {marcados.length} estudiante{marcados.length === 1 ? '' : 's'}</>)}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
