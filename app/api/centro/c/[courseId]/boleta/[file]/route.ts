import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getCenterCourse } from "@/lib/center";
import { readReceipt } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/centro/c/[courseId]/boleta/[file]">) {
  const { courseId, file } = await ctx.params;
  const user = await getUser();
  const course = user ? await getCenterCourse(user, courseId) : null;
  if (!course) return new NextResponse("No encontrado", { status: 404 });
  const [e] = await db.select({ id: schema.expenses.id }).from(schema.expenses)
    .where(and(eq(schema.expenses.courseId, course.id), eq(schema.expenses.receiptFile, file))).limit(1);
  if (!e) return new NextResponse("No encontrado", { status: 404 });
  try {
    const { buf, mime } = await readReceipt(course.id, file);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse("No encontrado", { status: 404 }); }
}
