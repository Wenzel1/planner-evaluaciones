'use client';
// Configuración del estudiante: foto, datos, contraseña, apariencia y sus clases
import { useState } from 'react';
import { LogOut, Plus, KeyRound, CheckCircle2 } from 'lucide-react';
import { EditorAvatar } from '@/components/Avatar';
import { confirmar as confirmarDialogo } from '@/components/Confirmar';

interface Cuenta { id: string; nombre: string; email: string; avatarEn?: string | null; avisosCorreo?: boolean }
interface Clase { id: string; estado: string; profesor: string; materia: string | null; seccion: string }

const campo = 'w-full h-10 px-3 rounded-lg bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-e0e0ec)] placeholder-[color:var(--c-5f6074)] focus:outline-none focus:border-[color:var(--c-818cf8)]';
const etiqueta = 'text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] block mb-1.5';
const tarjeta = 'rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] p-5';

export default function Configuracion({ cuenta, onCuenta, clases, onSalir, onUnirse }: {
  cuenta: Cuenta; onCuenta: (c: Partial<Cuenta>) => void;
  clases: Clase[]; onSalir: (claseId: string) => Promise<void>; onUnirse: () => void;
}) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [email, setEmail] = useState(cuenta.email);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  const [saliendo, setSaliendo] = useState<string | null>(null);

  const cambiaCorreo = email.trim().toLowerCase() !== cuenta.email.toLowerCase();
  const pideActual = cambiaCorreo || nueva.length > 0;
  const guardar = async () => {
    setAviso(null);
    if (nueva && nueva !== confirmar) { setAviso({ ok: false, t: 'Las contraseñas nuevas no coinciden.' }); return; }
    setGuardando(true);
    try {
      const r = await fetch('/api/perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre, email, passwordActual: actual, passwordNueva: nueva }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      onCuenta({ nombre: d.nombre ?? nombre, email: d.email ?? email });
      setActual(''); setNueva(''); setConfirmar('');
      setAviso({ ok: true, t: 'Tus datos se guardaron.' });
    } catch (e: any) { setAviso({ ok: false, t: e.message }); } finally { setGuardando(false); }
  };
  const salir = async (c: Clase) => {
    const pendiente = c.estado === 'PENDIENTE';
    if (!(await confirmarDialogo(pendiente ? `¿Cancelar tu solicitud a la clase de ${c.profesor}?` : `¿Salir de la clase de ${c.profesor}${c.materia ? ` (${c.materia})` : ''}? Tu profesor conserva tus notas y puedes volver a unirte con su código.`))) return;
    setSaliendo(c.id);
    try { await onSalir(c.id); } finally { setSaliendo(null); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--c-8a8b9e)]">Tu foto, tus datos y tus clases.</p>

      <div className="grid xl:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
      <section className={tarjeta}>
        <p className={etiqueta}>Foto de perfil</p>
        <EditorAvatar id={cuenta.id} version={cuenta.avatarEn} nombre={cuenta.nombre} onCambio={(v) => onCuenta({ avatarEn: v })} />
      </section>

      {/* Avisos por correo o WhatsApp */}
      <section className={tarjeta}>
        <p className={etiqueta}>Notificaciones</p>
        <button type="button" role="switch" aria-checked={cuenta.avisosCorreo !== false}
          onClick={async () => {
            const nuevo = cuenta.avisosCorreo === false;
            onCuenta({ avisosCorreo: nuevo }); // se ve al instante; si falla, se devuelve
            const r = await fetch('/api/perfil/avisos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avisos: nuevo }) }).catch(() => null);
            if (!r?.ok) { onCuenta({ avisosCorreo: !nuevo }); setAviso({ ok: false, t: 'No se pudo guardar tu preferencia de avisos.' }); }
          }}
          className="mt-2 w-full flex items-center gap-3 text-left">
          <span className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 ${cuenta.avisosCorreo !== false ? 'bg-[color:var(--c-818cf8)]' : 'bg-[color:var(--c-313248)]'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${cuenta.avisosCorreo !== false ? 'translate-x-5' : ''}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-[color:var(--c-e0e0ec)]">Recibir avisos por correo o WhatsApp</span>
            <span className="block text-xs text-[color:var(--c-8a8b9e)]">Recordatorios de evaluaciones, cambios de fecha y mensajes de tus profesores. Si lo apagas, igual los ves al entrar aquí.</span>
          </span>
        </button>
      </section>



      <section className={tarjeta}>
        <div className="flex items-center justify-between mb-3"><p className={`${etiqueta} mb-0`}>Mis clases</p><button type="button" onClick={onUnirse} className="h-8 px-3 rounded-lg text-xs font-semibold text-[color:var(--c-c7d2fe)] border border-[color:var(--c-818cf8)]/30 bg-[color:var(--c-818cf8)]/10 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Unirme a otra clase</button></div>
        {clases.length === 0 ? <p className="text-sm text-[color:var(--c-8a8b9e)]">Todavía no estás en ninguna clase.</p> : (
          <ul className="divide-y divide-[color:var(--c-282a3f)] -mx-1">
            {clases.map(c => (
              <li key={c.id} className="px-1 py-2.5 flex items-center gap-3">
                <span className="flex-1 min-w-0"><span className="block text-sm text-[color:var(--c-d0d0da)] truncate">{c.materia || 'Todas sus materias'} · Prof. {c.profesor}</span><span className="block text-xs text-[color:var(--c-8a8b9e)]">Sección {c.seccion}{c.estado === 'PENDIENTE' ? ' · esperando aprobación' : ''}</span></span>
                <button type="button" disabled={saliendo === c.id} onClick={() => salir(c)} className="h-8 px-3 rounded-lg text-xs text-[color:var(--c-8a8b9e)] hover:text-red-300 hover:bg-red-500/10 flex items-center gap-1.5 disabled:opacity-50"><LogOut className="w-3.5 h-3.5" />{c.estado === 'PENDIENTE' ? 'Cancelar solicitud' : 'Salir'}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
      <section className={`${tarjeta} space-y-3`}>
        <p className={etiqueta}>Mis datos</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className={etiqueta}>Nombre completo</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} autoComplete="name" /></label>
          <label><span className={etiqueta}>Correo</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} autoComplete="email" /></label>
        </div>
        <p className={`${etiqueta} pt-2 flex items-center gap-1.5`}><KeyRound className="w-3.5 h-3.5" />Cambiar contraseña (opcional)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Contraseña nueva" className={campo} autoComplete="new-password" />
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repite la contraseña nueva" className={campo} autoComplete="new-password" />
        </div>
        {pideActual && <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Tu contraseña actual (para confirmar el cambio)" className={campo} autoComplete="current-password" />}
        {aviso && <p className={`text-xs rounded-lg px-3 py-2 border ${aviso.ok ? 'text-emerald-200 bg-emerald-500/10 border-emerald-500/25' : 'text-red-200 bg-red-500/10 border-red-500/25'}`}>{aviso.ok && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}{aviso.t}</p>}
        <button type="button" disabled={guardando || nombre.trim().length < 3 || (pideActual && !actual)} onClick={guardar} className="h-10 px-5 rounded-lg bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-semibold disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </section>
      </div>
    </div>
  );
}
