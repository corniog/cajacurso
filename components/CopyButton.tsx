"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost !px-3 !py-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copia este texto:", text);
        }
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}
