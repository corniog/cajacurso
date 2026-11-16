import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import Link from "next/link";
import Logo from "@/components/Logo";
import PayOnline from "@/components/PayOnline";
import { db, schema } from "@/lib/db";
import { getStudentByToken } from "@/lib/public-data";
import { buildRows, clp, MONTH_NAMES } from "@/lib/finance";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ficha del apoderado", robots: { index: false, follow: false } };

const BADGE = {
  pagado: "bg-emerald-100 text-emerald-900", abonado: "bg-amber-100 text-amber-900",
  pendiente: "bg-slate-100 text-slate-700", no_aplica: "bg-transparent text-slate-400",
} as const;
const TEXT = { pagado: "Pagado", abonado: "Abonado", pendiente: "Pendiente", no_aplica: "No aplica" } as const;

export default async function FichaPage({ params, searchParams }: PageProps<"/f/[token]">) {
  const { token } = await params;
  const found = await getStudentByToken(token);
  if (!found) notFound();
  const { student, course } = found;
  const sp = await searchParams;

  const payments = await db.select().from(schema.payments).where(eq(schema.payments.studentId, student.id));
  const [row] = buildRows(course, [student], payments);
  const [integ] = await db.select({ mp: schema.integrations.mpAccessToken }).from(schema.integrations)
    .where(eq(schema.integrations.courseId, course.id)).limit(1);
  const canPay = hasFeature(course, "mercadopago") && !!integ?.mp;
  const options = course.months
    .filter((m) => row.months[m].status === "pendiente" || row.months[m].status === "abonado")
    .map((m) => ({ month: m, owed: course.monthlyFee - row.months[m].paid }));
  const history = [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-8">
      <Logo />
      {sp.pago === "ok" && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">¡Gracias! Si tu pago fue aprobado, se verá reflejado aquí en unos instantes.</p>}
      {sp.pago === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">El pago no se completó. Puedes intentarlo nuevamente.</p>}

      <div className="card">
        <p className="text-sm text-muted">{course.school} · {course.name} {course.year}</p>
        <h1 className="text-2xl font-bold">{student.firstName} {student.lastName}</h1>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Cuota mensual</p><p className="font-bold">{clp(course.monthlyFee)}</p></div>
          <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Pagado</p><p className="font-bold text-emerald-700">{clp(row.paid)}</p></div>
          <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Debe</p><p className={`font-bold ${row.debt > 0 ? "text-red-700" : "text-emerald-700"}`}>{clp(row.debt)}</p></div>
        </div>
        {row.debt === 0 && <p className="mt-3 text-sm text-emerald-700">✓ Estás al día con las cuotas vencidas.</p>}
        <a className="btn-ghost mt-4" href={`/api/f/${token}/pdf`}>⬇ Descargar estado de cuenta (PDF)</a>
      </div>

      <div className="card !p-0">
        <h2 className="border-b border-line px-5 py-3 font-bold">Cuotas del año</h2>
        <ul className="divide-y divide-line">
          {course.months.map((m) => {
            const c = row.months[m];
            return (
              <li key={m} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>{MONTH_NAMES[m - 1]}</span>
                <span className="flex items-center gap-3">
                  {c.status === "abonado" && <span className="text-muted">{clp(c.paid)} de {clp(course.monthlyFee)}</span>}
                  <span className={`badge ${BADGE[c.status]}`}>{TEXT[c.status]}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {canPay && <PayOnline token={token} options={options} />}

      {history.length > 0 && (
        <div className="card !p-0">
          <h2 className="border-b border-line px-5 py-3 font-bold">Tus pagos</h2>
          <ul className="divide-y divide-line text-sm">
            {history.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-2.5">
                <span>{p.paidAt} · {MONTH_NAMES[p.month - 1]} <span className="text-muted">({p.method})</span></span>
                <span className="font-semibold">{clp(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-sm text-muted">
        <Link href={`/c/${course.code}`} className="font-semibold text-brand">Ver el resumen general del curso</Link>
      </p>
    </main>
  );
}
