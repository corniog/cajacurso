import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getCourseByCode } from "@/lib/public-data";
import { loadCourseData } from "@/lib/course-data";
import { MONTH_SHORT, MONTH_NAMES, clp } from "@/lib/finance";

export const metadata: Metadata = { title: "Estado del curso", robots: { index: false, follow: false } };

const CELL = { pagado: "bg-emerald-100 text-emerald-900", abonado: "bg-amber-100 text-amber-900", pendiente: "bg-slate-100 text-slate-600", no_aplica: "text-slate-300" } as const;
const MARK = { pagado: "✓", abonado: "$", pendiente: "·", no_aplica: "—" } as const;

export default async function PublicCoursePage({ params }: PageProps<"/c/[code]">) {
  const { code } = await params;
  const course = await getCourseByCode(code);
  if (!course) notFound();
  const { rows, summary: s, expenses } = await loadCourseData(course);
  const visible = rows.filter((r) => r.student.active);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-8">
      <Logo />
      <div>
        <h1 className="text-2xl font-bold">{course.name} · {course.year}</h1>
        <p className="text-muted">{course.school} · Cuota mensual {clp(course.monthlyFee)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[["Recaudado", clp(s.collected + s.extras)], ["Gastos", clp(s.expenses)], ["Disponible", clp(s.balance)]].map(([k, v]) => (
          <div key={k} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</p><p className="mt-1 text-lg font-bold sm:text-2xl">{v}</p></div>
        ))}
      </div>

      {course.publicStudents && (
        <div className="card !p-0 overflow-x-auto">
          <h2 className="border-b border-line px-5 py-3 font-bold">Estado de pagos</h2>
          <table className="w-full min-w-[560px]">
            <thead><tr className="border-b border-line"><th className="th">Alumno</th>{course.months.map((m) => <th key={m} className="th text-center" title={MONTH_NAMES[m - 1]}>{MONTH_SHORT[m - 1]}</th>)}</tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.student.id} className="border-b border-line/60">
                  <th scope="row" className="td text-left font-medium">{r.student.firstName} {r.student.lastName.charAt(0)}.</th>
                  {course.months.map((m) => (
                    <td key={m} className="p-1 text-center"><span className={`inline-block w-full min-w-[34px] rounded-md py-1 text-xs font-semibold ${CELL[r.months[m].status]}`}>{MARK[r.months[m].status]}</span></td>
                  ))}
                </tr>
              ))}
              {!visible.length && <tr><td className="td text-muted" colSpan={course.months.length + 1}>Aún no hay alumnos.</td></tr>}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-muted">✓ pagado · $ abonado · · pendiente · — no aplica. Por privacidad se muestra solo la inicial del apellido y no los montos.</p>
        </div>
      )}

      {course.publicExpenses && (
        <div className="card !p-0 overflow-x-auto">
          <h2 className="border-b border-line px-5 py-3 font-bold">Gastos del curso</h2>
          {expenses.length === 0 ? <p className="p-5 text-sm text-muted">Todavía no hay gastos registrados.</p> : (
            <table className="w-full min-w-[480px]">
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="td whitespace-nowrap text-muted">{e.date}</td>
                    <td className="td">{e.description}</td>
                    <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                    <td className="td text-right">{e.receiptFile && <a className="font-semibold text-brand" target="_blank" rel="noopener noreferrer" href={`/api/p/${course.code}/receipt/${e.receiptFile}`}>Boleta</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-center text-sm text-muted">
        ¿Eres el tesorero? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link>
      </p>
    </main>
  );
}
