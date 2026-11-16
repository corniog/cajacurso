import Link from "next/link";
import { requireCourse } from "@/lib/auth";
import { loadCourseData } from "@/lib/course-data";
import { addExtra, deleteExtra } from "@/app/actions/course";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import { clp } from "@/lib/finance";
import { todayISO } from "@/lib/util";
import { hasFeature } from "@/lib/features";
import { PLANS } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ingresos extra" };

export default async function ExtrasPage({ params }: PageProps<"/app/c/[id]/extras">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  const { extras, students, summary } = await loadCourseData(course);
  const pro = hasFeature(course, "extras");
  const full = !pro && extras.length >= PLANS.freeExtraLimit;
  const names = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Ingresos extra</h2>
          <p className="text-sm text-muted">Rifas, ventas de comida, aportes voluntarios y otros ingresos distintos de la cuota.</p>
        </div>
        <span className={`badge ${full ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
          {pro ? "Ilimitados" : `${extras.length} de ${PLANS.freeExtraLimit} en plan Gratis`}
        </span>
      </div>

      {canWrite && (full ? (
        <div className="card text-sm">
          Llegaste al límite de {PLANS.freeExtraLimit} ingresos extra del plan Gratis.{" "}
          <Link href={`/app/c/${id}/plan`} className="font-semibold text-brand">Activa el Plan Pro (30 días de prueba)</Link> para registrar sin tope.
        </div>
      ) : (
        <div className="card">
          <h3 className="mb-3 font-bold">Registrar ingreso</h3>
          <ActionForm action={addExtra.bind(null, id)} submit="Guardar ingreso">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3"><span className="label">Descripción</span><input name="description" className="input" required maxLength={160} placeholder="Ej: Rifa del paseo" /></label>
              <label className="block"><span className="label">Monto (CLP)</span><input name="amount" type="number" min={1} step={1} className="input" required /></label>
              <label className="block"><span className="label">Fecha</span><input name="date" type="date" className="input" required defaultValue={todayISO()} /></label>
            </div>
            {students.length > 0 && (
              <details className="rounded-xl border border-line px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">Asociar a alumnos específicos (opcional)</summary>
                <p className="mt-2 text-xs text-muted">Si no eliges a nadie, el ingreso es del curso completo.</p>
                <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="studentIds" value={s.id} /> {s.lastName}, {s.firstName}
                    </label>
                  ))}
                </div>
              </details>
            )}
          </ActionForm>
        </div>
      ))}

      <div className="card !p-0 overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="font-bold">Registrados ({extras.length})</h3>
          <p className="text-sm">Total: <b>{clp(summary.extras)}</b></p>
        </div>
        {extras.length === 0 ? <p className="p-5 text-sm text-muted">Aún no hay ingresos extra.</p> : (
          <table className="w-full min-w-[560px]">
            <thead><tr className="border-b border-line"><th className="th">Fecha</th><th className="th">Descripción</th><th className="th">Aplica a</th><th className="th text-right">Monto</th><th className="th" /></tr></thead>
            <tbody>
              {extras.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="td whitespace-nowrap">{e.date}</td>
                  <td className="td">{e.description}</td>
                  <td className="td text-sm text-muted">
                    {e.studentIds.length === 0 ? "Curso completo" : e.studentIds.map((sid) => names.get(sid) ?? "—").join(", ")}
                  </td>
                  <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                  <td className="td text-right">
                    {canWrite && <ActionButton className="btn-danger !px-2 !py-1" label="Eliminar" confirm="¿Eliminar este ingreso?" action={deleteExtra.bind(null, id, e.id)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
