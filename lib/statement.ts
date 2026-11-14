import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, Student } from "@/lib/db/schema";
import { buildRows } from "@/lib/finance";
import { buildStudentPdf } from "@/lib/export";

/** Genera el PDF de estado de cuenta de un alumno con sus pagos actuales. */
export async function studentStatementPdf(course: Course, student: Student): Promise<{ pdf: Buffer; debt: number }> {
  const payments = await db.select().from(schema.payments).where(eq(schema.payments.studentId, student.id));
  const [row] = buildRows(course, [student], payments);
  const pdf = await buildStudentPdf(course, student, row, payments);
  return { pdf, debt: row.debt };
}

export const statementFileName = (s: Pick<Student, "firstName" | "lastName">) =>
  `estado-de-cuenta-${`${s.firstName}-${s.lastName}`.normalize("NFD").replace(/[^\w-]+/g, "_")}.pdf`;
