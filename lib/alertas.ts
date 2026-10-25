// lib/alertas.ts
// Alertas de supervisión para ADMIN y SUPERADMIN: se calculan con los datos del resumen (no consultan la base de datos).

export interface AlertaEvaluacion { nombre: string; peso: number | null; fecha: string | null; grupoSeccion: string }
export interface AlertaMateria { nombre: string; evaluaciones: AlertaEvaluacion[]; observaciones?: { leida: boolean; createdAt: string }[] }
export interface AlertaUsuario { id: string; nombre: string; rol: string; activo: boolean; pendiente: boolean; totalMaterias: number; materias: AlertaMateria[] }

export type TipoAlerta = 'sinMaterias' | 'peso' | 'choque' | 'proxima' | 'observacion'
export interface Alerta { tipo: TipoAlerta; gravedad: 'alta' | 'media' | 'info'; usuario: string; usuarioId: string; texto: string; fecha?: string }

const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
const ORDEN = { alta: 0, media: 1, info: 2 }

export function calcularAlertas(usuarios: AlertaUsuario[], ahora: Date = new Date(), diasProximas = 14, diasObservacion = 3): Alerta[] {
  const alertas: Alerta[] = []
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const limite = new Date(inicioHoy.getTime() + diasProximas * 86400000)

  for (const u of usuarios) {
    if (u.pendiente || !u.activo) continue
    const base = { usuario: u.nombre, usuarioId: u.id }
    if (u.rol === 'USUARIO' && u.totalMaterias === 0) {
      alertas.push({ ...base, tipo: 'sinMaterias', gravedad: 'media', texto: 'Todavía no ha creado ninguna materia.' })
    }

    for (const m of u.materias) {
      // Los pesos y las fechas se revisan por sección (cada sección es un grupo distinto de estudiantes)
      const porSeccion = new Map<string, AlertaEvaluacion[]>()
      for (const ev of m.evaluaciones) {
        const sec = ev.grupoSeccion || 'A'
        porSeccion.set(sec, [...(porSeccion.get(sec) || []), ev])
      }
      for (const [sec, evs] of porSeccion) {
        const suma = evs.reduce((acc, e) => acc + (e.peso ?? 0), 0)
        if (suma !== 100) {
          alertas.push({ ...base, tipo: 'peso', gravedad: suma > 100 ? 'alta' : 'media',
            texto: `${m.nombre}, sección ${sec}: los pesos suman ${suma}% (${suma > 100 ? `sobran ${suma - 100}%` : `faltan ${100 - suma}%`}).` })
        }
        const dias = new Map<string, AlertaEvaluacion[]>()
        for (const ev of evs) {
          if (!ev.fecha) continue
          const d = new Date(ev.fecha)
          if (isNaN(d.getTime())) continue
          dias.set(claveDia(d), [...(dias.get(claveDia(d)) || []), ev])
        }
        for (const lista of dias.values()) {
          if (lista.length > 1) {
            alertas.push({ ...base, tipo: 'choque', gravedad: 'media', texto: `${m.nombre}, sección ${sec}: ${lista.length} evaluaciones el ${new Date(lista[0].fecha as string).toLocaleDateString()}.` })
          }
        }
      }

      for (const ev of m.evaluaciones) {
        if (!ev.fecha) continue
        const d = new Date(ev.fecha)
        if (!isNaN(d.getTime()) && d >= inicioHoy && d <= limite) {
          alertas.push({ ...base, tipo: 'proxima', gravedad: 'info', fecha: ev.fecha, texto: `${ev.nombre} · ${m.nombre}, sección ${ev.grupoSeccion || 'A'}` })
        }
      }

      for (const o of m.observaciones ?? []) {
        if (o.leida) continue
        const dias = Math.floor((ahora.getTime() - new Date(o.createdAt).getTime()) / 86400000)
        if (dias >= diasObservacion) alertas.push({ ...base, tipo: 'observacion', gravedad: 'media', texto: `Una observación sobre ${m.nombre} lleva ${dias} días sin leerse.` })
      }
    }
  }

  return alertas.sort((a, b) => ORDEN[a.gravedad] - ORDEN[b.gravedad] || (a.fecha && b.fecha ? new Date(a.fecha).getTime() - new Date(b.fecha).getTime() : 0))
}
