'use client';

import { EditorAvatar } from '@/components/Avatar';
import { AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { validarCedula, validarEmail, validarNombre, validarPassword, validarTelefono } from '@/lib/validacionesUsuario';
import { DatosDemostracion } from '@/components/planificador/Administracion';
import { UsuarioSesion } from '@/components/planificador/tipos';

// ============================================
// CAMBIO OBLIGATORIO DE CONTRASEÑA (cuenta con clave temporal)
// ============================================
export function CambioPasswordObligatorio({ usuario, onLogout }: { usuario: UsuarioSesion; onLogout: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campo = 'w-full bg-[color:var(--c-1b1c2b)] border border-[color:var(--c-313248)] rounded-xl px-3 py-3 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)] focus:ring-2 focus:ring-[color:var(--c-818cf8)]/20 transition-all';
  const etiqueta = 'text-[11px] font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5';

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!actual) return setError('Escribe la contraseña temporal que te entregaron.');
    const p = validarPassword(nueva); if (p) return setError(p);
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden.');
    if (nueva === actual) return setError('La nueva contraseña debe ser distinta a la temporal.');
    setGuardando(true);
    try {
      const r = await fetch('/api/perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: usuario.nombre, email: usuario.email, passwordActual: actual, passwordNueva: nueva }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo cambiar la contraseña.'); setGuardando(false); return; }
      window.location.reload(); // entra al sistema con la contraseña nueva
    } catch { setError('No se pudo conectar con el servidor.'); setGuardando(false); }
  };

  return (
    <div className="min-h-screen bg-[color:var(--c-12131d)] flex items-center justify-center p-5">
      <motion.form onSubmit={guardar} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-8 shadow-2xl space-y-5" noValidate>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3"><ShieldCheck className="w-7 h-7 text-amber-300" /></div>
          <h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">Elige tu nueva contraseña</h1>
          <p className="text-sm text-[color:var(--c-8a8b9e)] mt-1">Hola, {usuario.nombre}. Entraste con una contraseña temporal; por seguridad debes cambiarla para continuar.</p>
        </div>
        <div><label className={etiqueta}>Contraseña temporal</label><input type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)} className={campo} autoComplete="current-password" autoFocus /></div>
        <div><label className={etiqueta}>Nueva contraseña</label><input type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 8, con letras y números" className={campo} autoComplete="new-password" /></div>
        <div><label className={etiqueta}>Confirmar nueva contraseña</label><input type={ver ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={campo} autoComplete="new-password" /></div>
        <label className="flex items-center gap-2 text-xs text-[color:var(--c-9a9bb0)] cursor-pointer"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="accent-[color:var(--c-818cf8)]" />Mostrar contraseñas</label>
        {error && <p className="text-red-300 text-xs flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5" role="alert"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span></p>}
        <button type="submit" disabled={guardando} className="w-full py-3 bg-[color:var(--c-818cf8)] text-white font-semibold text-sm rounded-xl shadow-lg disabled:opacity-60">{guardando ? 'Guardando...' : 'Guardar y entrar'}</button>
        <button type="button" onClick={onLogout} className="w-full text-xs text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-b0b0c4)]">Cerrar sesión</button>
      </motion.form>
    </div>
  );
}

