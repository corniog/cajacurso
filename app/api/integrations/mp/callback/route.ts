import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireCourse } from "@/lib/auth";
import { connectMpWithCode } from "@/lib/mp";
import { hasFeature } from "@/lib/features";
import { appUrl } from "@/lib/course-data";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const [courseId, state] = (u.searchParams.get("state") ?? "").split(".");
  const expected = (await cookies()).get("cc_mp_state")?.value;
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/app/c/${courseId}/plan?mp=${q}`);

  if (u.searchParams.get("error") && courseId) return back("cancelado");
  if (!code || !courseId || !state || state !== expected) return new NextResponse("Solicitud no válida", { status: 400 });
  const { course, role } = await requireCourse(courseId);
  if (role !== "owner" || !hasFeature(course, "mercadopago")) return new NextResponse("No autorizado", { status: 403 });
  try {
    await connectMpWithCode(courseId, code);
  } catch (e) {
    console.error("[mp callback]", e instanceof Error ? e.message : e);
    return back("error");
  }
  (await cookies()).delete("cc_mp_state");
  return back("ok");
}
