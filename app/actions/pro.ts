"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { startTrial, isPro } from "@/lib/plans";
import { hasFeature, FEATURES, type FeatureKey } from "@/lib/features";
import { PLANS } from "@/lib/brand";
import { encrypt } from "@/lib/crypto";
import { mpPreference, platformMpConfigured, validateMpToken } from "@/lib/mp";
import { disconnectDrive } from "@/lib/drive";
import { sendCourseReminders, sendCourseStatements, sendStatementEmail } from "@/lib/reminders";
import { newDirectiveCode } from "@/lib/util";
import { adminEmails } from "@/lib/admin";
import { sendMail, layout, esc, mailConfigured } from "@/lib/mail";
import { appUrl } from "@/lib/course-data";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const refresh = (id: string) => revalidatePath(`/app/c/${id}`, "layout");

async function owner(courseId: string) {
  const a = await requireCourse(courseId, { write: true });
  if (a.role !== "owner") throw new Error("Solo quien creó el curso puede hacer esto");
  return a;
}
const noFeature = (f: FeatureKey) => new Error(`"${FEATURES[f].label}" es parte del Plan Pro. Actívalo en Plan e integraciones o pídelo al administrador.`);
async function writerPro(courseId: string, f: FeatureKey) {
  const a = await requireCourse(courseId, { write: true });
  if (!hasFeature(a.course, f)) throw noFeature(f);
  return a;
}
async function ownerPro(courseId: string, f: FeatureKey) {
  const a = await owner(courseId);
  if (!hasFeature(a.course, f)) throw noFeature(f);
  return a;
}

export async function startTrialAction(courseId: string): Promise<ActionState> {
  try {
    const { course } = await owner(courseId);
    if (isPro(course)) return { error: "Este curso ya tiene el Plan Pro activo" };
    const ok = await startTrial(course);
    if (!ok) return { error: "La prueba gratuita de este curso ya fue utilizada" };
    refresh(courseId);
    return { ok: `Plan Pro activado por ${PLANS.trialDays} días` };
  } catch (e) { return fail(e); }
}

/** Crea el cobro en Mercado Pago y redirige al checkout. */
export async function subscribe(courseId: string, plan: "monthly" | "annual"): Promise<ActionState> {
  let url: string | undefined;
  try {
    const { course } = await owner(courseId);
    if (!platformMpConfigured()) return { error: "El cobro en línea aún no está configurado en esta plataforma. Contacta al soporte." };
    const p = PLANS[plan];
    const [sub] = await db.insert(schema.subscriptions).values({
      courseId, plan, status: "pending", amount: p.price,
    }).returning({ id: schema.subscriptions.id });
    const res = await mpPreference(process.env.MP_PLATFORM_ACCESS_TOKEN!).create({
      body: {
        items: [{ id: plan, title: `${p.label} · ${course.name} ${course.year}`, quantity: 1, unit_price: p.price, currency_id: "CLP" }],
        external_reference: `s:${courseId}:${plan}:${sub.id}`,
        notification_url: `${appUrl()}/api/webhooks/mp/platform`,
        back_urls: { success: `${appUrl()}/app/c/${courseId}/plan?pago=ok`, failure: `${appUrl()}/app/c/${courseId}/plan?pago=error`, pending: `${appUrl()}/app/c/${courseId}/plan?pago=pendiente` },
        auto_return: "approved",
      },
    });
    url = res.init_point;
  } catch (e) { return fail(e); }
  if (!url) return { error: "No se pudo iniciar el pago. Inténtalo de nuevo." };
  redirect(url);
}

