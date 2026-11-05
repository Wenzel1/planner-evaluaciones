'use client';
// La descripción de una evaluación viene como texto con secciones en mayúsculas
// (OBJETIVO:, ACTIVIDAD:, HERRAMIENTAS:, ENTREGABLES:, CRITERIOS DE EVALUACIÓN:, CASOS POR ESTUDIANTE:…).
// Aquí se separa en partes y se muestra ordenada: compacta para el profesor y más amigable para el estudiante.

import { partesDescripcion } from '@/lib/descripcion';
export { partesDescripcion };

const ICONO: Record<string, string> = { OBJETIVO: '🎯', ACTIVIDAD: '🛠️', HERRAMIENTAS: '🧰', ENTREGABLES: '📦', CRITERIOS: '✅', 'TEMAS POR GRUPO': '👥', 'CASOS POR GRUPO': '👥', 'CASOS POR ESTUDIANTE': '🧑‍🎓', RECURSOS: '📚', INSTRUCCIONES: '📝' };

const sinPunto = (x: string) => x.replace(/^[-•*]\s*/, '').replace(/[.;,]\s*$/, '').trim();
const normal = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const lineas = (x: string) => x.split(/\n+|\s*;\s*|\s+-\s+(?=[A-ZÁÉÍÓÚÑ0-9])/).map(sinPunto).filter(Boolean);

