import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireCourse } from "@/lib/auth";
import { mpAuthUrl, mpOAuthConfigured } from "@/lib/mp";
import { hasFeature } from "@/lib/features";

export async function GET(req: Request) {
  const courseId = new URL(req.url).searchParams.get("course") ?? "";
  const { course, role } = await requireCourse(courseId);
  if (role !== "owner" || !hasFeature(course, "mercadopago")) return new NextResponse("Requiere Plan Pro y ser el tesorero principal", { status: 403 });
  if (!mpOAuthConfigured()) return new NextResponse("El botón de Mercado Pago aún no está configurado en esta plataforma", { status: 503 });
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("cc_mp_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(mpAuthUrl(courseId, state));
}
