"use client";
import ActionForm from "@/components/ActionForm";
import { payOnline } from "@/app/actions/ficha";
import { MONTH_NAMES, clp } from "@/lib/finance";

export default function PayOnline({ token, options }: { token: string; options: { month: number; owed: number }[] }) {
  if (!options.length) return null;
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">Pagar en línea</h2>
      <p className="text-sm text-muted">Elige los meses que quieres pagar. Serás llevado a Mercado Pago y tu pago se registra automáticamente.</p>
      <ActionForm action={payOnline.bind(null, token)} submit="Ir a pagar con Mercado Pago" resetOnSuccess={false}>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label key={o.month} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="checkbox" name="months" value={o.month} defaultChecked />
              {MONTH_NAMES[o.month - 1]} <b>{clp(o.owed)}</b>
            </label>
          ))}
        </div>
      </ActionForm>
    </div>
  );
}
