"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getStudentByToken } from "@/lib/public-data";
import { decrypt } from "@/lib/crypto";
import { mpPreference } from "@/lib/mp";
import { isPro } from "@/lib/plans";
import { buildRows } from "@/lib/finance";
import { appUrl } from "@/lib/course-data";
import type { ActionState } from "@/app/actions/course";

/** El apoderado paga en línea (Plan Pro + Mercado Pago del tesorero conectado). */
export async function payOnline(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let url: string | undefined;
  try {
    const found = await getStudentByToken(token);
    if (!found) return { error: "Ficha no encontrada" };
    const { student, course } = found;
    const [integ] = await db.select().from(schema.integrations).where(eq(schema.integrations.courseId, course.id)).limit(1);
    if (!isPro(course) || !integ?.mpAccessToken) return { error: "El pago en línea no está disponible en este curso." };

    const months = [...new Set(fd.getAll("months").map(Number))].filter((m) => course.months.includes(m)).sort((a, b) => a - b);
    if (!months.length) return { error: "Elige al menos un mes para pagar" };

    const payments = await db.select().from(schema.payments).where(eq(schema.payments.studentId, student.id));
    const [row] = buildRows(course, [student], payments);
    const amount = months.reduce((a, m) => {
      const c = row.months[m];
      return a + (c && c.status !== "no_aplica" ? Math.max(0, course.monthlyFee - c.paid) : 0);
    }, 0);
    if (amount <= 0) return { error: "Los meses elegidos ya están pagados" };

    const res = await mpPreference(decrypt(integ.mpAccessToken)).create({
      body: {
        items: [{ id: "cuotas", title: `Cuotas ${course.name} · ${student.firstName} ${student.lastName}`, quantity: 1, unit_price: amount, currency_id: "CLP" }],
        external_reference: `g:${student.id}:${months.join(",")}`,
        notification_url: `${appUrl()}/api/webhooks/mp/${course.id}`,
        back_urls: { success: `${appUrl()}/f/${token}?pago=ok`, failure: `${appUrl()}/f/${token}?pago=error`, pending: `${appUrl()}/f/${token}?pago=pendiente` },
        auto_return: "approved",
      },
    });
    url = res.init_point;
  } catch (e) {
    console.error("[payOnline]", e instanceof Error ? e.message : e);
    return { error: "No se pudo iniciar el pago. Inténtalo de nuevo en unos minutos." };
  }
  if (!url) return { error: "No se pudo iniciar el pago." };
  redirect(url);
}
