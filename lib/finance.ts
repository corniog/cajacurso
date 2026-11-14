import type { Course, Student, Payment, Expense, ExtraIncome } from "@/lib/db/schema";

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const PAYMENT_METHODS = ["efectivo", "transferencia", "cheque", "mercadopago", "otro"] as const;
export const EXPENSE_CATEGORIES = ["útiles", "eventos", "administrativo", "regalos", "transporte", "otros"] as const;

export const clp = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export type MonthStatus = "pagado" | "abonado" | "pendiente" | "no_aplica";

/** Meses que se le cobran a un alumno (según rango de cobro individual). */
export function studentMonths(course: Pick<Course, "months">, s: Pick<Student, "billingStart" | "billingEnd">): number[] {
  return course.months.filter(
    (m) => (s.billingStart == null || m >= s.billingStart) && (s.billingEnd == null || m <= s.billingEnd),
  );
}

export function monthStatus(fee: number, paid: number, applies: boolean): MonthStatus {
  if (!applies) return "no_aplica";
  if (paid >= fee) return "pagado";
  if (paid > 0) return "abonado";
  return "pendiente";
}

export type StudentRow = {
  student: Student;
  months: Record<number, { status: MonthStatus; paid: number }>;
  billed: number; // total que debería haber pagado hasta hoy (todos los meses aplicables)
  paid: number;
  debt: number; // deuda de los meses ya vencidos
  paidMonths: number;
};

/** Mes "actual" dentro del año del curso, para calcular deuda vencida. */
export function currentCourseMonth(course: Pick<Course, "year">, now = new Date()): number {
  const y = now.getFullYear();
  if (y > course.year) return 12;
  if (y < course.year) return 0;
  return now.getMonth() + 1;
}

export function buildRows(course: Course, students: Student[], payments: Payment[], now = new Date()): StudentRow[] {
  const byStudent = new Map<string, Payment[]>();
  for (const p of payments) {
    const arr = byStudent.get(p.studentId) ?? [];
    arr.push(p);
    byStudent.set(p.studentId, arr);
  }
  const cur = currentCourseMonth(course, now);
  return students.map((student) => {
    const applicable = new Set(studentMonths(course, student));
    const ps = byStudent.get(student.id) ?? [];
    const months: StudentRow["months"] = {};
    let billed = 0, paid = 0, debt = 0, paidMonths = 0;
    for (const m of course.months) {
      const paidM = ps.filter((p) => p.month === m).reduce((a, p) => a + p.amount, 0);
      const applies = applicable.has(m);
      const status = monthStatus(course.monthlyFee, paidM, applies);
      months[m] = { status, paid: paidM };
      paid += paidM;
      if (applies) {
        billed += course.monthlyFee;
        if (status === "pagado") paidMonths++;
        if (m <= cur) debt += Math.max(0, course.monthlyFee - paidM);
      }
    }
    return { student, months, billed, paid, debt, paidMonths };
  });
}

export type Summary = {
  collected: number; // cuotas recaudadas
  extras: number;
  expenses: number;
  balance: number;
  expected: number;
  debt: number;
  byMonth: { month: number; collected: number; expected: number }[];
  byCategory: { category: string; total: number }[];
};

export function buildSummary(course: Course, rows: StudentRow[], expenses: Expense[], extras: ExtraIncome[]): Summary {
  const collected = rows.reduce((a, r) => a + r.paid, 0);
  const extrasTotal = extras.reduce((a, e) => a + e.amount, 0);
  const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const byMonth = course.months.map((month) => ({
    month,
    collected: rows.reduce((a, r) => a + (r.months[month]?.paid ?? 0), 0),
    expected: rows.reduce((a, r) => a + (r.months[month]?.status !== "no_aplica" ? course.monthlyFee : 0), 0),
  }));
  const cats = new Map<string, number>();
  for (const e of expenses) cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
  return {
    collected,
    extras: extrasTotal,
    expenses: expensesTotal,
    balance: collected + extrasTotal - expensesTotal,
    expected: rows.reduce((a, r) => a + r.billed, 0),
    debt: rows.reduce((a, r) => a + r.debt, 0),
    byMonth,
    byCategory: [...cats].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
  };
}

/** Reparte un monto entre meses consecutivos cubriendo la deuda de cada uno (para un comprobante multi-mes). */
export function allocateAcrossMonths(
  amount: number, fee: number, months: number[], alreadyPaid: Record<number, number>,
): { month: number; amount: number }[] {
  const out: { month: number; amount: number }[] = [];
  let left = amount;
  for (const m of months) {
    if (left <= 0) break;
    const owe = Math.max(0, fee - (alreadyPaid[m] ?? 0));
    if (owe === 0) continue;
    const a = Math.min(owe, left);
    out.push({ month: m, amount: a });
    left -= a;
  }
  // Si sobra dinero, se abona al último mes seleccionado (queda como saldo a favor visible)
  if (left > 0 && months.length) {
    const last = months[months.length - 1];
    const ex = out.find((o) => o.month === last);
    if (ex) ex.amount += left; else out.push({ month: last, amount: left });
  }
  return out;
}
