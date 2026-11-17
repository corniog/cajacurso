"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { hasFeature, FEATURES } from "@/lib/features";
import { getStudentByToken } from "@/lib/public-data";
import { mpPreference, getCourseMpToken } from "@/lib/mp";
import { confirmContribution } from "@/lib/contributions";
import { appUrl } from "@/lib/course-data";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const refresh = (id: string) => revalidatePath(`/app/c/${id}`, "layout");
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos";
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

async function gate(courseId: string) {
  const a = await requireCourse(courseId, { write: true });
  if (!hasFeature(a.course, "contributions")) throw new Error(`"${FEATURES.contributions.label}" es parte del Plan Pro. Actívalo en Plan e integraciones o pídelo al administrador.`);
  return a;
}

/* ---------------- Tesorero ---------------- */
export async function saveTransferInfo(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const v = String(fd.get("transferInfo") ?? "").trim().slice(0, 500);
    await db.update(schema.courses).set({ transferInfo: v || null }).where(eq(schema.courses.id, courseId));
    refresh(courseId);
    return { ok: "Datos de transferencia guardados" };
  } catch (e) { return fail(e); }
}

export async function createContribution(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const p = z.object({
      title: z.string().trim().min(3, "Escribe para qué es el aporte (ej. Regalo de la profesora)").max(100),
      description: optText(300),
      amount: z.string().trim().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 100 && v <= 5_000_000), "El monto debe ser un entero desde $100 (o déjalo vacío)"),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((v) => v || null),
    }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.insert(schema.contributions).values({ ...p.data, courseId });
    refresh(courseId);
    return { ok: "Colecta creada. Los apoderados ya la ven en su ficha." };
  } catch (e) { return fail(e); }
}

export async function toggleContribution(courseId: string, id: string) {
  await gate(courseId);
  const [c] = await db.select().from(schema.contributions).where(and(eq(schema.contributions.id, id), eq(schema.contributions.courseId, courseId))).limit(1);
  if (c) await db.update(schema.contributions).set({ active: !c.active }).where(eq(schema.contributions.id, id));
  refresh(courseId);
}

export async function deleteContribution(courseId: string, id: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const [{ n }] = await db.select({ n: count() }).from(schema.contributionPayments).where(eq(schema.contributionPayments.contributionId, id));
    if (n > 0) return { error: "Esta colecta ya tiene aportes. Ciérrala (Ocultar) en vez de eliminarla, así se conserva el historial." };
    await db.delete(schema.contributions).where(and(eq(schema.contributions.id, id), eq(schema.contributions.courseId, courseId)));
    refresh(courseId);
    return { ok: "Colecta eliminada" };
  } catch (e) { return fail(e); }
}

export async function confirmContributionPayment(courseId: string, paymentId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const r = await confirmContribution(courseId, paymentId);
    refresh(courseId);
    return r === "ok" ? { ok: "Aporte confirmado y registrado como ingreso del curso" } : r === "ya" ? { error: "Ese aporte ya estaba confirmado" } : { error: "Aporte no encontrado" };
  } catch (e) { return fail(e); }
}

export async function rejectContributionPayment(courseId: string, paymentId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    await db.update(schema.contributionPayments).set({ status: "rejected" })
      .where(and(eq(schema.contributionPayments.id, paymentId), eq(schema.contributionPayments.courseId, courseId), eq(schema.contributionPayments.status, "pending")));
    refresh(courseId);
    return { ok: "Aporte rechazado (no se suma al curso)" };
  } catch (e) { return fail(e); }
}

/* ---------------- Apoderado (acceso por enlace/código de la ficha) ---------------- */
const MAX_PENDING = 5;

async function prepare(token: string, contributionId: string, fd: FormData) {
  const found = await getStudentByToken(token);
  if (!found) throw new Error("Ficha no encontrada");
  const { student, course } = found;
  if (!hasFeature(course, "contributions")) throw new Error("Los aportes no están disponibles en este curso.");
  const raw = z.object({
    concept: optText(100), note: optText(200),
    amount: z.coerce.number().int("Usa un monto entero en pesos").min(100, "El monto mínimo es $100").max(5_000_000, "Monto demasiado alto"),
  }).safeParse(Object.fromEntries(fd));
  if (!raw.success) throw new Error(firstIssue(raw.error));
  let concept = raw.data.concept;
  let cid: string | null = null;
  if (contributionId) {
    const [c] = await db.select().from(schema.contributions)
      .where(and(eq(schema.contributions.id, contributionId), eq(schema.contributions.courseId, course.id), eq(schema.contributions.active, true))).limit(1);
    if (!c) throw new Error("Esa colecta ya no está disponible");
    cid = c.id; concept = c.title;
  }
  if (!concept) throw new Error("Escribe para qué es tu aporte (ej. regalo, rifa, compra de materiales)");
  const [{ n }] = await db.select({ n: count() }).from(schema.contributionPayments)
    .where(and(eq(schema.contributionPayments.studentId, student.id), eq(schema.contributionPayments.status, "pending")));
  if (n >= MAX_PENDING) throw new Error("Tienes varios aportes esperando confirmación. Espera a que el tesorero los revise.");
  return { student, course, cid, concept, amount: raw.data.amount, note: raw.data.note };
}

/** "Ya transferí": queda pendiente hasta que el tesorero lo confirme. */
export async function reportTransfer(token: string, contributionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const p = await prepare(token, contributionId, fd);
    await db.insert(schema.contributionPayments).values({
      courseId: p.course.id, contributionId: p.cid, studentId: p.student.id, concept: p.concept, amount: p.amount, method: "transferencia", note: p.note,
    });
    revalidatePath(`/f/${token}`);
    return { ok: "¡Gracias! Avisamos al tesorero. Cuando confirme tu transferencia aparecerá como confirmada aquí." };
  } catch (e) { return fail(e); }
}

/** Pago en línea por Mercado Pago: se confirma solo cuando el pago es aprobado. */
export async function payContributionOnline(token: string, contributionId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let url: string | undefined;
  try {
    const p = await prepare(token, contributionId, fd);
    const mp = hasFeature(p.course, "mercadopago") ? await getCourseMpToken(p.course.id) : null;
    if (!mp) return { error: "El pago en línea no está disponible en este curso. Usa “Ya transferí”." };
    const [row] = await db.insert(schema.contributionPayments).values({
      courseId: p.course.id, contributionId: p.cid, studentId: p.student.id, concept: p.concept, amount: p.amount, method: "mercadopago", note: p.note,
    }).returning({ id: schema.contributionPayments.id });
    const res = await mpPreference(mp).create({
      body: {
        items: [{ id: "aporte", title: `${p.concept} · ${p.course.name}`, quantity: 1, unit_price: p.amount, currency_id: "CLP" }],
        external_reference: `c:${row.id}`,
        notification_url: `${appUrl()}/api/webhooks/mp/${p.course.id}`,
        back_urls: { success: `${appUrl()}/f/${token}?aporte=ok`, failure: `${appUrl()}/f/${token}?aporte=error`, pending: `${appUrl()}/f/${token}?aporte=pendiente` },
        auto_return: "approved",
      },
    });
    url = res.init_point;
  } catch (e) {
    if (e instanceof Error && /^NEXT_REDIRECT/.test(e.message)) throw e;
    console.error("[payContribution]", e instanceof Error ? e.message : e);
    return fail(e);
  }
  if (!url) return { error: "No se pudo iniciar el pago." };
  redirect(url);
}
