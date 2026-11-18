import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: "Pagos, gastos y la ficha del apoderado, sin Excel. Tesorería para cursos escolares en Chile.",
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: BRAND.name },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: BRAND.themeColor, width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
