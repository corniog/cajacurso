import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course } from "@/lib/db/schema";
import { loadCourseData } from "@/lib/course-data";
import { buildLedger, reconcile } from "@/lib/ledger";

export async function loadLedger(course: Course) {
  const data = await loadCourseData(course);
  const [evs, audit, [owner]] = await Promise.all([
    db.select({ x: schema.events.extraIncomeId }).from(schema.events).where(eq(schema.events.courseId, course.id)),
    db.select().from(schema.ledgerAudit).where(eq(schema.ledgerAudit.courseId, course.id)).orderBy(desc(schema.ledgerAudit.createdAt)),
    db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, course.ownerId)).limit(1),
  ]);
  const eventExtraIds = new Set(evs.map((e) => e.x).filter((x): x is string => !!x));
  const { entries, totals } = buildLedger(course, data.students, data.payments, data.extras, data.expenses, eventExtraIds);
  const rec = reconcile(totals, data.summary);
  return { ...data, entries, totals, rec, audit, treasurer: owner?.name ?? "" };
}
