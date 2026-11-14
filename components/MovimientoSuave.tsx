'use client';
// Transición por defecto de toda la app: corta y suave, sin "rebote" de resorte
// (framer-motion usa resortes cuando una animación no dice cómo moverse, p. ej. al reacomodar listas).
import { MotionConfig } from 'framer-motion';

export default function MovimientoSuave({ children }: { children: React.ReactNode }) {
  return <MotionConfig transition={{ duration: 0.16, ease: 'easeOut' }}>{children}</MotionConfig>;
}
