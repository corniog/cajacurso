import "server-only";
import { and, eq, like, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Course, EventDoc, EventLine, EventSettings } from "@/lib/db/schema";

export const KIND_PREFIX = { sale: "B", credit: "F", quote: "P" } as const;
export type DocKind = keyof typeof KIND_PREFIX;
export const KIND_LABEL: Record<DocKind, string> = { sale: "Boleta de venta", credit: "Fiado", quote: "Presupuesto" };
export const PAY_METHODS = ["efectivo", "transferencia", "otro"] as const;

type Db = typeof db;
/** Siguiente número correlativo por curso y tipo (B-0001, F-0001, P-0001). */
export async function nextNumber(tx: Pick<Db, "select">, courseId: string, kind: DocKind) {
  const prefix = KIND_PREFIX[kind];
  const rows = await tx.select({ n: schema.eventDocs.number }).from(schema.eventDocs)
    .where(and(eq(schema.eventDocs.courseId, courseId), like(schema.eventDocs.number, `${prefix}-%`)));
  const max = rows.reduce((a, r) => Math.max(a, parseInt(r.n.split("-")[1] ?? "0", 10) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function eventSettingsFor(course: Course, s?: EventSettings | null) {
  return {
    businessName: s?.businessName || `${course.school} · ${course.name}`,
    address: s?.address || "",
    phone: s?.phone || "",
    email: s?.email || "",
    footer: s?.footer || "¡Gracias por su compra!",
    logo: s?.logo || "",
  };
}
export type BusinessInfo = ReturnType<typeof eventSettingsFor>;

export async function loadSettings(course: Course) {
  const [s] = await db.select().from(schema.eventSettings).where(eq(schema.eventSettings.courseId, course.id)).limit(1);
  return eventSettingsFor(course, s);
}

export async function loadDocWithLines(where: ReturnType<typeof eq>) {
  const [doc] = await db.select().from(schema.eventDocs).where(where).limit(1);
  if (!doc) return null;
  const lines = await db.select().from(schema.eventLines).where(eq(schema.eventLines.docId, doc.id)).orderBy(asc(schema.eventLines.name));
  return { doc, lines };
}

/** Total cobrado de un evento: ventas + fiados ya pagados. */
export function eventTotals(docs: EventDoc[]) {
  const sold = docs.filter((d) => d.kind === "sale").reduce((a, d) => a + d.total, 0);
  const creditPaid = docs.filter((d) => d.kind === "credit" && d.status === "paid").reduce((a, d) => a + d.total, 0);
  const creditPending = docs.filter((d) => d.kind === "credit" && d.status === "pending").reduce((a, d) => a + d.total, 0);
  const quotes = docs.filter((d) => d.kind === "quote" && d.status === "pending").reduce((a, d) => a + d.total, 0);
  return { collected: sold + creditPaid, sold, creditPaid, creditPending, quotes };
}

export function docDate(d: EventDoc) {
  return d.createdAt.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
}
export type DocWithLines = { doc: EventDoc; lines: EventLine[] };