export async function saveMpToken(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await ownerPro(courseId, "mercadopago");
    const token = String(fd.get("token") ?? "").trim();
    if (token.length < 20) return { error: "Pega tu Access Token de producción de Mercado Pago" };
    const v = await validateMpToken(token);
    if (!v.ok) return { error: "Mercado Pago no reconoció ese token. Revisa que sea el Access Token de producción." };
    const values = { mpAccessToken: encrypt(token), mpRefreshToken: null, mpExpiresAt: null, mpUserId: null, updatedAt: new Date() };
    await db.insert(schema.integrations).values({ courseId, ...values })
      .onConflictDoUpdate({ target: schema.integrations.courseId, set: values });
    refresh(courseId);
    return { ok: `Mercado Pago conectado${v.nickname ? ` (${v.nickname})` : ""}` };
  } catch (e) { return fail(e); }
}

export async function removeMpToken(courseId: string) {
  await owner(courseId);
  await db.update(schema.integrations).set({ mpAccessToken: null, mpRefreshToken: null, mpExpiresAt: null, mpUserId: null, updatedAt: new Date() }).where(eq(schema.integrations.courseId, courseId));
  refresh(courseId);
}

export async function disconnectDriveAction(courseId: string) {
  await owner(courseId);
  await disconnectDrive(courseId);
  refresh(courseId);
}

export async function saveReminders(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await ownerPro(courseId, "reminders");
    const day = z.coerce.number().int().min(1).max(28).safeParse(fd.get("reminderDay"));
    if (!day.success) return { error: "Elige un día entre 1 y 28" };
    const values = { remindersEnabled: fd.get("enabled") === "on", reminderDay: day.data, updatedAt: new Date() };
    await db.insert(schema.integrations).values({ courseId, ...values })
      .onConflictDoUpdate({ target: schema.integrations.courseId, set: values });
    refresh(courseId);
    return { ok: "Recordatorios guardados" };
  } catch (e) { return fail(e); }
}

export async function sendRemindersNow(courseId: string): Promise<ActionState> {
  try {
    const { course } = await ownerPro(courseId, "reminders");
    const r = await sendCourseReminders(course);
    if (!r.configured) return { error: "El envío de correos no está configurado en esta plataforma (SMTP)." };
    refresh(courseId);
    return { ok: `Se enviaron ${r.sent} recordatorios${r.skipped ? ` (${r.skipped} apoderados sin correo o con error)` : ""}` };
  } catch (e) { return fail(e); }
}

export async function addMember(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course } = await ownerPro(courseId, "coTreasurer");
    const p = z.object({ email: z.string().trim().toLowerCase().email("Correo no válido") }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, p.data.email)).limit(1);
    if (!u) return { error: "Esa persona aún no tiene cuenta. Pídele que se registre primero y vuelve a agregarla." };
    if (u.id === course.ownerId) return { error: "Esa persona ya es la tesorera o tesorero principal" };
    const current = await db.select().from(schema.courseMembers).where(eq(schema.courseMembers.courseId, courseId));
    if (current.some((m) => m.userId !== u.id)) return { error: "Este curso ya tiene un co-tesorero. Quítalo primero para agregar a otra persona." };
    await db.insert(schema.courseMembers).values({ courseId, userId: u.id, role: "admin" })
      .onConflictDoUpdate({ target: [schema.courseMembers.courseId, schema.courseMembers.userId], set: { role: "admin" } });
    refresh(courseId);
    return { ok: `${u.name} ahora es co-tesorero(a) y puede registrar pagos y gastos` };
  } catch (e) { return fail(e); }
}

export async function removeMember(courseId: string, userId: string) {
  await owner(courseId);
  await db.delete(schema.courseMembers).where(and(eq(schema.courseMembers.courseId, courseId), eq(schema.courseMembers.userId, userId)));
  refresh(courseId);
}

/* ---- Estados de cuenta por correo (con PDF) ---- */

