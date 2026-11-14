"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { extendPro } from "@/lib/plans";
import { PLANS } from "@/lib/brand";
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
