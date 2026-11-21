import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCenter, getCenterCourse, loadCenterLedger } from "@/lib/center";
import { buildKpis } from "@/lib/kpi";
import { clp } from "@/lib/finance";
import KpiDashboard from "@/components/KpiDashboard";
import LedgerTable, { type LedgerRowData } from "@/components/LedgerTable";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Auditoría del curso", robots: { index: false, follow: false } };
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default async function CenterCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireCenter();
  const course = await getCenterCourse(user, courseId);
  if (!course) notFound();
  const d = await loadCenterLedger(course);
  const k = buildKpis(course, d.rows, d.summary, d.expenses, d.extras);
  const rows: LedgerRowData[] = d.entries.map((e) => { const { createdAt: _c, ...rest } = e; void _c; return { ...rest, locked: "Vista de auditoría: solo lectura", edit: {} }; });
  const base = `/api/centro/c/${course.id}`;

  return (
    <div className="space-y-6">
      <div className="no-print"><Link href="/centro" className="text-sm text-muted">← Cursos de {user.centerSchool}</Link></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{course.name} · {course.year}</h1>
          <p className="text-muted">{course.school} · Tesorero/a: {d.treasurer || "—"} · Cuota mensual {clp(course.monthlyFee)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <a className="btn-ghost" href={`${base}/libro/xlsx`}>⬇ Libro Excel</a>
          <a className="btn" href={`${base}/libro/pdf`}>⬇ Libro PDF</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Total ingresos", clp(d.totals.income), "text-emerald-700"], ["Total egresos", clp(d.totals.expense), "text-red-700"], ["Saldo en caja", clp(d.totals.balance), d.totals.balance >= 0 ? "text-emerald-700" : "text-red-700"], ["Movimientos", String(d.totals.count), ""]].map(([a, b, c]) => (
          <div key={a} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{a}</p><p className={`mt-1 text-2xl font-bold ${c}`}>{b}</p></div>
        ))}
      </div>

      <div className={`card space-y-2 ${d.rec.ok ? "!border-emerald-300" : "!border-red-300"}`}>
        <h2 className="font-bold">{d.rec.ok ? "✅ El libro cuadra con la aplicación del curso" : "⚠️ Hay diferencias entre el libro y la aplicación"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 font-medium">Concepto</th><th className="py-1 text-right font-medium">Libro</th><th className="py-1 text-right font-medium">Aplicación</th><th className="py-1 text-right font-medium">Estado</th></tr></thead>
            <tbody>
              {d.rec.rows.map((r) => (
                <tr key={r.label} className="border-t border-line/60">
                  <td className="py-1.5">{r.label}</td><td className="py-1.5 text-right tabular-nums">{clp(r.ledger)}</td><td className="py-1.5 text-right tabular-nums">{clp(r.app)}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{r.ok ? "Cuadra" : "No cuadra"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Libro contable</h2>
        <LedgerTable courseId={course.id} rows={rows} canWrite={false} />
        <p className="text-xs text-muted">Los alumnos aparecen abreviados (nombre e inicial del apellido). Cada cuota, ingreso y gasto está en el libro en orden de fecha.</p>
      </section>

      <div className="card !p-0 overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 font-bold">Gastos con respaldo ({d.expenses.length})</h2>
        {d.expenses.length === 0 ? <p className="p-5 text-sm text-muted">Sin gastos registrados.</p> : (
          <table className="w-full min-w-[560px]">
            <tbody>
              {d.expenses.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="td whitespace-nowrap text-muted">{dmy(e.date)}</td>
                  <td className="td">{e.description}<div className="text-xs text-muted">{[e.vendor, e.docNumber && `N° ${e.docNumber}`].filter(Boolean).join(" · ")}</div></td>
                  <td className="td capitalize">{e.category}</td>
                  <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                  <td className="td text-right">{e.receiptFile ? <a className="font-semibold text-brand" target="_blank" rel="noopener noreferrer" href={`${base}/boleta/${e.receiptFile}`}>Boleta</a> : <span className="text-xs text-amber-700">sin boleta</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Indicadores del curso</h2>
        <KpiDashboard course={course} k={k} s={d.summary} />
      </section>

      <div className="card">
        <h2 className="mb-2 font-bold">Bitácora de cambios</h2>
        {d.audit.length === 0 ? <p className="text-sm text-muted">Ningún movimiento ha sido corregido ni eliminado.</p> : (
          <ul className="divide-y divide-line text-sm">
            {d.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{a.action === "edit" ? "Corrección" : "Eliminación"}:</b> {a.summary}</span>
                <span className="text-xs text-muted">{a.userName} · {a.createdAt.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
