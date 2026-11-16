import { NextResponse } from "next/server";
import { requireCourse } from "@/lib/auth";
import { loadLedger } from "@/lib/ledger-data";
import { buildLedgerPdf, buildLedgerXlsx } from "@/lib/ledger-export";

export async function GET(_req: Request, ctx: RouteContext<"/api/c/[id]/libro/[kind]">) {
  const { id, kind } = await ctx.params;
  const { course } = await requireCourse(id);
  const d = await loadLedger(course);
  const base = `${course.name}-${course.year}`.normalize("NFD").replace(/[^\w-]+/g, "_");
  if (kind === "xlsx") {
    const buf = await buildLedgerXlsx(d);
    return new NextResponse(new Uint8Array(buf), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="libro-contable-${base}.xlsx"`, "Cache-Control": "private, no-store" } });
  }
  if (kind === "pdf") {
    const buf = await buildLedgerPdf(d);
    return new NextResponse(new Uint8Array(buf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="libro-contable-${base}.pdf"`, "Cache-Control": "private, no-store" } });
  }
  return new NextResponse("No encontrado", { status: 404 });
}
