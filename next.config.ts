import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Permite cualquier subdominio de Supabase
      },
    ],
  },
  experimental: {
    serverActions: {
      // Las fotos viajan por Server Actions. Llegan comprimidas a ~1 MB, que
      // es justo el límite por defecto; 4 MB deja margen sin pasar el tope
      // de 4,5 MB que pone Vercel al cuerpo de una función.
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
