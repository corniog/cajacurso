"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Botón «Instalar app» (PWA). Solo aparece cuando el navegador permite instalar. */
export default function InstallButton({ className = "btn" }: { className?: string }) {
  const [ev, setEv] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEv(e as BIPEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed) return <p className="text-sm font-semibold text-emerald-700">✓ App instalada</p>;
  if (!ev) return <p className="text-sm text-muted">Si tu navegador lo permite, aquí aparecerá el botón para instalar. En iPhone: Compartir → «Agregar a pantalla de inicio».</p>;
  return (
    <button type="button" className={className} onClick={async () => { await ev.prompt(); await ev.userChoice; setEv(null); }}>
      📲 Instalar app en este dispositivo
    </button>
  );
}
