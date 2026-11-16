import { Donut, LineChart, BarChart, KPI_COLORS as C } from "@/components/KpiCharts";
import { MONTH_SHORT, MONTH_NAMES, clp } from "@/lib/finance";
import type { Course } from "@/lib/db/schema";
import type { Summary } from "@/lib/finance";
import type { buildKpis } from "@/lib/kpi";

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="card !p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

/** Indicadores del curso (caja, recaudación y gráficos). Solo datos agregados: sirve para el tesorero y para la vista pública. */
export default function KpiDashboard({ course, k, s }: { course: Course; k: ReturnType<typeof buildKpis>; s: Summary }) {
  const mName = MONTH_NAMES[k.curMonth - 1] ?? "";
  const labels = k.series.map((x) => MONTH_SHORT[x.month - 1]);
  return (
    <>
      <section id="caja" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-slate-800 p-6 text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">Disponible en caja</p>
            <p className={`mt-1 text-4xl font-bold sm:text-5xl ${s.balance >= 0 ? "text-emerald-300" : "text-red-300"}`}>{clp(s.balance)}</p>
          </div>
          <p className="max-w-xs text-sm text-slate-300">Cuotas + extras cobrados, menos los gastos del curso.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Cuotas recaudadas" value={clp(s.collected)} tone="good" />
          <Stat label="Ingresos extra" value={clp(s.extras)} tone="good" />
          <Stat label="Gastos" value={clp(s.expenses)} tone="bad" />
          <Stat label="Alumnos" value={String(k.activeStudents)} />
        </div>
      </section>

      <section id="recaudacion" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Recaudación</h2>
          <p className="text-sm text-muted">Qué se ha cobrado y qué falta, solo con pagos reales.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card">
            <p className="font-semibold text-muted">Hasta {mName} {course.year}</p>
            <p className="mt-2 text-4xl font-bold">{pct(k.toDate.pct)}</p>
            <Progress value={k.toDate.pct} color={C.green} />
            <p className="mt-2 text-sm text-muted">{clp(k.toDate.collected)} de {clp(k.toDate.expected)}</p>
          </div>
          <div className="card">
            <p className="font-semibold text-muted">Faltante hasta {mName}</p>
            <p className={`mt-2 text-4xl font-bold ${k.toDate.missing > 0 ? "text-red-700" : "text-emerald-700"}`}>{clp(k.toDate.missing)}</p>
            <p className="mt-2 text-sm text-muted">{pct(100 - k.toDate.pct)} pendiente a la fecha</p>
          </div>
          <div className="card">
            <p className="font-semibold text-muted">Año completo</p>
            <p className="mt-2 text-4xl font-bold">{pct(k.year.pct)}</p>
            <Progress value={k.year.pct} color={C.gold} />
            <p className="mt-2 text-sm text-muted">{clp(k.year.collected)} de {clp(k.year.expected)}</p>
          </div>
          <div className="card">
            <p className="font-semibold text-muted">Saldo de cuotas por recaudar</p>
            <p className="mt-2 text-4xl font-bold">{clp(k.year.missing)}</p>
            <p className="mt-2 text-sm text-muted">Compromisos anuales pendientes</p>
          </div>
        </div>
      </section>

      <section id="graficos" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Gráficos</h2>
          <p className="text-sm text-muted">Pagos, evolución y balance de los meses del año.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card">
            <h3 className="font-bold">Cumplimiento hasta {mName} {course.year}</h3>
            <p className="mb-2 text-sm text-muted">Pagos acumulados vs saldo</p>
            <Donut label="Cumplimiento a la fecha" parts={[{ value: k.toDate.collected, color: C.green, name: "Pagos realizados" }, { value: k.toDate.missing, color: C.gold, name: "Saldo pendiente" }]} />
            <p className="mt-2 flex justify-center gap-4 text-xs text-muted">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.green }} />Pagos realizados</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.gold }} />Saldo pendiente</span>
            </p>
          </div>
          <div className="card">
            <h3 className="font-bold">Estado anual {course.year}</h3>
            <p className="mb-2 text-sm text-muted">Montos pagados e incluye abonos</p>
            <Donut hole={0} label="Estado anual" parts={[{ value: k.year.collected, color: C.green, name: "Monto pagado" }, { value: k.year.missing, color: C.red, name: "Monto pendiente" }]} />
            <p className="mt-2 flex justify-center gap-4 text-xs text-muted">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.green }} />Monto pagado</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.red }} />Monto pendiente</span>
            </p>
          </div>
          <div className="card">
            <h3 className="font-bold">Evolución mensual</h3>
            <p className="mb-2 text-sm text-muted">Ingresos reales vs gastos</p>
            <LineChart labels={labels} a={k.series.map((x) => x.income)} b={k.series.map((x) => x.expenses)} label="Ingresos y gastos por mes" />
            <p className="mt-1 flex justify-center gap-4 text-xs text-muted">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.green }} />Ingresos</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.red }} />Gastos</span>
            </p>
          </div>
          <div className="card">
            <h3 className="font-bold">Balance histórico</h3>
            <p className="mb-2 text-sm text-muted">Resultado mes a mes</p>
            <BarChart labels={labels} values={k.series.map((x) => x.balance)} label="Balance por mes" />
          </div>
        </div>
      </section>
    </>
  );
}
