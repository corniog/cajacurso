import { eq, count } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course } from "@/lib/db/schema";
import { PLANS } from "@/lib/brand";
import { hasFeature } from "@/lib/features";

export const isPro = (c: Pick<Course, "proUntil">) => !!c.proUntil && c.proUntil.getTime() > Date.now();

export async function extraCount(courseId: string) {
  const [r] = await db.select({ n: count() }).from(schema.extraIncomes).where(eq(schema.extraIncomes.courseId, courseId));
  return r?.n ?? 0;
}

export async function canAddExtra(course: Course) {
  if (hasFeature(course, "extras")) return true;
  return (await extraCount(course.id)) < PLANS.freeExtraLimit;
}

/** Extiende la vigencia Pro desde hoy o desde el vencimiento actual, lo que sea mayor. */
export function extendPro(course: Pick<Course, "proUntil">, days: number): Date {
  const base = course.proUntil && course.proUntil.getTime() > Date.now() ? course.proUntil : new Date();
  return new Date(base.getTime() + days * 86400000);
}

export async function startTrial(course: Course): Promise<boolean> {
  if (course.proTrialUsed) return false;
  const until = extendPro(course, PLANS.trialDays);
  await db.update(schema.courses).set({ proUntil: until, proTrialUsed: true }).where(eq(schema.courses.id, course.id));
  await db.insert(schema.subscriptions).values({
    courseId: course.id, plan: "trial", status: "active", amount: 0, method: "prueba", startsAt: new Date(), endsAt: until,
  });
  return true;
}

