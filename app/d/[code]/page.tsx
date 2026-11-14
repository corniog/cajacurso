import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import PaymentGrid from "@/components/PaymentGrid";
import ReportView from "@/components/ReportView";
import PrintButton from "@/components/PrintButton";
import { getCourseByDirectiveCode } from "@/lib/public-data";
import { loadCourseData } from "@/lib/course-data";
import { clp } from "@/lib/finance";
import { isPro } from "@/lib/plans";

export const metadata: Metadata = { title: "Vista de directivos", robots: { index: false, follow: false } };

export default async function DirectivePage({ params }: PageProps<"/d/[code]">) {
  const { code } = await params;
  const course = await getCourseByDirectiveCode(code);
  if (!course) notFound();
  const { rows, payments, expenses, extras, students, summary } = await loadCourseData(course);
  const base = `/api/d/${course.directiveCode}`;
  const names = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <span className="badge bg-blue-100 text-blue-800">Vista de directivos · solo lectura</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{course.name} · {course.year}</h1>
          <p className="text-muted">{course.school} · Cuota mensual {clp(course.monthlyFee)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <a className="btn-ghost" href={`${base}/export/xlsx`}>⬇ Excel</a>
          {isPro(course) && <a className="btn" href={`${base}/export/pdf`}>⬇ PDF</a>}
        </div>
      </div>

      <ReportView course={course} rows={rows} summary={summary} />

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Pagos por alumno y mes</h2>
        <PaymentGrid
          courseId={course.id} fee={course.monthlyFee} months={course.months} canWrite={false}
          students={rows.map((r) => ({ id: r.student.id, name: `${r.student.lastName}, ${r.student.firstName}`, active: r.student.active, months: r.months }))}
          payments={payments.map((p) => ({ id: p.id, studentId: p.studentId, month: p.month, amount: p.amount, paidAt: p.paidAt, method: p.method, notes: p.notes }))}
        />
      </section>

      <div className="card !p-0 overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-bold">Gastos ({expenses.length})</h2>
        {expenses.length === 0 ? <p className="p-5 text-sm text-muted">Sin gastos registrados.</p> : (
          <table className="w-full min-w-[560px]">
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="td whitespace-nowrap text-muted">{e.date}</td>
                  <td className="td">{e.description}<div className="text-xs text-muted">{[e.vendor, e.docNumber && `N° ${e.docNumber}`].filter(Boolean).join(" · ")}</div></td>
                  <td className="td capitalize">{e.category}</td>
                  <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                  <td className="td text-right">{e.receiptFile && <a className="font-semibold text-brand" target="_blank" rel="noopener noreferrer" href={`${base}/receipt/${e.receiptFile}`}>Boleta</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card !p-0 overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-bold">Ingresos extra ({extras.length})</h2>
        {extras.length === 0 ? <p className="p-5 text-sm text-muted">Sin ingresos extra.</p> : (
          <table className="w-full min-w-[480px]">
            <tbody>
              {extras.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="td whitespace-nowrap text-muted">{e.date}</td>
                  <td className="td">{e.description}</td>
                  <td className="td text-sm text-muted">{e.studentIds.length === 0 ? "Curso completo" : e.studentIds.map((i) => names.get(i) ?? "—").join(", ")}</td>
                  <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="no-print text-center text-sm text-muted">Esta vista no permite editar. ¿Eres el tesorero? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link></p>
    </main>
  );
}
