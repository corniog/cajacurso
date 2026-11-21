import Link from "next/link";
import { requireCenter, listCenterLinks, loadCenterLedger } from "@/lib/center";
import { clp } from "@/lib/finance";
import { unlinkCourse } from "@/app/actions/center";
import AddCourseByCode from "@/components/AddCourseByCode";
import ActionButton from "@/components/ActionButton";

export const dynamic = "force-dynamic";

export default async function CenterHome() {
  const user = await requireCenter();
  if (!user.centerEnabled) {
    return (
      <div className="card mx-auto max-w-xl space-y-3 text-center">
        <p className="text-4xl">⏳</p>
        <h1 className="text-xl font-bold">Tu perfil está pendiente de activación</h1>
        <p className="text-muted">Creaste una cuenta de centro de padres para <b>{user.centerSchool}</b>. El administrador de CajaCurso debe activarla antes de que puedas agregar cursos. Vuelve a entrar en un momento; no necesitas hacer nada más.</p>
      </div>
    );
  }
  const links = await listCenterLinks(user);
  const valid = links.filter((l) => !l.reason);
  const data = await Promise.all(valid.map(async (l) => ({ l, d: await loadCenterLedger(l.course) })));
  const tot = data.reduce((a, { d }) => ({ income: a.income + d.totals.income, expense: a.expense + d.totals.expense, balance: a.balance + d.totals.balance }), { income: 0, expense: 0, balance: 0 });
  const broken = links.filter((l) => l.reason);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cursos de {user.centerSchool}</h1>
        <p className="text-sm text-muted">Solo lectura: resumen, libro contable y gastos con boleta de los cursos que agregaste con su código de auditoría.</p>
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Cursos", String(data.length), ""], ["Ingresos (todos)", clp(tot.income), "text-emerald-700"], ["Egresos (todos)", clp(tot.expense), "text-red-700"], ["Saldo en caja (todos)", clp(tot.balance), tot.balance >= 0 ? "text-emerald-700" : "text-red-700"]].map(([a, b, c]) => (
            <div key={a} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{a}</p><p className={`mt-1 text-2xl font-bold ${c}`}>{b}</p></div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          {data.length === 0 && <div className="card text-sm text-muted">Aún no tienes cursos. Pídele a cada tesorero su <b>código de auditoría</b> (lo genera en Accesos y QR → “Centro de padres”) y agrégalo aquí.</div>}
          {data.map(({ l, d }) => (
            <article key={l.course.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{l.course.name} · {l.course.year}</h2>
                  <p className="text-sm text-muted">Tesorero/a: {d.treasurer || "—"}</p>
                </div>
                <span className={`badge ${d.rec.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{d.rec.ok ? "✅ Libro cuadrado" : "⚠️ Con diferencias"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl bg-bg p-2"><p className="text-xs text-muted">Ingresos</p><p className="font-bold">{clp(d.totals.income)}</p></div>
                <div className="rounded-xl bg-bg p-2"><p className="text-xs text-muted">Egresos</p><p className="font-bold">{clp(d.totals.expense)}</p></div>
                <div className="rounded-xl bg-bg p-2"><p className="text-xs text-muted">Saldo en caja</p><p className="font-bold">{clp(d.totals.balance)}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn" href={`/centro/c/${l.course.id}`}>Auditar curso</Link>
                <a className="btn-ghost" href={`/api/centro/c/${l.course.id}/libro/xlsx`}>⬇ Libro Excel</a>
                <a className="btn-ghost" href={`/api/centro/c/${l.course.id}/libro/pdf`}>⬇ Libro PDF</a>
                <ActionButton className="btn-ghost text-red-700" label="Quitar" confirm="¿Quitar este curso de tu vista? Podrás agregarlo de nuevo con su código." action={unlinkCourse.bind(null, l.course.id)} />
              </div>
            </article>
          ))}
          {broken.map((l) => (
            <article key={l.course.id} className="card space-y-2 !border-amber-300">
              <h2 className="font-bold">{l.course.name} · {l.course.year}</h2>
              <p className="text-sm text-amber-900">🔒 {l.reason}</p>
              <ActionButton className="btn-ghost" label="Quitar de mi lista" action={unlinkCourse.bind(null, l.course.id)} />
            </article>
          ))}
        </section>
        <aside className="card h-fit space-y-2">
          <h2 className="font-bold">Agregar un curso</h2>
          <p className="text-xs text-muted">Solo se aceptan cursos de <b>{user.centerSchool}</b>. Si el curso pertenece a otro colegio, el sistema lo rechaza.</p>
          <AddCourseByCode />
        </aside>
      </div>
    </div>
  );
}
