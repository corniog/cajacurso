import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, Student } from "@/lib/db/schema";
import { appUrl } from "@/lib/course-data";
import { clp, MONTH_NAMES } from "@/lib/finance";
import { esc, layout, sendMail, mailConfigured } from "@/lib/mail";
import { isPro } from "@/lib/plans";
import { studentStatementPdf, statementFileName } from "@/lib/statement";

type Kind = "reminder" | "statement" | "payment";

/** Envía al apoderado un correo con el estado de cuenta en PDF adjunto. Devuelve false si no pudo enviarse. */
export async function sendStatementEmail(course: Course, student: Student, kind: Kind, extra?: { amount: number; months: number[] }): Promise<boolean> {
  if (!student.guardianEmail) return false;
  const { pdf, debt } = await studentStatementPdf(course, student);
  const link = `${appUrl()}/f/${student.token}`;
  const hello = `<p>Hola${student.guardianName ? " " + esc(student.guardianName.split(" ")[0]) : ""},</p>`;
  const button = `<p><a href="${link}" style="background:#1f6f5c;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;display:inline-block">Ver mi ficha en línea</a></p>
    <p style="color:#5d6b67;font-size:13px">Adjuntamos tu estado de cuenta en PDF.</p>`;

  let subject: string, title: string, body: string;
  if (kind === "payment" && extra) {
    subject = `Pago recibido · ${course.name}`;
    title = "Registramos tu pago";
    body = `${hello}<p>Registramos un pago de <b>${clp(extra.amount)}</b> por ${esc(student.firstName)} (${extra.months.map((m) => MONTH_NAMES[m - 1]).join(", ")}). ${debt > 0 ? `Saldo vencido: <b>${clp(debt)}</b>.` : "Quedas al día. ¡Gracias!"}</p>${button}`;
  } else if (kind === "reminder") {
    subject = `Recordatorio de cuotas · ${course.name}`;
    title = "Recordatorio de cuotas";
    body = `${hello}<p>Te recordamos que ${esc(student.firstName)} tiene cuotas pendientes en el curso <b>${esc(course.name)}</b> por <b>${clp(debt)}</b>.</p>${button}`;
  } else {
    subject = `Estado de cuenta · ${course.name}`;
    title = "Estado de cuenta";
    body = `${hello}<p>Te enviamos el estado de cuenta de ${esc(student.firstName)} en el curso <b>${esc(course.name)}</b>. ${debt > 0 ? `Deuda vencida: <b>${clp(debt)}</b>.` : "Está al día."}</p>${button}`;
  }
  return sendMail(student.guardianEmail, subject, layout(title, body), [
    { filename: statementFileName(student), content: pdf, contentType: "application/pdf" },
  ]);
}

async function activeStudents(courseId: string) {
  return db.select().from(schema.students).where(eq(schema.students.courseId, courseId))
    .orderBy(asc(schema.students.lastName), asc(schema.students.firstName));
}

/** Recordatorio a apoderados con deuda vencida (con PDF). Solo Plan Pro. */
export async function sendCourseReminders(course: Course): Promise<{ sent: number; skipped: number; configured: boolean }> {
  if (!isPro(course) || !mailConfigured()) return { sent: 0, skipped: 0, configured: mailConfigured() };
  let sent = 0, skipped = 0;
  for (const s of await activeStudents(course.id)) {
    if (!s.active) continue;
    const { debt } = await studentStatementPdf(course, s);
    if (debt <= 0) continue;
    if (!s.guardianEmail) { skipped++; continue; }
    if (await sendStatementEmail(course, s, "reminder")) sent++; else skipped++;
  }
  await db.update(schema.integrations).set({ lastReminderAt: new Date() }).where(eq(schema.integrations.courseId, course.id));
  return { sent, skipped, configured: true };
}

/** Estado de cuenta en PDF a todos los apoderados con correo, tengan o no deuda. Solo Plan Pro. */
export async function sendCourseStatements(course: Course): Promise<{ sent: number; skipped: number; configured: boolean }> {
  if (!isPro(course) || !mailConfigured()) return { sent: 0, skipped: 0, configured: mailConfigured() };
  let sent = 0, skipped = 0;
  for (const s of await activeStudents(course.id)) {
    if (!s.active) continue;
    if (!s.guardianEmail) { skipped++; continue; }
    if (await sendStatementEmail(course, s, "statement")) sent++; else skipped++;
  }
  return { sent, skipped, configured: true };
}

/** Aviso de pago recibido al apoderado, con PDF actualizado (Plan Pro). No bloquea el flujo si falla. */
export async function notifyPayment(course: Course, student: Student, amount: number, months: number[]) {
  try {
    if (!isPro(course) || !student.guardianEmail || !mailConfigured()) return;
    await sendStatementEmail(course, student, "payment", { amount, months });
  } catch (e) {
    console.error("[notifyPayment]", e instanceof Error ? e.message : e);
  }
}
