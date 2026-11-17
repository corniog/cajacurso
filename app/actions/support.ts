"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { requireAdmin, adminEmails } from "@/lib/admin";
import { FEATURES, FEATURE_KEYS, type FeatureKey } from "@/lib/features";
import { sendMail, layout, esc } from "@/lib/mail";
import { appUrl } from "@/lib/course-data";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });

function notifyAdmins(subject: string, html: string) {
  const admins = adminEmails();
  if (admins.length) void sendMail(admins.join(","), subject, layout(subject, html + `<p><a href="${appUrl()}/admin/solicitudes">Abrir solicitudes</a></p>`));
}

/** El tesorero (dueño del curso) pide al administrador activar una función. */
export async function requestFeature(courseId: string, feature: FeatureKey, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course, user, role } = await requireCourse(courseId);
    if (role !== "owner") return { error: "Solo quien creó el curso puede enviar esta solicitud" };
    if (!FEATURE_KEYS.includes(feature)) return { error: "Función no válida" };
    const message = z.string().trim().max(300).safeParse(String(fd.get("message") ?? ""));
    if (!message.success) return { error: "El mensaje es demasiado largo (máx. 300 caracteres)" };
    const [dup] = await db.select({ id: schema.supportRequests.id }).from(schema.supportRequests).where(and(
      eq(schema.supportRequests.courseId, courseId), eq(schema.supportRequests.featureKey, feature), eq(schema.supportRequests.status, "pending"))).limit(1);
    if (dup) return { error: "Ya enviaste esta solicitud. El administrador la revisará pronto." };
    await db.insert(schema.supportRequests).values({ userId: user.id, courseId, kind: "feature", featureKey: feature, message: message.data || null });
    notifyAdmins(`Solicitud: ${FEATURES[feature].label} · ${course.name}`,
      `<p>${esc(user.name)} (${esc(user.email)}) pidió activar <b>${esc(FEATURES[feature].label)}</b> para <b>${esc(course.name)} ${course.year}</b> (${esc(course.school)}).</p>${message.data ? `<p>“${esc(message.data)}”</p>` : ""}`);
    revalidatePath(`/app/c/${courseId}`, "layout");
    return { ok: "Solicitud enviada. Te avisaremos cuando esté activa." };
  } catch (e) { return fail(e); }
}

/** Mensaje libre al administrador (consulta, problema, petición). */
export async function sendMessageToAdmin(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course, user } = await requireCourse(courseId);
    const m = z.string().trim().min(5, "Escribe tu mensaje").max(500, "Máximo 500 caracteres").safeParse(String(fd.get("message") ?? ""));
    if (!m.success) return { error: m.error.issues[0].message };
    await db.insert(schema.supportRequests).values({ userId: user.id, courseId, kind: "message", message: m.data });
    notifyAdmins(`Mensaje de ${user.name} · ${course.name}`, `<p>${esc(user.name)} (${esc(user.email)}) · ${esc(course.name)} ${course.year}:</p><p>${esc(m.data)}</p>`);
    revalidatePath(`/app/c/${courseId}`, "layout");
    return { ok: "Mensaje enviado al administrador." };
  } catch (e) { return fail(e); }
}

/* ---------------- Administrador ---------------- */
export async function resolveRequest(id: string, decision: "approved" | "rejected", _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const adminNote = z.string().trim().max(300).safeParse(String(fd.get("adminNote") ?? ""));
    if (!adminNote.success) return { error: "La respuesta es demasiado larga" };
    const [r] = await db.select().from(schema.supportRequests).where(eq(schema.supportRequests.id, z.string().uuid().parse(id))).limit(1);
    if (!r || r.status !== "pending") return { error: "La solicitud ya fue atendida" };
    if (decision === "approved" && r.kind === "feature" && r.courseId && r.featureKey && FEATURE_KEYS.includes(r.featureKey as FeatureKey)) {
      const [c] = await db.select().from(schema.courses).where(eq(schema.courses.id, r.courseId)).limit(1);
      if (c) await db.update(schema.courses).set({ features: { ...(c.features ?? {}), [r.featureKey]: true } }).where(eq(schema.courses.id, c.id));
    }
    await db.update(schema.supportRequests).set({ status: decision, adminNote: adminNote.data || null, resolvedAt: new Date() }).where(eq(schema.supportRequests.id, r.id));
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
    if (u) {
      const what = r.kind === "feature" && r.featureKey ? FEATURES[r.featureKey as FeatureKey]?.label ?? r.featureKey : "tu mensaje";
      void sendMail(u.email, decision === "approved" ? `Listo: ${what}` : `Sobre tu solicitud: ${what}`,
        layout("Respuesta del administrador", `<p>Hola ${esc(u.name)},</p><p>${decision === "approved" ? (r.kind === "feature" ? `Activamos <b>${esc(what)}</b> en tu curso.` : "Atendimos tu mensaje.") : `No pudimos aprobar <b>${esc(what)}</b> por ahora.`}</p>${adminNote.data ? `<p>${esc(adminNote.data)}</p>` : ""}<p><a href="${appUrl()}/app">Abrir CajaCurso</a></p>`));
    }
    revalidatePath("/admin", "layout");
    if (r.courseId) revalidatePath(`/app/c/${r.courseId}`, "layout");
    return { ok: decision === "approved" ? "Solicitud aprobada" : "Solicitud rechazada" };
  } catch (e) { return fail(e); }
}
