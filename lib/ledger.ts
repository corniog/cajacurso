import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, Expense, ExtraIncome, Payment, Student } from "@/lib/db/schema";
import { MONTH_NAMES } from "@/lib/finance";

export type LedgerEntry = {
  key: string;             // "payment:<id>" | "extra:<id>" | "expense:<id>"
  n: number;               // correlativo cronológico
  date: string;            // YYYY-MM-DD
  type: "income" | "expense";
  source: "Cuota" | "Ingreso extra" | "Gasto";
  concept: string;
  detail: string;
  income: number;
  expense: number;
  balance: number;         // saldo acumulado
  entity: "payment" | "extra" | "expense";
  entityId: string;
  locked: string | null;   // motivo por el que no se puede editar
  createdAt: number;
};

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const fmtDate = dmy;

/**
 * El libro NO es una copia: se arma en vivo con los pagos, ingresos extra y gastos del curso.
 * Por eso cada movimiento nuevo aparece solo y nunca puede quedar desfasado de la aplicación.
 */
export function buildLedger(
  course: Course, students: Student[], payments: Payment[], extras: ExtraIncome[], expenses: Expense[],
  lockedExtras: Map<string, string> = new Map(),
) {
  const sName = new Map(students.map((s) => [s.id, `${s.lastName}, ${s.firstName}`]));
  const raw: Omit<LedgerEntry, "n" | "balance">[] = [];

  for (const p of payments) {
    raw.push({
      key: `payment:${p.id}`, date: p.paidAt, type: "income", source: "Cuota",
      concept: `Cuota ${MONTH_NAMES[p.month - 1] ?? p.month} · ${sName.get(p.studentId) ?? "Alumno eliminado"}`,
      detail: [p.method, p.notes, p.source === "mercadopago" ? "Mercado Pago" : ""].filter(Boolean).join(" · "),
      income: p.amount, expense: 0, entity: "payment", entityId: p.id,
      locked: p.source === "mercadopago" ? "Pago en línea (Mercado Pago): no se edita, queda respaldado por el comprobante del banco" : null,
      createdAt: p.createdAt.getTime(),
    });
  }
  for (const e of extras) {
    raw.push({
      key: `extra:${e.id}`, date: e.date, type: "income", source: "Ingreso extra",
      concept: e.description, detail: e.studentIds.length ? `${e.studentIds.length} alumno(s)` : "Curso completo",
      income: e.amount, expense: 0, entity: "extra", entityId: e.id,
      locked: lockedExtras.get(e.id) ?? null,
      createdAt: e.createdAt.getTime(),
    });
  }
  for (const g of expenses) {
    raw.push({
      key: `expense:${g.id}`, date: g.date, type: "expense", source: "Gasto",
      concept: g.description, detail: [g.category, g.vendor, g.docNumber ? `Doc. ${g.docNumber}` : "", g.receiptFile ? "con boleta adjunta" : ""].filter(Boolean).join(" · "),
      income: 0, expense: g.amount, entity: "expense", entityId: g.id, locked: null, createdAt: g.createdAt.getTime(),
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.key.localeCompare(b.key));
  let bal = 0;
  const entries: LedgerEntry[] = raw.map((r, i) => { bal += r.income - r.expense; return { ...r, n: i + 1, balance: bal }; });
  const totals = {
    income: entries.reduce((a, e) => a + e.income, 0),
    expense: entries.reduce((a, e) => a + e.expense, 0),
    fees: entries.filter((e) => e.source === "Cuota").reduce((a, e) => a + e.income, 0),
    extras: entries.filter((e) => e.source === "Ingreso extra").reduce((a, e) => a + e.income, 0),
    balance: bal,
    count: entries.length,
  };
  return { entries, totals };
}

export type Reconciliation = {
  ok: boolean;
  rows: { label: string; ledger: number; app: number; ok: boolean }[];
};

/** Compara el total del libro contra los números de la aplicación (resumen del curso). */
export function reconcile(totals: ReturnType<typeof buildLedger>["totals"], app: { collected: number; extras: number; expenses: number; balance: number }): Reconciliation {
  const rows = [
    { label: "Cuotas recaudadas", ledger: totals.fees, app: app.collected },
    { label: "Ingresos extra", ledger: totals.extras, app: app.extras },
    { label: "Total ingresos", ledger: totals.income, app: app.collected + app.extras },
    { label: "Total egresos (gastos)", ledger: totals.expense, app: app.expenses },
    { label: "Saldo en caja", ledger: totals.balance, app: app.balance },
  ].map((r) => ({ ...r, ok: r.ledger === r.app }));
  return { ok: rows.every((r) => r.ok), rows };
}

/** Verificación independiente: suma directo en la base de datos (otra ruta de cálculo que el libro). */
export async function dbTotals(courseId: string) {
  const one = async (t: typeof schema.payments | typeof schema.extraIncomes | typeof schema.expenses) => {
    const [r] = await db.select({ s: sql<number>`coalesce(sum(${t.amount}),0)::int` }).from(t).where(eq(t.courseId, courseId));
    return r.s;
  };
  const [fees, extras, expenses] = await Promise.all([one(schema.payments), one(schema.extraIncomes), one(schema.expenses)]);
  return { fees, extras, expenses, balance: fees + extras - expenses };
}
