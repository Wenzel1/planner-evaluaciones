'use client';

import { memoriaPaneles } from '@/components/planificador/utilidades';
import { AlertCircle, CheckCircle, Copy, Download, ExternalLink, Eye, Filter, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, User, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiEstudiantes } from '@/lib/api';
import { csvAEstudiantes, plantillaCSV } from '@/lib/csvEstudiantes';
import { useEffect, useRef, useState } from 'react';
import { Estudiante } from '@/components/planificador/tipos';
import { Tooltip, VentanaFlotante } from '@/components/planificador/ui';
import { haceCuanto, inputBase, labelBase, olvidarCache, opcionesSeccion } from '@/components/planificador/utilidades';

export function EstudiantesPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('todos');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>(() => memoriaPaneles.estudiantes ?? []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [cargando, setCargando] = useState(() => !memoriaPaneles.estudiantes);
  useEffect(() => { if (!cargando) memoriaPaneles.estudiantes = estudiantes; }, [estudiantes, cargando]);
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{ creados: number; omitidos: { fila: number; motivo: string }[]; desplazamiento: number } | null>(null);
  const [errorImport, setErrorImport] = useState('');
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  // Estudiantes de prueba (correos @demo.planificador: la app nunca les envía nada)
  const [verPrueba, setVerPrueba] = useState(false);
  const [prueba, setPrueba] = useState({ cantidad: 12, grupo: 'A' });
  const [procesandoPrueba, setProcesandoPrueba] = useState(false);
  const esDePrueba = (e: { email?: string }) => String(e.email || '').toLowerCase().endsWith('@demo.planificador');
  // Solicitudes de estudiantes que se unieron con el código de clase (si la sección pide aprobación)
  const [solicitudes, setSolicitudes] = useState<{ id: string; nombre: string; email: string; grupo: string; solicitadoEn: string | null; materia?: { nombre: string } | null }[]>([]);
  const cargarSolicitudes = async () => { try { const r = await fetch('/api/estudiantes?estado=PENDIENTE', { cache: 'no-store' }); if (r.ok) setSolicitudes(await r.json()); } catch { /* sin conexión */ } };
  useEffect(() => { cargarSolicitudes(); const t = setInterval(cargarSolicitudes, 60000); return () => clearInterval(t); }, []);
  const responderSolicitud = async (cuerpo: { id?: string; todas?: boolean; accion: 'aceptar' | 'rechazar' }) => {
    const r = await fetch('/api/estudiantes/solicitudes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (!r.ok) { alert('No se pudo procesar la solicitud.'); return; }
    await Promise.all([cargarSolicitudes(), recargarEstudiantes()]); window.dispatchEvent(new Event('estudiantes-cambiaron'));
  };
  const crearPrueba = async () => {
    setProcesandoPrueba(true);
    try {
      const r = await fetch('/api/estudiantes/prueba', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prueba) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron crear.');
      await recargarEstudiantes(); window.dispatchEvent(new Event('estudiantes-cambiaron'));
      setVerPrueba(false);
    } catch (e: any) { alert(e.message); } finally { setProcesandoPrueba(false); }
  };
  const borrarPrueba = async () => {
    if (!window.confirm('¿Borrar todos los estudiantes de prueba (y sus notas de prueba)?')) return;
    setProcesandoPrueba(true);
    try {
      const r = await fetch('/api/estudiantes/prueba', { method: 'DELETE' });
      if (!r.ok) throw new Error('No se pudieron borrar.');
      await recargarEstudiantes(); window.dispatchEvent(new Event('estudiantes-cambiaron'));
      setVerPrueba(false);
    } catch (e: any) { alert(e.message); } finally { setProcesandoPrueba(false); }
  };

  // Estados para Agregar
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoGrupo, setNuevoGrupo] = useState('A');
  const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({});

  // Estados para Editar
  const [editando, setEditando] = useState<Estudiante | null>(null);
  const [erroresEdit, setErroresEdit] = useState<Record<string, string>>({});

  // Validaciones en tiempo real
      const validarCampo = (campo: string, valor: string) => {
    let error = '';
    if (campo === 'nombre' && (!valor || valor.trim().length < 3)) {
      error = 'Mínimo 3 caracteres.';
    }
    if (campo === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!valor || !emailRegex.test(valor)) error = 'Correo no válido (ej: juan@correo.com).';
    }
    if (campo === 'telefono') {
      const limpio = String(valor || '').replace(/[\s().-]/g, '');
      if (!limpio) return ''; // opcional: los avisos pueden ir por correo
      if (!/^\+?\d+$/.test(limpio)) error = 'Solo se permiten números (puede empezar con +).';
      else {
        // Venezuela: 0412/0414/0416/0422/0424/0426 o fijo 02XX; también +58 o 58 delante. Otro país: con + y 8 a 15 dígitos.
        const local = limpio.replace(/^\+?58/, '0');
        const esVenezolano = /^04(12|14|16|22|24|26)\d{7}$/.test(local) || /^02\d{9}$/.test(local) || /^02\d{8}$/.test(local);
        const esExtranjero = /^\+(?!58)\d{8,15}$/.test(limpio);
        if (!esVenezolano && !esExtranjero) error = 'Teléfono no válido. Ej: 04121234567, +584121234567 o 02123456789';
      }
    }
    return error;
  };

  const validarFormularioCompleto = (nombre: string, email: string, telefono: string) => {
    const err: Record<string, string> = {};
    const eNombre = validarCampo('nombre', nombre);
    const eEmail = validarCampo('email', email);
    const eTel = validarCampo('telefono', telefono);
    if (eNombre) err.nombre = eNombre;
    if (eEmail) err.email = eEmail;
    if (eTel) err.telefono = eTel;
    return err;
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await apiEstudiantes.listar();
        const mapeados = data.map((e: any) => ({ ...e, estado: e.estado.toLowerCase() }));
        setEstudiantes(mapeados);
      } catch (error) {
        console.error("Error cargando estudiantes", error);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const recargarEstudiantes = async () => {
    olvidarCache('/api/estudiantes');
    const data = await apiEstudiantes.listar();
    setEstudiantes(data.map((e: any) => ({ ...e, estado: e.estado.toLowerCase() })));
  };
  // El agente agregó, movió o retiró estudiantes: la lista se actualiza sola
  useEffect(() => {
    const alCambiar = () => { recargarEstudiantes().catch(() => {}); };
    window.addEventListener('estudiantes-cambiaron', alCambiar);
    return () => window.removeEventListener('estudiantes-cambiaron', alCambiar);
  }, []);

  // Importa estudiantes desde un archivo CSV (Excel → Guardar como → CSV). Máximo 500 por archivo.
  const importarArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    setResultadoImport(null); setErrorImport('');
    try {
      if (!/\.(csv|txt)$/i.test(archivo.name)) { setErrorImport('El archivo debe ser .csv. En Excel usa Guardar como → CSV.'); return; }
      const { estudiantes: filas, tieneEncabezado } = csvAEstudiantes(await archivo.text());
      if (filas.length === 0) { setErrorImport('El archivo está vacío.'); return; }
      setImportando(true);
      const r = await fetch('/api/estudiantes/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estudiantes: filas }) });
      const d = await r.json();
      if (!r.ok) { setErrorImport(d.error || 'No se pudo importar el archivo.'); return; }
      setResultadoImport({ creados: d.creados, omitidos: d.omitidos, desplazamiento: tieneEncabezado ? 1 : 0 });
      await recargarEstudiantes();
    } catch { setErrorImport('No se pudo leer o enviar el archivo.'); }
    finally { setImportando(false); if (inputArchivoRef.current) inputArchivoRef.current.value = ''; }
  };

  const descargarPlantilla = () => {
    const url = URL.createObjectURL(new Blob([plantillaCSV()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla-estudiantes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEstudiantes = estudiantes.filter(e => {
    const matchSearch = e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase()) || (e.telefono || '').includes(searchTerm);
    const matchFilter = filter === 'todos' || e.estado === filter;
    return matchSearch && matchFilter;
  });

  const totalEstudiantes = estudiantes.length;
  const totalActivos = estudiantes.filter(e => e.estado === 'activo').length;
  // Promedio (sobre 20) solo de quienes ya tienen notas; aprobado = 10 o más
  const calificados = estudiantes.filter(e => (e.notasCargadas ?? 0) > 0);
  const promedioGeneral = calificados.length > 0 ? calificados.reduce((acc, e) => acc + e.promedio, 0) / calificados.length : null;
  const aprobados = calificados.filter(e => e.promedio >= 10).length;
  const grupos = [...new Set(estudiantes.map(e => e.grupo))];

  const enviandoEstRef = useRef(false);
  const agregarEstudiante = async () => {
    if (enviandoEstRef.current) return;
    const errores = validarFormularioCompleto(nuevoNombre, nuevoEmail, nuevoTelefono);
    setErroresNuevo(errores);
    if (Object.keys(errores).length > 0) return;

    enviandoEstRef.current = true;
    try {
      await apiEstudiantes.crear({ nombre: nuevoNombre.trim(), email: nuevoEmail.trim(), telefono: nuevoTelefono.replace(/[\s().-]/g, ''), grupo: nuevoGrupo });
      setNuevoNombre(''); setNuevoEmail(''); setNuevoTelefono(''); setNuevoGrupo('A'); setErroresNuevo({});
      setShowAddModal(false);
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    } finally { enviandoEstRef.current = false; }
  };

  const actualizarEstudiante = async () => {
    if (!editando || enviandoEstRef.current) return;
    const errores = validarFormularioCompleto(editando.nombre, editando.email, editando.telefono);
    setErroresEdit(errores);
    if (Object.keys(errores).length > 0) return;

    enviandoEstRef.current = true;
    try {
      await apiEstudiantes.editar({
        id: editando.id, nombre: editando.nombre.trim(), email: editando.email.trim(),
        telefono: String(editando.telefono || '').replace(/[\s().-]/g, ''), grupo: editando.grupo, estado: editando.estado
      });
      setEditando(null); setErroresEdit({});
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    } finally { enviandoEstRef.current = false; }
  };

  // Página personal del estudiante (/e/<token>): ver, copiar o cambiar su enlace
  const [enlaceCopiado, setEnlaceCopiado] = useState<string | null>(null);
  const pedirEnlace = async (id: string, nuevo = false): Promise<string> => {
    const r = await fetch(`/api/estudiantes/${encodeURIComponent(id)}/enlace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevo }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) throw new Error(d.error || 'No se pudo obtener el enlace.');
    return d.url;
  };
  const abrirPagina = async (est: Estudiante) => {
    const ventana = window.open('', '_blank'); // se abre ya para que el navegador no la bloquee
    try { const url = `${await pedirEnlace(est.id)}?profesor=1`; if (ventana) ventana.location.href = url; else window.location.href = url; } // ?profesor=1: no cuenta como visita del estudiante
    catch (e: any) { ventana?.close(); alert(e.message); }
  };
  const copiarEnlace = async (est: Estudiante, nuevo = false) => {
    if (nuevo && !window.confirm(`Se creará un enlace nuevo para ${est.nombre} y el anterior dejará de funcionar. ¿Continuar?`)) return;
    try {
      const url = await pedirEnlace(est.id, nuevo);
      try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copia el enlace:', url); }
      setEnlaceCopiado(est.id); setTimeout(() => setEnlaceCopiado(prev => (prev === est.id ? null : prev)), 2000);
    } catch (e: any) { alert(e.message); }
  };

  const [confirmandoBorrar, setConfirmandoBorrar] = useState<string | null>(null);
  const eliminarEstudiante = async (id: string) => {
    if (confirmandoBorrar !== id) { setConfirmandoBorrar(id); setTimeout(() => setConfirmandoBorrar(prev => (prev === id ? null : prev)), 3000); return; }
    setConfirmandoBorrar(null);
    try {
      await apiEstudiantes.eliminar(id);
      await recargarEstudiantes();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (cargando) return <div className="text-center text-[color:var(--c-8a8b9e)] py-10">Cargando estudiantes...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[color:var(--c-d0d0da)] flex items-center gap-3"><Users className="w-6 h-6 text-[color:var(--c-818cf8)]" />Gestión de Estudiantes</h2>
          <p className="text-sm text-[color:var(--c-8a8b9e)] mt-1">{totalEstudiantes} estudiantes en {grupos.length} grupos{totalEstudiantes > 0 && <> · <span className="text-[color:var(--c-a5b4fc)]">{estudiantes.filter(e => e.portalUltimaVisita).length} de {totalEstudiantes} abrieron su página</span></>}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={inputArchivoRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => importarArchivo(e.target.files?.[0])} />
          <button onClick={descargarPlantilla} className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl hover:border-[color:var(--c-818cf8)]/40 transition-colors"><Download className="w-4 h-4" />Plantilla</button>
          <button data-tutorial="est-importar" onClick={() => inputArchivoRef.current?.click()} disabled={importando} className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl hover:border-[color:var(--c-818cf8)]/40 transition-colors disabled:opacity-60"><Upload className="w-4 h-4" />{importando ? 'Importando...' : 'Importar CSV'}</button>
          <button data-tutorial="est-prueba" onClick={() => setVerPrueba(true)} title="Crea estudiantes de ejemplo sin correo real para probar grupos, notas y la página del estudiante" className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--c-c7d2fe)] bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/30 rounded-xl hover:bg-[color:var(--c-818cf8)]/20 transition-colors"><Sparkles className="w-4 h-4" />Estudiantes de prueba</button>
          <motion.button data-tutorial="est-agregar" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-medium rounded-xl transition-all shadow-md"><Plus className="w-4 h-4" /> Agregar estudiante</motion.button>
          <AnimatePresence>
            {verPrueba && (
              <VentanaFlotante onCerrar={() => setVerPrueba(false)} ancho="max-w-md">
                <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><Sparkles className="w-5 h-5 text-[color:var(--c-818cf8)]" />Estudiantes de prueba</h3><button onClick={() => setVerPrueba(false)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] rounded-lg"><X className="w-5 h-5" /></button></div>
                  <p className="text-sm text-[color:var(--c-9a9bb0)] leading-relaxed">Crea estudiantes de ejemplo para probar evaluaciones en grupo, notas y su página personal. <strong className="text-[color:var(--c-c7d2fe)]">No tienen correo real: nunca se les envía nada.</strong> Para probar los correos, agrégate tú con tu propio correo.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelBase}>Cantidad</label><select value={prueba.cantidad} onChange={(e) => setPrueba({ ...prueba, cantidad: Number(e.target.value) })} className={inputBase}>{[4, 6, 8, 12, 16, 20, 30].map(n => <option key={n} value={n}>{n} estudiantes</option>)}</select></div>
                    <div><label className={labelBase}>Sección</label><select value={prueba.grupo} onChange={(e) => setPrueba({ ...prueba, grupo: e.target.value })} className={inputBase}>{opcionesSeccion(prueba.grupo, grupos as string[]).map(g => <option key={g} value={g}>Sección {g}</option>)}</select></div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    {estudiantes.some(esDePrueba) ? <button type="button" disabled={procesandoPrueba} onClick={borrarPrueba} className="text-xs text-red-300/80 hover:text-red-200 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Borrar los de prueba ({estudiantes.filter(esDePrueba).length})</button> : <span />}
                    <button type="button" disabled={procesandoPrueba} onClick={crearPrueba} className="px-4 py-2 bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-medium rounded-xl flex items-center gap-2 disabled:opacity-60">{procesandoPrueba ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}Crear</button>
                  </div>
                </div>
              </VentanaFlotante>
            )}
          </AnimatePresence>
        </div>
      </div>

      {solicitudes.length > 0 && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-amber-500/20">
            <span className="text-sm font-semibold text-amber-200">🙋 {solicitudes.length} solicitud{solicitudes.length === 1 ? '' : 'es'} para unirse a tu clase</span>
            <span className="text-[11px] text-[color:var(--c-8a8b9e)]">Usaron tu código de clase. Acéptalos para que aparezcan en tu lista.</span>
            {solicitudes.length > 1 && <button type="button" onClick={() => responderSolicitud({ todas: true, accion: 'aceptar' })} className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/25">Aceptar todas</button>}
          </div>
          <div className="divide-y divide-amber-500/10">
            {solicitudes.map(sol => (
              <div key={sol.id} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-medium text-[color:var(--c-e0e0ec)]">{sol.nombre}</p>
                  <p className="text-xs text-[color:var(--c-8a8b9e)]">{sol.email} · {sol.materia?.nombre ? `${sol.materia.nombre} · ` : ''}Sección {sol.grupo}{sol.solicitadoEn ? ` · ${new Date(sol.solicitadoEn).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}` : ''}</p>
                </div>
                <button type="button" onClick={() => responderSolicitud({ id: sol.id, accion: 'aceptar' })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/25">Aceptar</button>
                <button type="button" onClick={() => { if (window.confirm(`¿Rechazar la solicitud de ${sol.nombre}?`)) responderSolicitud({ id: sol.id, accion: 'rechazar' }); }} className="text-xs px-3 py-1.5 rounded-lg text-red-300/80 hover:text-red-200 hover:bg-red-500/10">Rechazar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorImport && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1">{errorImport}</span><button onClick={() => setErrorImport('')} className="text-red-300/70 hover:text-red-200"><X className="w-4 h-4" /></button></div>
      )}
      {resultadoImport && (
        <div className={`rounded-xl px-4 py-3 border text-sm ${resultadoImport.omitidos.length > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          <div className="flex items-start gap-2">
            {resultadoImport.omitidos.length > 0 ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-medium">Se importaron {resultadoImport.creados} estudiante(s){resultadoImport.omitidos.length > 0 ? ` y se omitieron ${resultadoImport.omitidos.length}.` : '.'}</p>
              {resultadoImport.omitidos.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-200/90">
                  {resultadoImport.omitidos.slice(0, 10).map(o => (<li key={o.fila}>Fila {o.fila + resultadoImport.desplazamiento}: {o.motivo}</li>))}
                  {resultadoImport.omitidos.length > 10 && <li>... y {resultadoImport.omitidos.length - 10} más.</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setResultadoImport(null)} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-3"><div className="flex items-center gap-3"><Search className="w-4 h-4 text-[color:var(--c-8a8b9e)]" /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-transparent text-[color:var(--c-d8d8e2)] placeholder-[color:var(--c-6a6b7e)] outline-none text-sm" /></div></div>
        <div className="flex items-center gap-2 bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl px-3 py-2"><Filter className="w-4 h-4 text-[color:var(--c-8a8b9e)]" /><select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-transparent text-[color:var(--c-d8d8e2)] text-sm outline-none"><option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-3 text-center"><p className="text-xs text-[color:var(--c-8a8b9e)]">Total</p><p className="text-lg font-bold text-[color:var(--c-d0d0da)]">{totalEstudiantes}</p></div>
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-3 text-center"><p className="text-xs text-[color:var(--c-8a8b9e)]">Activos</p><p className="text-lg font-bold text-emerald-400">{totalActivos}</p></div>
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-3 text-center"><p className="text-xs text-[color:var(--c-8a8b9e)]">Promedio</p><p className="text-lg font-bold text-[color:var(--c-818cf8)]">{promedioGeneral == null ? '—' : `${promedioGeneral.toFixed(1).replace('.', ',')}/20`}</p></div>
        <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl p-3 text-center"><p className="text-xs text-[color:var(--c-8a8b9e)]">Aprobados</p><p className="text-lg font-bold text-blue-400">{calificados.length === 0 ? '—' : `${aprobados} de ${calificados.length}`}</p></div>
      </div>

      <div className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[color:var(--c-8a8b9e)] border-b border-[color:var(--c-313248)] bg-[color:var(--c-191a26)]"><th className="py-3 px-4 font-medium">Nombre</th><th className="py-3 px-4 font-medium">Correo</th><th className="py-3 px-4 font-medium">Teléfono</th><th className="py-3 px-4 font-medium">Grupo</th><th className="py-3 px-4 font-medium text-center">Promedio</th><th className="py-3 px-4 font-medium">Su página</th><th className="py-3 px-4 font-medium">Estado</th><th className="py-3 px-4 font-medium text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-[color:var(--c-313248)]">
              {filteredEstudiantes.map(est => (
                <tr key={est.id} className="hover:bg-[color:var(--c-272839)]/50 transition-colors">
                  <td className="py-3 px-4 text-[color:var(--c-d0d0da)] font-medium">{est.nombre}{(est as any).cuentaId && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 align-middle" title="Tiene su propia cuenta en el sistema">con cuenta</span>}{(est as any).materia?.nombre && <span className="block text-[11px] font-normal text-[color:var(--c-8a8b9e)]">{(est as any).materia.nombre}</span>}</td>
                  <td className="py-3 px-4 text-[color:var(--c-b0b0c4)]">{esDePrueba(est) ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--c-818cf8)]/10 border border-[color:var(--c-818cf8)]/30 text-[color:var(--c-a5b4fc)]" title="Estudiante de prueba: no recibe correos">de prueba · sin correo</span> : est.email}</td>
                  <td className="py-3 px-4 text-[color:var(--c-b0b0c4)]">{est.telefono}</td>
                  <td className="py-3 px-4"><span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[color:var(--c-818cf8)]/10 text-[color:var(--c-818cf8)] border border-[color:var(--c-818cf8)]/20">{est.grupo}</span></td>
                  <td className="py-3 px-4 text-center">{(est.notasCargadas ?? 0) > 0 ? (<span title={`Promedio ponderado de ${est.notasCargadas} evaluación(es)`} className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${est.promedio >= 10 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-red-500/10 text-red-300 border-red-500/25'}`}>{est.promedio.toFixed(1).replace('.', ',')}</span>) : <span className="text-[color:var(--c-6a6b7e)]">—</span>}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{est.portalUltimaVisita ? (<span title={`${est.portalVisitas || 1} visita(s)${est.portalPrimeraVisita ? ` · la abrió por primera vez el ${new Date(est.portalPrimeraVisita).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}` : ''}`} className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><Eye className="w-3.5 h-3.5" />{haceCuanto(est.portalUltimaVisita, Date.now())}{(est.portalVisitas || 0) > 1 && <span className="text-[color:var(--c-6a6b7e)]">· {est.portalVisitas}×</span>}</span>) : <span className="text-xs text-[color:var(--c-6a6b7e)]" title="Todavía no abre el enlace de su página">Sin abrir</span>}</td>
                  <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${est.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}><span className={`w-1.5 h-1.5 rounded-full ${est.estado === 'activo' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>{est.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip text="Ver su página personal"><button onClick={() => abrirPagina(est)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-818cf8)]/10 rounded-lg transition-all"><ExternalLink className="w-4 h-4" /></button></Tooltip>
                      <Tooltip text={enlaceCopiado === est.id ? '¡Copiado!' : 'Copiar su enlace'}><button onClick={() => copiarEnlace(est)} className={`p-1.5 rounded-lg transition-all ${enlaceCopiado === est.id ? 'text-emerald-400 bg-emerald-500/10' : 'text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-818cf8)]/10'}`}>{enlaceCopiado === est.id ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button></Tooltip>
                      <Tooltip text="Cambiar su enlace (el anterior deja de funcionar)"><button onClick={() => copiarEnlace(est, true)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-all"><RefreshCw className="w-4 h-4" /></button></Tooltip>
                      <Tooltip text="Editar"><button onClick={() => { setEditando({...est}); setErroresEdit({}); }} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-818cf8)] hover:bg-[color:var(--c-818cf8)]/10 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button></Tooltip>
                      {confirmandoBorrar === est.id ? (<button onClick={() => eliminarEstudiante(est.id)} className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 rounded-lg">¿Seguro?</button>) : (<Tooltip text="Eliminar"><button onClick={() => eliminarEstudiante(est.id)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button></Tooltip>)}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEstudiantes.length === 0 && (<tr><td colSpan={8} className="py-8 text-center text-[color:var(--c-8a8b9e)]">No hay estudiantes registrados</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL AGREGAR CON VALIDACIONES */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--c-0b0b12)]/75 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.14, ease: 'easeOut' }} className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><User className="w-5 h-5 text-[color:var(--c-818cf8)]" />Nuevo estudiante</h3><button onClick={() => setShowAddModal(false)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)] rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <div><label className={labelBase}>Nombre completo</label><input type="text" value={nuevoNombre} onChange={(e) => { setNuevoNombre(e.target.value); setErroresNuevo(p => ({...p, nombre: validarCampo('nombre', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.nombre ? 'border-red-500/50' : ''}`} placeholder="Ej: Juan Pérez" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') setShowAddModal(false); }} />{erroresNuevo.nombre && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.nombre}</p>}</div>
                <div><label className={labelBase}>Correo electrónico</label><input type="email" value={nuevoEmail} onChange={(e) => { setNuevoEmail(e.target.value); setErroresNuevo(p => ({...p, email: validarCampo('email', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.email ? 'border-red-500/50' : ''}`} placeholder="juan@email.com" />{erroresNuevo.email && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.email}</p>}</div>
                <div><label className={labelBase}>Teléfono</label><input type="tel" inputMode="numeric" value={nuevoTelefono} onChange={(e) => { setNuevoTelefono(e.target.value); setErroresNuevo(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresNuevo.telefono ? 'border-red-500/50' : ''}`} placeholder="04121234567" />{erroresNuevo.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresNuevo.telefono}</p>}</div>
                <div><label className={labelBase}>Grupo</label><select value={nuevoGrupo} onChange={(e) => setNuevoGrupo(e.target.value)} className={inputBase}>{opcionesSeccion(nuevoGrupo, grupos as string[]).map(g => <option key={g} value={g}>Grupo {g}</option>)}</select></div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] hover:bg-[color:var(--c-313248)] rounded-xl transition-colors">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={agregarEstudiante} className="px-5 py-2 bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-medium rounded-xl transition-all shadow-md flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL EDITAR CON VALIDACIONES */}
      <AnimatePresence>
        {editando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--c-0b0b12)]/75 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditando(null); }}>
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.14, ease: 'easeOut' }} className="bg-[color:var(--c-1f2035)] border border-[color:var(--c-313248)] rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-[color:var(--c-d0d0da)] flex items-center gap-2"><Pencil className="w-5 h-5 text-[color:var(--c-818cf8)]" />Editar estudiante</h3><button onClick={() => setEditando(null)} className="p-1.5 text-[color:var(--c-8a8b9e)] hover:text-[color:var(--c-d0d0da)] hover:bg-[color:var(--c-272839)] rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <div><label className={labelBase}>Nombre completo</label><input type="text" value={editando.nombre} onChange={(e) => { setEditando({...editando, nombre: e.target.value}); setErroresEdit(p => ({...p, nombre: validarCampo('nombre', e.target.value)})); }} className={`${inputBase} ${erroresEdit.nombre ? 'border-red-500/50' : ''}`} />{erroresEdit.nombre && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.nombre}</p>}</div>
                <div><label className={labelBase}>Correo electrónico</label><input type="email" value={editando.email} onChange={(e) => { setEditando({...editando, email: e.target.value}); setErroresEdit(p => ({...p, email: validarCampo('email', e.target.value)})); }} className={`${inputBase} ${erroresEdit.email ? 'border-red-500/50' : ''}`} />{erroresEdit.email && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.email}</p>}</div>
                <div><label className={labelBase}>Teléfono</label><input type="tel" inputMode="numeric" value={editando.telefono || ''} onChange={(e) => { setEditando({...editando, telefono: e.target.value}); setErroresEdit(p => ({...p, telefono: validarCampo('telefono', e.target.value)})); }} className={`${inputBase} ${erroresEdit.telefono ? 'border-red-500/50' : ''}`} />{erroresEdit.telefono && <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erroresEdit.telefono}</p>}</div>
                <div><label className={labelBase}>Grupo</label><select value={editando.grupo} onChange={(e) => setEditando({...editando, grupo: e.target.value})} className={inputBase}>{opcionesSeccion(editando.grupo, grupos as string[]).map(g => <option key={g} value={g}>Grupo {g}</option>)}</select></div>
                <div><label className={labelBase}>Estado</label><select value={editando.estado} onChange={(e) => setEditando({...editando, estado: e.target.value as any})} className={inputBase}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditando(null)} className="px-4 py-2 text-sm text-[color:var(--c-b0b0c4)] bg-[color:var(--c-272839)] hover:bg-[color:var(--c-313248)] rounded-xl transition-colors">Cancelar</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={actualizarEstudiante} className="px-5 py-2 bg-[color:var(--c-818cf8)] hover:bg-[color:var(--c-6366f1)] text-white text-sm font-medium rounded-xl transition-all shadow-md flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Actualizar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
