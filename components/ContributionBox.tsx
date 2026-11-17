"use client";
import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import { reportTransfer, payContributionOnline } from "@/app/actions/contributions";
import type { ActionState } from "@/app/actions/course";
import { clp } from "@/lib/finance";

export type ContribOption = { id: string; title: string; amount: number | null; description: string | null; dueDate: string | null };

/** Sección de la ficha del apoderado para colectas y aportes (no es la cuota mensual). */
export default function ContributionBox({ token, options, canPayOnline, transferInfo }: {
  token: string; options: ContribOption[]; canPayOnline: boolean; transferInfo: string | null;
}) {
  const [sel, setSel] = useState<string>(options[0]?.id ?? "");
  const [method, setMethod] = useState<"mp" | "transfer">(canPayOnline ? "mp" : "transfer");
  const opt = options.find((o) => o.id === sel);
  const action = async (prev: ActionState, fd: FormData): Promise<ActionState> =>
    method === "mp" ? payContributionOnline(token, sel, prev, fd) : reportTransfer(token, sel, prev, fd);

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">Otros aportes y colectas</h2>
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Esta sección es <b>solo para aportes distintos de la cuota mensual</b> (regalo, ventas, compras, paseos). Las cuotas del año se pagan más arriba y esto <b>no se descuenta de tus cuotas</b>.
      </p>
      <ActionForm action={action} submit={method === "mp" ? "Ir a pagar con Mercado Pago" : "Ya transferí, avisar al tesorero"}>
        <div>
          <label className="label" htmlFor="ct-sel">¿Para qué es tu aporte?</label>
          <select id="ct-sel" className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.title}{o.amount ? ` · sugerido ${clp(o.amount)}` : ""}</option>)}
            <option value="">Otro (lo escribo yo)</option>
          </select>
          {opt?.description && <p className="mt-1 text-xs text-muted">{opt.description}{opt.dueDate ? ` · hasta ${opt.dueDate}` : ""}</p>}
        </div>
        {sel === "" && (
          <div><label className="label" htmlFor="ct-concept">Describe tu aporte *</label><input id="ct-concept" name="concept" className="input" maxLength={100} required placeholder="Ej. Rifa, regalo, materiales" /></div>
        )}
        <div>
          <label className="label" htmlFor="ct-amt">Monto (CLP) *</label>
          <input key={sel} id="ct-amt" name="amount" type="number" min={100} step={1} required className="input" defaultValue={opt?.amount ?? ""} />
        </div>
        <fieldset className="space-y-2">
          <legend className="label">¿Cómo vas a pagar?</legend>
          {canPayOnline && (
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" checked={method === "mp"} onChange={() => setMethod("mp")} className="mt-1" />
              <span><b>Pagar en línea (Mercado Pago)</b><br /><span className="text-muted">Se registra solo apenas se aprueba.</span></span>
            </label>
          )}
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="radio" checked={method === "transfer"} onChange={() => setMethod("transfer")} className="mt-1" />
            <span><b>Transferencia bancaria</b><br /><span className="text-muted">Transfiere y luego avisa aquí; el tesorero la confirma.</span></span>
          </label>
        </fieldset>
        {method === "transfer" && (
          <>
            {transferInfo
              ? <pre className="whitespace-pre-wrap rounded-xl bg-bg p-3 text-sm">{transferInfo}</pre>
              : <p className="rounded-xl bg-bg p-3 text-sm text-muted">El tesorero aún no publicó sus datos de transferencia. Pídeselos por el grupo del curso.</p>}
            <div><label className="label" htmlFor="ct-note">N° de operación o comentario (opcional)</label><input id="ct-note" name="note" className="input" maxLength={200} /></div>
          </>
        )}
      </ActionForm>
    </div>
  );
}
