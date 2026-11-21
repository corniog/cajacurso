"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  hashPassword, verifyPassword, createSession, destroySession,
  loginKey, isLoginBlocked, recordLoginFailure, clearLoginFailures,
} from "@/lib/auth";

export type FormState = { error?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
  accountType: z.enum(["tesorero", "centro"]).default("tesorero"),
  centerSchool: z.string().trim().max(120).optional(),
});

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, accountType, centerSchool } = parsed.data;
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists) return { error: "Ese correo ya está registrado. Inicia sesión." };
  const [u] = await db.insert(schema.users).values({
    name, email, passwordHash: await hashPassword(password),
    accountType, centerSchool: accountType === "centro" ? (centerSchool || null) : null, // el centro queda pendiente hasta que el administrador lo active
  }).returning();
  await createSession(u.id);
  redirect(accountType === "centro" ? "/centro" : "/app");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y contraseña" };
  const key = await loginKey(email);
  if (await isLoginBlocked(key)) return { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  // Se compara siempre contra un hash para no revelar si el correo existe por tiempo de respuesta
  const ok = await verifyPassword(password, u?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok) {
    await recordLoginFailure(key);
    return { error: "Correo o contraseña incorrectos" };
  }
  if (u.disabled) return { error: "Tu cuenta está suspendida. Escribe al administrador de CajaCurso para reactivarla." };
  await clearLoginFailures(key);
  await createSession(u.id);
  redirect(u.accountType === "centro" ? "/centro" : "/app");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
