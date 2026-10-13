import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! ADVERTENCIA !!
    // Esto permite que la compilación de producción termine con éxito
    // incluso si tu proyecto tiene errores de TypeScript.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
