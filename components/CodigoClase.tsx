'use client';
// Código de clase de una sección: el profesor lo comparte (código, enlace de invitación o QR para proyectar)
// y cada estudiante que lo usa queda en la lista de ESA materia y sección.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, Copy, Check, RefreshCw, X, Link2 } from 'lucide-react';

interface Seccion { letra: string; codigo: string; requiereAprobacion: boolean; activo: boolean }

export default function CodigoClase({ materiaId, materia, letra, onCerrar, notificar }: { materiaId: string; materia: string; letra: string; onCerrar: () => void; notificar: (m: string) => void }) {
  const [s, setS] = useState<Seccion | null>(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState<'codigo' | 'enlace' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enlace = s && typeof window !== 'undefined' ? `${window.location.origin}/login?clase=${encodeURIComponent(s.codigo)}` : '';

  useEffect(() => {
    fetch('/api/materias/secciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId, letra }) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo obtener el código.'); setS(d); })
      .catch(e => setError(e.message));
  }, [materiaId, letra]);
  useEffect(() => { if (enlace) QRCode.toDataURL(enlace, { margin: 1, width: 360, color: { dark: '#1e1b4b', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [enlace]);

  const cambiar = async (cambio: Partial<Seccion> & { nuevoCodigo?: boolean }) => {
    if (cambio.nuevoCodigo && !window.confirm('Se creará un código nuevo y el actual dejará de funcionar. Los estudiantes que ya se unieron no se ven afectados. ¿Continuar?')) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/materias/secciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ materiaId, letra, ...cambio }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      setS(d);
      if (cambio.nuevoCodigo) notificar(`🔑 Nuevo código de la Sección ${letra}: ${d.codigo}`);
    } catch (e: any) { notificar(`⚠️ ${e.message}`); } finally { setGuardando(false); }
  };
  const copiar = async (que: 'codigo' | 'enlace') => {
    const t = que === 'codigo' ? s?.codigo || '' : enlace;
    try { await navigator.clipboard.writeText(t); } catch { window.prompt('Copia:', t); }
    setCopiado(que); setTimeout(() => setCopiado(null), 1800);
  };

  return (
    <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[color:var(--c-313248)]">
        <div className="w-9 h-9 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center"><KeyRound className="w-[18px] h-[18px] text-[color:var(--c-a5b4fc)]" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[color:var(--c-e0e0ec)]">Código de clase · Sección {letra}</h3>
          <p className="text-xs text-[color:var(--c-8a8b9e)] truncate">{materia}: tus estudiantes lo usan para unirse desde su cuenta</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)]"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-4">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {!s && !error && <div className="flex justify-center py-10"><span className="w-5 h-5 border-2 border-[color:var(--c-818cf8)] border-t-transparent rounded-full animate-spin" /></div>}
        {s && (<>
          <div className="grid sm:grid-cols-[1fr_180px] gap-4 items-center">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[color:var(--c-8a8b9e)] font-semibold mb-1">Código</p>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold tracking-[0.12em] font-mono ${s.activo ? 'text-[color:var(--c-e0e0ec)]' : 'text-[color:var(--c-6a6b7e)] line-through'}`}>{s.codigo}</span>
                  <button type="button" onClick={() => copiar('codigo')} className="p-2 rounded-lg text-[color:var(--c-a5b4fc)] hover:bg-[color:var(--c-818cf8)]/10" title="Copiar código">{copiado === 'codigo' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}</button>
                </div>
              </div>
              <button type="button" onClick={() => copiar('enlace')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[color:var(--c-313248)] text-xs text-[color:var(--c-c7d2fe)] hover:bg-[color:var(--c-818cf8)]/10 text-left">
                {copiado === 'enlace' ? <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" /> : <Link2 className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate">{copiado === 'enlace' ? '¡Enlace copiado! Envíalo por WhatsApp o correo' : 'Copiar enlace de invitación (ya trae el código)'}</span>
              </button>
              <p className="text-[11px] text-[color:var(--c-8a8b9e)] leading-relaxed">El estudiante crea su cuenta como <strong>Estudiante</strong> y escribe el código (o abre el enlace, o escanea el QR). Queda en tu lista de <strong>{materia}</strong>, Sección {letra}.</p>
            </div>
            {qr && <div className="justify-self-center bg-white rounded-xl p-2"><img src={qr} alt={`Código QR para unirse a la Sección ${letra}`} className="w-[164px] h-[164px]" /></div>}
          </div>
          <div className="rounded-xl border border-[color:var(--c-2a2b3d)] divide-y divide-[color:var(--c-2a2b3d)]">
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={s.requiereAprobacion} disabled={guardando} onChange={(e) => cambiar({ requiereAprobacion: e.target.checked })} className="accent-[#818cf8]" />
              <span className="text-sm text-[color:var(--c-d0d0da)]">Aprobar cada solicitud <span className="block text-[11px] text-[color:var(--c-8a8b9e)]">{s.requiereAprobacion ? 'Los verás en Estudiantes → Solicitudes, para aceptarlos o rechazarlos.' : 'Entran directo a tu lista al usar el código.'}</span></span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={s.activo} disabled={guardando} onChange={(e) => cambiar({ activo: e.target.checked })} className="accent-[#818cf8]" />
              <span className="text-sm text-[color:var(--c-d0d0da)]">Código activo <span className="block text-[11px] text-[color:var(--c-8a8b9e)]">Desactívalo cuando ya estén todos; nadie más podrá unirse.</span></span>
            </label>
            <button type="button" disabled={guardando} onClick={() => cambiar({ nuevoCodigo: true })} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[color:var(--c-b0b0c4)] hover:text-[color:var(--c-c7d2fe)] text-left"><RefreshCw className="w-4 h-4" />Generar un código nuevo</button>
          </div>
        </>)}
      </div>
    </div>
  );
}