// ============================================
// MI PERFIL (disponible para los tres roles)
// ============================================
export function PerfilPanel({ usuario, onActualizado }: { usuario?: UsuarioSesion | null; onActualizado?: (u: UsuarioSesion) => void }) {
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [passwordActual, setPasswordActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGlobal, setErrorGlobal] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [creadoEn, setCreadoEn] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cedula, setCedula] = useState('');
  const [cedulaBloqueada, setCedulaBloqueada] = useState(false);
  const telefonoOriginal = useRef('');

  useEffect(() => { if (usuario) { setNombre(usuario.nombre); setEmail(usuario.email); } }, [usuario?.id, usuario?.nombre, usuario?.email]);
  useEffect(() => {
    fetch('/api/perfil').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.createdAt) setCreadoEn(new Date(d.createdAt).toLocaleDateString()); if (d) { setTelefono(d.telefono || ''); telefonoOriginal.current = (d.telefono || '').replace(/[\s().-]/g, ''); setCedula(d.cedula || ''); setCedulaBloqueada(!!d.cedula); } }).catch(() => {});
  }, []);

  const INFO_ROL = {
    SUPERADMIN: {
      badge: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
      descripcion: 'Control total del sistema.',
      permisos: ['Crear, editar y eliminar cuentas de administradores y profesores', 'Atender las solicitudes de "olvidé mi contraseña"', 'Ver, editar y eliminar el trabajo y los estudiantes de cualquier profesor', 'Configurar el chat, el modelo de lenguaje y los límites del sistema', 'Consultar el registro de actividad', 'Usar el planificador y el chat como cualquier profesor'],
    },
    ADMIN: {
      badge: 'bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-a5b4fc)] border-[color:var(--c-818cf8)]/30',
      descripcion: 'Supervisas a los profesores y administras sus cuentas.',
      permisos: ['Crear, editar, desactivar y eliminar cuentas de profesores (rol USUARIO)', 'Ver el trabajo y los estudiantes de todos los profesores, y eliminarlos como moderación (editarlos es del superadmin)', 'No puedes modificar a otros administradores ni al superadmin', 'Gestionar tus propias materias, estudiantes y evaluaciones'],
    },
    USUARIO: {
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      descripcion: 'Profesor: trabajas con tus propios datos.',
      permisos: ['Gestionar tus materias, secciones y evaluaciones', 'Agregar y administrar a tus propios estudiantes', 'Generar y enviar planes de acción', 'Tus datos no son visibles para otros profesores'],
    },
  } as const;
  const rol = usuario?.rol || 'USUARIO';
  const info = INFO_ROL[rol];

  const inputCls = 'w-full bg-[color:var(--c-272839)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2.5 text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-6a6b7e)] focus:outline-none focus:border-[color:var(--c-818cf8)] transition-colors';
  const labelCls = 'text-xs font-semibold text-[color:var(--c-8a8b9e)] uppercase tracking-wider block mb-1.5';

  const guardar = async () => {
    setExito(''); setErrorGlobal('');
    const e: Record<string, string> = {};
    const n = validarNombre(nombre); if (n) e.nombre = n;
    const m = validarEmail(email); if (m) e.email = m;
    if (telefono.trim()) { const tl = validarTelefono(telefono); if (tl) e.telefono = tl; }
    if (!cedulaBloqueada && cedula.trim()) { const cd = validarCedula(cedula); if (cd) e.cedula = cd; }
    const cambiaEmail = !!usuario && email.trim().toLowerCase() !== usuario.email.toLowerCase();
    const cambiaPassword = nueva.length > 0 || confirmar.length > 0;
    const cambiaTelefono = telefono.trim() !== '' && telefono.replace(/[\s().-]/g, '') !== telefonoOriginal.current;
    if (cambiaPassword) {
      const p = validarPassword(nueva);
      if (p) e.nueva = p;
      else if (nueva !== confirmar) e.confirmar = 'Las contraseñas no coinciden.';
    }
    if ((cambiaEmail || cambiaPassword || cambiaTelefono) && !passwordActual) e.passwordActual = 'Ingresa tu contraseña actual para confirmar este cambio.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    try {
      const r = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, telefono, cedula: cedulaBloqueada ? undefined : cedula, passwordActual: passwordActual || undefined, passwordNueva: nueva || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { setErrorGlobal(d.error || 'No se pudieron guardar los cambios.'); return; }
      if (onActualizado) onActualizado({ ...d, avatarEn: usuario?.avatarEn ?? null }); // la foto no viene en esta respuesta: se conserva
      telefonoOriginal.current = telefono.replace(/[\s().-]/g, ''); if (cedula.trim()) setCedulaBloqueada(true);
      setPasswordActual(''); setNueva(''); setConfirmar('');
      setExito(cambiaPassword ? 'Cambios guardados. Tu contraseña fue actualizada.' : 'Cambios guardados.');
    } catch {
      setErrorGlobal('No se pudo conectar con el servidor.');
    } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--c-e0e0ec)]">Mi perfil</h2>
        <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5">Administra tus datos de acceso.{creadoEn && ` Cuenta creada el ${creadoEn}.`}</p>
      </div>

      {usuario && (
        <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] mb-3">Foto de perfil</p>
          <EditorAvatar id={usuario.id} version={usuario.avatarEn} nombre={usuario.nombre} onCambio={(v) => onActualizado?.({ ...usuario, avatarEn: v })} />
        </div>
      )}

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-full bg-[color:var(--c-272839)] flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-[color:var(--c-818cf8)]" /></div>
          <div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${info.badge}`}>{rol}</span>
            <p className="text-sm text-[color:var(--c-b0b0c4)] mt-1">{info.descripcion}</p>
          </div>
        </div>
        <ul className="space-y-1.5 pt-1">
          {info.permisos.map(p => (<li key={p} className="text-xs text-[color:var(--c-9a9bb0)] flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /><span>{p}</span></li>))}
        </ul>
      </div>

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)]">Datos personales</h3>
        <div>
          <label className={labelCls}>Nombre completo</label>
          <input value={nombre} onChange={(e) => { setNombre(e.target.value); setExito(''); }} className={`${inputCls} ${errores.nombre ? 'border-red-500/50' : ''}`} />
          {errores.nombre && <p className="text-red-400 text-[11px] mt-1">{errores.nombre}</p>}
        </div>
        <div>
          <label className={labelCls}>Correo electrónico</label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setExito(''); }} className={`${inputCls} ${errores.email ? 'border-red-500/50' : ''}`} />
          {errores.email && <p className="text-red-400 text-[11px] mt-1">{errores.email}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Teléfono</label>
            <input type="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); setExito(''); }} placeholder="Ej: 0412 123 4567" className={`${inputCls} ${errores.telefono ? 'border-red-500/50' : ''}`} />
            {errores.telefono && <p className="text-red-400 text-[11px] mt-1">{errores.telefono}</p>}
            <p className="text-[11px] text-[color:var(--c-6a6b7e)] mt-1">Por este número el administrador puede contactarte (por ejemplo, para entregarte una clave temporal).</p>
          </div>
          <div>
            <label className={labelCls}>Cédula</label>
            <input value={cedula} disabled={cedulaBloqueada} onChange={(e) => { setCedula(e.target.value); setExito(''); }} inputMode="numeric" placeholder="Solo números" className={`${inputCls} disabled:opacity-60 ${errores.cedula ? 'border-red-500/50' : ''}`} />
            {errores.cedula && <p className="text-red-400 text-[11px] mt-1">{errores.cedula}</p>}
            <p className="text-[11px] text-[color:var(--c-6a6b7e)] mt-1">{cedulaBloqueada ? 'Si necesitas corregirla, pídeselo a un administrador.' : 'Se registra una sola vez.'}</p>
          </div>
        </div>
      </div>

      <div className="bg-[color:var(--c-1d1e2e)] border border-[color:var(--c-313248)] rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--c-d0d0da)]">Seguridad</h3>
          <p className="text-[11px] text-[color:var(--c-8a8b9e)] mt-0.5">Necesitas tu contraseña actual solo si cambias tu correo o tu contraseña.</p>
        </div>
        <div>
          <label className={labelCls}>Contraseña actual</label>
          <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} autoComplete="current-password" className={`${inputCls} ${errores.passwordActual ? 'border-red-500/50' : ''}`} />
          {errores.passwordActual && <p className="text-red-400 text-[11px] mt-1">{errores.passwordActual}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mín. 8, letras y números" autoComplete="new-password" className={`${inputCls} ${errores.nueva ? 'border-red-500/50' : ''}`} />
            {errores.nueva && <p className="text-red-400 text-[11px] mt-1">{errores.nueva}</p>}
          </div>
          <div>
            <label className={labelCls}>Confirmar nueva contraseña</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" className={`${inputCls} ${errores.confirmar ? 'border-red-500/50' : ''}`} />
            {errores.confirmar && <p className="text-red-400 text-[11px] mt-1">{errores.confirmar}</p>}
          </div>
        </div>
      </div>

      {errorGlobal && <p className="text-red-400 text-xs flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{errorGlobal}</span></p>}
      {exito && <p className="text-emerald-400 text-xs flex items-start gap-1.5"><CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{exito}</span></p>}

      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={guardar} disabled={guardando} className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-[color:var(--c-818cf8)] rounded-xl shadow-lg disabled:opacity-60">
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </motion.button>

      <DatosDemostracion />
    </div>
  );
}
