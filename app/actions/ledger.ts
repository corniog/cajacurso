"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { PAYMENT_METHODS, EXPENSE_CATEGORIES, clp } from "@/lib/finance";
import { dbTotals } from "@/lib/ledger";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos";
const refresh = (id: string) => revalidatePath(`/app/c/${id}`, "layout");
const optText = (max = 120) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const money = z.coerce.number().int("Usa un monto entero en pesos").min(1, "El monto debe ser mayor a 0").max(100_000_000);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Cuadratura: tras cada cambio se recalcula todo sumando directo en la base y se compara contra lo
 * esperado (total anterior ± la diferencia del movimiento). Si algo no coincide, se revierte: no deja editar.
 */
async function assertBalanced(tx: Tx, courseId: string, before: { fees: number; extras: number; expenses: number }, delta: { fees?: number; extras?: number; expenses?: number }) {
  const sum = async (t: typeof schema.payments | typeof schema.extraIncomes | typeof schema.expenses) => {
    const [r] = await tx.select({ s: sql<number>`coalesce(sum(${t.amount}),0)::int` }).from(t).where(eq(t.courseId, courseId));
    return r.s;
  };
  const now = { fees: await sum(schema.payments), extras: await sum(schema.extraIncomes), expenses: await sum(schema.expenses) };
  const want = { fees: before.fees + (delta.fees ?? 0), extras: before.extras + (delta.extras ?? 0), expenses: before.expenses + (delta.expenses ?? 0) };
  if (now.fees !== want.fees || now.extras !== want.extras || now.expenses !== want.expenses) {
    throw new Error("El cambio no cuadra con los totales del libro y se canceló. Revisa los montos.");
  }
}

async function audit(tx: Tx, courseId: string, user: { id: string; name: string }, a: {
  action: "edit" | "delete"; entity: "payment" | "expense" | "extra"; entityId: string; summary: string; before: unknown; after?: unknown;
}) {
  await tx.insert(schema.ledgerAudit).values({
    courseId, userId: user.id, userName: user.name, action: a.action, entity: a.entity, entityId: a.entityId,
    summary: a.summary, before: a.before as object, after: (a.after ?? null) as object | null,
  });
}

/* ---------------- Cuotas ---------------- */
export async function editPayment(courseId: string, paymentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course, user } = await requireCourse(courseId, { write: true });
    const p = z.object({ amount: money, paidAt: dateStr, method: z.enum(PAYMENT_METHODS), notes: optText(200) }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.transaction(async (tx) => {
      const [old] = await tx.select().from(schema.payments)
        .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.courseId, courseId))).for("update");
      if (!old) throw new Error("Movimiento no encontrado");
      if (old.source === "mercadopago") throw new Error("Los pagos de Mercado Pago no se pueden editar");
      const others = await tx.select({ s: sql<number>`coalesce(sum(${schema.payments.amount}),0)::int` }).from(schema.payments)
        .where(and(eq(schema.payments.studentId, old.studentId), eq(schema.payments.month, old.month), ne(schema.payments.id, old.id)));
      const monthTotal = others[0].s + p.data.amount;
      const oldTotal = others[0].s + old.amount;
      if (monthTotal > course.monthlyFee && monthTotal > oldTotal) {
        throw new Error(`No cuadra: ese mes quedaría con ${clp(monthTotal)} pagados y la cuota es ${clp(course.monthlyFee)}. El máximo para este movimiento es ${clp(Math.max(old.amount, course.monthlyFee - others[0].s))}.`);
      }
      const before = await dbTotals(courseId);
      await tx.update(schema.payments).set({ amount: p.data.amount, paidAt: p.data.paidAt, method: p.data.method, notes: p.data.notes }).where(eq(schema.payments.id, old.id));
      await assertBalanced(tx, courseId, before, { fees: p.data.amount - old.amount });
      await audit(tx, courseId, user, {
        action: "edit", entity: "payment", entityId: old.id,
        summary: `Cuota mes ${old.month}: ${clp(old.amount)} → ${clp(p.data.amount)}`,
        before: { amount: old.amount, paidAt: old.paidAt, method: old.method, notes: old.notes },
        after: p.data,
      });
    });
    refresh(courseId);
    return { ok: "Movimiento corregido. El libro sigue cuadrado." };
  } catch (e) { return fail(e); }
}

/* ---------------- Gastos ---------------- */
export async function editExpense(courseId: string, expenseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user } = await requireCourse(courseId, { write: true });
    const p = z.object({
      description: z.string().trim().min(2, "Describe el gasto").max(160), category: z.enum(EXPENSE_CATEGORIES),
      amount: money, date: dateStr, vendor: optText(100), docNumber: optText(40),
    }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.transaction(async (tx) => {
      const [old] = await tx.select().from(schema.expenses)
        .where(and(eq(schema.expenses.id, expenseId), eq(schema.expenses.courseId, courseId))).for("update");
      if (!old) throw new Error("Movimiento no encontrado");
      const before = await dbTotals(courseId);
      const net = before.balance - old.amount + p.data.amount;
      if (net < 0 && p.data.amount > old.amount) throw new Error(`No cuadra: con ese monto el saldo en caja quedaría negativo (${clp(before.balance - (p.data.amount - old.amount))}).`);
      await tx.update(schema.expenses).set(p.data).where(eq(schema.expenses.id, old.id));
      await assertBalanced(tx, courseId, before, { expenses: p.data.amount - old.amount });
      await audit(tx, courseId, user, {
        action: "edit", entity: "expense", entityId: old.id,
        summary: `Gasto "${old.description}": ${clp(old.amount)} → ${clp(p.data.amount)}`,
        before: { description: old.description, category: old.category, amount: old.amount, date: old.date, vendor: old.vendor, docNumber: old.docNumber },
        after: p.data,
      });
    });
    refresh(courseId);
    return { ok: "Movimiento corregido. El libro sigue cuadrado." };
  } catch (e) { return fail(e); }
}

