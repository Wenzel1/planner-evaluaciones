'use client';

import { Activity, AlertCircle, BarChart3, CheckCircle, ClipboardList, FileText, Info, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfigChat, ConfigCliente, ConfigCompleta, Estudiante, Mensaje, UsuarioSesion } from '@/components/planificador/tipos';
import { CONFIG_CLIENTE_DEFECTO, ESTILO_ROL, limpiarTexto } from '@/components/planificador/utilidades';

export const CONFIG_COMPLETA_DEFECTO: ConfigCompleta = { ...CONFIG_CLIENTE_DEFECTO, acceso: { registroAbierto: true, diasPapelera: 30 } };

// ============================================
// DATOS DE DEMOSTRACIÓN (para presentar la app con todo lleno)
// ============================================
export function DatosDemostracion() {
  const [trabajando, setTrabajando] = useState<'' | 'crear' | 'borrar'>('');
  const [error, setError] = useState('');
  const accion = async (a: 'crear' | 'borrar') => {
    const aviso = a === 'crear'
      ? 'Se creará la materia «Ingeniería de Software (Demo)» con secciones A y B, 14 estudiantes de ejemplo, notas, rúbricas, recursos y opiniones. Mientras exista, la app abrirá esa materia. Los estudiantes de ejemplo no tienen teléfono ni correo real: nunca se les envía nada. ¿Crear?'
      : 'Se borrará la materia de demostración y sus 14 estudiantes de ejemplo. Tus materias y estudiantes reales no se tocan. ¿Borrar?';
    if (!window.confirm(aviso)) return;
    setTrabajando(a); setError('');
    try {
      const r = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: a }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo completar.');
      window.location.reload(); // recarga para abrir (o dejar de abrir) la materia de demostración
    } catch (e: any) { setError(e.message); setTrabajando(''); }
  };
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--c-818cf8)]/40 bg-[color:var(--c-818cf8)]/5 p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[color:var(--c-blanco)]">Datos de demostración</p>
          <p className="text-xs text-[color:var(--c-9a9bb0)] mt-0.5">Para presentar la app con todo lleno: una materia de ejemplo con estudiantes, notas con rúbrica, recursos, opiniones y «ya me preparé». Solo afecta tu cuenta y se borra con un clic.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => accion('crear')} disabled={!!trabajando} className="h-9 px-4 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-xs font-semibold disabled:opacity-60">{trabajando === 'crear' ? 'Creando… (unos segundos)' : 'Crear datos de demostración'}</button>
            <button type="button" onClick={() => accion('borrar')} disabled={!!trabajando} className="h-9 px-4 rounded-lg bg-[color:var(--c-232430)] border border-[color:var(--c-313248)] text-[color:var(--c-c0c0d0)] text-xs font-medium hover:text-red-300 hover:border-red-500/40 disabled:opacity-60">{trabajando === 'borrar' ? 'Borrando…' : 'Borrar datos de demostración'}</button>
          </div>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// REGISTRO DE ACTIVIDAD (solo SUPERADMIN)
// ============================================
export const ESTILO_ACCION: Record<string, string> = {
  CREAR: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  EDITAR: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  ELIMINAR: 'bg-red-500/10 text-red-300 border-red-500/30',
  RECHAZAR: 'bg-red-500/10 text-red-300 border-red-500/30',
  APROBAR: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  REGISTRO: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  LOGIN: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  LOGIN_FALLIDO: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  LOGOUT: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  OBSERVAR: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  RESTAURAR: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  RECUPERAR: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  RESTABLECER: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  VERIFICAR: 'bg-green-500/10 text-green-300 border-green-500/30',
  ENVIAR: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};

