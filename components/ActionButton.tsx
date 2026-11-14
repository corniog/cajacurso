"use client";
import { useTransition } from "react";

/** Botón que ejecuta una acción del servidor (con confirmación opcional). */
export default function ActionButton({
  action, label, confirm, className = "btn-ghost",
}: { action: () => Promise<unknown>; label: string; confirm?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => { await action(); });
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
