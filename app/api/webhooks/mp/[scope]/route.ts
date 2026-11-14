import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { fetchPayment } from "@/lib/mp";
import { extendPro } from "@/lib/plans";
import { PLANS } from "@/lib/brand";
import { allocateAcrossMonths } from "@/lib/finance";
import { notifyPayment } from "@/lib/reminders";


/**
 * Notificaciones de Mercado Pago. No se confía en el contenido recibido: solo se toma el ID del pago
 * y se consulta a Mercado Pago con el token correspondiente, así una notificación falsa no puede
 * registrar pagos ni activar planes.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/mp/[scope]">) {
  const { scope } = await ctx.params;
  const url = new URL(req.url);
  let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  let type = url.searchParams.get("type") ?? url.searchParams.get("topic");
  try {
    const body = (await req.json()) as { data?: { id?: string | number }; type?: string };
    paymentId = paymentId ?? (body.data?.id != null ? String(body.data.id) : null);
    type = type ?? body.type ?? null;
  } catch { /* sin cuerpo JSON */ }
  if (type && type !== "payment") return NextResponse.json({ ok: true });
  if (!paymentId || !/^\d{3,20}$/.test(paymentId)) return NextResponse.json({ ok: true });

  try {
    if (scope === "platform") await handlePlatform(paymentId);
    else if (/^[0-9a-f-]{36}$/i.test(scope)) await handleGuardian(scope, paymentId);
  } catch (e) {
    console.error("[mp webhook]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 }); // MP reintentará
  }
  return NextResponse.json({ ok: true });
}

async function handlePlatform(paymentId: string) {
  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) return;
  const p = await fetchPayment(token, paymentId);
  if (!p || p.status !== "approved" || !p.externalReference?.startsWith("s:")) return;
  const [, courseId, plan, subId] = p.externalReference.split(":");
  if (plan !== "monthly" && plan !== "annual") return;

  const [dup] = await db.select({ id: schema.subscriptions.id }).from(schema.subscriptions)
    .where(eq(schema.subscriptions.externalId, p.id)).limit(1);
  if (dup) return; // ya procesado

  const [sub] = await db.select().from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.id, subId), eq(schema.subscriptions.courseId, courseId))).limit(1);
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)).limit(1);
  if (!sub || !course || sub.plan !== plan || p.amount < PLANS[plan].price) return;

  const endsAt = extendPro(course, PLANS[plan].days);
  await db.update(schema.subscriptions).set({ status: "active", externalId: p.id, startsAt: new Date(), endsAt })
    .where(eq(schema.subscriptions.id, sub.id));
  await db.update(schema.courses).set({ proUntil: endsAt }).where(eq(schema.courses.id, courseId));
}

async function handleGuardian(courseId: string, paymentId: string) {
  const [integ] = await db.select().from(schema.integrations).where(eq(schema.integrations.courseId, courseId)).limit(1);
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, courseId)).limit(1);
  if (!integ?.mpAccessToken || !course) return;
  const p = await fetchPayment(decrypt(integ.mpAccessToken), paymentId);
  if (!p || p.status !== "approved" || !p.externalReference?.startsWith("g:")) return;
  const [, studentId, monthsRaw] = p.externalReference.split(":");
  const months = [...new Set(monthsRaw.split(",").map(Number))].filter((m) => course.months.includes(m)).sort((a, b) => a - b);
  if (!months.length) return;

  const [student] = await db.select().from(schema.students)
    .where(and(eq(schema.students.id, studentId), eq(schema.students.courseId, courseId))).limit(1);
  if (!student) return;

  const existing = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.studentId, studentId), inArray(schema.payments.month, months)));
  if (existing.some((e) => e.externalId === p.id)) return; // ya registrado
  const already: Record<number, number> = {};
  for (const e of existing) already[e.month] = (already[e.month] ?? 0) + e.amount;

  const parts = allocateAcrossMonths(Math.round(p.amount), course.monthlyFee, months, already);
  const receiptId = parts.length > 1 ? crypto.randomUUID() : null;
  await db.insert(schema.payments).values(parts.map((x) => ({
    courseId, studentId, month: x.month, amount: x.amount, paidAt: new Date().toISOString().slice(0, 10),
    method: "mercadopago", notes: `Mercado Pago #${p.id}`, receiptId, source: "mercadopago" as const, externalId: p.id,
  }))).onConflictDoNothing();
  await notifyPayment(course, student, Math.round(p.amount), parts.map((x) => x.month));
}
