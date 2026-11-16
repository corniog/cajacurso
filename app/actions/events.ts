"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { hasFeature, FEATURES } from "@/lib/features";
import { newToken } from "@/lib/util";
import { nextNumber, PAY_METHODS, loadSettings, type DocKind } from "@/lib/events";
import { buildDocPdf } from "@/lib/event-pdf";
import { sendMail, layout, esc, mailConfigured } from "@/lib/mail";
import { appUrl } from "@/lib/course-data";
import type { ActionState } from "@/app/actions/course";

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const refresh = (id: string) => revalidatePath(`/app/c/${id}`, "layout");
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos";

async function gate(courseId: string) {
  const a = await requireCourse(courseId, { write: true });
  if (!hasFeature(a.course, "events")) {
    throw new Error(`"${FEATURES.events.label}" es parte del Plan Pro. Actívalo en Plan e integraciones o pídelo al administrador.`);
  }
  return a;
}
const optText = (max = 120) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const price = z.coerce.number().int("Usa pesos enteros").min(0).max(10_000_000);

/* ---------------- Productos ---------------- */
const productSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre del producto").max(80),
  price: price,
  stock: z.string().trim().optional().transform((v) => (v === "" || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100000), "El stock debe ser un número entero (o déjalo vacío)"),
});

export async function saveProduct(courseId: string, productId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const p = productSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    if (productId) {
      await db.update(schema.eventProducts).set(p.data)
        .where(and(eq(schema.eventProducts.id, productId), eq(schema.eventProducts.courseId, courseId)));
    } else {
      await db.insert(schema.eventProducts).values({ ...p.data, courseId });
    }
    refresh(courseId);
    return { ok: "Producto guardado" };
  } catch (e) { return fail(e); }
}
export async function toggleProduct(courseId: string, productId: string) {
  await gate(courseId);
  await db.update(schema.eventProducts).set({ active: sql`NOT ${schema.eventProducts.active}` })
    .where(and(eq(schema.eventProducts.id, productId), eq(schema.eventProducts.courseId, courseId)));
  refresh(courseId);
}
export async function deleteProduct(courseId: string, productId: string) {
  await gate(courseId);
  await db.delete(schema.eventProducts).where(and(eq(schema.eventProducts.id, productId), eq(schema.eventProducts.courseId, courseId)));
  refresh(courseId);
}

/* ---------------- Eventos ---------------- */
export async function createEvent(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const p = z.object({
      name: z.string().trim().min(2, "Escribe el nombre del evento").max(100),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
      notes: optText(300),
    }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.insert(schema.events).values({ ...p.data, courseId });
    refresh(courseId);
    return { ok: "Evento creado" };
  } catch (e) { return fail(e); }
}
export async function deleteEvent(courseId: string, eventId: string) {
  await gate(courseId);
  await db.delete(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.courseId, courseId)));
  refresh(courseId);
}

/** Cierra el evento y registra lo cobrado como ingreso extra del curso (se actualiza si se reabre y cierra de nuevo). */
export async function closeEvent(courseId: string, eventId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const [ev] = await db.select().from(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.courseId, courseId))).limit(1);
    if (!ev) return { error: "Evento no encontrado" };
    const docs = await db.select().from(schema.eventDocs).where(eq(schema.eventDocs.eventId, eventId));
    const total = docs.filter((d) => d.kind === "sale" || (d.kind === "credit" && d.status === "paid")).reduce((a, d) => a + d.total, 0);
    await db.transaction(async (tx) => {
      if (ev.extraIncomeId) await tx.delete(schema.extraIncomes).where(eq(schema.extraIncomes.id, ev.extraIncomeId));
      let extraId: string | null = null;
      if (total > 0) {
        const [x] = await tx.insert(schema.extraIncomes).values({
          courseId, description: `Evento: ${ev.name}`, amount: total, date: ev.date, studentIds: [],
        }).returning({ id: schema.extraIncomes.id });
        extraId = x.id;
      }
      await tx.update(schema.events).set({ status: "closed", extraIncomeId: extraId }).where(eq(schema.events.id, eventId));
    });
    refresh(courseId);
    return { ok: total > 0 ? `Evento cerrado. Se registró $${total.toLocaleString("es-CL")} como ingreso extra del curso.` : "Evento cerrado (sin ventas cobradas)." };
  } catch (e) { return fail(e); }
}
export async function reopenEvent(courseId: string, eventId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const [ev] = await db.select().from(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.courseId, courseId))).limit(1);
    if (!ev) return { error: "Evento no encontrado" };
    await db.transaction(async (tx) => {
      if (ev.extraIncomeId) await tx.delete(schema.extraIncomes).where(eq(schema.extraIncomes.id, ev.extraIncomeId));
      await tx.update(schema.events).set({ status: "open", extraIncomeId: null }).where(eq(schema.events.id, eventId));
    });
    refresh(courseId);
    return { ok: "Evento reabierto. Al cerrarlo de nuevo se actualiza el ingreso extra." };
  } catch (e) { return fail(e); }
}

