import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, User } from "@/lib/db/schema";

const COOKIE = "cc_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días
const secretKey = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax", // protege contra CSRF en envíos desde otros sitios
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, String(payload.uid))).limit(1);
    return u && !u.disabled ? u : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export type Role = "owner" | "admin" | "viewer";
export type CourseAccess = { course: Course; role: Role; canWrite: boolean; user: User };

/** Verifica que el usuario pertenece al curso. Con `write` exige poder editar. */
export async function requireCourse(courseId: string, opts: { write?: boolean } = {}): Promise<CourseAccess> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) redirect("/app");
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)).limit(1);
  if (!course) redirect("/app");
  let role: Role | null = course.ownerId === user.id ? "owner" : null;
  if (!role) {
    const [m] = await db
      .select()
      .from(schema.courseMembers)
      .where(and(eq(schema.courseMembers.courseId, courseId), eq(schema.courseMembers.userId, user.id)))
      .limit(1);
    role = m?.role ?? null;
  }
  if (!role) redirect("/app");
  const canWrite = role !== "viewer";
  if (opts.write && !canWrite) throw new Error("Tu rol es de solo lectura en este curso");
  return { course, role, canWrite, user };
}

/** Límite de intentos de login: 5 fallos por correo+IP en 15 minutos. */
export async function loginKey(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${email.toLowerCase()}|${ip}`;
}
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function isLoginBlocked(key: string): Promise<boolean> {
  const [r] = await db.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).limit(1);
  if (!r) return false;
  if (Date.now() - r.windowStart.getTime() > WINDOW_MS) return false;
  return r.count >= MAX_ATTEMPTS;
}
export async function recordLoginFailure(key: string) {
  const [r] = await db.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).limit(1);
  if (!r || Date.now() - r.windowStart.getTime() > WINDOW_MS) {
    await db.insert(schema.loginAttempts).values({ key, count: 1, windowStart: new Date() })
      .onConflictDoUpdate({ target: schema.loginAttempts.key, set: { count: 1, windowStart: new Date() } });
  } else {
    await db.update(schema.loginAttempts).set({ count: r.count + 1 }).where(eq(schema.loginAttempts.key, key));
  }
}
export async function clearLoginFailures(key: string) {
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
}
