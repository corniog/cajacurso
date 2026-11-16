import Link from "next/link";
import { eq, asc } from "drizzle-orm";
import { requireCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { saveProduct, toggleProduct, deleteProduct } from "@/app/actions/events";
import { clp } from "@/lib/finance";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import FeatureLock from "@/components/FeatureLock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos del evento" };

export default async function ProductosPage({ params }: PageProps<"/app/c/[id]/eventos/productos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  if (!hasFeature(course, "events")) return <FeatureLock courseId={id} feature="events" />;
  const products = await db.select().from(schema.eventProducts).where(eq(schema.eventProducts.courseId, id)).orderBy(asc(schema.eventProducts.name));
  return (
    <>
      <div>
        <Link href={`/app/c/${id}/eventos`} className="text-sm text-brand">← Eventos</Link>
        <h2 className="text-lg font-bold">Productos</h2>
        <p className="text-sm text-muted">Productos terminados con su precio. Si indicas stock, se descuenta solo en cada venta; si lo dejas vacío no se controla.</p>
      </div>
      {canWrite && (
        <div className="card">
          <ActionForm action={saveProduct.bind(null, id, null)} submit="Agregar producto" className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
            <div><label className="label" htmlFor="pr-name">Producto *</label><input id="pr-name" name="name" className="input" required maxLength={80} placeholder="Completo italiano" /></div>
            <div><label className="label" htmlFor="pr-price">Precio (CLP) *</label><input id="pr-price" name="price" type="number" min={0} className="input" required /></div>
            <div><label className="label" htmlFor="pr-stock">Stock</label><input id="pr-stock" name="stock" type="number" min={0} className="input" placeholder="Sin control" /></div>
          </ActionForm>
        </div>
      )}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-line"><th className="th text-left">Producto</th><th className="th text-right">Precio</th><th className="th text-right">Stock</th><th className="th" /></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b border-line/60 ${p.active ? "" : "opacity-50"}`}>
                <td className="td font-medium">{p.name}{!p.active && <span className="ml-2 text-xs text-muted">(oculto)</span>}</td>
                <td className="td text-right">{clp(p.price)}</td>
                <td className="td text-right">{p.stock ?? "—"}</td>
                <td className="td text-right whitespace-nowrap">
                  {canWrite && <div className="flex justify-end gap-2">
                    <details className="relative">
                      <summary className="btn-ghost !px-2.5 !py-1 text-xs cursor-pointer">Editar</summary>
                      <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-line bg-white p-3 text-left shadow-lg">
                        <ActionForm action={saveProduct.bind(null, id, p.id)} submit="Guardar" resetOnSuccess={false}>
                          <input name="name" className="input" defaultValue={p.name} required maxLength={80} aria-label="Nombre" />
                          <input name="price" type="number" min={0} className="input" defaultValue={p.price} required aria-label="Precio" />
                          <input name="stock" type="number" min={0} className="input" defaultValue={p.stock ?? ""} placeholder="Sin control de stock" aria-label="Stock" />
                        </ActionForm>
                      </div>
                    </details>
                    <ActionButton className="btn-ghost !px-2.5 !py-1 text-xs" label={p.active ? "Ocultar" : "Mostrar"} action={toggleProduct.bind(null, id, p.id)} />
                    <ActionButton className="btn-danger !px-2.5 !py-1 text-xs" label="Quitar" confirm="¿Eliminar este producto?" action={deleteProduct.bind(null, id, p.id)} />
                  </div>}
                </td>
              </tr>
            ))}
            {!products.length && <tr><td className="td text-muted" colSpan={4}>Aún no hay productos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
