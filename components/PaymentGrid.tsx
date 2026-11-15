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
  const [start, setStart] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const student = students.find((s) => s.id === sel?.studentId);
  const cellPayments = useMemo(
    () => (sel ? payments.filter((p) => p.studentId === sel.studentId && p.month === sel.month) : []),
    [payments, sel],
  );

  const remaining = (s: GridStudent, m: number) => (s.months[m]?.status === "no_aplica" ? 0 : Math.max(0, fee - (s.months[m]?.paid ?? 0)));
  const firstPending = (s: GridStudent, from = 0) => months.find((m) => m >= from && remaining(s, m) > 0) ?? null;

  /** Reparte el monto desde el mes de inicio, cubriendo primero lo que falta de cada mes (automático). */
  const plan = useMemo(() => {
    if (!student || start === null) return { parts: [] as { m: number; amount: number; full: boolean }[], max: 0 };
    const list = months.filter((m) => m >= start && remaining(student, m) > 0);
    const max = list.reduce((a, m) => a + remaining(student, m), 0);
    let left = Math.max(0, Math.floor(Number(amount) || 0));
    const parts: { m: number; amount: number; full: boolean }[] = [];
    for (const m of list) {
      if (left <= 0) break;
      const rem = remaining(student, m);
      const a = Math.min(rem, left);
      parts.push({ m, amount: a, full: a >= rem });
      left -= a;
    }
    return { parts, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, start, amount, months, fee]);

  function openAt(s: GridStudent, m: number) {
    if (s.months[m].status === "no_aplica") return;
    const st = remaining(s, m) > 0 ? m : firstPending(s, m);
    setSel({ studentId: s.id, month: m });
    setStart(st);
    setAmount(st === null ? "" : String(remaining(s, st)));
    dlg.current?.showModal();
  }
  function openRow(s: GridStudent) {
    const st = firstPending(s);
    setSel({ studentId: s.id, month: st ?? months.find((m) => s.months[m].status !== "no_aplica") ?? months[0] });
    setStart(st);
    setAmount(st === null ? "" : String(remaining(s, st)));
    dlg.current?.showModal();
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
                        onClick={() => openAt(s, m)}
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
                    {firstPending(s) !== null && (
                      <button type="button" className="btn !px-2.5 !py-1 text-xs" onClick={() => openRow(s)} title="Registrar un pago o abono; se reparte solo entre los meses pendientes">Abono</button>
                    )}
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
              start === null ? (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Este alumno no tiene meses pendientes. ¡Está al día!</p>
              ) : (
              <ActionForm action={registerPayment.bind(null, courseId)} submit="Registrar pago" onDone={() => dlg.current?.close()}>
                <input type="hidden" name="studentId" value={student.id} />
                {(plan.parts.length ? plan.parts.map((x) => x.m) : [start]).map((m) => <input key={m} type="hidden" name="months" value={m} />)}
                <p className="text-sm text-muted">
                  Máximo {clp(plan.max)} (lo que falta desde {MONTH_NAMES[start - 1]}). Se completa el primer mes pendiente y el resto sigue al siguiente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="pay-amount">Monto (CLP) *</label>
                    <input id="pay-amount" name="amount" type="number" min={1} max={plan.max} step={1} required className="input"
                      value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-date">Fecha *</label>
                    <input id="pay-date" name="paidAt" type="date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="pay-method">Método de pago</label>
                    <select id="pay-method" name="method" className="input">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-notes">Observaciones</label>
                    <input id="pay-notes" name="notes" className="input" maxLength={200} placeholder="Opcional" />
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-bg p-3 text-sm" aria-live="polite">
                  {plan.parts.length ? (
                    <>
                      <p className="mb-1 font-semibold">Se aplicará:</p>
                      <ul className="space-y-0.5">
                        {plan.parts.map((x) => (
                          <li key={x.m}>
                            {MONTH_NAMES[x.m - 1]}: <b>{clp(x.amount)}</b>{" "}
                            <span className={x.full ? "text-emerald-700" : "text-amber-700"}>({x.full ? "pagado" : "abono"})</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : <p className="text-muted">Escribe un monto para ver cómo se aplica.</p>}
                </div>
              </ActionForm>
              )
            ) : (
              <p className="text-sm text-muted">Tu rol es de solo lectura.</p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
