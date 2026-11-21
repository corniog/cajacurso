"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";
  const [tipo, setTipo] = useState<"tesorero" | "centro">("tesorero");
  return (
    <form action={action} className="card space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "Iniciar sesión" : "Crea tu cuenta gratis"}</h1>
      {!isLogin && (
        <fieldset className="space-y-2">
          <legend className="label">¿Qué tipo de cuenta necesitas?</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" name="accountType" value="tesorero" checked={tipo === "tesorero"} onChange={() => setTipo("tesorero")} className="mt-1" />
            <span><b>Soy tesorero de un curso</b><br /><span className="text-muted">Llevo las cuotas, gastos y reportes.</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" name="accountType" value="centro" checked={tipo === "centro"} onChange={() => setTipo("centro")} className="mt-1" />
            <span><b>Soy del centro de padres</b><br /><span className="text-muted">Quiero auditar los cursos de mi colegio. El administrador debe activar tu perfil.</span></span>
          </label>
        </fieldset>
      )}
      {!isLogin && tipo === "centro" && (
        <div>
          <label className="label" htmlFor="centerSchool">Colegio de tu centro de padres</label>
          <input id="centerSchool" name="centerSchool" className="input" placeholder="Ej: Colegio San Andrés" required minLength={3} />
          <p className="mt-1 text-xs text-muted">Escríbelo igual que lo escriben los tesoreros en sus cursos; solo podrás ver cursos de este colegio.</p>
        </div>
      )}
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
