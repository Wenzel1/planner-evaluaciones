const API_BASE = '/api'

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error de conexión' }))
    throw new Error(error.error || `Error ${res.status}`)
  }

  return res.json()
}

export const apiMaterias = {
  listar: () => fetchAPI<any[]>('/materias'),
  crear: (data: { nombre: string; descripcion?: string; codigo?: string }) =>
    fetchAPI<any>('/materias', { method: 'POST', body: JSON.stringify(data) }),
}

export const apiPlanificaciones = {
  listar: (materiaId?: string) =>
    fetchAPI<any[]>(`/planificaciones${materiaId ? `?materiaId=${materiaId}` : ''}`),

  obtener: (id: string) => fetchAPI<any>(`/planificaciones/${id}`),

  crear: (data: any) =>
    fetchAPI<any>('/planificaciones', { method: 'POST', body: JSON.stringify(data) }),

  actualizar: (id: string, data: any) =>
    fetchAPI<any>(`/planificaciones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  eliminar: (id: string) =>
    fetchAPI<any>(`/planificaciones/${id}`, { method: 'DELETE' }),
}

export const apiEstudiantes = {
  listar: (params?: { grupo?: string; estado?: string; buscar?: string }) => {
    const sp = new URLSearchParams()
    if (params?.grupo) sp.set('grupo', params.grupo)
    if (params?.estado) sp.set('estado', params.estado)
    if (params?.buscar) sp.set('buscar', params.buscar)
    const query = sp.toString()
    return fetchAPI<any[]>(`/estudiantes${query ? `?${query}` : ''}`)
  },

  crear: (data: { nombre: string; email: string; telefono?: string; grupo?: string }) =>
    fetchAPI<any>('/estudiantes', { method: 'POST', body: JSON.stringify(data) }),

  eliminar: (id: string) =>
    fetchAPI<any>(`/estudiantes?id=${id}`, { method: 'DELETE' }), 
  editar: (data: { id: string; nombre: string; email: string; telefono?: string; grupo?: string; estado?: string }) =>
    fetchAPI<any>('/estudiantes', { method: 'PUT', body: JSON.stringify(data) }),
}

export const apiConversaciones = {
  crear: (data: { titulo?: string; planificacionId?: string; rol: string; contenido: string }) =>
    fetchAPI<any>('/conversaciones', { method: 'POST', body: JSON.stringify(data) }),

  agregarMensaje: (conversacionId: string, data: { rol: string; contenido: string; completo?: boolean }) =>
    fetchAPI<any>(`/conversaciones/${conversacionId}/mensajes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export const apiComentarios = {
  crear: (data: { tipo: string; mensaje: string; planificacionId?: string }) =>
    fetchAPI<any>('/comentarios', { method: 'POST', body: JSON.stringify(data) }),
}