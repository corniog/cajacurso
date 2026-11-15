"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import ExcelJS from "exceljs";
import { db, schema } from "@/lib/db";
import { requireUser, requireCourse } from "@/lib/auth";
import { courseCode, newToken, newStudentCode, normalizeRut } from "@/lib/util";
import { allocateAcrossMonths, PAYMENT_METHODS, EXPENSE_CATEGORIES } from "@/lib/finance";
import { canAddExtra } from "@/lib/plans";
import { PLANS } from "@/lib/brand";
import { saveReceipt, deleteReceipt } from "@/lib/storage";
import { uploadReceiptToDrive } from "@/lib/drive";
import { notifyPayment } from "@/lib/reminders";

export type ActionState = { error?: string; ok?: string } | undefined;

const fail = (e: unknown): ActionState => ({ error: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Datos no válidos";
const refresh = (courseId: string) => revalidatePath(`/app/c/${courseId}`, "layout");

const monthNum = z.coerce.number().int().min(1).max(12);
const money = z.coerce.number().int("Usa un monto entero en pesos").min(1, "El monto debe ser mayor a 0").max(100_000_000);
const optText = (max = 120) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

/* ------------------------------ Cursos ------------------------------ */

const courseSchema = z.object({
  school: z.string().trim().min(2, "Escribe el nombre del colegio").max(120),
  name: z.string().trim().min(1, "Escribe el nombre del curso (ej: 3° Básico A)").max(60),
  year: z.coerce.number().int().min(2020).max(2100),
  monthlyFee: z.coerce.number().int().min(0, "La cuota no puede ser negativa").max(10_000_000),
  startMonth: monthNum,
  endMonth: monthNum,
}).refine((d) => d.endMonth >= d.startMonth, { message: "El mes final no puede ser anterior al inicial" });

const monthRange = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export async function createCourse(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = courseSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  let id: string;
  try {
    for (let i = 0; ; i++) {
      try {
        const [c] = await db.insert(schema.courses).values({
          ownerId: user.id, school: d.school, name: d.name, year: d.year, monthlyFee: d.monthlyFee,
          months: monthRange(d.startMonth, d.endMonth), code: courseCode(d.name),
        }).returning({ id: schema.courses.id });
        id = c.id;
        break;
      } catch (e) {
        if (i >= 4) throw e; // colisión de código poco probable: reintenta
      }
    }
  } catch (e) { return fail(e); }
  redirect(`/app/c/${id}`);
}

export async function updateCourse(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { role } = await requireCourse(courseId, { write: true });
    if (role !== "owner") return { error: "Solo quien creó el curso puede cambiar su configuración" };
    const p = courseSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    const d = p.data;
    await db.update(schema.courses).set({
      school: d.school, name: d.name, year: d.year, monthlyFee: d.monthlyFee,
      months: monthRange(d.startMonth, d.endMonth),
      publicExpenses: fd.get("publicExpenses") === "on",
    }).where(eq(schema.courses.id, courseId));
    refresh(courseId);
    return { ok: "Cambios guardados" };
  } catch (e) { return fail(e); }
}

export async function deleteCourse(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { role, course } = await requireCourse(courseId, { write: true });
    if (role !== "owner") return { error: "Solo quien creó el curso puede eliminarlo" };
    if (String(fd.get("confirm") ?? "").trim() !== course.name) return { error: "Escribe el nombre exacto del curso para confirmar" };
    await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  } catch (e) { return fail(e); }
  redirect("/app");
}

/* ------------------------------ Alumnos ------------------------------ */

const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Falta el nombre").max(60),
  lastName: z.string().trim().min(1, "Falta el apellido").max(60),
  rut: optText(20),
  guardianName: optText(80),
  guardianPhone: optText(25),
  guardianEmail: z.string().trim().toLowerCase().max(120).optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Correo del apoderado no válido").transform((v) => (v ? v : null)),
  billingStart: z.preprocess((v) => (v === "" || v == null ? null : v), monthNum.nullable()),
  billingEnd: z.preprocess((v) => (v === "" || v == null ? null : v), monthNum.nullable()),
}).refine((d) => d.billingStart == null || d.billingEnd == null || d.billingEnd >= d.billingStart,
  { message: "El fin de cobro no puede ser anterior al inicio" });

function cleanStudent(d: z.infer<typeof studentSchema>) {
  let rut = d.rut;
  if (rut) {
    const n = normalizeRut(rut);
    if (!n) throw new Error("El RUT no es válido (revisa el dígito verificador) o déjalo en blanco");
    rut = n;
  }
  return { ...d, rut };
}

