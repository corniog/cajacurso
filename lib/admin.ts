import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { User } from "@/lib/db/schema";

/** Administradores: correos separados por coma en la variable ADMIN_EMAILS. */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const isAdminEmail = (email: string) => adminEmails().includes(email.trim().toLowerCase());

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!isAdminEmail(u.email)) redirect("/app");
  return u;
}
