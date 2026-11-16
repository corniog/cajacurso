import { NextResponse } from "next/server";
import { requireCourse } from "@/lib/auth";
import { loadCourseData } from "@/lib/course-data";
import { buildPdf, buildXlsx } from "@/lib/export";
import { hasFeature } from "@/lib/features";


export async function GET(_req: Request, ctx: RouteContext<"/api/c/[id]/export/[kind]">) {
  const { id, kind } = await ctx.params;
  const { course } = await requireCourse(id);
  const data = await loadCourseData(course);
  const base = `${course.name}-${course.year}`.normalize("NFD").replace(/[^\w-]+/g, "_");

  if (kind === "xlsx") {
    const buf = await buildXlsx(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tesoreria-${base}.xlsx"`,
      },
    });
  }
  if (kind === "pdf") {
    if (!hasFeature(course, "pdf")) return new NextResponse("El PDF para la reunión es parte del Plan Pro", { status: 403 });
    const buf = await buildPdf(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="informe-${base}.pdf"` },
    });
  }
  return new NextResponse("No encontrado", { status: 404 });
}