export async function addStudent(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireCourse(courseId, { write: true });
    const p = studentSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.insert(schema.students).values({ ...cleanStudent(p.data), courseId, token: newToken(), shortCode: newStudentCode() });
    refresh(courseId);
    return { ok: "Alumno agregado" };
  } catch (e) { return fail(e); }
}

export async function updateStudent(courseId: string, studentId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireCourse(courseId, { write: true });
    const p = studentSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    await db.update(schema.students).set(cleanStudent(p.data))
      .where(and(eq(schema.students.id, studentId), eq(schema.students.courseId, courseId)));
    refresh(courseId);
    return { ok: "Alumno actualizado" };
  } catch (e) { return fail(e); }
}

export async function setStudentActive(courseId: string, studentId: string, active: boolean) {
  await requireCourse(courseId, { write: true });
  await db.update(schema.students).set({ active })
    .where(and(eq(schema.students.id, studentId), eq(schema.students.courseId, courseId)));
  refresh(courseId);
}

export async function deleteStudent(courseId: string, studentId: string) {
  await requireCourse(courseId, { write: true });
  await db.delete(schema.students).where(and(eq(schema.students.id, studentId), eq(schema.students.courseId, courseId)));
  refresh(courseId);
}

/** Importa alumnos desde Excel (.xlsx) o CSV. Acepta columnas Nombre, Apellido, RUT, Apoderado, Teléfono, Correo. */
export async function importStudents(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireCourse(courseId, { write: true });
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo .xlsx o .csv" };
    if (file.size > 2 * 1024 * 1024) return { error: "El archivo es muy grande (máximo 2 MB)" };
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    if (/\.csv$/i.test(file.name)) {
      const { Readable } = await import("node:stream");
      await wb.csv.read(Readable.from(buf));
    } else {
      await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    }
    const ws = wb.worksheets[0];
    if (!ws) return { error: "El archivo no tiene hojas con datos" };

    const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const cell = (v: ExcelJS.CellValue): string => {
      if (v == null) return "";
      if (typeof v === "object") {
        const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
        if (o.richText) return o.richText.map((r) => r.text).join("");
        return String(o.text ?? o.result ?? "");
      }
      return String(v);
    };
    const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => norm(cell(v)));
    const find = (...names: string[]) => header.findIndex((h) => h && names.some((n) => h.includes(n)));
    const cName = find("nombre"), cLast = find("apellido"), cRut = find("rut"), cG = find("apoderado"),
      cPhone = find("telefono", "celular", "fono"), cMail = find("correo", "email", "mail");
    if (cName < 1) return { error: "No encontré la columna \"Nombre\" en la primera fila" };

    const existing = await db.select().from(schema.students).where(eq(schema.students.courseId, courseId));
    const seen = new Set(existing.map((s) => `${norm(s.firstName)}|${norm(s.lastName)}`));
    const rows: (typeof schema.students.$inferInsert)[] = [];
    let skipped = 0;
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const get = (c: number) => (c > 0 ? cell(row.getCell(c).value).trim() : "");
      let first = get(cName), last = get(cLast);
      if (!last && first.includes(" ")) { // "Nombre completo" en una sola columna
        const parts = first.split(/\s+/);
        last = parts.slice(-1).join(" ");
        first = parts.slice(0, -1).join(" ");
      }
      if (!first || !last) { if (first || last) skipped++; return; }
      const key = `${norm(first)}|${norm(last)}`;
      if (seen.has(key)) { skipped++; return; }
      seen.add(key);
      const rutRaw = get(cRut);
      const mail = get(cMail).toLowerCase();
      rows.push({
        courseId, firstName: first.slice(0, 60), lastName: last.slice(0, 60),
        rut: rutRaw ? normalizeRut(rutRaw) : null,
        guardianName: get(cG).slice(0, 80) || null,
        guardianPhone: get(cPhone).slice(0, 25) || null,
        guardianEmail: /^\S+@\S+\.\S+$/.test(mail) ? mail : null,
        token: newToken(), shortCode: newStudentCode(),
      });
    });
    if (rows.length > 500) return { error: "Máximo 500 alumnos por importación" };
    if (rows.length) await db.insert(schema.students).values(rows);
    refresh(courseId);
    return { ok: `Se importaron ${rows.length} alumnos${skipped ? ` (${skipped} omitidos por estar repetidos o incompletos)` : ""}` };
  } catch (e) { return fail(e); }
}

/* ------------------------------ Pagos ------------------------------ */

const paymentSchema = z.object({
  studentId: z.string().uuid(),
  amount: money,
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  method: z.enum(PAYMENT_METHODS),
  notes: optText(200),
});

