"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { extendPro } from "@/lib/plans";
import { PLANS } from "@/lib/brand";
import { FEATURE_KEYS } from "@/lib/features";
import { adminEmails } from "@/lib/admin";
import { hashPassword } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const refresh = () => { revalidatePath("/admin", "layout"); };
const uuid = z.string().uuid();
const note = z.string().trim().max(300).optional().transform((v) => v || null);

async function getCourse(courseId: string) {
  const [c] = await db.select().from(schema.courses).where(eq(schema.courses.id, uuid.parse(courseId))).limit(1);
  if (!c) throw new Error("Curso no encontrado");
  return c;
}

/** Suma días de Plan Pro a un curso (desde hoy o desde su vencimiento actual). */
export async function grantPro(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const p = z.object({ days: z.coerce.number().int().min(1, "Indica los días").max(3650), note }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    const c = await getCourse(courseId);
    const endsAt = extendPro(c, p.data.days);
    await db.update(schema.courses).set({ proUntil: endsAt }).where(eq(schema.courses.id, c.id));
    await db.insert(schema.subscriptions).values({
      courseId: c.id, plan: "manual", status: "active", amount: 0, method: "manual",
      note: p.data.note ?? `+${p.data.days} días (administrador)`, startsAt: new Date(), endsAt,
    });
    refresh();
    return { ok: `Plan Pro activo hasta el ${endsAt.toLocaleDateString("es-CL")}` };
  } catch (e) { return fail(e); }
}

/** Fija exactamente la fecha de término del Plan Pro. */
export async function setProUntil(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const p = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"), note }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    const c = await getCourse(courseId);
    const endsAt = new Date(`${p.data.date}T23:59:59-03:00`);
    if (Number.isNaN(endsAt.getTime())) return { error: "Fecha no válida" };
    await db.update(schema.courses).set({ proUntil: endsAt }).where(eq(schema.courses.id, c.id));
    await db.insert(schema.subscriptions).values({
      courseId: c.id, plan: "manual", status: "active", amount: 0, method: "manual",
      note: p.data.note ?? `Vigencia fijada al ${p.data.date}`, startsAt: new Date(), endsAt,
    });
    refresh();
    return { ok: `Vigencia fijada al ${endsAt.toLocaleDateString("es-CL")}` };
  } catch (e) { return fail(e); }
}

/** Quita el Plan Pro de inmediato (el curso vuelve a Gratis; no se borra ningún dato). */
export async function revokePro(courseId: string): Promise<ActionState> {
  try {
    await requireAdmin();
    const c = await getCourse(courseId);
    await db.update(schema.courses).set({ proUntil: null }).where(eq(schema.courses.id, c.id));
    await db.update(schema.subscriptions).set({ status: "cancelled" })
      .where(and(eq(schema.subscriptions.courseId, c.id), eq(schema.subscriptions.status, "active")));
    refresh();
    return { ok: "Plan Pro quitado. El curso vuelve al plan Gratis." };
  } catch (e) { return fail(e); }
}

/** Permite que el curso vuelva a usar la prueba gratuita de 30 días. */
export async function resetTrial(courseId: string): Promise<ActionState> {
  try {
    await requireAdmin();
    const c = await getCourse(courseId);
    await db.update(schema.courses).set({ proTrialUsed: false }).where(eq(schema.courses.id, c.id));
    refresh();
    return { ok: "La prueba gratuita vuelve a estar disponible para este curso" };
  } catch (e) { return fail(e); }
}

/** Aprueba una solicitud por transferencia: activa el plan solicitado. */
export async function approveRequest(subId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const p = z.object({ amount: z.coerce.number().int().min(0).max(10_000_000), note }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Monto no válido" };
    const [sub] = await db.select().from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.id, uuid.parse(subId)), eq(schema.subscriptions.status, "pending"))).limit(1);
    if (!sub || (sub.plan !== "monthly" && sub.plan !== "annual")) return { error: "La solicitud ya no está pendiente" };
    const c = await getCourse(sub.courseId);
    const endsAt = extendPro(c, PLANS[sub.plan].days);
    await db.update(schema.courses).set({ proUntil: endsAt }).where(eq(schema.courses.id, c.id));
    await db.update(schema.subscriptions).set({
      status: "active", amount: p.data.amount, method: "transferencia", startsAt: new Date(), endsAt,
      note: [sub.note, p.data.note && `Admin: ${p.data.note}`].filter(Boolean).join(" · ") || null,
    }).where(eq(schema.subscriptions.id, sub.id));
    refresh();
    return { ok: `Aprobado: Pro activo hasta el ${endsAt.toLocaleDateString("es-CL")}` };
  } catch (e) { return fail(e); }
}

export async function rejectRequest(subId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const n = z.object({ note }).safeParse(Object.fromEntries(fd));
    const [sub] = await db.select().from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.id, uuid.parse(subId)), eq(schema.subscriptions.status, "pending"))).limit(1);
    if (!sub) return { error: "La solicitud ya no está pendiente" };
    await db.update(schema.subscriptions).set({
      status: "cancelled",
      note: [sub.note, n.success && n.data.note && `Rechazada: ${n.data.note}`].filter(Boolean).join(" · ") || "Rechazada",
    }).where(eq(schema.subscriptions.id, sub.id));
    refresh();
    return { ok: "Solicitud rechazada" };
  } catch (e) { return fail(e); }
}

