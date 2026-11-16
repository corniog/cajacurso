import { requireCourse } from "@/lib/auth";
import { loadCourseData } from "@/lib/course-data";
import { addExpense, deleteExpense } from "@/app/actions/course";
import ActionForm from "@/components/ActionForm";
import ReceiptInput from "@/components/ReceiptInput";
import ActionButton from "@/components/ActionButton";
import { EXPENSE_CATEGORIES, clp } from "@/lib/finance";
import { todayISO } from "@/lib/util";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gastos" };

export default async function ExpensesPage({ params }: PageProps<"/app/c/[id]/gastos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  const { expenses, summary } = await loadCourseData(course);

  return (
    <>
      {canWrite && (
        <div className="card">
          <h2 className="mb-3 font-bold">Registrar gasto</h2>
          <ActionForm action={addExpense.bind(null, id)} submit="Guardar gasto">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="label">Descripción</span><input name="description" className="input" required maxLength={160} placeholder="Ej: Regalo día del profesor" /></label>
              <label className="block"><span className="label">Categoría</span><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label className="block"><span className="label">Monto (CLP)</span><input name="amount" type="number" min={1} step={1} className="input" required /></label>
              <label className="block"><span className="label">Fecha</span><input name="date" type="date" className="input" required defaultValue={todayISO()} /></label>
              <label className="block"><span className="label">Proveedor (opcional)</span><input name="vendor" className="input" maxLength={100} /></label>
              <label className="block"><span className="label">N° de boleta (opcional)</span><input name="docNumber" className="input" maxLength={40} /></label>
              <ReceiptInput />
            </div>
            {hasFeature(course, "drive") && <p className="text-xs text-muted">Si conectaste Google Drive, la boleta también se guarda allí.</p>}
          </ActionForm>
        </div>
      )}

      <div className="card !p-0 overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">Gastos ({expenses.length})</h2>
          <p className="text-sm">Total: <b>{clp(summary.expenses)}</b></p>
        </div>
        {expenses.length === 0 ? (
          <p className="p-5 text-sm text-muted">Todavía no hay gastos registrados.</p>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-line"><th className="th">Fecha</th><th className="th">Descripción</th><th className="th">Categoría</th><th className="th text-right">Monto</th><th className="th">Boleta</th><th className="th" /></tr></thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="td whitespace-nowrap">{e.date}</td>
                  <td className="td">{e.description}<div className="text-xs text-muted">{[e.vendor, e.docNumber && `N° ${e.docNumber}`].filter(Boolean).join(" · ")}</div></td>
                  <td className="td capitalize">{e.category}</td>
                  <td className="td text-right font-semibold tabular-nums">{clp(e.amount)}</td>
                  <td className="td">
                    {e.receiptFile ? (
                      <a className="font-semibold text-brand" target="_blank" rel="noopener noreferrer"
                        href={`/api/c/${id}/receipt/${e.receiptFile}`}>Ver{e.driveFileId ? " · Drive ✓" : ""}</a>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="td text-right">
                    {canWrite && <ActionButton className="btn-danger !px-2 !py-1" label="Eliminar" confirm="¿Eliminar este gasto?" action={deleteExpense.bind(null, id, e.id)} />}
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