export function ActividadPanel() {
  interface RegistroActividad { id: string; usuarioNombre: string; usuarioRol: string | null; accion: string; entidad: string; detalle: string | null; createdAt: string }
  const [items, setItems] = useState<RegistroActividad[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [accion, setAccion] = useState('');
  const [buscar, setBuscar] = useState('');
  const [buscarAplicado, setBuscarAplicado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async (p: number) => {
    setCargando(true); setError('');
    try {
      const params = new URLSearchParams({ pagina: String(p) });
      if (accion) params.set('accion', accion);
      if (buscarAplicado) params.set('buscar', buscarAplicado);
      const r = await fetch(`/api/actividad?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la actividad.');
      setItems(d.items); setTotal(d.total); setTotalPaginas(d.totalPaginas); setPagina(d.pagina);
    } catch (e: any) { setError(e.message || 'No se pudo cargar la actividad.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(1); }, [accion, buscarAplicado]);

  const acciones = ['LOGIN', 'LOGIN_FALLIDO', 'LOGOUT', 'REGISTRO', 'APROBAR', 'RECHAZAR', 'CREAR', 'EDITAR', 'ELIMINAR', 'OBSERVAR', 'RESTAURAR', 'RECUPERAR', 'RESTABLECER', 'VERIFICAR', 'ENVIAR'];
  const inputCls = 'bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)] transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)] flex items-center gap-2"><Activity className="w-5 h-5 text-[color:var(--c-818cf8)]" />Registro de actividad</h2>
          <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">Quién hizo qué y cuándo. Solo lectura. {total} registro(s).</p>
        </div>
        <button onClick={() => cargar(pagina)} disabled={cargando} className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl hover:border-[color:var(--c-818cf8)]/40 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />Actualizar
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={accion} onChange={(e) => setAccion(e.target.value)} className={inputCls}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-[color:var(--c-6a6b7e)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setBuscarAplicado(buscar.trim()); }} placeholder="Buscar por persona o detalle y presiona Enter..." className={`${inputCls} w-full pl-9`} />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
        {cargando && items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">No hay registros{accion || buscarAplicado ? ' con esos filtros' : ' todavía'}.</div>
        ) : (
          <div className="divide-y divide-[color:var(--c-313248)]">
            {items.map(it => (
              <div key={it.id} className="p-4 flex items-start gap-3 hover:bg-[color:var(--c-232438)] transition-colors">
                <span className={`mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ESTILO_ACCION[it.accion] || 'bg-slate-500/10 text-slate-300 border-slate-500/30'}`}>{it.accion.replace('_', ' ')}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[color:var(--c-d0d0da)]">{it.usuarioNombre}</span>
                    {it.usuarioRol && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESTILO_ROL[it.usuarioRol] || ''}`}>{it.usuarioRol}</span>}
                    <span className="text-[11px] text-[color:var(--c-6a6b7e)]">· {it.entidad}</span>
                  </div>
                  {it.detalle && <p className="text-xs text-[color:var(--c-9a9bb0)] mt-0.5 break-words">{it.detalle}</p>}
                </div>
                <span className="text-[11px] text-[color:var(--c-8a8b9e)] whitespace-nowrap">{new Date(it.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => cargar(pagina - 1)} disabled={pagina <= 1 || cargando} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl disabled:opacity-40">Anterior</button>
          <span className="text-xs text-[color:var(--c-8a8b9e)]">Página {pagina} de {totalPaginas}</span>
          <button onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas || cargando} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}

// ============================================
// PAPELERA (lo eliminado se guarda 30 días y se puede restaurar)
// ============================================
export function PapeleraPanel({ usuario }: { usuario?: UsuarioSesion | null }) {
  interface ItemPapelera { id: string; tipo: string; nombre: string; contexto: string | null; eliminadoPorNombre: string; eliminadoPorId: string | null; createdAt: string }
  const [items, setItems] = useState<ItemPapelera[]>([]);
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/papelera');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la papelera.');
      setItems(d.items); setDias(d.diasRetencion);
    } catch (e: any) { setError(e.message || 'No se pudo cargar la papelera.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const restaurar = async (it: ItemPapelera) => {
    setProcesandoId(it.id); setError(''); setAviso('');
    try {
      const r = await fetch(`/api/papelera/${it.id}/restaurar`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo restaurar.'); return; }
      if (it.tipo === 'EVALUACION') {
        // La evaluación vuelve a la base de datos: se recarga la página para que aparezca en el planificador
        setAviso('Evaluación restaurada. Recargando...');
        setTimeout(() => window.location.reload(), 900);
      } else {
        setAviso('Estudiante restaurado. Ya aparece en la pestaña Estudiantes.');
        await cargar();
      }
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally { setProcesandoId(null); }
  };

  const eliminarDefinitivo = async (it: ItemPapelera) => {
    if (confirmandoId !== it.id) { setConfirmandoId(it.id); setTimeout(() => setConfirmandoId(prev => (prev === it.id ? null : prev)), 3000); return; }
    setConfirmandoId(null);
    const r = await fetch(`/api/papelera/${it.id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || 'No se pudo eliminar.'); return; }
    await cargar();
  };

  const diasRestantes = (creado: string) => Math.max(0, Math.ceil((new Date(creado).getTime() + dias * 86400000 - Date.now()) / 86400000));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)] flex items-center gap-2"><Trash2 className="w-5 h-5 text-[color:var(--c-818cf8)]" />Papelera</h2>
        <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">Lo que eliminas se guarda {dias} días y luego se borra definitivamente. Aquí puedes restaurarlo.</p>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {aviso && <p className="text-emerald-400 text-sm flex items-start gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{aviso}</span></p>}

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-[color:var(--c-8a8b9e)]"><Trash2 className="w-8 h-8 mx-auto mb-3 text-[color:var(--c-3a3b52)]" />La papelera está vacía.</div>
        ) : (
          <div className="divide-y divide-[color:var(--c-313248)]">
            {items.map(it => {
              const porOtro = !!it.eliminadoPorId && it.eliminadoPorId !== usuario?.id;
              return (
                <div key={it.id} className="p-4 flex items-center gap-3 hover:bg-[color:var(--c-232438)] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center flex-shrink-0">{it.tipo === 'ESTUDIANTE' ? <User className="w-4 h-4 text-purple-300" /> : <FileText className="w-4 h-4 text-amber-300" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{it.tipo === 'EVALUACION' ? limpiarTexto(it.nombre) : it.nombre}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-300 border-slate-500/30">{it.tipo === 'ESTUDIANTE' ? 'ESTUDIANTE' : 'EVALUACIÓN'}</span>
                      {porOtro && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">ELIMINADA POR {it.eliminadoPorNombre.toUpperCase()}</span>}
                    </div>
                    <div className="text-xs text-[color:var(--c-8a8b9e)] truncate">{it.contexto ? `${it.contexto} · ` : ''}Eliminado el {new Date(it.createdAt).toLocaleDateString()} · se borra en {diasRestantes(it.createdAt)} día(s)</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => restaurar(it)} disabled={procesandoId === it.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-60"><RotateCcw className="w-3.5 h-3.5" />{procesandoId === it.id ? 'Restaurando...' : 'Restaurar'}</button>
                    <button onClick={() => eliminarDefinitivo(it)} className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${confirmandoId === it.id ? 'text-red-300 bg-red-500/15 border border-red-500/30 font-semibold' : 'text-[color:var(--c-6a6b7e)] hover:text-red-400 hover:bg-red-500/10'}`} title="Eliminar definitivamente">{confirmandoId === it.id ? '¿Seguro?' : <Trash2 className="w-4 h-4" />}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CONFIGURACIÓN DEL SISTEMA (solo SUPERADMIN): chat, modelo de lenguaje, límites del planificador y acceso
// ============================================
// Uso del agente (solo superadmin): respuestas por día, modelos, respaldos y valoraciones
export function PanelUsoAgente() {
  const [datos, setDatos] = useState<any>(null);
  const [dias, setDias] = useState(14);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true; setError('');
    fetch(`/api/chat/uso?dias=${dias}`).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo cargar.'); return d; })
      .then(d => { if (vivo) setDatos(d); }).catch(e => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [dias]);
  const tarjeta = 'bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl p-5';
  if (error) return <div className={tarjeta}><p className="text-xs text-red-300">Uso del agente: {error}</p></div>;
  if (!datos) return <div className={tarjeta}><p className="text-xs text-[color:var(--c-8a8b9e)]">Cargando uso del agente…</p></div>;
  const serie = Object.entries(datos.porDia as Record<string, number>);
  const max = Math.max(1, ...serie.map(([, n]) => n));
  const modelos = Object.entries(datos.porModelo as Record<string, number>).sort((a, b) => b[1] - a[1]);
  const valoradas = datos.positivas + datos.negativas;
  return (
    <div className={tarjeta}>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Uso del agente</h3>
        <div className="ml-auto flex gap-1 bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-lg p-1">
          {[7, 14, 30].map(d => <button key={d} type="button" onClick={() => setDias(d)} className={`h-7 px-2.5 rounded-md text-xs font-semibold ${dias === d ? 'bg-[color:var(--c-818cf8)] text-white' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]'}`}>{d} días</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          ['Respuestas', datos.respuestas, ''],
          ['Profesores que lo usaron', datos.usuarios, ''],
          ['Con modelo de respaldo', datos.respaldos, datos.respuestas ? `${Math.round((datos.respaldos / datos.respuestas) * 100)}%` : ''],
          ['Valoración', valoradas ? `${Math.round((datos.positivas / valoradas) * 100)}% 👍` : '—', valoradas ? `${datos.positivas} 👍 · ${datos.negativas} 👎` : 'sin votos'],
        ].map(([t, v, sub]) => (
          <div key={String(t)} className="bg-[color:var(--c-191a26)] border border-[color:var(--c-282a3f)] rounded-xl p-3">
            <p className="text-[11px] text-[color:var(--c-8a8b9e)]">{t}</p>
            <p className="text-xl font-bold text-[color:var(--c-e0e0ec)] mt-1">{v}</p>
            {sub && <p className="text-[10px] text-[color:var(--c-6a6b7e)] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[color:var(--c-8a8b9e)] mb-2">Respuestas por día</p>
      <div className="flex items-end gap-1 h-28">
        {serie.map(([dia, n]) => (
          <div key={dia} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${dia}: ${n} respuesta(s)`}>
            <span className="text-[9px] text-[color:var(--c-8a8b9e)] opacity-0 group-hover:opacity-100">{n}</span>
            <div className="w-full rounded-t bg-[color:var(--c-818cf8)]/70 group-hover:bg-[color:var(--c-818cf8)] transition-colors" style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[color:var(--c-6a6b7e)] mt-1"><span>{serie[0]?.[0]}</span><span>{serie[serie.length - 1]?.[0]}</span></div>
      {modelos.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] mb-2">Qué modelo respondió</p>
          <div className="space-y-1.5">
            {modelos.map(([m, n]) => (
              <div key={m} className="flex items-center gap-3 text-xs">
                <span className="w-44 truncate text-[color:var(--c-c0c0d0)]">{m}</span>
                <div className="flex-1 h-2 rounded-full bg-[color:var(--c-272839)] overflow-hidden"><div className="h-full bg-[color:var(--c-818cf8)]" style={{ width: `${(n / datos.respuestas) * 100}%` }} /></div>
                <span className="w-10 text-right text-[color:var(--c-8a8b9e)]">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {datos.incompletas > 0 && <p className="text-[11px] text-amber-300 mt-3">{datos.incompletas} respuesta(s) se cortaron (error o el profesor la detuvo).</p>}
    </div>
  );
}

export function ConfigSistemaPanel({ onGuardada }: { onGuardada: (c: ConfigCliente) => void }) {
  const [cfg, setCfg] = useState<ConfigCompleta | null>(null);
  const [original, setOriginal] = useState('');
  const [meta, setMeta] = useState<{ por: string | null; en: string | null }>({ por: null, en: null });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargar = async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch('/api/configuracion');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar la configuración.');
      setCfg(d.config); setOriginal(JSON.stringify(d.config)); setMeta({ por: d.actualizadoPor, en: d.actualizadoEn });
    } catch (e: any) { setError(e.message || 'No se pudo cargar la configuración.'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const sucia = !!cfg && JSON.stringify(cfg) !== original;
  const cambiarChat = (p: Partial<ConfigChat>) => cfg && setCfg({ ...cfg, chat: { ...cfg.chat, ...p } });
  const cambiarPlan = (p: Partial<ConfigCompleta['planificador']>) => cfg && setCfg({ ...cfg, planificador: { ...cfg.planificador, ...p } });
  const cambiarAcceso = (p: Partial<ConfigCompleta['acceso']>) => cfg && setCfg({ ...cfg, acceso: { ...cfg.acceso, ...p } });

  const guardar = async () => {
    if (!cfg) return;
    setGuardando(true); setError(''); setExito('');
    try {
      const r = await fetch('/api/configuracion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo guardar la configuración.'); return; }
      setCfg(d.config); setOriginal(JSON.stringify(d.config));
      setExito(d.cambios?.length ? 'Configuración guardada. Se aplica de inmediato a todos los usuarios.' : 'No había cambios que guardar.');
      onGuardada({ chat: d.config.chat, planificador: d.config.planificador });
      await cargar();
    } catch { setError('No se pudo conectar con el servidor.'); }
    finally { setGuardando(false); }
  };

  const campo = 'w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2.5 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)] transition-colors';
  const etiqueta = 'text-xs font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5';
  const ayuda = 'text-[11px] text-[color:var(--c-6a6b7e)] mt-1';
  const tarjeta = 'bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 space-y-5';

  const Interruptor = ({ activo, onChange, texto, detalle }: { activo: boolean; onChange: (v: boolean) => void; texto: string; detalle?: string }) => (
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm text-[color:var(--c-d0d0da)] font-medium">{texto}</p>{detalle && <p className={ayuda}>{detalle}</p>}</div>
      <button type="button" role="switch" aria-checked={activo} onClick={() => onChange(!activo)} className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${activo ? 'bg-[color:var(--c-818cf8)]' : 'bg-[color:var(--c-313248)]'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );

  if (cargando && !cfg) return <div className="p-10 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando configuración...</div>;
  if (!cfg) return <p className="text-red-400 text-sm">{error || 'No se pudo cargar la configuración.'}</p>;

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)] flex items-center gap-2"><Settings className="w-5 h-5 text-[color:var(--c-818cf8)]" />Configuración del sistema</h2>
        <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">Solo el superadmin ve esta pantalla. {meta.por ? `Última modificación: ${meta.por}${meta.en ? `, ${new Date(meta.en).toLocaleString()}` : ''}.` : 'Todavía no se ha modificado: se usan los valores por defecto.'}</p>
      </div>

      <PanelUsoAgente />

      {/* ---------- CHAT ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><Sparkles className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Chat y modelo de lenguaje</h3>
        <Interruptor activo={cfg.chat.activo} onChange={(v) => cambiarChat({ activo: v })} texto="Asistente activado" detalle="Si lo apagas, el chat no responde y los usuarios ven el mensaje de abajo. Los comandos de guardar y eliminar siguen funcionando." />
        {!cfg.chat.activo && (
          <div><label className={etiqueta}>Mensaje cuando está apagado</label><input value={cfg.chat.mensajeInactivo} onChange={(e) => cambiarChat({ mensajeInactivo: e.target.value })} maxLength={300} className={campo} /></div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={etiqueta}>Modelo de lenguaje</label>
            <input list="modelos-sugeridos" value={cfg.chat.modelo} onChange={(e) => cambiarChat({ modelo: e.target.value })} placeholder="google/gemini-2.5-flash (por defecto)" className={campo} />
            <datalist id="modelos-sugeridos"><option value="google/gemini-2.5-flash" /><option value="google/gemini-2.5-pro" /><option value="openai/gpt-4.1-mini" /><option value="deepseek/deepseek-chat-v3.1" /></datalist>
            <p className={ayuda}>El agente usa solo OpenRouter (OPENROUTER_API_KEY). Escribe el nombre del modelo tal como aparece en openrouter.ai, con «/». Vacío = OPENROUTER_MODELO o google/gemini-2.5-flash.</p>
          </div>
          <div>
            <label className={etiqueta}>Dirección de n8n (solo respaldo de WhatsApp)</label>
            <input value={cfg.chat.webhookUrl} onChange={(e) => cambiarChat({ webhookUrl: e.target.value })} placeholder="(la variable NEXT_PUBLIC_N8N_URL)" className={campo} />
            <p className={ayuda}>El chat ya no usa n8n. Esta dirección solo se usa para WhatsApp si no configuraste el correo (GMAIL_USER y GMAIL_APP_PASSWORD) ni UltraMsg (ULTRAMSG_INSTANCE y ULTRAMSG_TOKEN) en Vercel.</p>
          </div>
        </div>
        <div>
          <label className={etiqueta}>Creatividad (temperatura): {cfg.chat.temperatura.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={cfg.chat.temperatura} onChange={(e) => cambiarChat({ temperatura: parseFloat(e.target.value) })} className="w-full accent-[color:var(--c-818cf8)]" />
          <p className={ayuda}>Más bajo = respuestas más precisas y repetibles. Más alto = más variadas y creativas.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className={etiqueta}>Largo de respuesta</label><input type="number" min={0} max={32000} value={cfg.chat.maxTokens} onChange={(e) => cambiarChat({ maxTokens: parseInt(e.target.value) || 0 })} className={campo} /><p className={ayuda}>Tokens máx. 0 = automático.</p></div>
          <div><label className={etiqueta}>Memoria</label><input type="number" min={1} max={30} value={cfg.chat.ventanaMemoria} onChange={(e) => cambiarChat({ ventanaMemoria: parseInt(e.target.value) || 1 })} className={campo} /><p className={ayuda}>Mensajes que recuerda.</p></div>
          <div><label className={etiqueta}>Máx. caracteres</label><input type="number" min={100} max={5000} value={cfg.chat.maxCaracteresMensaje} onChange={(e) => cambiarChat({ maxCaracteresMensaje: parseInt(e.target.value) || 100 })} className={campo} /><p className={ayuda}>Por mensaje del usuario.</p></div>
          <div><label className={etiqueta}>Espera máx. (s)</label><input type="number" min={10} max={180} value={cfg.chat.timeoutSegundos} onChange={(e) => cambiarChat({ timeoutSegundos: parseInt(e.target.value) || 10 })} className={campo} /><p className={ayuda}>Antes de rendirse.</p></div>
        </div>
        <div>
          <label className={etiqueta}>Instrucciones adicionales para el agente</label>
          <textarea value={cfg.chat.instruccionesExtra} onChange={(e) => cambiarChat({ instruccionesExtra: e.target.value })} maxLength={1500} rows={4} placeholder="Ej: Responde siempre en tono formal y usa ejemplos de ingeniería de software." className={campo} />
          <p className={ayuda}>{cfg.chat.instruccionesExtra.length}/1500 · Se le entregan al agente junto con cada mensaje, sin tocar su prompt base.</p>
        </div>
        <div className="flex items-start gap-2 text-xs text-[color:var(--c-9a9bb0)] bg-[color:var(--c-161722)] border border-[color:var(--c-282a3f)] rounded-xl p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[color:var(--c-a5b4fc)]" />
          <span>Estos valores los usa el agente EvaPlanner en cada mensaje: el <strong className="text-[color:var(--c-c0c0cc)]">modelo</strong> (de OpenRouter; vacío = google/gemini-2.5-flash), la <strong className="text-[color:var(--c-c0c0cc)]">creatividad</strong>, la <strong className="text-[color:var(--c-c0c0cc)]">memoria</strong>, el largo máximo y las <strong className="text-[color:var(--c-c0c0cc)]">instrucciones extra</strong>. La dirección de n8n ya no la usa el chat.</span>
        </div>
      </div>

      {/* ---------- PLANIFICADOR ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Límites del planificador</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={etiqueta}>Máximo de grupos por evaluación</label><input type="number" min={1} max={100} value={cfg.planificador.maxGrupos} onChange={(e) => cambiarPlan({ maxGrupos: parseInt(e.target.value) || 1 })} className={campo} /></div>
          <div><label className={etiqueta}>Máximo de personas por grupo</label><input type="number" min={1} max={1000} value={cfg.planificador.maxPersonasPorGrupo} onChange={(e) => cambiarPlan({ maxPersonasPorGrupo: parseInt(e.target.value) || 1 })} className={campo} /></div>
        </div>
      </div>

      {/* ---------- ACCESO ---------- */}
      <div className={tarjeta}>
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Acceso y datos</h3>
        <Interruptor activo={cfg.acceso.registroAbierto} onChange={(v) => cambiarAcceso({ registroAbierto: v })} texto="Registro público abierto" detalle="Permite que los profesores soliciten su cuenta desde el login. Ciérralo cuando ya estén todos; las cuentas las seguirás creando desde Usuarios." />
        <div className="max-w-xs"><label className={etiqueta}>Días que se conserva la papelera</label><input type="number" min={7} max={90} value={cfg.acceso.diasPapelera} onChange={(e) => cambiarAcceso({ diasPapelera: parseInt(e.target.value) || 7 })} className={campo} /><p className={ayuda}>Entre 7 y 90 días.</p></div>
      </div>

      {error && <p className="text-red-400 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></p>}
      {exito && <p className="text-emerald-400 text-sm flex items-start gap-2"><CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{exito}</span></p>}

      <div className="sticky bottom-4 flex items-center gap-3 bg-[color:var(--c-1d1e2e)]/95 backdrop-blur border border-[color:var(--c-313248)] rounded-2xl p-3 shadow-2xl">
        <span className={`text-xs flex-1 ${sucia ? 'text-amber-300' : 'text-[color:var(--c-8a8b9e)]'}`}>{sucia ? 'Hay cambios sin guardar.' : 'Todo guardado.'}</span>
        <button onClick={() => { setCfg(JSON.parse(original)); setError(''); setExito(''); }} disabled={!sucia || guardando} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl disabled:opacity-40">Descartar</button>
        <button onClick={() => { setCfg(CONFIG_COMPLETA_DEFECTO); setExito(''); }} disabled={guardando} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl disabled:opacity-40">Valores por defecto</button>
        <button onClick={guardar} disabled={!sucia || guardando} className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[color:var(--c-818cf8)] to-[color:var(--c-6366f1)] rounded-xl disabled:opacity-40">{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </div>
  );
}
