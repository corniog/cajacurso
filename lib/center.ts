import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, User } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { loadLedger } from "@/lib/ledger-data";
import { maskName } from "@/lib/util";

/** Compara colegios ignorando mayúsculas, tildes, puntuación y espacios repetidos. */
export const normSchool = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const sameSchool = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normSchool(a) !== "" && normSchool(a) === normSchool(b);

/** Exige una cuenta de Centro de padres (la activación por el administrador se revisa aparte con `centerEnabled`). */
export async function requireCenter(): Promise<User> {
  const user = await requireUser();
  if (user.accountType !== "centro") redirect("/app");
  return user;
}

export type CenterCourse = { course: Course; tesorero: string };

/** Curso agregado a la vista del centro, solo si el vínculo sigue vigente (código vigente, mismo colegio, perfil activo). */
export async function getCenterCourse(user: User, courseId: string): Promise<Course | null> {
  if (user.accountType !== "centro" || !user.centerEnabled || user.disabled) return null;
  const [row] = await db.select({ course: schema.courses, link: schema.centerLinks })
    .from(schema.centerLinks).innerJoin(schema.courses, eq(schema.centerLinks.courseId, schema.courses.id))
    .where(and(eq(schema.centerLinks.centerId, user.id), eq(schema.centerLinks.courseId, courseId))).limit(1);
  if (!row) return null;
  if (!row.course.auditCode || row.course.auditCode !== row.link.code) return null;
  if (!sameSchool(row.course.school, user.centerSchool)) return null;
  return row.course;
}

/** Todos los vínculos del centro, indicando si siguen vigentes y por qué no. */
export async function listCenterLinks(user: User) {
  const rows = await db.select({ course: schema.courses, link: schema.centerLinks })
    .from(schema.centerLinks).innerJoin(schema.courses, eq(schema.centerLinks.courseId, schema.courses.id))
    .where(eq(schema.centerLinks.centerId, user.id));
  return rows.map(({ course, link }) => {
    let reason: string | null = null;
    if (!course.auditCode) reason = "El tesorero desactivó el acceso";
    else if (course.auditCode !== link.code) reason = "El tesorero generó un código nuevo: pídelo y agrégalo otra vez";
    else if (!sameSchool(course.school, user.centerSchool)) reason = "El colegio del curso ya no coincide con el de tu centro";
    return { course, link, reason };
  }).sort((a, b) => a.course.name.localeCompare(b.course.name, "es", { numeric: true }));
}

/** Libro contable para auditoría: igual que el del tesorero, pero con los alumnos abreviados ("Matías S."). */
export async function loadCenterLedger(course: Course) {
  const d = await loadLedger(course);
  const entries = d.entries.map((e) => {
    if (e.entity !== "payment") return e;
    const i = e.concept.indexOf(" · ");
    return i < 0 ? e : { ...e, concept: `${e.concept.slice(0, i)} · ${maskName(e.concept.slice(i + 3))}` };
  });
  return { ...d, entries };
}
