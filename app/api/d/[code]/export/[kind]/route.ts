import { NextResponse } from "next/server";
import { getCourseByDirectiveCode } from "@/lib/public-data";
import { loadCourseData } from "@/lib/course-data";
import { buildPdf, buildXlsx } from "@/lib/export";
import { isPro } from "@/lib/plans";

// Descargas de solo lectura para directivos (Excel siempre; PDF si el curso tiene Plan Pro)
export async function GET(_req: Request, ctx: RouteContext<"/api/d/[code]/export/[kind]">) {
  const { code, kind } = await ctx.params;
  const course = await getCourseByDirectiveCode(code);
  if (!course) return new NextResponse("No encontrado", { status: 404 });
  const data = await loadCourseData(course);
  const base = `${course.name}-${course.year}`.normalize("NFD").replace(/[^\w-]+/g, "_");

  if (kind === "xlsx") {
    const buf = await buildXlsx(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tesoreria-${base}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (kind === "pdf") {
    if (!isPro(course)) return new NextResponse("El PDF es parte del Plan Pro del curso", { status: 403 });
    const buf = await buildPdf(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="informe-${base}.pdf"`, "Cache-Control": "private, no-store" },
    });
  }
  return new NextResponse("No encontrado", { status: 404 });
}
