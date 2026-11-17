import { desc, eq } from "drizzle-orm";
import { requireCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { saveTransferInfo, createContribution, toggleContribution, deleteContribution, confirmContributionPayment, rejectContributionPayment } from "@/app/actions/contributions";
import { clp } from "@/lib/finance";
import ActionForm from "@/components/ActionForm";
import ActionNotice from "@/components/ActionNotice";
import ActionButton from "@/components/ActionButton";
import FeatureLock from "@/components/FeatureLock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aportes y colectas" };

export default async function AportesPage({ params }: PageProps<"/app/c/[id]/aportes">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  if (!hasFeature(course, "contributions")) return <FeatureLock courseId={id} feature="contributions" />;
  const [contribs, pays, students] = await Promise.all([
    db.select().from(schema.contributions).where(eq(schema.contributions.courseId, id)).orderBy(desc(schema.contributions.createdAt)),
    db.select().from(schema.contributionPayments).where(eq(schema.contributionPayments.courseId, id)).orderBy(desc(schema.contributionPayments.createdAt)),
    db.select().from(schema.students).where(eq(schema.students.courseId, id)),
  ]);
  const name = new Map(students.map((s) => [s.id, `${s.lastName}, ${s.firstName}`]));
  const pending = pays.filter((p) => p.status === "pending");
  const confirmed = pays.filter((p) => p.status === "confirmed");
  const totalOf = (cid: string) => confirmed.filter((p) => p.contributionId === cid).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <div>
        <h2 className="text-lg font-bold">Aportes y colectas</h2>
        <p className="max-w-2xl text-sm text-muted">
          Para todo lo que no es la cuota mensual: regalo de la profesora, ventas, compras, paseos. Los apoderados ven un botón en su ficha para pagar o informar su transferencia.
          Cada aporte confirmado se registra solo como ingreso del curso (aparece en el libro contable).
        </p>
      </div>

      {canWrite && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 font-bold">Datos para transferir</h3>
            <p className="mb-2 text-xs text-muted">Los verán los apoderados cuando elijan “Ya transferí”. Incluye banco, tipo y número de cuenta, RUT, nombre y correo.</p>
            <ActionForm action={saveTransferInfo.bind(null, id)} submit="Guardar" resetOnSuccess={false}>
              <textarea name="transferInfo" rows={5} maxLength={500} className="input" defaultValue={course.transferInfo ?? ""} placeholder={"Banco Estado\nCuenta Vista 123456789\nRUT 11.111.111-1\nNombre Apellido\ncorreo@ejemplo.cl"} aria-label="Datos para transferir" />
            </ActionForm>
          </div>
          <div className="card">
            <h3 className="mb-2 font-bold">Nueva colecta</h3>
            <ActionForm action={createContribution.bind(null, id)} submit="Crear colecta">
              <div><label className="label" htmlFor="ct-title">¿Para qué es? *</label><input id="ct-title" name="title" className="input" required maxLength={100} placeholder="Regalo de la profesora" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="ct-amount">Monto por familia</label><input id="ct-amount" name="amount" type="number" min={100} className="input" placeholder="Libre" /></div>
                <div><label className="label" htmlFor="ct-due">Fecha límite</label><input id="ct-due" name="dueDate" type="date" className="input" /></div>
              </div>
              <div><label className="label" htmlFor="ct-desc">Detalle (opcional)</label><input id="ct-desc" name="description" className="input" maxLength={300} /></div>
            </ActionForm>
          </div>
        </div>
      )}

      <div className="card !p-0">
        <h3 className="border-b border-line px-5 py-3 font-bold">Por confirmar ({pending.length})</h3>
        {pending.length === 0 ? <p className="p-5 text-sm text-muted">No hay aportes esperando confirmación.</p> : (
          <ul className="divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold">{name.get(p.studentId) ?? "Alumno"} · {clp(p.amount)}</p>
                  <p className="text-muted">{p.concept} · {p.method === "mercadopago" ? "Mercado Pago (esperando aprobación)" : "dice que transfirió"}{p.note ? ` · “${p.note}”` : ""} · {p.createdAt.toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</p>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <ActionNotice className="btn !px-3 !py-1.5 text-sm" label="✔ Confirmar (llegó el dinero)" confirm={`¿Confirmas que recibiste ${clp(p.amount)}? Se suma a los ingresos del curso.`} action={confirmContributionPayment.bind(null, id, p.id)} />
                    <ActionNotice className="btn-danger !px-3 !py-1.5 text-sm" label="Rechazar" confirm="¿Rechazar este aporte? No se suma al curso." action={rejectContributionPayment.bind(null, id, p.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {contribs.map((c) => (
          <div key={c.id} className={`card space-y-1 ${c.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{c.title}</h3>
              <span className={`badge ${c.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{c.active ? "Abierta" : "Cerrada"}</span>
            </div>
            <p className="text-sm text-muted">{c.amount ? `Sugerido ${clp(c.amount)} por familia` : "Monto libre"}{c.dueDate ? ` · hasta ${c.dueDate}` : ""}</p>
            {c.description && <p className="text-xs text-muted">{c.description}</p>}
            <p className="text-sm">Recaudado: <b>{clp(totalOf(c.id))}</b> ({confirmed.filter((p) => p.contributionId === c.id).length} aportes)</p>
            {canWrite && (
              <div className="flex gap-2 pt-1">
                <ActionButton className="btn-ghost !px-2.5 !py-1 text-xs" label={c.active ? "Cerrar colecta" : "Reabrir"} action={toggleContribution.bind(null, id, c.id)} />
                <ActionNotice className="btn-danger !px-2.5 !py-1 text-xs" label="Eliminar" confirm="¿Eliminar esta colecta?" action={deleteContribution.bind(null, id, c.id)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {confirmed.length > 0 && (
        <div className="card !p-0">
          <h3 className="border-b border-line px-5 py-3 font-bold">Aportes confirmados</h3>
          <ul className="divide-y divide-line text-sm">
            {confirmed.slice(0, 60).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-5 py-2.5">
                <span>{name.get(p.studentId) ?? "Alumno"} · {p.concept} <span className="text-muted">({p.method})</span></span>
                <b>{clp(p.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
