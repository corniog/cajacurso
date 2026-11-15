"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { registerPayment, deletePayment } from "@/app/actions/course";
import { sendStatementOne } from "@/app/actions/pro";
import ActionNotice from "@/components/ActionNotice";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import { MONTH_NAMES, MONTH_SHORT, PAYMENT_METHODS, clp, type MonthStatus } from "@/lib/finance";

export type GridStudent = {
  id: string; name: string; active: boolean;
  months: Record<number, { status: MonthStatus; paid: number }>;
  wa?: string | null; hasEmail?: boolean;
};
export type GridPayment = { id: string; studentId: string; month: number; amount: number; paidAt: string; method: string; notes: string | null };

const COLORS: Record<MonthStatus, string> = {
  pagado: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  abonado: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  pendiente: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  no_aplica: "bg-transparent text-slate-300 cursor-default",
};
const LABEL: Record<MonthStatus, string> = { pagado: "Pagado", abonado: "Abonado", pendiente: "Pendiente", no_aplica: "No aplica" };

export default function PaymentGrid({
  courseId, fee, months, students, payments, canWrite, pro = false,
}: { courseId: string; fee: number; months: number[]; students: GridStudent[]; payments: GridPayment[]; canWrite: boolean; pro?: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [sel, setSel] = useState<{ studentId: string; month: number } | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [amount, setAmount] = useState("");

  const student = students.find((s) => s.id === sel?.studentId);
  const cellPayments = useMemo(
    () => (sel ? payments.filter((p) => p.studentId === sel.studentId && p.month === sel.month) : []),
    [payments, sel],
  );

  const remaining = (s: GridStudent, m: number) => Math.max(0, fee - (s.months[m]?.paid ?? 0));
  const suggest = (s: GridStudent, ms: number[]) => String(ms.reduce((a, m) => a + remaining(s, m), 0) || fee);

  function open(s: GridStudent, m: number) {
    if (s.months[m].status === "no_aplica") return;
    setSel({ studentId: s.id, month: m });
    setChecked([m]);
    setAmount(suggest(s, [m]));
    dlg.current?.showModal();
  }
  function toggle(m: number) {
    if (!student) return;
    const next = checked.includes(m) ? checked.filter((x) => x !== m) : [...checked, m].sort((a, b) => a - b);
    setChecked(next);
    setAmount(suggest(student, next));
  }

  return (
    <>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="th sticky left-0 z-10 bg-white">Alumno</th>
              {months.map((m) => <th key={m} className="th text-center" title={MONTH_NAMES[m - 1]}>{MONTH_SHORT[m - 1]}</th>)}
              {canWrite && <th className="th text-left">Enviar al apoderado</th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className={`border-b border-line/60 ${s.active ? "" : "opacity-50"}`}>
                <th scope="row" className="td sticky left-0 z-10 bg-white text-left font-medium whitespace-nowrap">
                  {s.name}{!s.active && <span className="ml-2 text-xs text-muted">(inactivo)</span>}
                </th>
                {months.map((m) => {
                  const c = s.months[m];
                  return (
                    <td key={m} className="p-1 text-center">
                      <button
                        type="button"
                        disabled={c.status === "no_aplica"}
                        onClick={() => open(s, m)}
                        aria-label={`${s.name}, ${MONTH_NAMES[m - 1]}: ${LABEL[c.status]}`}
                        className={`h-9 w-full min-w-[52px] rounded-lg text-xs font-semibold transition cursor-pointer ${COLORS[c.status]}`}
                      >
                        {c.status === "pagado" ? "✓" : c.status === "abonado" ? clp(c.paid).replace("$", "$") : c.status === "no_aplica" ? "—" : "·"}
                      </button>
                    </td>
                  );
                })}
                {canWrite && <td className="td whitespace-nowrap">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.wa ? (
                      <a className="btn-ghost !px-2.5 !py-1 text-xs" href={s.wa} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp con el mensaje listo">💬 WhatsApp</a>
                    ) : (
                      <span className="text-xs text-muted" title="Agrega el teléfono en Alumnos → Editar">💬 sin teléfono</span>
                    )}
                    {pro && s.hasEmail && (
                      <ActionNotice label="✉️ Correo" className="btn-ghost !px-2.5 !py-1 text-xs" action={() => sendStatementOne(courseId, s.id)} />
                    )}
                    {pro && !s.hasEmail && <span className="text-xs text-muted" title="Agrega el correo en Alumnos → Editar">✉️ sin correo</span>}
                    {!pro && <Link href={`/app/c/${courseId}/plan`} className="text-xs text-muted underline" title="Enviar el PDF por correo es del Plan Pro">✉️ Correo (Pro)</Link>}
                  </div>
                </td>}
              </tr>
            ))}
            {!students.length && (
              <tr><td className="td text-muted" colSpan={months.length + (canWrite ? 2 : 1)}>Aún no hay alumnos. Agrégalos en la sección Alumnos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        <span><b className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">✓</b> Pagado</span>
        <span><b className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">$</b> Abonado</span>
        <span><b className="rounded bg-slate-100 px-1.5 py-0.5">·</b> Pendiente</span>
        <span>— No aplica</span>
      </p>

      <dialog ref={dlg} className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-line p-0 shadow-xl backdrop:bg-black/40"
        onClose={() => setSel(null)}>
        {student && sel && (
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{student.name}</h2>
                <p className="text-sm text-muted">{MONTH_NAMES[sel.month - 1]} · cuota {clp(fee)}</p>
              </div>
              <button type="button" className="btn-ghost !px-2.5 !py-1" onClick={() => dlg.current?.close()} aria-label="Cerrar">✕</button>
            </div>

            {cellPayments.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-semibold">Pagos registrados este mes</p>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {cellPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>{clp(p.amount)} · {p.paidAt} · {p.method}{p.notes ? ` · ${p.notes}` : ""}</span>
                      {canWrite && (
                        <ActionButton className="btn-danger !px-2 !py-1" label="Quitar"
                          confirm="¿Eliminar este pago?" action={() => deletePayment(courseId, p.id)} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canWrite ? (
              <ActionForm action={registerPayment.bind(null, courseId)} submit="Registrar pago" onDone={() => dlg.current?.close()}>
                <input type="hidden" name="studentId" value={student.id} />
                <fieldset>
                  <legend className="label">Meses que cubre este pago</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {months.filter((m) => student.months[m].status !== "no_aplica").map((m) => (
                      <label key={m} className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        checked.includes(m) ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
                        <input type="checkbox" name="months" value={m} checked={checked.includes(m)} onChange={() => toggle(m)} className="sr-only" />
                        {MONTH_SHORT[m - 1]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="pay-amount">Monto total (CLP)</label>
                    <input id="pay-amount" name="amount" type="number" min={1} step={1} required className="input"
                      value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-date">Fecha</label>
                    <input id="pay-date" name="paidAt" type="date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="pay-method">Método</label>
                    <select id="pay-method" name="method" className="input">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-notes">Observación</label>
                    <input id="pay-notes" name="notes" className="input" maxLength={200} placeholder="Opcional" />
                  </div>
                </div>
                {checked.length > 1 && (
                  <p className="text-xs text-muted">El monto se reparte en orden, cubriendo primero lo que falta de cada mes.</p>
                )}
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Tu rol es de solo lectura.</p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
