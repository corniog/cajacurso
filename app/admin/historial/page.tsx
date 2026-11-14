import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { clp } from "@/lib/finance";

export const dynamic = "force-dynamic";

export const metadata = { title: "Historial de pagos" };
const STATUS = { pending: "Pendiente", active: "Activo", cancelled: "Cancelado", expired: "Vencido" } as const;
const TONE = { pending: "bg-amber-100 text-amber-900", active: "bg-emerald-100 text-emerald-900", cancelled: "bg-slate-100 text-slate-600", expired: "bg-slate-100 text-slate-600" } as const;

export default async function HistoryPage() {
  const rows = await db.select({ sub: schema.subscriptions, course: schema.courses, owner: schema.users }).from(schema.subscriptions)
    .innerJoin(schema.courses, eq(schema.subscriptions.courseId, schema.courses.id))
    .innerJoin(schema.users, eq(schema.courses.ownerId, schema.users.id))
    .orderBy(desc(schema.subscriptions.createdAt)).limit(200);
  return (
    <>
      <div><h1 className="text-xl font-bold">Historial de planes y pagos</h1><p className="text-sm text-muted">Últimos 200 movimientos: pruebas, pagos con Mercado Pago, transferencias y activaciones manuales.</p></div>
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr className="border-b border-line"><th className="th">Fecha</th><th className="th">Curso</th><th className="th">Tesorero</th><th className="th">Plan</th><th className="th">Método</th><th className="th text-right">Monto</th><th className="th">Estado</th><th className="th">Vence</th><th className="th">Nota</th></tr></thead>
          <tbody>
            {rows.map(({ sub, course, owner }) => (
              <tr key={sub.id} className="border-b border-line/60 align-top">
                <td className="td whitespace-nowrap">{sub.createdAt.toLocaleDateString("es-CL")}</td>
                <td className="td">{course.name} {course.year}<div className="text-xs text-muted">{course.school}</div></td>
                <td className="td text-sm">{owner.email}</td>
                <td className="td capitalize">{sub.plan}</td>
                <td className="td capitalize">{sub.method}</td>
                <td className="td text-right tabular-nums">{clp(sub.amount)}</td>
                <td className="td"><span className={`badge ${TONE[sub.status]}`}>{STATUS[sub.status]}</span></td>
                <td className="td whitespace-nowrap text-sm">{sub.endsAt?.toLocaleDateString("es-CL") ?? "—"}</td>
                <td className="td max-w-[240px] text-xs text-muted">{sub.note}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className="td text-muted" colSpan={9}>Aún no hay movimientos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
