import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const todayCl = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());

/**
 * Confirma un aporte: lo marca como confirmado y lo registra como ingreso extra del curso (entra al libro y a los totales).
 * Es seguro llamarlo más de una vez: si ya estaba confirmado no hace nada.
 */
export async function confirmContribution(courseId: string, paymentId: string, opts: { externalId?: string } = {}): Promise<"ok" | "ya" | "no"> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.contributionPayments)
      .where(and(eq(schema.contributionPayments.id, paymentId), eq(schema.contributionPayments.courseId, courseId))).for("update");
    if (!row) return "no";
    if (row.status === "confirmed") return "ya";
    const [st] = await tx.select().from(schema.students).where(eq(schema.students.id, row.studentId)).limit(1);
    const [x] = await tx.insert(schema.extraIncomes).values({
      courseId, description: `Aporte: ${row.concept} · ${st ? `${st.lastName}, ${st.firstName}` : "alumno"}`,
      amount: row.amount, date: todayCl(), studentIds: [row.studentId],
    }).returning({ id: schema.extraIncomes.id });
    await tx.update(schema.contributionPayments).set({
      status: "confirmed", extraIncomeId: x.id, confirmedAt: new Date(), ...(opts.externalId ? { externalId: opts.externalId } : {}),
    }).where(eq(schema.contributionPayments.id, row.id));
    return "ok";
  });
}
