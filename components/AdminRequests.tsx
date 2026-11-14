import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import ActionForm from "@/components/ActionForm";
import { approveRequest, rejectRequest } from "@/app/actions/admin";
import { PLANS } from "@/lib/brand";
import { clp } from "@/lib/finance";

/** Solicitudes de plan por transferencia pendientes de aprobación. */
export default async function AdminRequests() {
  const rows = await db.select({
    sub: schema.subscriptions, course: schema.courses, owner: schema.users,
  }).from(schema.subscriptions)
    .innerJoin(schema.courses, eq(schema.subscriptions.courseId, schema.courses.id))
    .innerJoin(schema.users, eq(schema.courses.ownerId, schema.users.id))
    .where(and(eq(schema.subscriptions.status, "pending"), eq(schema.subscriptions.method, "transferencia")))
    .orderBy(desc(schema.subscriptions.createdAt));

  if (!rows.length) return <div className="card text-sm text-muted">No hay solicitudes pendientes. 🎉</div>;
  return (
    <ul className="space-y-3">
      {rows.map(({ sub, course, owner }) => (
        <li key={sub.id} className="card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold">{course.name} · {course.year} <span className="font-normal text-muted">— {course.school}</span></p>
              <p className="text-sm text-muted">{owner.name} · {owner.email}</p>
              {sub.note && <p className="mt-1 text-sm">{sub.note}</p>}
              <p className="text-xs text-muted">Pidió {sub.createdAt.toLocaleString("es-CL")}</p>
            </div>
            <span className="badge bg-amber-100 text-amber-900">{sub.plan === "annual" ? PLANS.annual.label : PLANS.monthly.label} · {clp(sub.amount)}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ActionForm action={approveRequest.bind(null, sub.id)} submit="✓ Aprobar y activar" resetOnSuccess={false}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block"><span className="label">Monto recibido (CLP)</span><input name="amount" type="number" min={0} defaultValue={sub.amount} className="input" /></label>
                <label className="block"><span className="label">Nota (opcional)</span><input name="note" className="input" maxLength={300} placeholder="Ej: transferencia #1234" /></label>
              </div>
            </ActionForm>
            <ActionForm action={rejectRequest.bind(null, sub.id)} submit="✕ Rechazar" submitClassName="btn-danger" resetOnSuccess={false}>
              <label className="block"><span className="label">Motivo (opcional)</span><input name="note" className="input" maxLength={300} /></label>
            </ActionForm>
          </div>
        </li>
      ))}
    </ul>
  );
}
