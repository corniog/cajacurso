import { NextResponse } from "next/server";
import { getStudentByToken } from "@/lib/public-data";
import { studentStatementPdf, statementFileName } from "@/lib/statement";

// El apoderado descarga el estado de cuenta de su hijo en PDF (con su enlace o código)
export async function GET(_req: Request, ctx: RouteContext<"/api/f/[token]/pdf">) {
  const { token } = await ctx.params;
  const found = await getStudentByToken(token);
  if (!found) return new NextResponse("No encontrado", { status: 404 });
  const { pdf } = await studentStatementPdf(found.course, found.student);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${statementFileName(found.student)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