/* ---------------- Ventas, fiados y presupuestos ---------------- */
const cartSchema = z.array(z.object({
  productId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  qty: z.number().int().min(1).max(10000),
  unitPrice: z.number().int().min(0).max(10_000_000),
})).min(1, "Agrega al menos un producto");

export async function createDoc(courseId: string, eventId: string, kind: DocKind, cartJson: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const [ev] = await db.select().from(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.courseId, courseId))).limit(1);
    if (!ev) return { error: "Evento no encontrado" };
    if (ev.status === "closed") return { error: "El evento está cerrado. Reábrelo para registrar movimientos." };
    let cart;
    try { cart = cartSchema.parse(JSON.parse(cartJson)); } catch { return { error: "Agrega al menos un producto al carrito" }; }
    const f = z.object({
      customer: z.string().trim().max(100).optional(),
      phone: optText(30), email: optText(120), notes: optText(300),
      method: z.enum(PAY_METHODS).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    }).safeParse(Object.fromEntries(fd));
    if (!f.success) return { error: firstIssue(f.error) };
    const customer = f.data.customer || (kind === "sale" ? "Cliente" : "");
    if (!customer) return { error: kind === "credit" ? "Escribe quién queda debiendo" : "Escribe el nombre del cliente" };
    const total = cart.reduce((a, l) => a + l.qty * l.unitPrice, 0);

    const doc = await db.transaction(async (tx) => {
      if (kind !== "quote") {
        for (const l of cart) {
          if (!l.productId) continue;
          const [p] = await tx.select().from(schema.eventProducts)
            .where(and(eq(schema.eventProducts.id, l.productId), eq(schema.eventProducts.courseId, courseId))).for("update");
          if (p && p.stock !== null) {
            if (p.stock < l.qty) throw new Error(`Stock insuficiente de "${p.name}" (quedan ${p.stock})`);
            await tx.update(schema.eventProducts).set({ stock: p.stock - l.qty }).where(eq(schema.eventProducts.id, p.id));
          }
        }
      }
      const number = await nextNumber(tx, courseId, kind);
      const [d] = await tx.insert(schema.eventDocs).values({
        courseId, eventId, kind, number, token: newToken(), customer,
        phone: f.data.phone, email: f.data.email, notes: f.data.notes,
        status: kind === "sale" ? "paid" : "pending",
        method: kind === "sale" ? (f.data.method ?? "efectivo") : null,
        dueDate: f.data.dueDate || null, total,
        paidAt: kind === "sale" ? new Date() : null,
      }).returning();
      await tx.insert(schema.eventLines).values(cart.map((l) => ({ docId: d.id, productId: l.productId ?? null, name: l.name, qty: l.qty, unitPrice: l.unitPrice })));
      return d;
    });
    refresh(courseId);
    return { ok: `${doc.number} registrada · ${doc.customer} · $${doc.total.toLocaleString("es-CL")}` };
  } catch (e) { return fail(e); }
}

async function loadDoc(courseId: string, docId: string) {
  const [d] = await db.select().from(schema.eventDocs).where(and(eq(schema.eventDocs.id, docId), eq(schema.eventDocs.courseId, courseId))).limit(1);
  if (!d) throw new Error("Documento no encontrado");
  return d;
}

/** Fiado: “Ya me pagó” → pasa a ventas pagadas. */
export async function markCreditPaid(courseId: string, docId: string, method: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const d = await loadDoc(courseId, docId);
    if (d.kind !== "credit" || d.status === "paid") return { error: "Este fiado ya está pagado" };
    const m = (PAY_METHODS as readonly string[]).includes(method) ? method : "efectivo";
    await db.update(schema.eventDocs).set({ status: "paid", method: m, paidAt: new Date() }).where(eq(schema.eventDocs.id, d.id));
    refresh(courseId);
    return { ok: `${d.number} pagado` };
  } catch (e) { return fail(e); }
}