export async function registerPayment(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course } = await requireCourse(courseId, { write: true });
    const p = paymentSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    const months = [...new Set(fd.getAll("months").map(Number))].filter((m) => course.months.includes(m)).sort((a, b) => a - b);
    if (!months.length) return { error: "Elige al menos un mes" };
    const [st] = await db.select().from(schema.students)
      .where(and(eq(schema.students.id, p.data.studentId), eq(schema.students.courseId, courseId))).limit(1);
    if (!st) return { error: "Alumno no encontrado" };

    const existing = await db.select().from(schema.payments)
      .where(and(eq(schema.payments.studentId, st.id), inArray(schema.payments.month, months)));
    const already: Record<number, number> = {};
    for (const e of existing) already[e.month] = (already[e.month] ?? 0) + e.amount;

    const parts = months.length === 1
      ? [{ month: months[0], amount: p.data.amount }]
      : allocateAcrossMonths(p.data.amount, course.monthlyFee, months, already);
    const receiptId = parts.length > 1 ? crypto.randomUUID() : null;
    await db.insert(schema.payments).values(parts.map((x) => ({
      courseId, studentId: st.id, month: x.month, amount: x.amount, paidAt: p.data.paidAt,
      method: p.data.method, notes: p.data.notes, receiptId, source: "manual" as const,
    })));
    void notifyPayment(course, st, p.data.amount, parts.map((x) => x.month)); // correo Pro, no bloquea
    refresh(courseId);
    return { ok: parts.length > 1 ? `Pago registrado en ${parts.length} meses` : "Pago registrado" };
  } catch (e) { return fail(e); }
}

export async function deletePayment(courseId: string, paymentId: string) {
  await requireCourse(courseId, { write: true });
  await db.delete(schema.payments).where(and(eq(schema.payments.id, paymentId), eq(schema.payments.courseId, courseId)));
  refresh(courseId);
}

/* ------------------------------ Gastos ------------------------------ */

const expenseSchema = z.object({
  description: z.string().trim().min(2, "Describe el gasto").max(160),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  vendor: optText(100),
  docNumber: optText(40),
});

export async function addExpense(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course } = await requireCourse(courseId, { write: true });
    const p = expenseSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    let receiptFile: string | null = null, driveFileId: string | null = null;
    const f = fd.get("receipt");
    if (f instanceof File && f.size > 0) {
      const saved = await saveReceipt(courseId, f);
      receiptFile = saved.name;
      driveFileId = await uploadReceiptToDrive(course, saved.name, saved.mime, saved.buffer, p.data.description);
    }
    await db.insert(schema.expenses).values({ ...p.data, courseId, receiptFile, driveFileId });
    refresh(courseId);
    return { ok: "Gasto registrado" };
  } catch (e) { return fail(e); }
}

export async function deleteExpense(courseId: string, expenseId: string) {
  await requireCourse(courseId, { write: true });
  const [e] = await db.select().from(schema.expenses)
    .where(and(eq(schema.expenses.id, expenseId), eq(schema.expenses.courseId, courseId))).limit(1);
  if (!e) return;
  await db.delete(schema.expenses).where(eq(schema.expenses.id, expenseId));
  await deleteReceipt(courseId, e.receiptFile);
  refresh(courseId);
}

/* ------------------------------ Ingresos extra ------------------------------ */

const extraSchema = z.object({
  description: z.string().trim().min(2, "Describe el ingreso").max(160),
  amount: money,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
});

export async function addExtra(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { course } = await requireCourse(courseId, { write: true });
    if (!(await canAddExtra(course))) {
      return { error: `El plan Gratis permite hasta ${PLANS.freeExtraLimit} ingresos extra. Activa el Plan Pro para agregar más.` };
    }
    const p = extraSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstIssue(p.error) };
    const ids = fd.getAll("studentIds").map(String);
    let studentIds: string[] = [];
    if (ids.length) {
      const valid = await db.select({ id: schema.students.id }).from(schema.students)
        .where(and(eq(schema.students.courseId, courseId), inArray(schema.students.id, ids)));
      studentIds = valid.map((v) => v.id);
    }
    await db.insert(schema.extraIncomes).values({ ...p.data, courseId, studentIds });
    refresh(courseId);
    return { ok: "Ingreso extra registrado" };
  } catch (e) { return fail(e); }
}

export async function deleteExtra(courseId: string, extraId: string) {
  await requireCourse(courseId, { write: true });
  await db.delete(schema.extraIncomes).where(and(eq(schema.extraIncomes.id, extraId), eq(schema.extraIncomes.courseId, courseId)));
  refresh(courseId);
}
