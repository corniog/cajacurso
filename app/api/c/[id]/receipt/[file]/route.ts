import { NextResponse } from "next/server";
import { requireCourse } from "@/lib/auth";
import { readReceipt } from "@/lib/storage";

// Boletas visibles solo para quienes pertenecen al curso
export async function GET(_req: Request, ctx: RouteContext<"/api/c/[id]/receipt/[file]">) {
  const { id, file } = await ctx.params;
  await requireCourse(id);
  try {
    const { buf, mime } = await readReceipt(id, file);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