export async function sendStatementOne(courseId: string, studentId: string): Promise<ActionState> {
  try {
    const { course } = await writerPro(courseId, "email");
    if (!mailConfigured()) return { error: "El envío de correos no está configurado en esta plataforma (SMTP)." };
    const [st] = await db.select().from(schema.students)
      .where(and(eq(schema.students.id, studentId), eq(schema.students.courseId, courseId))).limit(1);
    if (!st) return { error: "Alumno no encontrado" };
    if (!st.guardianEmail) return { error: "Este alumno no tiene correo de apoderado registrado" };
    const ok = await sendStatementEmail(course, st, "statement");
    return ok ? { ok: `Estado de cuenta enviado a ${st.guardianEmail}` } : { error: "No se pudo enviar el correo. Revisa la configuración SMTP." };
  } catch (e) { return fail(e); }
}

export async function sendStatementsAll(courseId: string): Promise<ActionState> {
  try {
    const { course } = await writerPro(courseId, "email");
    const r = await sendCourseStatements(course);
    if (!r.configured) return { error: "El envío de correos no está configurado en esta plataforma (SMTP)." };
    return { ok: `Se enviaron ${r.sent} estados de cuenta${r.skipped ? ` (${r.skipped} apoderados sin correo o con error)` : ""}` };
  } catch (e) { return fail(e); }
}

/* ---- Acceso de solo lectura para directivos ---- */

export async function generateDirectiveCode(courseId: string): Promise<ActionState> {
  try {
    await requireCourse(courseId, { write: true });
    await db.update(schema.courses).set({ directiveCode: newDirectiveCode() }).where(eq(schema.courses.id, courseId));
    refresh(courseId);
    return { ok: "Código de directivos generado. Si había uno anterior, dejó de funcionar." };
  } catch (e) { return fail(e); }
}

export async function revokeDirectiveCode(courseId: string): Promise<ActionState> {
  try {
    await requireCourse(courseId, { write: true });
    await db.update(schema.courses).set({ directiveCode: null }).where(eq(schema.courses.id, courseId));
    refresh(courseId);
    return { ok: "Acceso de directivos desactivado" };
  } catch (e) { return fail(e); }
}

/* ---- Pago manual: el tesorero pide la activación y el administrador la aprueba ---- */

export async function requestManualPlan(courseId: string, plan: "monthly" | "annual", _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course, user } = await owner(courseId);
    const comment = String(fd.get("note") ?? "").trim().slice(0, 300);
    const [pending] = await db.select({ id: schema.subscriptions.id }).from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.courseId, courseId), eq(schema.subscriptions.status, "pending"), eq(schema.subscriptions.method, "transferencia"))).limit(1);
    if (pending) return { error: "Ya tienes una solicitud pendiente para este curso. El administrador la revisará pronto." };
    await db.insert(schema.subscriptions).values({
      courseId, plan, status: "pending", amount: PLANS[plan].price, method: "transferencia",
      note: comment ? `Tesorero: ${comment}` : null,
    });
    // Aviso por correo a los administradores (si hay SMTP); no bloquea la solicitud
    const admins = adminEmails();
    if (admins.length) {
      void sendMail(admins.join(","), `Solicitud de ${PLANS[plan].label} · ${course.name}`,
        layout("Nueva solicitud de plan", `<p>${esc(user.name)} (${esc(user.email)}) pidió activar <b>${esc(PLANS[plan].label)}</b> para <b>${esc(course.name)} ${course.year}</b> (${esc(course.school)}) por transferencia.</p>
        <p><a href="${appUrl()}/admin">Abrir panel de administración</a></p>`));
    }
    refresh(courseId);
    return { ok: "Solicitud enviada. Cuando confirmemos tu transferencia, el plan se activa." };
  } catch (e) { return fail(e); }
}

export async function cancelManualRequest(courseId: string) {
  await owner(courseId);
  await db.update(schema.subscriptions).set({ status: "cancelled", note: "Cancelada por el tesorero" })
    .where(and(eq(schema.subscriptions.courseId, courseId), eq(schema.subscriptions.status, "pending"), eq(schema.subscriptions.method, "transferencia")));
  refresh(courseId);
}
