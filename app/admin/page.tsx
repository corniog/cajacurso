import { and, count, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clp } from "@/lib/finance";
import AdminRequests from "@/components/AdminRequests";
import { adminEmails } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const now = new Date();
  const since = new Date(Date.now() - 30 * 86400000);
  const [[u], [c], [pro], [pend], [rev], [rev30]] = await Promise.all([
    db.select({ n: count() }).from(schema.users),
    db.select({ n: count() }).from(schema.courses),
    db.select({ n: count() }).from(schema.courses).where(gt(schema.courses.proUntil, now)),
    db.select({ n: count() }).from(schema.subscriptions).where(and(eq(schema.subscriptions.status, "pending"), eq(schema.subscriptions.method, "transferencia"))),
    db.select({ t: sql<number>`coalesce(sum(${schema.subscriptions.amount}),0)::int` }).from(schema.subscriptions).where(eq(schema.subscriptions.status, "active")),
    db.select({ t: sql<number>`coalesce(sum(${schema.subscriptions.amount}),0)::int` }).from(schema.subscriptions).where(and(eq(schema.subscriptions.status, "active"), gt(schema.subscriptions.createdAt, since))),
  ]);
  const kpis: [string, string][] = [
    ["Usuarios", String(u.n)], ["Cursos", String(c.n)], ["Cursos con Pro", String(pro.n)],
    ["Solicitudes pendientes", String(pend.n)], ["Ingresos (últimos 30 días)", clp(rev30.t)], ["Ingresos totales", clp(rev.t)],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map(([k, v]) => <div key={k} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Solicitudes por transferencia</h2>
        <AdminRequests />
      </section>
      <p className="text-xs text-muted">Administradores: {adminEmails().join(", ") || "ninguno configurado"}. Se definen en la variable ADMIN_EMAILS.</p>
    </>
  );
}
