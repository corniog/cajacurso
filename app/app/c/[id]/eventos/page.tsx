import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { createEvent, deleteEvent } from "@/app/actions/events";
import { eventTotals } from "@/lib/events";
import { clp } from "@/lib/finance";
import { todayISO } from "@/lib/util";
import ActionForm from "@/components/ActionForm";
import ActionButton from "@/components/ActionButton";
import FeatureLock from "@/components/FeatureLock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas para eventos" };

export default async function EventosPage({ params }: PageProps<"/app/c/[id]/eventos">) {
  const { id } = await params;
  const { course, canWrite } = await requireCourse(id);
  if (!hasFeature(course, "events")) return <FeatureLock courseId={id} feature="events" />;
  const events = await db.select().from(schema.events).where(eq(schema.events.courseId, id)).orderBy(desc(schema.events.date));
  const docs = await db.select().from(schema.eventDocs).where(eq(schema.eventDocs.courseId, id));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Ventas para eventos</h2>
          <p className="text-sm text-muted">Bingo, kermés, completadas… vende, anota fiados y entrega boletas. Al cerrar el evento, lo recaudado entra a los ingresos del curso.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Link className="btn-ghost" href={`/app/c/${id}/eventos/productos`}>🍔 Productos</Link>
            <Link className="btn-ghost" href={`/app/c/${id}/eventos/ajustes`}>⚙️ Datos y logo</Link>
          </div>
        )}
      </div>

      {canWrite && (
        <div className="card">
          <h3 className="mb-2 font-bold">Nuevo evento</h3>
          <ActionForm action={createEvent.bind(null, id)} submit="Crear evento" className="grid gap-3 sm:grid-cols-[1fr_11rem_1fr_auto] sm:items-end">
            <div><label className="label" htmlFor="ev-name">Nombre *</label><input id="ev-name" name="name" className="input" required maxLength={100} placeholder="Kermés de primavera" /></div>
            <div><label className="label" htmlFor="ev-date">Fecha *</label><input id="ev-date" name="date" type="date" className="input" required defaultValue={todayISO()} /></div>
            <div><label className="label" htmlFor="ev-notes">Notas</label><input id="ev-notes" name="notes" className="input" maxLength={300} /></div>
          </ActionForm>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => {
          const t = eventTotals(docs.filter((d) => d.eventId === e.id));
          return (
            <div key={e.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-bold">{e.name}</h3><p className="text-sm text-muted">{e.date}</p></div>
                <span className={`badge ${e.status === "open" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{e.status === "open" ? "Abierto" : "Cerrado"}</span>
              </div>
              <p className="text-sm">Cobrado <b>{clp(t.collected)}</b>{t.creditPending > 0 && <> · fiado pendiente <b>{clp(t.creditPending)}</b></>}</p>
              <div className="flex gap-2">
                <Link className="btn" href={`/app/c/${id}/eventos/${e.id}`}>Abrir</Link>
                {canWrite && <ActionButton className="btn-danger" label="Eliminar" confirm="¿Eliminar el evento y todas sus ventas?" action={deleteEvent.bind(null, id, e.id)} />}
              </div>
            </div>
          );
        })}
        {!events.length && <p className="card text-sm text-muted">Aún no hay eventos. Crea el primero arriba.</p>}
      </div>
    </>
  );
}
