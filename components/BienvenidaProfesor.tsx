'use client';
// Primera vez de un profesor (todavía sin materias): elige su materia y sus secciones.
// Con eso se crea su primera materia, con un código de clase por sección, y EvaPlanner se adapta a esa materia.
import { useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

const SUGERENCIAS = ['Ingeniería de Software', 'Programación', 'Base de Datos', 'Análisis y Diseño de Sistemas', 'Desarrollo Web', 'Redes de Computadoras', 'Soporte Técnico', 'Matemática Discreta', 'Arquitectura del Computador', 'Sistemas Operativos'];

export default function BienvenidaProfesor({ nombre, onCrear }: { nombre: string; onCrear: (materia: string, secciones: string[]) => Promise<void> }) {
  const [materia, setMateria] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const primer = String(nombre || '').trim().split(/\s+/)[0];
  const letras = Array.from({ length: cantidad }, (_, i) => String.fromCharCode(65 + i));
  const crear = async () => {
    const m = materia.trim();
    if (m.length < 3) { setError('Escribe el nombre de la materia (al menos 3 letras).'); return; }
    setCreando(true); setError('');
    try { await onCrear(m.slice(0, 120), letras); } catch (e: any) { setError(e?.message || 'No se pudo crear la materia.'); setCreando(false); }
  };
  return (
    <div className="fixed inset-0 z-[9000] bg-[color:var(--c-0b0b12)]/85 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5">
        <div>
          <div className="w-11 h-11 rounded-xl bg-[color:var(--c-818cf8)]/15 flex items-center justify-center mb-3"><Sparkles className="w-5 h-5 text-[color:var(--c-a5b4fc)]" /></div>
          <h2 className="text-xl font-bold text-[color:var(--c-e0e0ec)]">¡Bienvenido{primer ? `, ${primer}` : ''}! 👋</h2>
          <p className="text-sm text-[color:var(--c-9a9bb0)] mt-1">Antes de empezar: ¿qué materia vas a planificar? EvaPlanner se adapta a ella (temas, casos y búsquedas). Después puedes agregar más materias desde el libro 📖.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--c-b0b0c4)] mb-1.5">Materia</label>
          <div className="relative">
            <BookOpen className="w-4 h-4 text-[color:var(--c-6a6b7e)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoFocus value={materia} onChange={(e) => setMateria(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} maxLength={120} placeholder="Ej: Soporte Técnico de Computadoras"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-[color:var(--c-191a26)] border border-[color:var(--c-313248)] text-sm text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-5a5b6e)] outline-none focus:border-[color:var(--c-818cf8)]/60" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGERENCIAS.map(s => <button key={s} type="button" onClick={() => setMateria(s)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${materia === s ? 'border-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-9a9bb0)] hover:text-[color:var(--c-c7d2fe)]'}`}>{s}</button>)}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--c-b0b0c4)] mb-1.5">¿Cuántas secciones das de esta materia?</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(n => <button key={n} type="button" onClick={() => setCantidad(n)} className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-colors ${cantidad === n ? 'border-[color:var(--c-818cf8)] bg-[color:var(--c-818cf8)]/15 text-[color:var(--c-c7d2fe)]' : 'border-[color:var(--c-313248)] text-[color:var(--c-9a9bb0)]'}`}>{n}</button>)}
          </div>
          <p className="text-[11px] text-[color:var(--c-6a6b7e)] mt-1.5">Secciones {letras.join(', ')}. Cada una tendrá su código para que tus estudiantes se unan.</p>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button type="button" onClick={crear} disabled={creando} className="w-full h-11 rounded-xl bg-[color:var(--c-818cf8)] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {creando ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}Empezar
        </button>
      </div>
    </div>
  );
}
