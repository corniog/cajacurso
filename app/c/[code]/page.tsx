import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import Logo from "@/components/Logo";
import KpiDashboard from "@/components/KpiDashboard";
import { db, schema } from "@/lib/db";
import { getCourseByCode } from "@/lib/public-data";
import { loadCourseData } from "@/lib/course-data";
import { buildKpis } from "@/lib/kpi";
import { clp } from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Resumen del curso", robots: { index: false, follow: false } };

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Vista pública del curso para apoderados: SOLO indicadores agregados.
 * No incluye nombres, pagos ni deudas de ningún alumno (eso lo ven únicamente el tesorero y la directiva).
 */
export default async function PublicCoursePage({ params }: PageProps<"/c/[code]">) {
  const { code } = await params;
  const course = await getCourseByCode(code);
  if (!course) notFound();
  const [{ rows, summary: s, expenses, extras }, [owner]] = await Promise.all([
    loadCourseData(course),
    db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, course.ownerId)).limit(1),
  ]);
  const k = buildKpis(course, rows, s, expenses, extras);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <Logo />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contabilidad pública · {course.year}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">{course.school} · {course.name}</h1>
          </div>
          <span className="rounded-full bg-slate-800 px-4 py-2 text-sm font-bold tracking-wider text-white">{course.code}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Tesorero", owner?.name ?? "—"], ["Año", String(course.year)], ["Cuota mensual", clp(course.monthlyFee)], ["Alumnos", String(k.activeStudents)]].map(([a, b]) => (
            <div key={a} className="rounded-xl border border-line bg-bg p-3"><p className="text-xs text-muted">{a}</p><p className="mt-0.5 font-bold">{b}</p></div>
          ))}
        </div>
      </section>

      <nav aria-label="Secciones" className="flex flex-wrap gap-2 text-sm font-semibold">
        {[["#caja", "Caja"], ["#recaudacion", "Recaudación"], ["#graficos", "Gráficos"], ...(course.publicExpenses ? [["#movimientos", "Movimientos"]] : [])].map(([h, t]) => (
          <a key={h} href={h} className="rounded-full border border-line bg-white px-4 py-1.5 hover:border-brand">{t}</a>
        ))}
      </nav>

      <KpiDashboard course={course} k={k} s={s} />

      {course.publicExpenses && (
        <section id="movimientos" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">Movimientos</h2>
            <p className="text-sm text-muted">Gastos con boleta e ingresos extra cobrados.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="card !p-0">
              <div className="border-b border-line px-5 py-3"><h3 className="font-bold">Gastos</h3><p className="text-sm text-muted">{expenses.length} {expenses.length === 1 ? "registrado" : "registrados"}</p></div>
              {expenses.length === 0 ? <p className="p-5 text-sm text-muted">Todavía no hay gastos registrados.</p> : (
                <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                  {expenses.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{e.description}</p>
                        <p className="text-xs text-muted">{e.category} · {dmy(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}
                          {e.receiptFile && <> · <a className="font-semibold text-brand" target="_blank" rel="noopener noreferrer" href={`/api/p/${course.code}/receipt/${e.receiptFile}`}>Ver boleta</a></>}
                        </p>
                      </div>
                      <p className="whitespace-nowrap font-bold text-red-700">-{clp(e.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card !p-0">
              <div className="border-b border-line px-5 py-3"><h3 className="font-bold">Ingresos extra</h3><p className="text-sm text-muted">{k.sharedExtras.length} {k.sharedExtras.length === 1 ? "del curso" : "del curso"}{k.individualExtras ? ` · ${k.individualExtras} individuales (incluidos en los totales)` : ""}</p></div>
              {k.sharedExtras.length === 0 ? <p className="p-5 text-sm text-muted">Todavía no hay ingresos extra del curso.</p> : (
                <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                  {k.sharedExtras.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div><p className="font-semibold">{e.description}</p><p className="text-xs text-muted">{dmy(e.date)}</p></div>
                      <p className="whitespace-nowrap font-bold text-emerald-700">+{clp(e.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <p className="rounded-xl bg-bg p-4 text-center text-sm text-muted">
        Por privacidad, aquí no se muestran nombres ni pagos de alumnos. Cada apoderado ve solo la información de su hijo/a con su enlace o código personal.
      </p>
      <p className="text-center text-sm text-muted">
        ¿Eres el tesorero? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link>
      </p>
    </main>
  );
}