// ---------- Vista del profesor (compacta, en tarjetas) ----------
export default function DescripcionOrdenada({ texto, compacta = false }: { texto: string; compacta?: boolean }) {
  const partes = partesDescripcion(texto);
  if (partes.length === 1 && !partes[0].titulo) return <p className={`${compacta ? 'text-[12px]' : 'text-sm'} text-[#b8b9cc] whitespace-pre-wrap leading-relaxed`}>{partes[0].cuerpo}</p>;
  return (
    <div className={`grid gap-2 ${compacta ? '' : 'sm:grid-cols-2'}`}>
      {partes.map((p, k) => {
        const clave = p.titulo.startsWith('CRITERIOS') ? 'CRITERIOS' : p.titulo;
        const ancho = !compacta && (p.titulo.startsWith('CRITERIOS') || p.titulo === 'ACTIVIDAD' || p.titulo.includes('POR GRUPO') || p.titulo.includes('ESTUDIANTE') || !p.titulo);
        const items = p.cuerpo.split(/\n+|\s*;\s*|\s+-\s+(?=[A-ZÁÉÍÓÚÑ0-9])/).map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
        return (
          <div key={k} className={`rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-3 py-2 ${ancho ? 'sm:col-span-2' : ''}`}>
            {p.titulo && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a5b4fc] mb-1">{ICONO[clave] || '•'} {p.titulo.charAt(0) + p.titulo.slice(1).toLowerCase()}</p>}
            {items.length > 1
              ? <ul className={`${compacta ? 'text-[12px]' : 'text-[13px]'} text-[#c0c0cc] space-y-0.5 list-disc pl-4 marker:text-[#5f6080]`}>{items.map((x, j) => <li key={j}>{x}</li>)}</ul>
              : <p className={`${compacta ? 'text-[12px]' : 'text-[13px]'} text-[#c0c0cc] leading-relaxed whitespace-pre-wrap`}>{p.cuerpo}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Vista del estudiante (página personal) ----------
function Etiqueta({ icono, children }: { icono: string; children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a5b4fc] mb-2 flex items-center gap-1.5"><span className="text-sm">{icono}</span>{children}</p>;
}

// "Claridad (40%), detalle (40%), cobertura (20%)" → [{nombre, pct}]
function criterios(cuerpo: string): { nombre: string; pct: number }[] {
  const res: { nombre: string; pct: number }[] = [];
  const re = /([^,;\n()]+?)\s*[(:]?\s*(\d{1,3})\s*%\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo))) {
    const nombre = sinPunto(m[1].replace(/^\s*(y|e)\s+/i, ''));
    if (nombre) res.push({ nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), pct: Math.min(100, Number(m[2])) });
  }
  return res;
}

export function DescripcionEstudiante({ texto, estudiante }: { texto: string; estudiante?: string }) {
  const partes = partesDescripcion(texto);
  if (partes.length === 1 && !partes[0].titulo) return <p className="text-sm text-[#c0c0d0] whitespace-pre-wrap leading-relaxed">{partes[0].cuerpo}</p>;
  const de = (t: string) => partes.find(p => p.titulo === t || (t === 'CRITERIOS' && p.titulo.startsWith('CRITERIOS')));
  const intro = partes.find(p => !p.titulo);
  const objetivo = de('OBJETIVO'), actividad = de('ACTIVIDAD'), herramientas = de('HERRAMIENTAS'), entregables = de('ENTREGABLES'), crit = de('CRITERIOS');
  const casosEst = de('CASOS POR ESTUDIANTE'), casosGrupo = de('TEMAS POR GRUPO') || de('CASOS POR GRUPO');
  const otras = partes.filter(p => p.titulo && ['RECURSOS', 'INSTRUCCIONES'].includes(p.titulo));

  // De la lista de casos por estudiante, solo el suyo
  let miCaso: string | null = null;
  if (casosEst && estudiante) {
    const yo = normal(estudiante);
    const primero = yo.split(' ')[0];
    for (const l of lineas(casosEst.cuerpo)) {
      const i = l.indexOf(':');
      if (i < 0) continue;
      const quien = normal(l.slice(0, i));
      if (quien === yo || yo.startsWith(quien) || quien.startsWith(yo) || (quien.split(' ')[0] === primero && quien.split(' ').length === 1)) { miCaso = l.slice(i + 1).trim(); break; }
    }
  }
  const listaCrit = crit ? criterios(crit.cuerpo) : [];
  const listaHerr = herramientas ? herramientas.cuerpo.split(/\s*[,;\n]\s*/).map(sinPunto).filter(Boolean) : [];
  const listaEntr = entregables ? lineas(entregables.cuerpo) : [];

  return (
    <div className="space-y-3">
      {intro && <p className="text-sm text-[#c0c0d0] leading-relaxed whitespace-pre-wrap">{intro.cuerpo}</p>}
      {objetivo && (
        <div className="rounded-xl border-l-[3px] border-[#818cf8] bg-[#818cf8]/[0.07] px-4 py-3">
          <Etiqueta icono="🎯">Objetivo</Etiqueta>
          <p className="text-[15px] text-white leading-relaxed">{sinPunto(objetivo.cuerpo)}.</p>
        </div>
      )}
      {actividad && (
        <div className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
          <Etiqueta icono="🛠️">Qué vas a hacer</Etiqueta>
          <p className="text-sm text-[#d0d0dc] leading-relaxed whitespace-pre-wrap">{actividad.cuerpo}</p>
        </div>
      )}
      {miCaso && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
          <Etiqueta icono="🧑‍🎓">Tu caso</Etiqueta>
          <p className="text-sm text-emerald-100 leading-relaxed">{miCaso}</p>
        </div>
      )}
      {(listaHerr.length > 0 || listaEntr.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {listaHerr.length > 0 && (
            <div className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
              <Etiqueta icono="🧰">Herramientas</Etiqueta>
              <div className="flex flex-wrap gap-1.5">{listaHerr.map((h, k) => <span key={k} className="text-xs px-2.5 py-1 rounded-full bg-[#232438] border border-[#34354d] text-[#c7d2fe]">{h}</span>)}</div>
            </div>
          )}
          {listaEntr.length > 0 && (
            <div className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
              <Etiqueta icono="📦">Qué entregas</Etiqueta>
              <ul className="space-y-1.5">{listaEntr.map((x, k) => <li key={k} className="flex gap-2 text-sm text-[#d0d0dc] leading-snug"><span className="mt-0.5 text-emerald-300">✓</span><span>{x}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
      {crit && (
        <div className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
          <Etiqueta icono="✅">Cómo te van a evaluar</Etiqueta>
          {listaCrit.length >= 2 ? (
            <ul className="space-y-2">
              {listaCrit.map((c, k) => (
                <li key={k}>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-[#d0d0dc]">{c.nombre}</span><span className="font-semibold text-[#c7d2fe] tabular-nums">{c.pct}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#2a2b3d] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#818cf8] to-[#a78bfa]" style={{ width: `${c.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[#d0d0dc] leading-relaxed whitespace-pre-wrap">{crit.cuerpo}</p>}
        </div>
      )}
      {casosGrupo && (
        <div className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
          <Etiqueta icono="👥">Temas por grupo</Etiqueta>
          <ul className="space-y-1">{lineas(casosGrupo.cuerpo).map((x, k) => <li key={k} className="text-sm text-[#d0d0dc] leading-snug">{x}</li>)}</ul>
        </div>
      )}
      {otras.map((p, k) => (
        <div key={k} className="rounded-xl bg-[#161722]/70 border border-[#2a2b3d] px-4 py-3">
          <Etiqueta icono={ICONO[p.titulo] || '•'}>{p.titulo.charAt(0) + p.titulo.slice(1).toLowerCase()}</Etiqueta>
          <p className="text-sm text-[#d0d0dc] leading-relaxed whitespace-pre-wrap">{p.cuerpo}</p>
        </div>
      ))}
    </div>
  );
}
