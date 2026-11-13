// Plan de Acción en HTML (vista previa e impresión cuando el PDF no está disponible). Función pura: solo arma el texto.
import { PlanificacionExamen, SeccionExamen } from '@/components/planificador/tipos';
import { escaparHTML, limpiarTexto } from '@/components/planificador/utilidades';

export function planAccionHTML(planificacion: PlanificacionExamen, secciones: SeccionExamen[], nombreProfesor?: string | null): string | null {
  const seccionesPlan = secciones;
  if (seccionesPlan.length === 0) return null;
  const nombreMateria = escaparHTML(planificacion.materia || 'Asignatura');
  const fechaPlan = planificacion.fechaExamen ? new Date(planificacion.fechaExamen).toLocaleDateString() : 'Por definir';
  
  const renderFila = (sec: SeccionExamen) => {
    const nombreLimpio = escaparHTML(limpiarTexto(sec.nombre || '') || 'Sin Nombre');
    return `<tr>
      <td style="padding: 16px; font-weight: 500; color: #334155;">${nombreLimpio}</td>
      <td style="padding: 16px; color: #475569;">${escaparHTML(sec.tipoActividad || 'Desarrollo')}</td>
      <td style="padding: 16px; text-align: center; font-weight: 700; color: #1e3a8a;">${sec.peso || 0}%</td>
      <td style="padding: 16px; text-align: center; color: #475569;">${sec.fecha ? new Date(sec.fecha).toLocaleDateString() : fechaPlan}</td>
    </tr>`;
  };

  const tieneDescripciones = seccionesPlan.some(s => s.descripcion);
  const renderDescripciones = tieneDescripciones ? `
    <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid #e2e8f0;">
      <h3 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 12px 0;">📋 Especificaciones</h3>
      <div style="display: grid; gap: 16px;">
        ${seccionesPlan.map((sec, i) => {
          const n = escaparHTML(limpiarTexto(sec.nombre || '') || 'Sin Nombre');
          return sec.descripcion ? `<div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #94a3b8;">#${i + 1}</span>
              <span style="font-weight: 600; color: #1e293b;">${n}</span>
            </div>
            <p style="font-size: 14px; color: #475569; white-space: pre-wrap;">${escaparHTML(sec.descripcion)}</p>
          </div>` : '';
        }).join('')}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Plan de Acción - ${nombreMateria}</title>
<style>
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 0; }
  .page { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
  .header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #1e3a8a; }
  .badge { position: absolute; top: 40px; right: 40px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 6px; }
  .subtitle { font-size: 11px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 2px; }
  .title { font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 4px 0 0 0; }
  .meta { display: flex; gap: 24px; margin-top: 12px; font-size: 12px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; text-align: left; background: white; }
  thead tr { background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
  th { padding: 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  td { padding: 16px; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #d1d5db; }
  .firma-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
  .firma-linea { border-bottom: 2px solid #cbd5e1; width: 75%; }
  .sello-label { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page" style="position: relative;">
  <div class="badge">Plan v1.0</div>
  <div class="header">
    <div class="subtitle">Plan de Acción</div>
    <h1 class="title">${nombreMateria}</h1>
    <div class="meta">
      <p>👤 ${nombreProfesor ? 'Prof. ' + escaparHTML(nombreProfesor) : 'Docente'}</p>
      <p>📅 ${fechaPlan}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Contenido</th>
        <th>Estrategia</th>
        <th style="text-align: center;">Peso</th>
        <th style="text-align: center;">Fecha</th>
      </tr>
    </thead>
    <tbody>
      ${seccionesPlan.map(sec => renderFila(sec)).join('')}
    </tbody>
  </table>
  ${renderDescripciones}
  <div class="firmas">
    <div><p class="firma-label">${nombreProfesor ? 'Prof. ' + escaparHTML(nombreProfesor) : 'Docente'}</p><div class="firma-linea"></div><p class="sello-label">Firma</p></div>
    <div><p class="firma-label">Coordinación Académica</p><div class="firma-linea"></div><p class="sello-label">Sello</p></div>
  </div>
</div>
</body>
</html>`;
}
