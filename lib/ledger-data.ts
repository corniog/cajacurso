import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course } from "@/lib/db/schema";
import { loadCourseData } from "@/lib/course-data";
import { buildLedger, reconcile } from "@/lib/ledger";

export async function loadLedger(course: Course) {
  const data = await loadCourseData(course);
  const [evs, aportes, audit, [owner]] = await Promise.all([
    db.select({ x: schema.events.extraIncomeId }).from(schema.events).where(eq(schema.events.courseId, course.id)),
    db.select({ x: schema.contributionPayments.extraIncomeId }).from(schema.contributionPayments).where(eq(schema.contributionPayments.courseId, course.id)),
    db.select().from(schema.ledgerAudit).where(eq(schema.ledgerAudit.courseId, course.id)).orderBy(desc(schema.ledgerAudit.createdAt)),
    db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, course.ownerId)).limit(1),
  ]);
  const locked = new Map<string, string>();
  for (const e of evs) if (e.x) locked.set(e.x, "Viene de un evento cerrado: reábrelo en Ventas para eventos para corregirlo");
  for (const a of aportes) if (a.x) locked.set(a.x, "Viene de un aporte confirmado: se gestiona en Aportes y colectas");
  const { entries, totals } = buildLedger(course, data.students, data.payments, data.extras, data.expenses, locked);
  const rec = reconcile(totals, data.summary);
  return { ...data, entries, totals, rec, audit, treasurer: owner?.name ?? "" };
}
