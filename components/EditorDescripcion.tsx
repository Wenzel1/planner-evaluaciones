'use client';
// Editor de la descripción de una evaluación por partes (Objetivo, Actividad, Herramientas, Entregables, Criterios, Casos…).
// Cada parte es un recuadro con su título; al escribir se vuelve a armar el texto completo con las secciones
// en mayúsculas, que es el formato que usan la tarjeta, la página del estudiante, el PDF y el Excel.
import { useEffect, useRef } from 'react';
import { partesDescripcion } from '@/lib/descripcion';

const INFO: Record<string, { icono: string; nombre: string; ayuda: string }> = {
  OBJETIVO: { icono: '🎯', nombre: 'Objetivo', ayuda: 'Qué debe lograr el estudiante' },
  ACTIVIDAD: { icono: '🛠️', nombre: 'Actividad', ayuda: 'Qué va a hacer, paso a paso' },
  HERRAMIENTAS: { icono: '🧰', nombre: 'Herramientas', ayuda: 'Separadas por comas: Figma, GitHub…' },
  ENTREGABLES: { icono: '📦', nombre: 'Entregables', ayuda: 'Qué entrega (uno por línea o separados por ;)' },
  'CRITERIOS DE EVALUACIÓN': { icono: '✅', nombre: 'Criterios de evaluación', ayuda: 'Con porcentaje: Claridad (40%), …' },
  CRITERIOS: { icono: '✅', nombre: 'Criterios', ayuda: 'Con porcentaje' },
  'CASOS POR GRUPO': { icono: '👥', nombre: 'Casos por grupo', ayuda: 'Grupo 1 (integrantes): caso — uno por línea' },
  'TEMAS POR GRUPO': { icono: '👥', nombre: 'Temas por grupo', ayuda: 'Uno por línea' },
  GRUPOS: { icono: '👥', nombre: 'Grupos', ayuda: 'Grupo 1: integrantes — uno por línea' },
  'CASOS POR ESTUDIANTE': { icono: '🧑‍🎓', nombre: 'Casos por estudiante', ayuda: 'Nombre: caso — uno por línea' },
  RECURSOS: { icono: '📚', nombre: 'Recursos', ayuda: '' },
  INSTRUCCIONES: { icono: '📝', nombre: 'Instrucciones', ayuda: '' },
};
const BASICAS = ['OBJETIVO', 'ACTIVIDAD', 'HERRAMIENTAS', 'ENTREGABLES', 'CRITERIOS DE EVALUACIÓN'];

export function tieneSecciones(texto: string) { return partesDescripcion(texto).filter(p => p.titulo).length >= 2; }

function unir(partes: { titulo: string; cuerpo: string }[]): string {
  return partes.map(p => {
    const c = p.cuerpo.trim();
    if (!p.titulo) return c;
    return c.includes('\n') ? `${p.titulo}:\n${c}` : `${p.titulo}: ${c}`;
  }).filter((x, i) => x.trim() || partes[i].titulo).join('\n');
}

function Campo({ valor, onChange, ayuda }: { valor: string; onChange: (v: string) => void; ayuda: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = ref.current; if (!t) return; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight + 2, 320)}px`; }, [valor]);
  return <textarea ref={ref} value={valor} onChange={(e) => onChange(e.target.value)} rows={1} placeholder={ayuda}
    className="w-full bg-[color:var(--c-191a26)] border border-[color:var(--c-2a2b3d)] rounded-lg px-3 py-2 text-[13px] leading-relaxed text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-5a5b6e)] outline-none resize-none focus:border-[color:var(--c-818cf8)]/60 custom-scrollbar" />;
}

export default function EditorDescripcion({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const partes = partesDescripcion(value);
  const cambiar = (i: number, cuerpo: string) => onChange(unir(partes.map((p, k) => (k === i ? { ...p, cuerpo } : p))));
  const quitar = (i: number) => onChange(unir(partes.filter((_, k) => k !== i)));
  const faltan = BASICAS.filter(t => !partes.some(p => p.titulo === t || (t.startsWith('CRITERIOS') && p.titulo.startsWith('CRITERIOS'))));
  const agregar = (t: string) => {
    // Las secciones básicas van antes de los casos/grupos
    const iCasos = partes.findIndex(p => /POR GRUPO|POR ESTUDIANTE|^GRUPOS$/.test(p.titulo));
    const nuevas = [...partes];
    nuevas.splice(iCasos >= 0 ? iCasos : nuevas.length, 0, { titulo: t, cuerpo: '…' });
    onChange(unir(nuevas));
  };
  return (
    <div className="space-y-2.5 mt-2">
      {partes.map((p, i) => {
        const info = INFO[p.titulo] || { icono: '📄', nombre: p.titulo ? p.titulo.charAt(0) + p.titulo.slice(1).toLowerCase() : 'Introducción', ayuda: '' };
        return (
          <div key={`${p.titulo}-${i}`} className="group/parte">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{info.icono}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-a5b4fc)]">{info.nombre}</span>
              {p.titulo && <button type="button" onClick={() => quitar(i)} title="Quitar esta sección" className="ml-auto text-[11px] text-[color:var(--c-6a6b7e)] hover:text-red-300 opacity-0 group-hover/parte:opacity-100 focus:opacity-100">Quitar</button>}
            </div>
            <Campo valor={p.cuerpo} onChange={(v) => cambiar(i, v)} ayuda={info.ayuda} />
          </div>
        );
      })}
      {faltan.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-[color:var(--c-6a6b7e)]">Agregar:</span>
          {faltan.map(t => <button key={t} type="button" onClick={() => agregar(t)} className="text-[11px] px-2 py-1 rounded-md border border-dashed border-[color:var(--c-3a3b52)] text-[color:var(--c-9a9bb0)] hover:text-[color:var(--c-c7d2fe)] hover:border-[color:var(--c-818cf8)]/50">+ {INFO[t].icono} {INFO[t].nombre}</button>)}
        </div>
      )}
    </div>
  );
}
