"use client";
import { useState, useTransition } from "react";
import type { ActionState } from "@/app/actions/course";

/** Botón que ejecuta una acción y muestra su resultado (éxito o error) al lado. */
export default function ActionNotice({
  action, label, confirm, className = "btn-ghost !px-3 !py-1.5",
}: { action: () => Promise<ActionState>; label: string; confirm?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button" className={className} disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setMsg(undefined);
          start(async () => setMsg(await action()));
        }}
      >
        {pending ? "Enviando…" : label}
      </button>
      {msg?.error && <span role="alert" className="text-xs font-medium text-red-700">{msg.error}</span>}
      {msg?.ok && <span role="status" className="text-xs font-medium text-emerald-700">{msg.ok}</span>}
    </span>
  );
}
