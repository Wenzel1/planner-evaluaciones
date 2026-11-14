import type { MetadataRoute } from 'next';

// Manifiesto de la app instalable (PWA): permite "Instalar" en el teléfono o la computadora, con su ícono y sin la barra del navegador
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EvaPlanner · Planificador de Evaluaciones',
    short_name: 'EvaPlanner',
    description: 'Planifica, evalúa y organiza tus cursos. Para profesores y estudiantes.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#1b1c1d',
    theme_color: '#1b1c1d',
    icons: [
      { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
