"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCenter } from "@/lib/center";
import { AUDIT_CODE_RE } from "@/lib/util";
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
    if (!course) throw new Error("No encontramos un curso con ese código. Revisa que esté bien escrito o pídeselo de nuevo al tesorero.");
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

