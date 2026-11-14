"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";
  return (
    <form action={action} className="card space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "Iniciar sesión" : "Crea tu cuenta gratis"}</h1>
      {!isLogin && (
        <div>
          <label className="label" htmlFor="name">Tu nombre</label>
          <input id="name" name="name" className="input" autoComplete="name" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="input" minLength={isLogin ? undefined : 8}
          autoComplete={isLogin ? "current-password" : "new-password"} required />
        {!isLogin && <p className="mt-1 text-xs text-muted">Mínimo 8 caracteres.</p>}
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Un momento…" : isLogin ? "Entrar" : "Crear cuenta"}</button>
      <p className="text-center text-sm text-muted">
        {isLogin ? (
          <>¿No tienes cuenta? <Link href="/register" className="font-semibold text-brand">Regístrate</Link></>
        ) : (
          <>¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link></>
        )}
      </p>
    </form>
  );
}
