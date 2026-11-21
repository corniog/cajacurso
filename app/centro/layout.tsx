import Link from "next/link";
import Logo from "@/components/Logo";
import { requireCenter } from "@/lib/center";
import { logout } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centro de padres" };

export default async function CenterLayout({ children }: LayoutProps<"/centro">) {
  const user = await requireCenter();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo href="/centro" />
          <div className="flex items-center gap-3">
            <span className="badge hidden bg-blue-100 text-blue-800 sm:inline-flex">🏛️ Centro de padres · solo lectura</span>
            <span className="hidden text-sm text-muted md:inline">{user.name}</span>
            <form action={logout}><button className="btn-ghost !py-1.5">Salir</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
      <footer className="no-print py-4 text-center text-xs text-muted"><Link href="/ayuda">Ayuda</Link></footer>
    </div>
  );
}
