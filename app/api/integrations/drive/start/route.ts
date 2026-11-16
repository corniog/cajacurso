import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireCourse } from "@/lib/auth";
import { driveAuthUrl, driveConfigured } from "@/lib/drive";
import { hasFeature } from "@/lib/features";

export async function GET(req: Request) {
  const courseId = new URL(req.url).searchParams.get("course") ?? "";
  const { course, role } = await requireCourse(courseId);
  if (role !== "owner" || !hasFeature(course, "drive")) return new NextResponse("Requiere Plan Pro y ser el tesorero principal", { status: 403 });
  if (!driveConfigured()) return new NextResponse("Google Drive no está configurado en esta plataforma", { status: 503 });
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("cc_drive_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(driveAuthUrl(courseId, state));
}
