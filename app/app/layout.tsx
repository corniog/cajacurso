import Logo from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { isAdminEmail } from "@/lib/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  if (user.accountType === "centro") redirect("/centro");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo href="/app" />
          <div className="flex items-center gap-3">
            {isAdminEmail(user.email) && <Link href="/admin" className="btn-ghost !py-1.5">🛡️ Administración</Link>}
            <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
            <form action={logout}><button className="btn-ghost !py-1.5">Salir</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
