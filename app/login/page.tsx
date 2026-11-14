import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  if (await getUser()) redirect("/app");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <AuthForm mode="login" />
    </main>
  );
}
