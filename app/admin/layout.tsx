import Link from "next/link";
import type { Metadata } from "next";
import Logo from "@/components/Logo";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };

const NAV = [["/admin", "Resumen"], ["/admin/solicitudes", "Solicitudes"], ["/admin/usuarios", "Usuarios"], ["/admin/cursos", "Cursos y planes"], ["/admin/historial", "Historial de pagos"]];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3"><Logo href="/app" /><span className="badge bg-purple-100 text-purple-800">Administración</span></div>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-muted sm:inline">{user.email}</span><Link href="/app" className="btn-ghost !py-1.5">Volver a mis cursos</Link></div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Administración">
          {NAV.map(([h, t]) => <Link key={h} href={h} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-brand-soft">{t}</Link>)}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6">{children}</div>
    </div>
  );
}
