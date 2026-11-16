import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireCourse } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { appUrl } from "@/lib/course-data";
import { eventTotals, docDate, KIND_LABEL } from "@/lib/events";
import { clp } from "@/lib/finance";
import { todayISO, whatsappLink } from "@/lib/util";
import { mailConfigured } from "@/lib/mail";
import { markCreditPaid, convertQuote, deleteDoc, closeEvent, reopenEvent, emailDoc } from "@/app/actions/events";
import EventPos from "@/components/EventPos";
import ActionNotice from "@/components/ActionNotice";
import FeatureLock from "@/components/FeatureLock";
import type { EventDoc, EventLine } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evento" };

const TABS = [["vender", "🛒 Vender"], ["ventas", "💵 Ventas"], ["fiado", "📒 Fiados"], ["presupuestos", "📝 Presupuestos"], ["resumen", "📊 Resumen"]] as const;

function DocCard({ id, d, lines, canWrite, base, bizName, mail }: { id: string; d: EventDoc; lines: EventLine[]; canWrite: boolean; base: string; bizName: string; mail: boolean }) {
  const link = `${base}/b/${d.token}`;
  const wa = whatsappLink(d.phone, `Hola ${d.customer}, te envío tu ${KIND_LABEL[d.kind].toLowerCase()} ${d.number} de ${bizName} por ${clp(d.total)}: ${link}`);
  return (
    <li className="card space-y-2 !p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{d.number} · {d.customer}</p>
          <p className="text-xs text-muted">{docDate(d)}{d.method ? ` · ${d.method}` : ""}{d.dueDate ? ` · ${d.kind === "credit" ? "paga el" : "válido hasta"} ${d.dueDate}` : ""}</p>
        </div>
        <p className="text-lg font-bold">{clp(d.total)}</p>
      </div>
      <p className="text-sm text-muted">{lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</p>
      {d.notes && <p className="text-xs text-muted">📝 {d.notes}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn-ghost !px-2.5 !py-1 text-xs" href={`/b/${d.token}`} target="_blank" rel="noopener noreferrer">Ver / imprimir</a>
        <a className="btn-ghost !px-2.5 !py-1 text-xs" href={`/api/b/${d.token}/pdf`} target="_blank" rel="noopener noreferrer">PDF</a>
        {wa && <a className="btn-ghost !px-2.5 !py-1 text-xs" href={wa} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
        {canWrite && mail && d.email && <ActionNotice className="btn-ghost !px-2.5 !py-1 text-xs" label="✉️ Correo" action={emailDoc.bind(null, id, d.id)} />}
        {canWrite && d.kind === "credit" && d.status === "pending" && <ActionNotice className="btn !px-2.5 !py-1 text-xs" label="✔ Ya me pagó" action={markCreditPaid.bind(null, id, d.id, "efectivo")} />}
        {canWrite && d.kind === "quote" && <ActionNotice className="btn !px-2.5 !py-1 text-xs" label="Convertir en venta" confirm="¿Convertir en venta? Se descuenta el stock." action={convertQuote.bind(null, id, d.id)} />}
        {canWrite && <ActionNotice className="btn-danger !px-2.5 !py-1 text-xs" label="Eliminar" confirm="¿Eliminar? Se devuelve el stock." action={deleteDoc.bind(null, id, d.id)} />}
      </div>
    </li>
  );
}

export default async function EventPage({ params, searchParams }: PageProps<"/app/c/[id]/eventos/[eventId]">) {
  const { id, eventId } = await params;
  const sp = await searchParams;
  const { course, canWrite } = await requireCourse(id);
  if (!hasFeature(course, "events")) return <FeatureLock courseId={id} feature="events" />;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const [ev] = await db.select().from(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.courseId, id))).limit(1);
  if (!ev) notFound();
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? (canWrite && ev.status === "open" ? "vender" : "resumen");

  const [products, docs, settings] = await Promise.all([
    db.select().from(schema.eventProducts).where(eq(schema.eventProducts.courseId, id)).orderBy(asc(schema.eventProducts.name)),
    db.select().from(schema.eventDocs).where(eq(schema.eventDocs.eventId, eventId)).orderBy(desc(schema.eventDocs.createdAt)),
    db.select().from(schema.eventSettings).where(eq(schema.eventSettings.courseId, id)).limit(1),
  ]);
  const allLines = docs.length ? await db.select().from(schema.eventLines).where(inArray(schema.eventLines.docId, docs.map((d) => d.id))) : [];
  const linesOf = (docId: string) => allLines.filter((l) => l.docId === docId);
  const t = eventTotals(docs);
  const base = appUrl();
  const bizName = settings[0]?.businessName || `${course.school} · ${course.name}`;
  const mail = mailConfigured();
  const list = (kind: EventDoc["kind"], pending?: boolean) => docs.filter((d) => d.kind === kind && (pending === undefined || (d.status === "pending") === pending));

  // Resumen por producto (ventas + fiados pagados)
  const sold = new Map<string, { qty: number; total: number }>();
  for (const d of docs.filter((x) => x.kind === "sale" || (x.kind === "credit" && x.status === "paid"))) {
    for (const l of linesOf(d.id)) { const c = sold.get(l.name) ?? { qty: 0, total: 0 }; c.qty += l.qty; c.total += l.qty * l.unitPrice; sold.set(l.name, c); }
  }
  const byMethod = new Map<string, number>();
  for (const d of docs.filter((x) => x.kind === "sale" || (x.kind === "credit" && x.status === "paid"))) byMethod.set(d.method ?? "otro", (byMethod.get(d.method ?? "otro") ?? 0) + d.total);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/app/c/${id}/eventos`} className="text-sm text-brand">← Eventos</Link>
          <h2 className="text-lg font-bold">{ev.name} <span className={`badge ml-2 ${ev.status === "open" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{ev.status === "open" ? "Abierto" : "Cerrado"}</span></h2>
          <p className="text-sm text-muted">{ev.date}{ev.notes ? ` · ${ev.notes}` : ""}</p>
        </div>
        {canWrite && (ev.status === "open"
          ? <ActionNotice className="btn" label="Cerrar evento y sumar al curso" confirm="¿Cerrar el evento? Lo cobrado se registra como ingreso extra del curso." action={closeEvent.bind(null, id, eventId)} />
          : <ActionNotice className="btn-ghost" label="Reabrir evento" action={reopenEvent.bind(null, id, eventId)} />)}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Cobrado", clp(t.collected), "text-emerald-700"], ["Fiado pendiente", clp(t.creditPending), t.creditPending ? "text-amber-700" : ""], ["Presupuestos", clp(t.quotes), ""], ["Ventas", String(list("sale").length), ""]].map(([a, b, c]) => (
          <div key={a} className="card !p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{a}</p><p className={`mt-1 text-2xl font-bold ${c}`}>{b}</p></div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Secciones del evento">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/app/c/${id}/eventos/${eventId}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${tab === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "vender" && (canWrite && ev.status === "open"
        ? <EventPos courseId={id} eventId={eventId} today={todayISO()} products={products.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }))} />
        : <p className="card text-sm text-muted">{ev.status === "closed" ? "El evento está cerrado. Reábrelo para seguir vendiendo." : "Tu rol es de solo lectura."}</p>)}

      {tab === "ventas" && <ul className="space-y-2">{list("sale").map((d) => <DocCard key={d.id} id={id} d={d} lines={linesOf(d.id)} canWrite={canWrite} base={base} bizName={bizName} mail={mail} />)}
        {list("sale").length === 0 && <li className="card text-sm text-muted">Todavía no hay ventas.</li>}</ul>}

      {tab === "fiado" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pendiente de cobro: <b>{clp(t.creditPending)}</b>. Al pulsar “Ya me pagó”, el fiado pasa a contar como cobrado.</p>
          <ul className="space-y-2">{list("credit", true).map((d) => <DocCard key={d.id} id={id} d={d} lines={linesOf(d.id)} canWrite={canWrite} base={base} bizName={bizName} mail={mail} />)}
            {list("credit", true).length === 0 && <li className="card text-sm text-muted">No hay fiados pendientes. 🎉</li>}</ul>
          {list("credit", false).length > 0 && <>
            <h3 className="font-bold">Fiados ya pagados</h3>
            <ul className="space-y-2">{list("credit", false).map((d) => <DocCard key={d.id} id={id} d={d} lines={linesOf(d.id)} canWrite={canWrite} base={base} bizName={bizName} mail={mail} />)}</ul></>}
        </div>
      )}

      {tab === "presupuestos" && <ul className="space-y-2">{list("quote").map((d) => <DocCard key={d.id} id={id} d={d} lines={linesOf(d.id)} canWrite={canWrite} base={base} bizName={bizName} mail={mail} />)}
        {list("quote").length === 0 && <li className="card text-sm text-muted">Todavía no hay presupuestos.</li>}</ul>}

      {tab === "resumen" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card"><h3 className="mb-2 font-bold">Productos vendidos</h3>
            {sold.size === 0 ? <p className="text-sm text-muted">Sin ventas aún.</p> : (
              <ul className="divide-y divide-line text-sm">{[...sold].sort((a, b) => b[1].total - a[1].total).map(([n, v]) => <li key={n} className="flex justify-between py-1.5"><span>{v.qty} × {n}</span><b>{clp(v.total)}</b></li>)}</ul>)}
          </div>
          <div className="card"><h3 className="mb-2 font-bold">Cobrado por forma de pago</h3>
            {byMethod.size === 0 ? <p className="text-sm text-muted">Sin cobros aún.</p> : (
              <ul className="divide-y divide-line text-sm">{[...byMethod].map(([m, v]) => <li key={m} className="flex justify-between py-1.5"><span className="capitalize">{m}</span><b>{clp(v)}</b></li>)}</ul>)}
            <p className="mt-3 flex justify-between border-t border-line pt-2 font-bold"><span>Total cobrado</span><span>{clp(t.collected)}</span></p>
          </div>
        </div>
      )}
    </>
  );
}
