import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} · Tesorería escolar`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: BRAND.themeColor,
    lang: "es-CL",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
