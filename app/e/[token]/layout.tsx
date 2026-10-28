import type { Metadata } from 'next'

// Página personal del estudiante: no debe aparecer en buscadores
export const metadata: Metadata = {
  title: 'Mi plan de evaluación',
  robots: { index: false, follow: false },
}

export default function LayoutPortal({ children }: { children: React.ReactNode }) {
  return children
}
