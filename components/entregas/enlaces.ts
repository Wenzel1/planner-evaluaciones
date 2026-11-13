// Enlaces temporales de los archivos entregados: se piden una vez, se guardan unos minutos y se pueden pedir
// por adelantado (al pasar el mouse) sin descargar el visor completo.
export interface Enlaces { ver: string; descargar: string }

// fuente: dirección que entrega el archivo (ya con ?archivoId=…); se le agrega &modo=…
export const conModo = (fuente: string, modo: string, extra = '') => `${fuente}${fuente.includes('?') ? '&' : '?'}modo=${modo}${extra}`;

// Enlaces ya pedidos (los firmados duran 10 min; se reusan por 8) y pedidos en curso: abrir un archivo
// por segunda vez, o uno que se precargó al pasar el mouse, es instantáneo.
export const enlacesGuardados = new Map<string, { enlaces: Enlaces; hasta: number }>();
const enCurso = new Map<string, Promise<Enlaces>>();
export function precargarArchivo(fuente: string): Promise<Enlaces> {
  const g = enlacesGuardados.get(fuente);
  if (g && g.hasta > Date.now()) return Promise.resolve(g.enlaces);
  const p0 = enCurso.get(fuente);
  if (p0) return p0;
  const p = fetch(conModo(fuente, 'url'), { cache: 'no-store' })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo abrir el archivo.'); return { ver: d.ver as string, descargar: d.descargar as string }; })
    .then(enlaces => {
      enlacesGuardados.set(fuente, { enlaces, hasta: Date.now() + 8 * 60_000 });
      preconectar(new URL(enlaces.ver).origin);
      return enlaces;
    })
    .finally(() => enCurso.delete(fuente));
  enCurso.set(fuente, p);
  return p;
}
// Abre la conexión con el servidor de archivos (y con el visor de Office) antes de necesitarla
const conectados = new Set<string>();
export function preconectar(origen: string) {
  if (typeof document === 'undefined' || conectados.has(origen)) return;
  conectados.add(origen);
  const l = document.createElement('link'); l.rel = 'preconnect'; l.href = origen; l.crossOrigin = 'anonymous'; document.head.appendChild(l);
}

