import { requireCourse } from "@/lib/auth";
import { loadLedger } from "@/lib/ledger-data";
import { clp } from "@/lib/finance";
import LedgerTable, { type LedgerRowData } from "@/components/LedgerTable";
import type { LedgerEntry } from "@/lib/ledger";
import type { Expense, ExtraIncome, Payment } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Libro contable" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="card !p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}

export default async function LibroPage({ params }: PageProps<"/app/c/[id]/libro">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  const d = await loadLedger(course);
  const pay = new Map<string, Payment>(d.payments.map((p) => [p.id, p]));
  const exp = new Map<string, Expense>(d.expenses.map((e) => [e.id, e]));
  const ext = new Map<string, ExtraIncome>(d.extras.map((e) => [e.id, e]));
  const rows: LedgerRowData[] = d.entries.map((e: LedgerEntry) => {
    let edit: LedgerRowData["edit"] = {};
    if (e.entity === "payment") { const p = pay.get(e.entityId)!; edit = { amount: p.amount, paidAt: p.paidAt, method: p.method, notes: p.notes }; }
    if (e.entity === "expense") { const g = exp.get(e.entityId)!; edit = { description: g.description, category: g.category, amount: g.amount, date: g.date, vendor: g.vendor, docNumber: g.docNumber }; }
    if (e.entity === "extra") { const x = ext.get(e.entityId)!; edit = { description: x.description, amount: x.amount, date: x.date }; }
    const { createdAt: _c, ...rest } = e; void _c;
    return { ...rest, edit };
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Libro de contabilidad</h2>
          <p className="max-w-2xl text-sm text-muted">
            Se llena solo: cada cuota, ingreso extra o gasto que registras aparece aquí en orden de fecha, con su saldo. Puedes corregir un error, pero solo si los totales siguen cuadrando; cada cambio queda en la bitácora.
          </p>
        </div>
        <div className="flex gap-2">
          <a className="btn" href={`/api/c/${id}/libro/pdf`}>⬇ PDF</a>
          <a className="btn-ghost" href={`/api/c/${id}/libro/xlsx`}>⬇ Excel</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total ingresos" value={clp(d.totals.income)} tone="good" />
        <Stat label="Total egresos" value={clp(d.totals.expense)} tone="bad" />
        <Stat label="Saldo en caja" value={clp(d.totals.balance)} tone={d.totals.balance >= 0 ? "good" : "bad"} />
        <Stat label="Movimientos" value={String(d.totals.count)} />
      </div>

      <div className={`card space-y-2 ${d.rec.ok ? "!border-emerald-300" : "!border-red-300"}`}>
        <h3 className="font-bold">{d.rec.ok ? "✅ El libro cuadra con la aplicación del curso" : "⚠️ Hay diferencias entre el libro y la aplicación"}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 font-medium">Concepto</th><th className="py-1 text-right font-medium">Libro</th><th className="py-1 text-right font-medium">Aplicación</th><th className="py-1 text-right font-medium">Estado</th></tr></thead>
            <tbody>
              {d.rec.rows.map((r) => (
                <tr key={r.label} className="border-t border-line/60">
                  <td className="py-1.5">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{clp(r.ledger)}</td>
                  <td className="py-1.5 text-right tabular-nums">{clp(r.app)}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.ok ? "text-emerald-700" : "text-red-700"}`}>{r.ok ? "Cuadra" : "No cuadra"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LedgerTable courseId={id} rows={rows} canWrite={canWrite} />

      <div className="card">
        <h3 className="mb-2 font-bold">Bitácora de cambios</h3>
        {d.audit.length === 0 ? <p className="text-sm text-muted">Ningún movimiento ha sido corregido ni eliminado.</p> : (
          <ul className="divide-y divide-line text-sm">
            {d.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b>{a.action === "edit" ? "Corrección" : "Eliminación"}:</b> {a.summary}</span>
                <span className="text-xs text-muted">{a.userName} · {a.createdAt.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
