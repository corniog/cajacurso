import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { resolveRequest } from "@/app/actions/support";
import ActionForm from "@/components/ActionForm";

/** Solicitudes de funciones y mensajes de los usuarios (pendientes primero, luego las últimas atendidas). */
export default async function SupportRequests({ limit = 30 }: { limit?: number }) {
  const rows = await db.select({ r: schema.supportRequests, u: schema.users, c: schema.courses })
    .from(schema.supportRequests)
    .innerJoin(schema.users, eq(schema.supportRequests.userId, schema.users.id))
    .leftJoin(schema.courses, eq(schema.supportRequests.courseId, schema.courses.id))
    .orderBy(desc(schema.supportRequests.createdAt)).limit(100);
  const pending = rows.filter((x) => x.r.status === "pending");
  const done = rows.filter((x) => x.r.status !== "pending").slice(0, limit);
  const title = (k: string | null) => (k && FEATURES[k as FeatureKey]?.label) || k || "Mensaje";

  return (
    <div className="space-y-3">
      {pending.length === 0 ? <div className="card text-sm text-muted">No hay solicitudes de usuarios pendientes. 🎉</div> : (
        <ul className="space-y-3">
          {pending.map(({ r, u, c }) => (
            <li key={r.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{r.kind === "feature" ? `Pide activar: ${title(r.featureKey)}` : "Mensaje"} {c && <span className="font-normal text-muted">— {c.name} {c.year} · {c.school}</span>}</p>
                  <p className="text-sm text-muted">{u.name} · {u.email} · {r.createdAt.toLocaleString("es-CL")}</p>
                  {r.message && <p className="mt-1 rounded-lg bg-bg p-2 text-sm">“{r.message}”</p>}
                </div>
                <span className="badge bg-amber-100 text-amber-900">Pendiente</span>
              </div>
              <ActionForm action={resolveRequest.bind(null, r.id, "approved")} submit={r.kind === "feature" ? "Aprobar y activar" : "Marcar como atendida"} resetOnSuccess={false}>
                <label className="label" htmlFor={`n-${r.id}`}>Respuesta para el usuario (se le envía por correo)</label>
                <input id={`n-${r.id}`} name="adminNote" className="input" maxLength={300} placeholder="Opcional" />
              </ActionForm>
              {r.kind === "feature" && (
                <ActionForm action={resolveRequest.bind(null, r.id, "rejected")} submit="Rechazar" submitClassName="btn-danger" resetOnSuccess={false}>
                  <input name="adminNote" className="input" maxLength={300} placeholder="Motivo del rechazo (opcional)" aria-label="Motivo del rechazo" />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Últimas atendidas ({done.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {done.map(({ r, u, c }) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>{r.kind === "feature" ? title(r.featureKey) : "Mensaje"} · {u.name}{c ? ` · ${c.name}` : ""}{r.adminNote ? ` · “${r.adminNote}”` : ""}</span>
                <span className={r.status === "approved" ? "text-emerald-700" : "text-red-700"}>{r.status === "approved" ? "Aprobada" : "Rechazada"} {r.resolvedAt?.toLocaleDateString("es-CL")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
