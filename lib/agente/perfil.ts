// Perfil del agente según la materia activa.
// - "software": Ingeniería de Software y afines. Es el perfil de siempre: las instrucciones NO cambian.
// - "otra": cualquier otra materia (Soporte Técnico, Redes, Matemática…). Misma forma de trabajar,
//   pero con temas, clásicos y búsquedas de ESA materia.
// Si no se sabe la materia (vacía), se usa "software": lo peor que puede pasar es el comportamiento de siempre.

export type TipoPerfil = 'software' | 'otra'

const normal = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const SOFTWARE = /(software|soft\b|programaci|programador|algoritm|base(s)? de datos|bases? datos|desarrollo (web|movil|de (software|aplicaciones|sistemas|apps))|aplicaciones (web|moviles)|analisis (y diseno )?de sistemas|diseno de sistemas|sistemas de informacion|ingenieria de (software|sistemas)|estructura(s)? de datos|lenguaje(s)? de programacion|\bweb\b|\bmovil|frontend|backend|full ?stack|devops|\bpoo\b|orientad[ao] a objetos|calidad de software|pruebas de software|testing|arquitectura de software|ingenieria web|\bapis?\b|computacion en la nube|cloud)/

export function tipoPerfil(materia?: string | null): TipoPerfil {
  const m = normal(materia || '')
  if (!m) return 'software'
  return SOFTWARE.test(m) ? 'software' : 'otra'
}

// Bloque que se agrega al final de las instrucciones cuando la materia NO es de software.
// Va al final para que mande sobre las reglas de temas de Ingeniería de Software de más arriba.
export function adaptacionMateria(materia: string): string {
  return `

ADAPTACIÓN A LA MATERIA (manda sobre las reglas anteriores)
- La materia activa es «${materia}», NO Ingeniería de Software. Eres experta en evaluación universitaria y en «${materia}».
- Los ejemplos de software de estas instrucciones (UML, historias de usuario, Docker, Vercel, apps de citas…) solo muestran la FORMA de trabajar. Aplica esa misma forma a «${materia}»: nombres de contenido concretos, casos realistas de esta área, evaluaciones encadenadas y criterios con porcentaje.
- TEMAS ACTUALES: usa el bloque [ACTUALIDAD] con novedades reales de «${materia}» (equipos, herramientas, normas, prácticas, incidentes y tendencias de esta área). La IA y la automatización solo donde encajen de forma natural en «${materia}» (como herramienta de apoyo), nunca como tema forzado. NO apliques la regla de "la mitad del plan en IA".
- CLÁSICOS: los fundamentos atemporales de «${materia}» se enseñan como son; solo actualiza los casos y las herramientas.
- APLICACIÓN CONCRETA: los casos son situaciones reales de esta área (ej. en Soporte Técnico: diagnosticar una PC que no enciende en una oficina, mantenimiento preventivo del laboratorio de una escuela, configurar la red de un cibercafé), alcanzables en el tiempo de la evaluación.
- No conviertas las evaluaciones en proyectos de programación salvo que la materia o el profesor lo pidan.`
}
