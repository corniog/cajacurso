"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { requireCenter, sameSchool } from "@/lib/center";
import { AUDIT_CODE_RE, newAuditCode } from "@/lib/util";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });

/** Centro de padres: agrega un curso a su vista con el código que le dio el tesorero. */
export async function linkCourseByCode(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireCenter();
    if (!user.centerEnabled) throw new Error("Tu perfil aún no está activado por el administrador");
    const code = String(fd.get("code") ?? "").trim().toUpperCase();
    if (!AUDIT_CODE_RE.test(code)) throw new Error("El código no es válido. Debe verse así: AUD-XXXXXXXXXXXX");
    const [course] = await db.select().from(schema.courses).where(eq(schema.courses.auditCode, code)).limit(1);
    if (!course) throw new Error("No encontramos un curso con ese código. Pídele al tesorero que lo genere o lo revise.");
    if (!sameSchool(course.school, user.centerSchool))
      throw new Error(`Ese curso pertenece a otro colegio ("${course.school}"). Tu centro de padres audita solo "${user.centerSchool ?? "—"}". Si hay un error en el nombre del colegio, avisa al administrador.`);
    await db.insert(schema.centerLinks).values({ centerId: user.id, courseId: course.id, code })
      .onConflictDoUpdate({ target: [schema.centerLinks.centerId, schema.centerLinks.courseId], set: { code } });
    revalidatePath("/centro");
    return { ok: `Curso agregado: ${course.name} · ${course.year}` };
  } catch (e) { return fail(e); }
}

export async function unlinkCourse(courseId: string): Promise<ActionState> {
  try {
    const user = await requireCenter();
    await db.delete(schema.centerLinks).where(and(eq(schema.centerLinks.centerId, user.id), eq(schema.centerLinks.courseId, z.string().uuid().parse(courseId))));
    revalidatePath("/centro");
    return { ok: "Curso quitado de tu vista" };
  } catch (e) { return fail(e); }
}

/** Tesorero: genera (o reemplaza) el código de auditoría. Al cambiarlo, los vínculos anteriores dejan de valer. */
export async function generateAuditCode(courseId: string): Promise<ActionState> {
  try {
    const { role } = await requireCourse(courseId, { write: true });
    if (role !== "owner") throw new Error("Solo el tesorero principal puede manejar este código");
    await db.update(schema.courses).set({ auditCode: newAuditCode() }).where(eq(schema.courses.id, courseId));
    revalidatePath(`/app/c/${courseId}`, "layout");
    return { ok: "Código para el centro de padres generado. Si había uno anterior, los centros ya vinculados deberán agregarlo de nuevo." };
  } catch (e) { return fail(e); }
}

export async function revokeAuditCode(courseId: string): Promise<ActionState> {
  try {
    const { role } = await requireCourse(courseId, { write: true });
    if (role !== "owner") throw new Error("Solo el tesorero principal puede manejar este código");
    await db.update(schema.courses).set({ auditCode: null }).where(eq(schema.courses.id, courseId));
    revalidatePath(`/app/c/${courseId}`, "layout");
    return { ok: "Acceso del centro de padres desactivado" };
  } catch (e) { return fail(e); }
}
