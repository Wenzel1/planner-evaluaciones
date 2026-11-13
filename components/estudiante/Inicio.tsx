'use client';
// Inicio del estudiante: lo importante de TODAS sus clases de un vistazo
import { CalendarDays, Upload, RotateCcw, MessageSquare, ChevronRight, AlertCircle, Award, BookOpen } from 'lucide-react';
import { type Resumen, type AbrirEvaluacion, colorDe, cuandoTexto, fechaCorta, limpiar, estadoEntrega, textoNota } from './comun';

export default function Inicio({ datos, nombre, onAbrir, onIr }: { datos: Resumen; nombre: string; onAbrir: AbrirEvaluacion; onIr: (pestana: string) => void }) {
  const evs = datos.evaluaciones.filter(e => e.estado !== 'CANCELADA');
  const proximas = evs.filter(e => e.fecha && new Date(e.fecha).getTime() >= Date.now() - 3600000 && e.estado !== 'REALIZADA').sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime());
  const pendientes = evs.filter(e => ['pendiente', 'atrasada'].includes(estadoEntrega(e) || ''));
  const porCorregir = evs.filter(e => estadoEntrega(e) === 'por_corregir');
  const atrasadas = evs.filter(e => estadoEntrega(e) === 'atrasada');
  const sinLeer = evs.reduce((t, e) => t + e.mensajesNuevos, 0);
  const notas = evs.filter(e => e.nota).sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()).slice(0, 4);
  const abrir = (e: typeof evs[number]) => onAbrir({ claseId: e.claseId, materiaId: datos.grupos.find(g => g.clave === e.grupo)?.materiaId, evaluacionId: e.id });
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const primera = proximas[0];

  const Tarjeta = ({ icono: I, titulo, valor, detalle, onClick, tono = '' }: { icono: any; titulo: string; valor: string | number; detalle: string; onClick?: () => void; tono?: string }) => (
    <button type="button" onClick={onClick} className="text-left rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] p-4 hover:border-[color:var(--c-414258)] transition-colors">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--c-8a8b9e)] flex items-center gap-1.5"><I className="w-3.5 h-3.5" />{titulo}</p>
      <p className={`text-2xl font-bold mt-2 ${tono || 'text-[color:var(--c-e0e0ec)]'}`}>{valor}</p>
      <p className="text-xs text-[color:var(--c-8a8b9e)] mt-0.5 truncate">{detalle}</p>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--c-e0e0ec)]">{saludo}, {nombre.split(' ')[0]}</h1>
        <p className="text-sm text-[color:var(--c-8a8b9e)]">{new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())} · {datos.grupos.length} materia{datos.grupos.length === 1 ? '' : 's'}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta icono={CalendarDays} titulo="Próxima evaluación" valor={primera ? cuandoTexto(primera.fecha) : '—'} detalle={primera ? `${limpiar(primera.nombre)} · ${primera.materia}` : 'No tienes evaluaciones próximas'} onClick={primera ? () => abrir(primera) : () => onIr('calendario')} />
        <Tarjeta icono={Upload} titulo="Por entregar" valor={pendientes.length} detalle={atrasadas.length ? `${atrasadas.length} atrasada${atrasadas.length === 1 ? '' : 's'}` : 'Al día'} onClick={() => onIr('entregas')} tono={atrasadas.length ? 'text-red-300' : ''} />
        <Tarjeta icono={RotateCcw} titulo="Por corregir" valor={porCorregir.length} detalle={porCorregir.length ? 'Te devolvieron trabajos' : 'Nada por corregir'} onClick={() => onIr('entregas')} tono={porCorregir.length ? 'text-amber-300' : ''} />
        <Tarjeta icono={MessageSquare} titulo="Mensajes" valor={sinLeer} detalle={sinLeer ? 'Sin leer de tus profesores' : 'Estás al día'} onClick={() => onIr('mensajes')} tono={sinLeer ? 'text-[color:var(--c-a5b4fc)]' : ''} />
      </div>

      {/* Avisos que requieren acción */}
      {(porCorregir.length > 0 || atrasadas.length > 0) && (
        <div className="space-y-2">
          {porCorregir.map(e => (
            <button key={e.id} type="button" onClick={() => abrir(e)} className="w-full flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left hover:bg-amber-500/10">
              <RotateCcw className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span className="text-sm text-[color:var(--c-d0d0da)] flex-1 min-w-0"><b>Corrige «{limpiar(e.nombre)}»</b> <span className="text-[color:var(--c-8a8b9e)]">· {e.materia}</span>{e.entrega?.devolucion && <span className="block text-xs text-amber-200/90 truncate">{e.entrega.devolucion}</span>}</span>
              <ChevronRight className="w-4 h-4 text-[color:var(--c-8a8b9e)]" />
            </button>
          ))}
          {atrasadas.map(e => (
            <button key={e.id} type="button" onClick={() => abrir(e)} className="w-full flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-left hover:bg-red-500/10">
              <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="text-sm text-[color:var(--c-d0d0da)] flex-1 min-w-0"><b>Sin entregar: «{limpiar(e.nombre)}»</b> <span className="text-[color:var(--c-8a8b9e)]">· {e.materia} · venció {cuandoTexto(e.fecha)}</span></span>
              <ChevronRight className="w-4 h-4 text-[color:var(--c-8a8b9e)]" />
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        {/* Próximas evaluaciones */}
        <section className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-[color:var(--c-282a3f)]"><h2 className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Próximas evaluaciones</h2><button type="button" onClick={() => onIr('calendario')} className="text-xs text-[color:var(--c-c7d2fe)] hover:underline">Ver calendario</button></div>
          {proximas.length === 0 ? <p className="px-4 py-6 text-sm text-[color:var(--c-8a8b9e)]">No tienes evaluaciones próximas.</p> : (
            <ul className="divide-y divide-[color:var(--c-282a3f)]">
              {proximas.slice(0, 6).map(e => (
                <li key={e.id}><button type="button" onClick={() => abrir(e)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[color:var(--c-818cf8)]/[0.04]">
                  <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: colorDe(datos.grupos, e.grupo) }} />
                  <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{limpiar(e.nombre)}</span><span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">{e.materia}{e.peso ? ` · ${e.peso}%` : ''}</span></span>
                  <span className="text-right flex-shrink-0"><span className="block text-xs font-semibold text-[color:var(--c-c7d2fe)]">{cuandoTexto(e.fecha)}</span><span className="block text-[11px] text-[color:var(--c-6a6b7e)]">{e.fecha && fechaCorta(e.fecha)}</span></span>
                </button></li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          {/* Mis clases */}
          <section className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[color:var(--c-282a3f)]"><h2 className="text-sm font-semibold text-[color:var(--c-e0e0ec)]">Mis materias</h2><button type="button" onClick={() => onIr('notas')} className="text-xs text-[color:var(--c-c7d2fe)] hover:underline">Calificaciones</button></div>
            <ul className="divide-y divide-[color:var(--c-282a3f)]">
              {datos.grupos.map(g => (
                <li key={g.clave}><button type="button" onClick={() => onAbrir({ claseId: g.claseId, materiaId: g.materiaId, evaluacionId: '' })} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[color:var(--c-818cf8)]/[0.04]">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${colorDe(datos.grupos, g.clave)}22`, color: colorDe(datos.grupos, g.clave) }}><BookOpen className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-[color:var(--c-d0d0da)] truncate">{g.materia}</span><span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">Prof. {g.profesor} · Sección {g.seccion}</span></span>
                  <span className="text-right flex-shrink-0">{g.promedio != null ? <><span className={`block text-lg font-bold leading-none ${g.promedio >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{textoNota(g.promedio)}</span><span className="text-[10px] text-[color:var(--c-6a6b7e)]">promedio</span></> : <span className="text-[11px] text-[color:var(--c-6a6b7e)]">sin notas</span>}</span>
                </button></li>
              ))}
            </ul>
          </section>
          {/* Últimas notas */}
          {notas.length > 0 && (
            <section className="rounded-2xl border border-[color:var(--c-313248)] bg-[color:var(--c-1d1e2e)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[color:var(--c-282a3f)]"><h2 className="text-sm font-semibold text-[color:var(--c-e0e0ec)] flex items-center gap-1.5"><Award className="w-4 h-4 text-[color:var(--c-a5b4fc)]" />Últimas notas</h2></div>
              <ul className="divide-y divide-[color:var(--c-282a3f)]">
                {notas.map(e => (
                  <li key={e.id}><button type="button" onClick={() => abrir(e)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-[color:var(--c-818cf8)]/[0.04]">
                    <span className="flex-1 min-w-0"><span className="block text-sm text-[color:var(--c-d0d0da)] truncate">{limpiar(e.nombre)}</span><span className="block text-xs text-[color:var(--c-8a8b9e)] truncate">{e.materia}</span></span>
                    <span className={`text-lg font-bold ${e.nota!.puntaje >= 10 ? 'text-emerald-300' : 'text-red-300'}`}>{textoNota(e.nota!.puntaje)}<span className="text-xs font-normal text-[color:var(--c-6a6b7e)]">/20</span></span>
                  </button></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
