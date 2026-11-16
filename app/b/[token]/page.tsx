/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadDocWithLines, loadSettings, KIND_LABEL, docDate } from "@/lib/events";
import { clp } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Boleta", robots: { index: false, follow: false } };

export default async function PublicDocPage({ params }: PageProps<"/b/[token]">) {
  const { token } = await params;
  const found = await loadDocWithLines(eq(schema.eventDocs.token, token));
  if (!found) notFound();
  const { doc, lines } = found;
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, doc.courseId)).limit(1);
  const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, doc.eventId)).limit(1);
  const biz = await loadSettings(course);
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="card space-y-3 text-center">
        {biz.logo && <img src={biz.logo} alt="" className="mx-auto h-16 w-16 object-contain" />}
        <h1 className="text-xl font-bold">{biz.businessName}</h1>
        <p className="text-sm text-muted">{[biz.address, biz.phone, biz.email].filter(Boolean).join(" · ")}</p>
        <p className="font-semibold">{KIND_LABEL[doc.kind]} {doc.number}</p>
        <p className="text-sm text-muted">{docDate(doc)} · {ev?.name}</p>
        <p className="text-sm">Cliente: <b>{doc.customer}</b></p>
        {doc.kind === "credit" && <p className={`badge ${doc.status === "paid" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{doc.status === "paid" ? "Pagado" : "Pendiente de pago"}</p>}
        <ul className="divide-y divide-line text-left text-sm">
          {lines.map((l) => <li key={l.id} className="flex justify-between py-1.5"><span>{l.qty} × {l.name}</span><b>{clp(l.qty * l.unitPrice)}</b></li>)}
        </ul>
        <p className="flex justify-between text-lg font-bold"><span>Total</span><span>{clp(doc.total)}</span></p>
        {doc.notes && <p className="text-xs text-muted">{doc.notes}</p>}
        <p className="text-sm">{biz.footer}</p>
        <a className="btn" href={`/api/b/${doc.token}/pdf`} target="_blank" rel="noopener noreferrer">Descargar PDF</a>
      </div>
    </main>
  );
}
