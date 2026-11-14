import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { STUDENT_CODE_RE } from "@/lib/util";

export async function getCourseByCode(raw: string) {
  let code: string;
  try { code = decodeURIComponent(raw).trim().toUpperCase(); } catch { return null; }
  if (!/^[A-Z0-9]{1,12}-[A-Z0-9]{6}$/.test(code)) return null;
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.code, code)).limit(1);
  return course ?? null;
}

/** Busca la ficha por enlace/QR (token largo) o por el código corto que el apoderado puede digitar. */
export async function getStudentByToken(raw: string) {
  let v: string;
  try { v = decodeURIComponent(raw).trim(); } catch { return null; }
  const byToken = /^[a-z0-9]{18}$/.test(v);
  const code = v.toUpperCase();
  const byCode = STUDENT_CODE_RE.test(code);
  if (!byToken && !byCode) return null;
  const [row] = await db.select({ student: schema.students, course: schema.courses })
    .from(schema.students).innerJoin(schema.courses, eq(schema.students.courseId, schema.courses.id))
    .where(byToken ? eq(schema.students.token, v) : eq(schema.students.shortCode, code)).limit(1);
  return row ?? null;
}

export async function getCourseByDirectiveCode(raw: string) {
  let code: string;
  try { code = decodeURIComponent(raw).trim().toUpperCase(); } catch { return null; }
  if (!/^DIR-[A-Z2-9]{12}$/.test(code)) return null;
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.directiveCode, code)).limit(1);
  return course ?? null;
}
