"use client";
import { useMemo, useState } from "react";
import ActionForm from "@/components/ActionForm";
import { createDoc } from "@/app/actions/events";
import type { ActionState } from "@/app/actions/course";
import { clp } from "@/lib/finance";

export type PosProduct = { id: string; name: string; price: number; stock: number | null };
type Kind = "sale" | "credit" | "quote";
const TABS: { k: Kind; label: string }[] = [
  { k: "sale", label: "💵 Venta" }, { k: "credit", label: "📒 Fiado" }, { k: "quote", label: "📝 Presupuesto" },
];

/** Punto de venta: toca los productos, ajusta cantidades y registra la boleta. */
export default function EventPos({ courseId, eventId, products, today }: { courseId: string; eventId: string; products: PosProduct[]; today: string }) {
  const [kind, setKind] = useState<Kind>("sale");
  const [cart, setCart] = useState<Record<string, number>>({});

  const lines = useMemo(() => products.filter((p) => cart[p.id]).map((p) => ({ productId: p.id, name: p.name, qty: cart[p.id], unitPrice: p.price })), [cart, products]);
  const total = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const left = (p: PosProduct) => (p.stock === null ? Infinity : p.stock - (cart[p.id] ?? 0));
  const add = (p: PosProduct, d: number) => setCart((c) => {
    const q = Math.max(0, (c[p.id] ?? 0) + d);
    if (kind !== "quote" && p.stock !== null && q > p.stock) return c;
    const n = { ...c }; if (q === 0) delete n[p.id]; else n[p.id] = q; return n;
  });

  // Al registrar, se vacía el carrito pero el formulario sigue visible para mostrar la confirmación
  const submitDoc = async (prev: ActionState, fd: FormData): Promise<ActionState> => {
    const r = await createDoc(courseId, eventId, kind, JSON.stringify(lines), prev, fd);
    if (r?.ok) setCart({});
    return r;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div>
        <div className="mb-3 flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.k} type="button" role="tab" aria-selected={kind === t.k}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${kind === t.k ? "bg-brand text-white" : "bg-slate-100"}`}
              onClick={() => setKind(t.k)}>{t.label}</button>
          ))}
        </div>
        {products.length === 0 && <p className="card text-sm text-muted">Aún no hay productos. Agrégalos en “Productos”.</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {products.map((p) => {
            const q = cart[p.id] ?? 0;
            const out = kind !== "quote" && left(p) <= 0 && q === 0;
            return (
              <div key={p.id} className={`rounded-2xl border p-3 ${q ? "border-brand bg-blue-50" : "border-line bg-white"} ${out ? "opacity-50" : ""}`}>
                <button type="button" disabled={out} onClick={() => add(p, 1)} className="w-full text-left" aria-label={`Agregar ${p.name}`}>
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <p className="text-sm text-muted">{clp(p.price)}{p.stock !== null && <> · stock {p.stock - q}</>}</p>
                </button>
                {q > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="btn-ghost !px-2.5 !py-0.5" onClick={() => add(p, -1)} aria-label={`Quitar uno de ${p.name}`}>−</button>
                    <b>{q}</b>
                    <button type="button" className="btn-ghost !px-2.5 !py-0.5" onClick={() => add(p, 1)} aria-label={`Agregar uno de ${p.name}`}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card h-fit space-y-3">
        <h3 className="font-bold">{TABS.find((t) => t.k === kind)!.label} · carrito</h3>
        {lines.length ? (
          <ul className="divide-y divide-line text-sm">
            {lines.map((l) => <li key={l.productId} className="flex justify-between py-1.5"><span>{l.qty} × {l.name}</span><b>{clp(l.qty * l.unitPrice)}</b></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Toca un producto para agregarlo.</p>}
        <p className="flex justify-between text-lg font-bold"><span>Total</span><span data-testid="pos-total">{clp(total)}</span></p>
        <ActionForm action={submitDoc}
          submit={kind === "sale" ? "Registrar venta" : kind === "credit" ? "Registrar fiado" : "Crear presupuesto"}
          >
          <div>
            <label className="label" htmlFor="pos-customer">{kind === "credit" ? "¿Quién queda debiendo? *" : kind === "quote" ? "Cliente *" : "Cliente (opcional)"}</label>
            <input id="pos-customer" name="customer" className="input" maxLength={100} />
          </div>
          {kind === "sale" && (
            <div>
              <label className="label" htmlFor="pos-method">Forma de pago</label>
              <select id="pos-method" name="method" className="input"><option>efectivo</option><option>transferencia</option><option>otro</option></select>
            </div>
          )}
          {kind !== "sale" && (
            <div>
              <label className="label" htmlFor="pos-due">{kind === "credit" ? "Fecha en que pagará" : "Válido hasta"}</label>
              <input id="pos-due" name="dueDate" type="date" className="input" min={today} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="pos-phone">WhatsApp</label><input id="pos-phone" name="phone" className="input" inputMode="tel" placeholder="Opcional" /></div>
            <div><label className="label" htmlFor="pos-email">Correo</label><input id="pos-email" name="email" type="email" className="input" placeholder="Opcional" /></div>
          </div>
          <div><label className="label" htmlFor="pos-notes">Notas</label><input id="pos-notes" name="notes" className="input" maxLength={300} /></div>
        </ActionForm>
      </div>
    </div>
  );
}
