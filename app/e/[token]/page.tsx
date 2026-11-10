'use client';
// Página personal del estudiante por enlace: /e/<token>
import { useParams } from 'next/navigation';
import PortalVista from '@/components/PortalVista';

export default function PaginaPortal() {
  const { token } = useParams<{ token: string }>();
  return <PortalVista token={token} />;
}