/* ---------------- Ingresos extra ---------------- */
export async function editExtra(courseId: string, extraId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user } = await requireCourse(courseId, { write: true });
    const p = z.object({ description: z.string().trim().min(2, "Describe el ingreso").max(160), amount: money, date: dateStr }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.transaction(async (tx) => {
      const [old] = await tx.select().from(schema.extraIncomes)
        .where(and(eq(schema.extraIncomes.id, extraId), eq(schema.extraIncomes.courseId, courseId))).for("update");
      if (!old) throw new Error("Movimiento no encontrado");
      const [ev] = await tx.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.extraIncomeId, old.id)).limit(1);
      if (ev) throw new Error("Este ingreso viene de un evento cerrado. Reábrelo en Ventas para eventos para corregirlo.");
      const [ap] = await tx.select({ id: schema.contributionPayments.id }).from(schema.contributionPayments).where(eq(schema.contributionPayments.extraIncomeId, old.id)).limit(1);
      if (ap) throw new Error("Este ingreso viene de un aporte confirmado de un apoderado. Se gestiona en Aportes y colectas.");
      const before = await dbTotals(courseId);
      if (p.data.amount < old.amount && before.balance - (old.amount - p.data.amount) < 0) {
        throw new Error("No cuadra: al bajar este ingreso el saldo en caja quedaría negativo (ya se gastó ese dinero).");
      }
      await tx.update(schema.extraIncomes).set(p.data).where(eq(schema.extraIncomes.id, old.id));
      await assertBalanced(tx, courseId, before, { extras: p.data.amount - old.amount });
      await audit(tx, courseId, user, {
        action: "edit", entity: "extra", entityId: old.id,
        summary: `Ingreso extra "${old.description}": ${clp(old.amount)} → ${clp(p.data.amount)}`,
        before: { description: old.description, amount: old.amount, date: old.date }, after: p.data,
      });
    });
    refresh(courseId);
    return { ok: "Movimiento corregido. El libro sigue cuadrado." };
  } catch (e) { return fail(e); }
}

/** Eliminación desde el libro (queda en la bitácora). No permite dejar el saldo en caja negativo. */
export async function deleteFromLedger(courseId: string, entity: "payment" | "expense" | "extra", entityId: string): Promise<ActionState> {
  try {
    const { user } = await requireCourse(courseId, { write: true });
    await db.transaction(async (tx) => {
      const before = await dbTotals(courseId);
      if (entity === "payment") {
        const [old] = await tx.select().from(schema.payments).where(and(eq(schema.payments.id, entityId), eq(schema.payments.courseId, courseId))).for("update");
        if (!old) throw new Error("Movimiento no encontrado");
        if (old.source === "mercadopago") throw new Error("Los pagos de Mercado Pago no se pueden eliminar");
        if (before.balance - old.amount < 0) throw new Error("No cuadra: eliminar esta cuota dejaría el saldo en caja negativo.");
        await tx.delete(schema.payments).where(eq(schema.payments.id, old.id));
        await assertBalanced(tx, courseId, before, { fees: -old.amount });
        await audit(tx, courseId, user, { action: "delete", entity, entityId, summary: `Cuota mes ${old.month} eliminada (${clp(old.amount)})`, before: old });
      } else if (entity === "expense") {
        const [old] = await tx.select().from(schema.expenses).where(and(eq(schema.expenses.id, entityId), eq(schema.expenses.courseId, courseId))).for("update");
        if (!old) throw new Error("Movimiento no encontrado");
        await tx.delete(schema.expenses).where(eq(schema.expenses.id, old.id));
        await assertBalanced(tx, courseId, before, { expenses: -old.amount });
        await audit(tx, courseId, user, { action: "delete", entity, entityId, summary: `Gasto "${old.description}" eliminado (${clp(old.amount)})`, before: { ...old, receiptFile: old.receiptFile } });
      } else {
        const [old] = await tx.select().from(schema.extraIncomes).where(and(eq(schema.extraIncomes.id, entityId), eq(schema.extraIncomes.courseId, courseId))).for("update");
        if (!old) throw new Error("Movimiento no encontrado");
        const [ev] = await tx.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.extraIncomeId, old.id)).limit(1);
        if (ev) throw new Error("Este ingreso viene de un evento cerrado. Reábrelo en Ventas para eventos.");
        const [ap] = await tx.select({ id: schema.contributionPayments.id }).from(schema.contributionPayments).where(eq(schema.contributionPayments.extraIncomeId, old.id)).limit(1);
        if (ap) throw new Error("Este ingreso viene de un aporte confirmado de un apoderado. Se gestiona en Aportes y colectas.");
        if (before.balance - old.amount < 0) throw new Error("No cuadra: eliminar este ingreso dejaría el saldo en caja negativo.");
        await tx.delete(schema.extraIncomes).where(eq(schema.extraIncomes.id, old.id));
        await assertBalanced(tx, courseId, before, { extras: -old.amount });
        await audit(tx, courseId, user, { action: "delete", entity, entityId, summary: `Ingreso extra "${old.description}" eliminado (${clp(old.amount)})`, before: old });
      }
    });
    refresh(courseId);
    return { ok: "Movimiento eliminado y registrado en la bitácora" };
  } catch (e) { return fail(e); }
}
