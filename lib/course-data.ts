import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course } from "@/lib/db/schema";
import { buildRows, buildSummary } from "@/lib/finance";
import { newStudentCode } from "@/lib/util";

export async function loadCourseData(course: Course) {
  const [students, payments, expenses, extras] = await Promise.all([
    db.select().from(schema.students).where(eq(schema.students.courseId, course.id))
      .orderBy(asc(schema.students.lastName), asc(schema.students.firstName)),
    db.select().from(schema.payments).where(eq(schema.payments.courseId, course.id)).orderBy(desc(schema.payments.paidAt)),
    db.select().from(schema.expenses).where(eq(schema.expenses.courseId, course.id)).orderBy(desc(schema.expenses.date)),
    db.select().from(schema.extraIncomes).where(eq(schema.extraIncomes.courseId, course.id)).orderBy(desc(schema.extraIncomes.date)),
  ]);
  // Extras asignados a alumnos específicos se cuentan igual en el balance del curso
  const rows = buildRows(course, students, payments);
  const summary = buildSummary(course, rows, expenses, extras);
  return { course, students, payments, expenses, extras, rows, summary };
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Asigna código corto a alumnos antiguos que aún no lo tienen (migración perezosa). */
export async function ensureStudentCodes(courseId: string) {
  const missing = await db.select({ id: schema.students.id }).from(schema.students)
    .where(and(eq(schema.students.courseId, courseId), isNull(schema.students.shortCode)));
  for (const m of missing) {
    await db.update(schema.students).set({ shortCode: newStudentCode() }).where(eq(schema.students.id, m.id));
  }
}
