import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadDocWithLines, loadSettings } from "@/lib/events";
import { buildDocPdf } from "@/lib/event-pdf";

// Boleta pública: se accede solo con el enlace secreto
export async function GET(_req: Request, ctx: RouteContext<"/api/b/[token]/pdf">) {
  const { token } = await ctx.params;
  const found = await loadDocWithLines(eq(schema.eventDocs.token, token));
  if (!found) return new NextResponse("No encontrado", { status: 404 });
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, found.doc.courseId)).limit(1);
  const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, found.doc.eventId)).limit(1);
  const pdf = await buildDocPdf(found.doc, found.lines, await loadSettings(course), ev?.name ?? "");
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${found.doc.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
