import { requireCourse } from "@/lib/auth";
import { loadCourseData, appUrl } from "@/lib/course-data";
import { clp, MONTH_NAMES } from "@/lib/finance";
import CopyButton from "@/components/CopyButton";
import KpiDashboard from "@/components/KpiDashboard";
import { buildKpis } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export const metadata = { title: "Resumen" };

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="card !p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}

export default async function SummaryPage({ params }: PageProps<"/app/c/[id]">) {
  const { id } = await params;
  const { course } = await requireCourse(id);
  const { students, rows, summary: s, expenses, extras } = await loadCourseData(course);
  const k = buildKpis(course, rows, s, expenses, extras);
  const active = students.filter((x) => x.active).length;
  const link = `${appUrl()}/c/${course.code}`;
  const maxBar = Math.max(1, ...s.byMonth.map((m) => Math.max(m.collected, m.expected)));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Alumnos activos" value={String(active)} />
        <Kpi label="Recaudado (cuotas)" value={clp(s.collected)} />
        <Kpi label="Balance" value={clp(s.balance)} tone={s.balance >= 0 ? "good" : "bad"} />
        <Kpi label="Deuda vencida" value={clp(s.debt)} tone={s.debt > 0 ? "bad" : "good"} />
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">Comparte el curso con los apoderados</h2>
        <p className="text-sm text-muted">
          Los apoderados entran con el código (sin crear cuenta) y ven solo un resumen del curso (totales, gráficos y gastos), nunca a otros alumnos. La ficha individual de cada alumno se envía desde la sección Alumnos.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-brand-soft px-3 py-2 text-base font-bold tracking-wider text-brand-dark">{course.code}</code>
          <CopyButton text={course.code} label="Copiar código" />
          <CopyButton text={link} label="Copiar enlace" />
        </div>
        <p className="break-all text-xs text-muted">{link}</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold">Indicadores del curso</h2>
        <KpiDashboard course={course} k={k} s={s} />
      </div>

      <div className="card">
        <h2 className="mb-4 font-bold">Recaudación por mes</h2>
        <ul className="space-y-2">
          {s.byMonth.map((m) => (
            <li key={m.month} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
              <span className="text-muted">{MONTH_NAMES[m.month - 1]}</span>
              <span className="relative h-3 overflow-hidden rounded-full bg-slate-100" role="img"
                aria-label={`${MONTH_NAMES[m.month - 1]}: ${clp(m.collected)} de ${clp(m.expected)}`}>
                <span className="absolute inset-y-0 left-0 rounded-full bg-slate-200" style={{ width: `${(m.expected / maxBar) * 100}%` }} />
                <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(m.collected / maxBar) * 100}%` }} />
              </span>
              <span className="tabular-nums">{clp(m.collected)} <span className="text-muted">/ {clp(m.expected)}</span></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold">Con deuda vencida</h2>
          {rows.filter((r) => r.debt > 0 && r.student.active).length === 0 ? (
            <p className="text-sm text-muted">Nadie tiene deuda vencida. 🎉</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {rows.filter((r) => r.debt > 0 && r.student.active).sort((a, b) => b.debt - a.debt).slice(0, 8).map((r) => (
                <li key={r.student.id} className="flex justify-between py-2">
                  <span>{r.student.lastName}, {r.student.firstName}</span>
                  <span className="font-semibold text-red-700">{clp(r.debt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Últimos gastos</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay gastos registrados.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {expenses.slice(0, 6).map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{e.description}</span>
                  <span className="shrink-0 font-semibold">{clp(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
