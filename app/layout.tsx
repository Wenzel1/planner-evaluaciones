// app/layout.tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css'; // Asegúrate de que este archivo exista con las directivas de Tailwind v3

export const metadata: Metadata = {
  title: 'Planificador de Evaluaciones',
  description: 'Sistema inteligente de planificación de evaluaciones',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Solo tema oscuro: si alguien tenía guardado el claro, se olvida */}
        <script dangerouslySetInnerHTML={{ __html: "try{localStorage.removeItem('tema');document.documentElement.classList.remove('claro')}catch(e){}" }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}