/** Activa o desactiva funciones sueltas de un curso, sin importar el plan. Valores: "plan" (según el plan), "on" o "off". */
export async function setFeatures(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const c = await getCourse(courseId);
    const features: Record<string, boolean> = {};
    for (const k of FEATURE_KEYS) {
      const v = String(fd.get(k) ?? "plan");
      if (v === "on") features[k] = true;
      else if (v === "off") features[k] = false;
    }
    await db.update(schema.courses).set({ features }).where(eq(schema.courses.id, c.id));
    refresh();
    revalidatePath(`/app/c/${c.id}`, "layout");
    const on = Object.values(features).filter(Boolean).length, off = Object.values(features).filter((x) => !x).length;
    return { ok: `Funciones guardadas (${on} activadas a mano, ${off} desactivadas)` };
  } catch (e) { return fail(e); }
}

/* ---------------- Usuarios (superusuario) ---------------- */
const isSelfOrAdmin = (email: string, me: string) => email === me || adminEmails().includes(email.toLowerCase());

async function getUserRow(userId: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, uuid.parse(userId))).limit(1);
  if (!u) throw new Error("Usuario no encontrado");
  return u;
}

export async function updateUserAdmin(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const p = z.object({ name: z.string().trim().min(2, "El nombre es muy corto").max(80), email: z.string().trim().toLowerCase().email("Correo no válido") }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    const u = await getUserRow(userId);
    if (p.data.email !== u.email) {
      if (adminEmails().includes(u.email.toLowerCase())) return { error: "No se puede cambiar el correo de un administrador (se define en ADMIN_EMAILS)" };
      const [dup] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, p.data.email)).limit(1);
      if (dup) return { error: "Ya existe otro usuario con ese correo" };
    }
    await db.update(schema.users).set(p.data).where(eq(schema.users.id, u.id));
    refresh();
    return { ok: "Usuario actualizado" };
  } catch (e) { return fail(e); }
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<ActionState> {
  try {
    const me = await requireAdmin();
    const u = await getUserRow(userId);
    if (disabled && isSelfOrAdmin(u.email, me.email)) return { error: "No puedes suspender a un administrador" };
    await db.update(schema.users).set({ disabled }).where(eq(schema.users.id, u.id));
    refresh();
    return { ok: disabled ? "Cuenta suspendida: no podrá iniciar sesión" : "Cuenta reactivada" };
  } catch (e) { return fail(e); }
}

/** Genera una contraseña temporal (se muestra una sola vez al administrador). */
export async function resetUserPassword(userId: string): Promise<ActionState> {
  try {
    await requireAdmin();
    const u = await getUserRow(userId);
    const temp = randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8) + "7a";
    await db.update(schema.users).set({ passwordHash: await hashPassword(temp) }).where(eq(schema.users.id, u.id));
    refresh();
    return { ok: `Contraseña temporal: ${temp} (cópiala ahora; pídele que la cambie)` };
  } catch (e) { return fail(e); }
}

export async function deleteUserAdmin(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await requireAdmin();
    const u = await getUserRow(userId);
    if (isSelfOrAdmin(u.email, me.email)) return { error: "No puedes eliminar a un administrador" };
    if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== u.email) return { error: "Escribe el correo del usuario para confirmar" };
    await db.delete(schema.users).where(eq(schema.users.id, u.id)); // borra también sus cursos y datos (cascada)
    refresh();
    return { ok: "Usuario eliminado junto con sus cursos" };
  } catch (e) { return fail(e); }
}

export async function deleteCourseAdmin(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const c = await getCourse(courseId);
    if (String(fd.get("confirm") ?? "").trim() !== c.name) return { error: `Escribe el nombre del curso (${c.name}) para confirmar` };
    await db.delete(schema.courses).where(eq(schema.courses.id, c.id));
    refresh();
    return { ok: "Curso eliminado" };
  } catch (e) { return fail(e); }
}

/** Funciones para TODOS los cursos de un usuario (incluye los que cree después). Un ajuste a nivel de curso tiene prioridad. */
export async function setUserFeatures(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const u = await getUserRow(userId);
    const features: Record<string, boolean> = {};
    for (const k of FEATURE_KEYS) {
      const v = String(fd.get(k) ?? "plan");
      if (v === "on") features[k] = true;
      else if (v === "off") features[k] = false;
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ features }).where(eq(schema.users.id, u.id));
      await tx.update(schema.courses).set({ ownerFeatures: features }).where(eq(schema.courses.ownerId, u.id));
    });
    refresh();
    revalidatePath("/app", "layout");
    const on = Object.values(features).filter(Boolean).length, off = Object.values(features).filter((x) => !x).length;
    return { ok: `Funciones del usuario guardadas (${on} activadas, ${off} desactivadas) para todos sus cursos` };
  } catch (e) { return fail(e); }
}

/** Perfil Centro de padres: tipo de cuenta, colegio que puede auditar y activación (solo el administrador la decide). */
export async function setCenterProfile(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const u = await getUserRow(userId);
    if (adminEmails().includes(u.email.toLowerCase())) throw new Error("No aplica a administradores");
    const d = z.object({
      accountType: z.enum(["tesorero", "centro"]),
      centerSchool: z.string().trim().max(120).optional().transform((v) => v || null),
      centerEnabled: z.string().optional(),
    }).parse(Object.fromEntries(fd));
    if (d.accountType === "centro" && !d.centerSchool) throw new Error("Indica el colegio que podrá auditar este centro de padres");
    await db.update(schema.users).set({
      accountType: d.accountType, centerSchool: d.accountType === "centro" ? d.centerSchool : null,
      centerEnabled: d.accountType === "centro" && d.centerEnabled === "on",
    }).where(eq(schema.users.id, u.id));
    refresh();
    return { ok: d.accountType === "centro"
      ? (d.centerEnabled === "on" ? `Perfil Centro de padres ACTIVADO para ${d.centerSchool}` : "Perfil Centro de padres guardado, sin activar") : "Cuenta de tesorero" };
  } catch (e) { return fail(e); }
}
