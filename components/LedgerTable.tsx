"use client";
import { useRef, useState } from "react";
import ActionForm from "@/components/ActionForm";
import ActionNotice from "@/components/ActionNotice";
import { editPayment, editExpense, editExtra, deleteFromLedger } from "@/app/actions/ledger";
import { PAYMENT_METHODS, EXPENSE_CATEGORIES, clp } from "@/lib/finance";

export type LedgerRowData = {
  key: string; n: number; date: string; type: "income" | "expense"; source: string; concept: string; detail: string;
  income: number; expense: number; balance: number; entity: "payment" | "extra" | "expense"; entityId: string; locked: string | null;
  edit: Record<string, string | number | null>;
};
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default function LedgerTable({ courseId, rows, canWrite }: { courseId: string; rows: LedgerRowData[]; canWrite: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [sel, setSel] = useState<LedgerRowData | null>(null);
  const open = (r: LedgerRowData) => { setSel(r); dlg.current?.showModal(); };
  const close = () => dlg.current?.close();

  return (
    <>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="th text-left">N°</th><th className="th text-left">Fecha</th><th className="th text-left">Concepto</th>
              <th className="th text-right">Ingreso</th><th className="th text-right">Egreso</th><th className="th text-right">Saldo</th>
              {canWrite && <th className="th" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line/60 align-top">
                <td className="td tabular-nums text-muted">{String(r.n).padStart(4, "0")}</td>
                <td className="td whitespace-nowrap">{dmy(r.date)}</td>
                <td className="td">
                  <p className="font-medium">{r.concept}</p>
                  <p className="text-xs text-muted">{r.source}{r.detail ? ` · ${r.detail}` : ""}</p>
                </td>
                <td className="td text-right tabular-nums text-emerald-700">{r.income ? clp(r.income) : ""}</td>
                <td className="td text-right tabular-nums text-red-700">{r.expense ? clp(r.expense) : ""}</td>
                <td className={`td text-right tabular-nums font-semibold ${r.balance < 0 ? "text-red-700" : ""}`}>{clp(r.balance)}</td>
                {canWrite && (
                  <td className="td text-right">
                    {r.locked
                      ? <span className="text-xs text-muted" title={r.locked}>🔒</span>
                      : <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => open(r)} aria-label={`Corregir movimiento ${r.n}`}>Corregir</button>}
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td className="td text-muted" colSpan={7}>Aún no hay movimientos. Se irán registrando solos con cada pago, gasto o ingreso extra.</td></tr>}
          </tbody>
        </table>
      </div>

      <dialog ref={dlg} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line p-0 shadow-xl backdrop:bg-black/40" onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">Corregir movimiento {String(sel.n).padStart(4, "0")}</h2><p className="text-sm text-muted">{sel.concept}</p></div>
              <button type="button" className="btn-ghost !px-2.5 !py-1" onClick={close} aria-label="Cerrar">✕</button>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              El cambio solo se guarda si los totales siguen cuadrando, y queda anotado en la bitácora (quién, cuándo, antes y después).
            </p>
            {sel.entity === "payment" && (
              <ActionForm action={editPayment.bind(null, courseId, sel.entityId)} submit="Guardar corrección" resetOnSuccess={false} onDone={close}>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="lg-amount">Monto *</label><input id="lg-amount" name="amount" type="number" min={1} step={1} required className="input" defaultValue={Number(sel.edit.amount)} /></div>
                  <div><label className="label" htmlFor="lg-date">Fecha *</label><input id="lg-date" name="paidAt" type="date" required className="input" defaultValue={String(sel.edit.paidAt)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="lg-method">Método</label><select id="lg-method" name="method" className="input" defaultValue={String(sel.edit.method)}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
                  <div><label className="label" htmlFor="lg-notes">Observaciones</label><input id="lg-notes" name="notes" className="input" maxLength={200} defaultValue={String(sel.edit.notes ?? "")} /></div>
                </div>
              </ActionForm>
            )}
            {sel.entity === "expense" && (
              <ActionForm action={editExpense.bind(null, courseId, sel.entityId)} submit="Guardar corrección" resetOnSuccess={false} onDone={close}>
                <div><label className="label" htmlFor="lg-desc">Descripción *</label><input id="lg-desc" name="description" required className="input" maxLength={160} defaultValue={String(sel.edit.description)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="lg-amount">Monto *</label><input id="lg-amount" name="amount" type="number" min={1} step={1} required className="input" defaultValue={Number(sel.edit.amount)} /></div>
                  <div><label className="label" htmlFor="lg-date">Fecha *</label><input id="lg-date" name="date" type="date" required className="input" defaultValue={String(sel.edit.date)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="lg-cat">Categoría</label><select id="lg-cat" name="category" className="input" defaultValue={String(sel.edit.category)}>{EXPENSE_CATEGORIES.map((m) => <option key={m}>{m}</option>)}</select></div>
                  <div><label className="label" htmlFor="lg-doc">N° documento</label><input id="lg-doc" name="docNumber" className="input" maxLength={40} defaultValue={String(sel.edit.docNumber ?? "")} /></div>
                </div>
                <div><label className="label" htmlFor="lg-vendor">Proveedor</label><input id="lg-vendor" name="vendor" className="input" maxLength={100} defaultValue={String(sel.edit.vendor ?? "")} /></div>
              </ActionForm>
            )}
            {sel.entity === "extra" && (
              <ActionForm action={editExtra.bind(null, courseId, sel.entityId)} submit="Guardar corrección" resetOnSuccess={false} onDone={close}>
                <div><label className="label" htmlFor="lg-desc">Descripción *</label><input id="lg-desc" name="description" required className="input" maxLength={160} defaultValue={String(sel.edit.description)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label" htmlFor="lg-amount">Monto *</label><input id="lg-amount" name="amount" type="number" min={1} step={1} required className="input" defaultValue={Number(sel.edit.amount)} /></div>
                  <div><label className="label" htmlFor="lg-date">Fecha *</label><input id="lg-date" name="date" type="date" required className="input" defaultValue={String(sel.edit.date)} /></div>
                </div>
              </ActionForm>
            )}
            <div className="border-t border-line pt-3">
              <ActionNotice className="btn-danger !px-3 !py-1.5 text-sm" label="Eliminar este movimiento"
                confirm="¿Eliminar este movimiento? Quedará registrado en la bitácora."
                action={deleteFromLedger.bind(null, courseId, sel.entity, sel.entityId)} />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
