"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ITEMS = [
  { href: "", label: "Resumen", icon: "📊" },
  { href: "/alumnos", label: "Alumnos", icon: "👦" },
  { href: "/pagos", label: "Pagos", icon: "💰" },
  { href: "/gastos", label: "Gastos", icon: "🧾" },
  { href: "/extras", label: "Ingresos extra", icon: "🎟️" },
  { href: "/aportes", label: "Aportes y colectas", icon: "🤝" },
  { href: "/libro", label: "Libro contable", icon: "📒" },
  { href: "/eventos", label: "Ventas para eventos", icon: "🛒" },
  { href: "/reportes", label: "Reportes", icon: "📑" },
  { href: "/accesos", label: "Accesos y QR", icon: "🔑" },
  { href: "/plan", label: "Plan e integraciones", icon: "⭐" },
  { href: "/config", label: "Configuración", icon: "⚙️" },
];

export default function CourseNav({ courseId }: { courseId: string }) {
  const path = usePathname();
  // en celular, deja visible la sección activa dentro de la barra deslizable
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.querySelector("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [path]);
  const base = `/app/c/${courseId}`;
  return (
    <nav ref={ref} className="flex gap-1 overflow-x-auto border-y border-line bg-bg/95 px-4 py-2 backdrop-blur [scrollbar-width:none] md:static md:flex-col md:overflow-visible md:border-0 md:bg-transparent md:p-0" aria-label="Secciones del curso">
      {ITEMS.map((it) => {
        const href = base + it.href;
        const active = it.href === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={it.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand text-white" : "text-ink hover:bg-brand-soft"
            }`}
          >
            <span aria-hidden>{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
