import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor autocontenido solo para Docker (en Vercel se deja el modo normal)
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  // pdfkit lee sus fuentes desde disco: no debe empaquetarse
  serverExternalPackages: ["pdfkit"],
  experimental: {
    // Las boletas se comprimen en el navegador; este margen cubre PDF y fotos ya livianas
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
