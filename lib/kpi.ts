import type { Course, Expense, ExtraIncome } from "@/lib/db/schema";
import { currentCourseMonth, type StudentRow, type Summary } from "@/lib/finance";

/** Indicadores agregados del curso. No contiene datos de alumnos individuales (se usa en la vista de apoderados). */
export function buildKpis(course: Course, rows: StudentRow[], s: Summary, expenses: Expense[], extras: ExtraIncome[], now = new Date()) {
  const cur = currentCourseMonth(course, now);
  const upTo = course.months.filter((m) => m <= cur);

  const expectedTo = s.byMonth.filter((b) => b.month <= cur).reduce((a, b) => a + b.expected, 0);
  const collectedTo = s.byMonth.filter((b) => b.month <= cur).reduce((a, b) => a + Math.min(b.collected, b.expected), 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);

  const monthOf = (d: string) => (d.slice(0, 4) === String(course.year) ? Number(d.slice(5, 7)) : 0);
  const shown = upTo.length ? upTo : course.months.slice(0, 1);
  const series = shown.map((m) => {
    const fees = s.byMonth.find((b) => b.month === m)?.collected ?? 0;
    const ex = extras.filter((e) => monthOf(e.date) === m).reduce((a, e) => a + e.amount, 0);
    const gs = expenses.filter((e) => monthOf(e.date) === m).reduce((a, e) => a + e.amount, 0);
    return { month: m, income: fees + ex, expenses: gs, balance: fees + ex - gs };
  });

  return {
    cur,
    started: upTo.length > 0, // false mientras no llega el primer mes de cobro (p. ej. curso 2027 visto en 2026)
    firstMonth: course.months[0],
    curMonth: upTo.length ? upTo[upTo.length - 1] : course.months[0],
    activeStudents: rows.filter((r) => r.student.active).length,
    toDate: { expected: expectedTo, collected: collectedTo, pct: pct(collectedTo, expectedTo), missing: Math.max(0, expectedTo - collectedTo) },
    year: { expected: s.expected, collected: s.collected, pct: pct(s.collected, s.expected), missing: Math.max(0, s.expected - s.collected) },
    series,
    // Ingresos extra del curso completo (los asignados a alumnos concretos no se detallan)
    sharedExtras: extras.filter((e) => e.studentIds.length === 0),
    individualExtras: extras.filter((e) => e.studentIds.length > 0).length,
  };
}
