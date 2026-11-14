import Link from "next/link";
import Logo from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export default function InfoPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/ayuda">Ayuda</Link><Link href="/login">Iniciar sesión</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {intro && <p className="mt-2 text-muted">{intro}</p>}
        </div>
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-3 px-4 py-5 text-sm text-muted">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/faq">Preguntas frecuentes</Link><Link href="/tutoriales">Tutoriales</Link>
            <Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link>
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
