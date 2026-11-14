"use client";
import { useRef, useState } from "react";

const MAX_SIDE = 1600;
const TARGET = 3.5 * 1024 * 1024;

/** Selector de boleta: reduce las fotos grandes en el navegador para que suban rápido y quepan en el límite. */
export default function ReceiptInput() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  async function onChange() {
    const el = input.current;
    const f = el?.files?.[0];
    if (!el || !f) { setMsg(""); return; }
    if (f.type === "application/pdf") {
      setMsg(f.size > TARGET ? "El PDF supera los 4 MB: comprímelo o sube una foto." : "");
      return;
    }
    if (!f.type.startsWith("image/") || f.size < 600 * 1024) { setMsg(""); return; }
    try {
      setMsg("Optimizando foto…");
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let blob: Blob | null = null;
      for (let i = 0; i < 4; i++) {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
        if (blob && blob.size <= TARGET) break;
        quality -= 0.15;
      }
      if (!blob) throw new Error("sin blob");
      const out = new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(out);
      el.files = dt.files;
      setMsg(`Foto lista (${(out.size / 1024).toFixed(0)} KB)`);
    } catch {
      setMsg(f.size > TARGET ? "No se pudo reducir la foto: prueba con una más liviana." : "");
    }
  }

  return (
    <label className="block">
      <span className="label">Foto de la boleta (opcional)</span>
      <input ref={input} onChange={onChange} name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="input" />
      {msg && <span className="mt-1 block text-xs text-muted">{msg}</span>}
    </label>
  );
}
