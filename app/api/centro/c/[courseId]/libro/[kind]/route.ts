import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCenterCourse, loadCenterLedger } from "@/lib/center";
import { buildLedgerPdf, buildLedgerXlsx } from "@/lib/ledger-export";

export async function GET(_req: Request, ctx: RouteContext<"/api/centro/c/[courseId]/libro/[kind]">) {
  const { courseId, kind } = await ctx.params;
  const user = await getUser();
  const course = user ? await getCenterCourse(user, courseId) : null;
  if (!course) return new NextResponse("No encontrado", { status: 404 });
  const d = await loadCenterLedger(course);
  const base = `${course.name}-${course.year}`.normalize("NFD").replace(/[^\w-]+/g, "_");
  if (kind === "xlsx") {
    const buf = await buildLedgerXlsx(d);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="auditoria-libro-${base}.xlsx"`, "Cache-Control": "private, no-store" } });
  }
  if (kind === "pdf") {
    const buf = await buildLedgerPdf(d);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="auditoria-libro-${base}.pdf"`, "Cache-Control": "private, no-store" } });
  }
  return new NextResponse("No encontrado", { status: 404 });
}