/** Presupuesto aprobado → se convierte en venta (descuenta stock). */
export async function convertQuote(courseId: string, docId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const d = await loadDoc(courseId, docId);
    if (d.kind !== "quote") return { error: "Solo los presupuestos se pueden convertir" };
    await db.transaction(async (tx) => {
      const lines = await tx.select().from(schema.eventLines).where(eq(schema.eventLines.docId, d.id));
      for (const l of lines) {
        if (!l.productId) continue;
        const [p] = await tx.select().from(schema.eventProducts).where(eq(schema.eventProducts.id, l.productId)).for("update");
        if (p && p.stock !== null) {
          if (p.stock < l.qty) throw new Error(`Stock insuficiente de "${p.name}" (quedan ${p.stock})`);
          await tx.update(schema.eventProducts).set({ stock: p.stock - l.qty }).where(eq(schema.eventProducts.id, p.id));
        }
      }
      const number = await nextNumber(tx, courseId, "sale");
      await tx.update(schema.eventDocs).set({ kind: "sale", number, status: "paid", method: "efectivo", paidAt: new Date() }).where(eq(schema.eventDocs.id, d.id));
    });
    refresh(courseId);
    return { ok: "Presupuesto convertido en venta" };
  } catch (e) { return fail(e); }
}

/** Elimina un documento y devuelve el stock si era venta o fiado. */
export async function deleteDoc(courseId: string, docId: string): Promise<ActionState> {
  try {
    await gate(courseId);
    const d = await loadDoc(courseId, docId);
    await db.transaction(async (tx) => {
      if (d.kind !== "quote") {
        const lines = await tx.select().from(schema.eventLines).where(eq(schema.eventLines.docId, d.id));
        for (const l of lines) {
          if (l.productId) await tx.update(schema.eventProducts).set({ stock: sql`CASE WHEN ${schema.eventProducts.stock} IS NULL THEN NULL ELSE ${schema.eventProducts.stock} + ${l.qty} END` })
            .where(eq(schema.eventProducts.id, l.productId));
        }
      }
      await tx.delete(schema.eventDocs).where(eq(schema.eventDocs.id, d.id));
    });
    refresh(courseId);
    return { ok: "Documento eliminado" };
  } catch (e) { return fail(e); }
}

/* ---------------- Ajustes del negocio / logo ---------------- */
export async function saveEventSettings(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await gate(courseId);
    const p = z.object({
      businessName: optText(80), address: optText(120), phone: optText(30), email: optText(120), footer: optText(120),
    }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    const file = fd.get("logoFile");
    const values: Record<string, unknown> = { ...p.data, updatedAt: new Date() };
    if (fd.get("removeLogo") === "on") values.logo = null;
    else if (file instanceof File && file.size > 0) {
      if (!/^image\/(png|jpeg)$/.test(file.type)) return { error: "El logo debe ser PNG o JPG" };
      if (file.size > 60_000) return { error: "El logo pesa demasiado (máx. 60 KB). Usa una imagen pequeña." };
      values.logo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    await db.insert(schema.eventSettings).values({ courseId, ...values }).onConflictDoUpdate({ target: schema.eventSettings.courseId, set: values });
    refresh(courseId);
    return { ok: "Datos del negocio guardados" };
  } catch (e) { return fail(e); }
}

/* ---------------- Envío por correo ---------------- */
export async function emailDoc(courseId: string, docId: string): Promise<ActionState> {
  try {
    const { course } = await gate(courseId);
    if (!mailConfigured()) return { error: "El envío de correos no está configurado en esta plataforma (SMTP)." };
    const d = await loadDoc(courseId, docId);
    if (!d.email) return { error: "Este documento no tiene correo del cliente" };
    const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, d.eventId)).limit(1);
    const lines = await db.select().from(schema.eventLines).where(eq(schema.eventLines.docId, d.id));
    const biz = await loadSettings(course);
    const pdf = await buildDocPdf(d, lines, biz, ev?.name ?? "");
    const ok = await sendMail(d.email, `${d.number} · ${biz.businessName}`,
      layout(`${d.number}`, `<p>Hola ${esc(d.customer)}, adjuntamos tu documento <b>${esc(d.number)}</b> de <b>${esc(biz.businessName)}</b>.</p><p><a href="${appUrl()}/b/${d.token}">Ver en línea</a></p>`),
      [{ filename: `${d.number}.pdf`, content: pdf, contentType: "application/pdf" }]);
    return ok ? { ok: `Enviado a ${d.email}` } : { error: "No se pudo enviar el correo. Revisa la configuración SMTP." };
  } catch (e) { return fail(e); }
}
