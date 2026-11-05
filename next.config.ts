import type { NextConfig } from "next";

// La compilación revisa los tipos de TypeScript: si hay un error, el despliegue se detiene antes de publicar algo roto.
// exceljs (Acta y exportación a Excel) se usa tal cual en el servidor, sin empaquetarlo.
const nextConfig: NextConfig = { serverExternalPackages: ['exceljs'] };

export default nextConfig;
