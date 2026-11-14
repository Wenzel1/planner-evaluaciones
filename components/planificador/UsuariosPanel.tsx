'use client';
import Selector from '@/components/Selector';

import { memoriaPaneles } from '@/components/planificador/utilidades';
import { AlertCircle, CheckCircle, Pencil, Phone, Plus, Search, Trash2, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { validarCedula, validarEmail, validarNombre, validarPassword, validarTelefono } from '@/lib/validacionesUsuario';
import { Tooltip } from '@/components/planificador/ui';
import { confirmar } from '@/components/Confirmar';

// ============================================
// PANEL DE USUARIOS (solo ADMIN y SUPERADMIN)
// ============================================
export function UsuariosPanel() {
  type RolU = 'SUPERADMIN' | 'ADMIN' | 'USUARIO';
  interface UsuarioFila { id: string; nombre: string; email: string; rol: RolU; activo: boolean; pendiente: boolean; telefono: string | null; cedula: string | null; debeCambiarPassword: boolean; telefonoVerificado?: boolean; }
  interface RecuperacionFila { id: string; createdAt: string; usuario: { id: string; nombre: string; email: string; telefono: string | null; cedula: string | null; rol: RolU } }
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>(() => memoriaPaneles.usuarios?.usuarios ?? []);
  const [actor, setActor] = useState<{ id: string; rol: RolU } | null>(() => memoriaPaneles.usuarios?.actor ?? null);
  const [cargando, setCargando] = useState(() => !memoriaPaneles.usuarios);
  const [modal, setModal] = useState<null | 'nuevo' | UsuarioFila>(null);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'USUARIO' as RolU, activo: true, telefono: '', cedula: '' });
  const [recuperaciones, setRecuperaciones] = useState<RecuperacionFila[]>(() => memoriaPaneles.usuarios?.recuperaciones ?? []);
  useEffect(() => { if (!cargando) memoriaPaneles.usuarios = { usuarios, actor, recuperaciones }; }, [usuarios, actor, recuperaciones, cargando]);
  const [resultadoReset, setResultadoReset] = useState<{ passwordTemporal: string; nombre: string; email: string; telefono: string | null } | null>(null);
  const [procesandoRec, setProcesandoRec] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGlobal, setErrorGlobal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const r = await fetch('/api/usuarios');
      const d = await r.json();
      if (r.ok) {
        setUsuarios(d.usuarios); setActor(d.actor);
        if (d.actor?.rol === 'SUPERADMIN') {
          const rr = await fetch('/api/recuperaciones');
          if (rr.ok) setRecuperaciones(await rr.json());
        }
      }
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const esSuper = actor?.rol === 'SUPERADMIN';
  // SUPERADMIN gestiona a todos; ADMIN solo a usuarios con rol USUARIO (y puede editarse a sí mismo)
  const puedeEditar = (u: UsuarioFila) => esSuper || u.rol === 'USUARIO' || u.id === actor?.id;
  const puedeEliminar = (u: UsuarioFila) => u.id !== actor?.id && (esSuper || u.rol === 'USUARIO');

  const abrirNuevo = () => { setForm({ nombre: '', email: '', password: '', rol: 'USUARIO', activo: true, telefono: '', cedula: '' }); setErrores({}); setErrorGlobal(''); setModal('nuevo'); };
  const abrirEditar = (u: UsuarioFila) => { setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, activo: u.activo, telefono: u.telefono || '', cedula: u.cedula || '' }); setErrores({}); setErrorGlobal(''); setModal(u); };

  const validar = (editando: boolean) => {
    const e: Record<string, string> = {};
    const n = validarNombre(form.nombre); if (n) e.nombre = n;
    const m = validarEmail(form.email); if (m) e.email = m;
    // Al crear una cuenta teléfono y cédula son obligatorios; al editar (cuentas antiguas) solo se validan si se escriben
    if (form.telefono.trim()) { const tl = validarTelefono(form.telefono); if (tl) e.telefono = tl; } // opcional
    if (form.cedula.trim()) { const cd = validarCedula(form.cedula); if (cd) e.cedula = cd; } // opcional
    if (!editando || form.password) { const p = validarPassword(form.password); if (p) e.password = p; }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    const editando = modal !== 'nuevo' && modal !== null;
    if (!validar(editando)) return;
    setGuardando(true); setErrorGlobal('');
    try {
      const r = await fetch('/api/usuarios', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando ? { id: (modal as UsuarioFila).id, ...form, password: form.password || undefined } : form),
      });
      const d = await r.json();
      if (!r.ok) { setErrorGlobal(d.error || 'No se pudo guardar.'); return; }
      setModal(null);
      await cargar();
    } finally { setGuardando(false); }
  };

  const eliminar = async (u: UsuarioFila) => {
    // Confirmación en dos pasos sin cuadros de diálogo: primer clic arma, segundo clic elimina
    if (!(await confirmar({ titulo: 'Eliminar cuenta', mensaje: `¿Eliminar la cuenta de ${u.nombre}? Esta acción no se puede deshacer.`, boton: 'Eliminar' }))) return;
    setConfirmandoId(null);
    const r = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'No se pudo eliminar.'); return; }
    await cargar();
  };

  const badgeRol = (rol: RolU) =>
    rol === 'SUPERADMIN' ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30'
    : rol === 'ADMIN' ? 'bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-a5b4fc)] border-[color:var(--c-818cf8)]/30'
    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

  const inputCls = 'w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2.5 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)] transition-colors';
  const rolesDisponibles: RolU[] = esSuper ? ['USUARIO', 'ADMIN', 'SUPERADMIN'] : ['USUARIO'];
  const editandoSelf = modal !== null && modal !== 'nuevo' && modal.id === actor?.id;
  const [buscarU, setBuscarU] = useState('');
  const [filtroRol, setFiltroRol] = useState<'todos' | RolU | 'inactivos'>('todos');
  const pendientes = usuarios.filter(u => u.pendiente);
  const normalU = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const todosAprobados = usuarios.filter(u => !u.pendiente);
  const aprobados = todosAprobados.filter(u => {
    if (filtroRol === 'inactivos' ? u.activo : filtroRol !== 'todos' && u.rol !== filtroRol) return false;
    const q = normalU(buscarU.trim());
    return !q || normalU(`${u.nombre} ${u.email} ${u.telefono || ''} ${u.cedula || ''}`).includes(q);
  });

  // Aprueba una solicitud de cuenta hecha desde el login (rechazar = eliminar, con el mismo "¿Seguro?")
  // Solicitudes de "olvidé mi contraseña": el superadmin restablece la clave y se la hace llegar por teléfono
  const restablecerRec = async (sol: RecuperacionFila) => {
    setProcesandoRec(sol.id);
    try {
      const r = await fetch(`/api/recuperaciones/${sol.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'restablecer' }) });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'No se pudo restablecer la contraseña.'); return; }
      setCopiado(false);
      setResultadoReset({ passwordTemporal: d.passwordTemporal, nombre: d.usuario.nombre, email: d.usuario.email, telefono: d.usuario.telefono });
      await cargar();
    } finally { setProcesandoRec(null); }
  };
  const descartarRec = async (sol: RecuperacionFila) => {
    setProcesandoRec(sol.id);
    try {
      const r = await fetch(`/api/recuperaciones/${sol.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'descartar' }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'No se pudo descartar.'); return; }
      await cargar();
    } finally { setProcesandoRec(null); }
  };
  const copiarClave = async () => {
    if (!resultadoReset) return;
    try { await navigator.clipboard.writeText(resultadoReset.passwordTemporal); setCopiado(true); } catch { /* la puede copiar a mano */ }
  };

  const aprobar = async (u: UsuarioFila) => {
    const r = await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, accion: 'aprobar' }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'No se pudo aprobar la cuenta.'); return; }
    await cargar();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)]">Usuarios del sistema</h2>
          <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">{esSuper ? 'Como superadmin gestionas a todos los usuarios.' : 'Como administrador gestionas a los usuarios con rol USUARIO.'}</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={abrirNuevo} className="flex items-center gap-2 px-4 py-2.5 bg-[color:var(--c-818cf8)] text-white text-sm font-semibold rounded-xl shadow-lg"><Plus className="w-4 h-4" />Nuevo usuario</motion.button>
      </div>

      {esSuper && recuperaciones.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-500/20 flex items-center gap-2 flex-wrap">
            <AlertCircle className="w-4 h-4 text-red-300" />
            <h3 className="text-sm font-semibold text-red-200">Recuperación de contraseña ({recuperaciones.length})</h3>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Verifica la identidad por teléfono antes de entregar la clave temporal.</span>
          </div>
          <div className="divide-y divide-red-500/10">
            {recuperaciones.map(sol => (
              <div key={sol.id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-red-300" /></div>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium text-[color:var(--c-d0d0da)]">{sol.usuario.nombre}</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeRol(sol.usuario.rol)}`}>{sol.usuario.rol}</span></div>
                  <div className="text-xs text-[color:var(--c-8a8b9e)]">{sol.usuario.email}{sol.usuario.cedula ? ` · CC ${sol.usuario.cedula}` : ''} · {new Date(sol.createdAt).toLocaleString()}</div>
                  {sol.usuario.telefono
                    ? <a href={`tel:${sol.usuario.telefono}`} className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 mt-0.5"><Phone className="w-3 h-3" />{sol.usuario.telefono}</a>
                    : <span className="text-xs text-amber-300">Esta cuenta no tiene teléfono registrado.</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => restablecerRec(sol)} disabled={procesandoRec === sol.id} className="px-3 py-1.5 text-xs font-semibold text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-60">{procesandoRec === sol.id ? 'Procesando...' : 'Restablecer contraseña'}</button>
                  <button onClick={() => descartarRec(sol)} disabled={procesandoRec === sol.id} className="px-3 py-1.5 text-xs text-[color:var(--c-9a9bb0)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-lg hover:bg-[color:var(--c-2c2d40)] disabled:opacity-60">Descartar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {resultadoReset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="w-full max-w-md bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Contraseña temporal para {resultadoReset.nombre}</h3>
              <div className="bg-[color:var(--c-161722)] border border-[color:var(--c-313248)] rounded-xl p-4 text-center">
                <code className="text-2xl font-mono tracking-widest text-emerald-300 select-all">{resultadoReset.passwordTemporal}</code>
              </div>
              <button onClick={copiarClave} className="w-full py-2.5 text-sm text-[color:var(--c-c7d2fe)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl hover:bg-[color:var(--c-2c2d40)]">{copiado ? '¡Copiada!' : 'Copiar contraseña'}</button>
              <div className="text-xs text-[color:var(--c-9a9bb0)] space-y-1.5">
                {resultadoReset.telefono ? <p>Entrégasela por teléfono: <a href={`tel:${resultadoReset.telefono}`} className="text-emerald-300 font-medium">{resultadoReset.telefono}</a>.</p> : <p className="text-amber-300">Esta cuenta no tiene teléfono registrado: contacta a la persona por otro medio.</p>}
                <p>Se muestra <strong className="text-[color:var(--c-c0c0cc)]">solo esta vez</strong>. Al entrar, la persona deberá elegir una contraseña nueva, y sus sesiones abiertas anteriores se cerraron.</p>
              </div>
              <button onClick={() => setResultadoReset(null)} className="w-full py-2.5 text-sm font-semibold text-white bg-[color:var(--c-818cf8)] rounded-xl">Entendido</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {pendientes.length > 0 && (
          <motion.div key="solicitudes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2 flex-wrap">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-200">Solicitudes pendientes ({pendientes.length})</h3>
                <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Se registraron desde el login y todavía no pueden entrar.</span>
              </div>
              <div className="divide-y divide-amber-500/10">
                {pendientes.map(u => (
                  <div key={u.id} className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-amber-300" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[color:var(--c-d0d0da)] truncate flex items-center gap-2">{u.nombre}{u.telefonoVerificado
                        ? <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Cuenta verificada</span>
                        : <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30" title="La persona todavía no escribió el código de verificación que le llegó">Sin verificar</span>}</div>
                      <div className="text-xs text-[color:var(--c-8a8b9e)] truncate">{u.email}{u.telefono ? ` · 📞 ${u.telefono}` : ''}{u.cedula ? ` · C.I. ${u.cedula}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => aprobar(u)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"><CheckCircle className="w-3.5 h-3.5" />Aprobar</button>
                      {puedeEliminar(u) && (
                        <button onClick={() => eliminar(u)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"><X className="w-3.5 h-3.5" />{confirmandoId === u.id ? '¿Seguro?' : 'Rechazar'}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {todosAprobados.length > 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 h-9 rounded-xl bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] focus-within:border-[color:var(--c-818cf8)]/60">
            <Search className="w-4 h-4 text-[color:var(--c-6a6b7e)]" />
            <input value={buscarU} onChange={(e) => setBuscarU(e.target.value)} placeholder="Buscar por nombre, correo, teléfono o cédula" className="flex-1 bg-transparent text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] outline-none" />
            {buscarU && <button type="button" onClick={() => setBuscarU('')} className="text-[color:var(--c-6a6b7e)] hover:text-[color:var(--c-blanco)]" aria-label="Limpiar búsqueda"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex gap-1 bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-xl p-1">
            {([['todos', 'Todos'], ['USUARIO', 'Usuarios'], ['ADMIN', 'Admins'], ...(esSuper ? [['SUPERADMIN', 'Superadmins']] : []), ['inactivos', 'Desactivados']] as [string, string][]).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setFiltroRol(v as any)} className={`h-7 px-2.5 rounded-lg text-xs font-semibold ${filtroRol === v ? 'bg-[color:var(--c-818cf8)] text-white' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-blanco)]'}`}>{t}</button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">Cargando...</div>
        ) : aprobados.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--c-8a8b9e)]">{todosAprobados.length ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados.'}</div>
        ) : (
          <div className="divide-y divide-[color:var(--c-313248)]">
            {aprobados.map(u => (
              <div key={u.id} className="p-4 flex items-center gap-3 hover:bg-[color:var(--c-232438)] transition-colors">
                <div className="w-9 h-9 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-[color:var(--c-818cf8)]" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{u.nombre}</span>
                    {u.id === actor?.id && <span className="text-[10px] text-[color:var(--c-8a8b9e)]">(tú)</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeRol(u.rol)}`}>{u.rol}</span>
                    {!u.activo && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-300 border-red-500/30">DESACTIVADO</span>}
                    {u.debeCambiarPassword && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">CLAVE TEMPORAL</span>}
                  </div>
                  <div className="text-xs text-[color:var(--c-8a8b9e)] truncate">{u.email}{u.telefono ? ` · 📞 ${u.telefono}` : ''}{u.cedula ? ` · C.I. ${u.cedula}` : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  {puedeEditar(u) && <Tooltip text="Editar"><button onClick={() => abrirEditar(u)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-272839)] rounded-lg"><Pencil className="w-4 h-4" /></button></Tooltip>}
                  {puedeEliminar(u) && (confirmandoId === u.id
                    ? <button onClick={() => eliminar(u)} className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg">¿Seguro?</button>
                    : <Tooltip text="Eliminar"><button onClick={() => eliminar(u)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></Tooltip>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setModal(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">{modal === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
                <button onClick={() => setModal(null)} className="p-1 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)]"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" className={`${inputCls} ${errores.nombre ? 'border-red-500/50' : ''}`} />
                {errores.nombre && <p className="text-red-400 text-[11px] mt-1">{errores.nombre}</p>}
              </div>
              <div>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo electrónico" className={`${inputCls} ${errores.email ? 'border-red-500/50' : ''}`} />
                {errores.email && <p className="text-red-400 text-[11px] mt-1">{errores.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Cédula" inputMode="numeric" className={`${inputCls} ${errores.cedula ? 'border-red-500/50' : ''}`} />
                  {errores.cedula && <p className="text-red-400 text-[11px] mt-1">{errores.cedula}</p>}
                </div>
                <div>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono" type="tel" className={`${inputCls} ${errores.telefono ? 'border-red-500/50' : ''}`} />
                  {errores.telefono && <p className="text-red-400 text-[11px] mt-1">{errores.telefono}</p>}
                </div>
              </div>
              <div>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={modal === 'nuevo' ? 'Contraseña (mín. 8, letras y números)' : 'Nueva contraseña (dejar vacío para no cambiar)'} className={`${inputCls} ${errores.password ? 'border-red-500/50' : ''}`} autoComplete="new-password" />
                {errores.password && <p className="text-red-400 text-[11px] mt-1">{errores.password}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5">Rol</label>
                <Selector value={form.rol} disabled={!esSuper || editandoSelf} onChange={(e) => setForm({ ...form, rol: e.target.value as RolU })} className={`${inputCls} disabled:opacity-60`}>
                  {(esSuper ? rolesDisponibles : [form.rol]).map(r => <option key={r} value={r}>{r}</option>)}
                </Selector>
              </div>
              {modal !== 'nuevo' && !editandoSelf && (
                <label className="flex items-center gap-2 text-sm text-[color:var(--c-b0b0c4)] cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="accent-[color:var(--c-818cf8)]" />
                  Cuenta activa
                </label>
              )}

              {errorGlobal && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{errorGlobal}</span></p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl hover:bg-[color:var(--c-2c2d40)]">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[color:var(--c-818cf8)] rounded-xl disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
