"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions/course";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
  onDone?: () => void;
  submitClassName?: string;
};

/** Formulario que ejecuta una acción del servidor y muestra el error o la confirmación. */
export default function ActionForm({ action, children, submit, className, resetOnSuccess = true, onDone, submitClassName = "btn" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onDone?.();
    }
  }, [state, resetOnSuccess, onDone]);
  return (
    <form ref={ref} action={formAction} className={className ?? "space-y-3"}>
      {children}
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
      <button className={submitClassName} disabled={pending}>{pending ? "Guardando…" : submit}</button>
    </form>
  );
}
