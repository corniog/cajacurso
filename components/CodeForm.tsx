"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";

/** Entrada del código del curso para apoderados. */
export default function CodeForm({ id = "code" }: { id?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = input.current?.value.trim().toUpperCase().replace(/\s+/g, "");
        if (!v) return;
        // DIR-… = directivos · 5+5 caracteres = alumno · otro = código del curso
        const enc = encodeURIComponent(v);
        router.push(v.startsWith("DIR-") ? `/d/${enc}` : /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(v) ? `/f/${enc}` : `/c/${enc}`);
      }}
    >
      <label htmlFor={id} className="sr-only">Código del curso</label>
      <input id={id} ref={input} className="input uppercase" placeholder="Código del curso o del alumno" autoComplete="off" required />
      <button className="btn shrink-0">Entrar</button>
    </form>
  );
}
