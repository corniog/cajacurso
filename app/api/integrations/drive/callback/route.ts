import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireCourse } from "@/lib/auth";
import { connectDrive } from "@/lib/drive";
import { hasFeature } from "@/lib/features";
import { appUrl } from "@/lib/course-data";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const [courseId, state] = (u.searchParams.get("state") ?? "").split(".");
  const expected = (await cookies()).get("cc_drive_state")?.value;
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/c/${courseId}/plan?drive=${q}`);

  if (!code || !courseId || !state || state !== expected) return new NextResponse("Solicitud no válida", { status: 400 });
  const { course, role } = await requireCourse(courseId);
  if (role !== "owner" || !hasFeature(course, "drive")) return new NextResponse("No autorizado", { status: 403 });
  try {
    await connectDrive(courseId, code, `${course.name} ${course.year}`);
  } catch (e) {
    console.error("[drive callback]", e instanceof Error ? e.message : e);
    return back("error");
  }
  (await cookies()).delete("cc_drive_state");
  return back("ok");
}
