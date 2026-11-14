import { NextResponse } from "next/server";
import { and, eq, isNotNull, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendCourseReminders } from "@/lib/reminders";


/** Llamar una vez al día (cron del servidor) con: Authorization: Bearer <CRON_SECRET> */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("No autorizado", { status: 401 });

  const today = new Date();
  const rows = await db.select({ course: schema.courses, integ: schema.integrations })
    .from(schema.integrations).innerJoin(schema.courses, eq(schema.integrations.courseId, schema.courses.id))
    .where(and(eq(schema.integrations.remindersEnabled, true), eq(schema.integrations.reminderDay, today.getDate()), isNotNull(schema.courses.proUntil), gt(schema.courses.proUntil, today)));

  let sent = 0, courses = 0;
  for (const { course, integ } of rows) {
    const last = integ.lastReminderAt;
    if (last && last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth() && last.getDate() === today.getDate()) continue;
    const r = await sendCourseReminders(course);
    sent += r.sent; courses++;
  }
  return NextResponse.json({ courses, sent });
}
