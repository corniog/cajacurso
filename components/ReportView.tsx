import type { Course } from "@/lib/db/schema";
import type { StudentRow, Summary } from "@/lib/finance";
import { clp, MONTH_NAMES } from "@/lib/finance";

/** Reporte financiero completo (solo lectura). Lo usan el tesorero y la vista de directivos. */
export default function ReportView({ course, rows, summary: s }: { course: Course; rows: StudentRow[]; summary: Summary }) {
  const sorted = [...rows].sort((a, b) => a.student.lastName.localeCompare(b.student.lastName, "es"));
  return (
    <>
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{course.school} · {course.name} {course.year}</h1>
        <p className="text-sm">Informe al {new Date().toLocaleDateString("es-CL")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Cuotas recaudadas", clp(s.collected)], ["Ingresos extra", clp(s.extras)],
          ["Gastos", clp(s.expenses)], ["Balance disponible", clp(s.balance)],
        ].map(([k, v]) => (
          <div key={k} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card !p-0 overflow-x-auto">
          <h3 className="border-b border-line px-5 py-3 font-bold">Detalle por mes</h3>
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className="th">Mes</th><th className="th text-right">Recaudado</th><th className="th text-right">Esperado</th></tr></thead>
            <tbody>
              {s.byMonth.map((m) => (
                <tr key={m.month} className="border-b border-line/60"><td className="td">{MONTH_NAMES[m.month - 1]}</td><td className="td text-right tabular-nums">{clp(m.collected)}</td><td className="td text-right tabular-nums text-muted">{clp(m.expected)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card !p-0 overflow-x-auto">
          <h3 className="border-b border-line px-5 py-3 font-bold">Gastos por categoría</h3>
          {s.byCategory.length === 0 ? <p className="p-5 text-sm text-muted">Sin gastos registrados.</p> : (
            <table className="w-full">
              <thead><tr className="border-b border-line"><th className="th">Categoría</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {s.byCategory.map((c) => (
                  <tr key={c.category} className="border-b border-line/60"><td className="td capitalize">{c.category}</td><td className="td text-right tabular-nums">{clp(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <h3 className="border-b border-line px-5 py-3 font-bold">Análisis por alumno</h3>
        <table className="w-full min-w-[560px]">
          <thead><tr className="border-b border-line"><th className="th">Alumno</th><th className="th text-center">Meses pagados</th><th className="th text-right">Pagado</th><th className="th text-right">Deuda vencida</th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.student.id} className="border-b border-line/60">
                <td className="td">{r.student.lastName}, {r.student.firstName}{!r.student.active && <span className="ml-2 text-xs text-muted">(inactivo)</span>}</td>
                <td className="td text-center">{r.paidMonths}</td>
                <td className="td text-right tabular-nums">{clp(r.paid)}</td>
                <td className={`td text-right tabular-nums font-semibold ${r.debt > 0 ? "text-red-700" : "text-emerald-700"}`}>{clp(r.debt)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td className="td font-bold" colSpan={2}>Total</td><td className="td text-right font-bold tabular-nums">{clp(s.collected)}</td><td className="td text-right font-bold tabular-nums">{clp(s.debt)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
