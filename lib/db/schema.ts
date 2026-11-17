import {
  pgTable, uuid, text, integer, smallint, boolean, timestamp, date, jsonb, index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  disabled: boolean("disabled").notNull().default(false), // cuenta suspendida por el administrador
  createdAt: createdAt(),
});

export const courses = pgTable("courses", {
  id: id(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  school: text("school").notNull(),
  name: text("name").notNull(),
  year: smallint("year").notNull(),
  monthlyFee: integer("monthly_fee").notNull(), // CLP
  months: jsonb("months").$type<number[]>().notNull(), // meses de cobro 1..12
  code: text("code").notNull().unique(), // código público del curso
  proUntil: timestamp("pro_until", { withTimezone: true }), // null = plan gratis
  proTrialUsed: boolean("pro_trial_used").notNull().default(false),
  // Funciones activadas o desactivadas a mano por el administrador (clave -> true/false). Sin clave = según el plan.
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  publicStudents: boolean("public_students").notNull().default(true), // lista abreviada en la vista por código
  publicExpenses: boolean("public_expenses").notNull().default(true), // gastos y boletas visibles para apoderados
  transferInfo: text("transfer_info"), // datos bancarios para que los apoderados transfieran aportes
  directiveCode: text("directive_code").unique(), // acceso de solo lectura para directivos (null = desactivado)
  createdAt: createdAt(),
}, (t) => [index("courses_owner_idx").on(t.ownerId)]);

// Segundo tesorero (Pro): rol "admin" (edita) o "viewer" (solo ve)
export const courseMembers = pgTable("course_members", {
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "viewer"] }).notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.courseId, t.userId] })]);

export const students = pgTable("students", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  rut: text("rut"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianEmail: text("guardian_email"),
  billingStart: smallint("billing_start"), // mes inicio de cobro (null = desde el primer mes del curso)
  billingEnd: smallint("billing_end"), // mes fin de cobro (null = hasta el último)
  active: boolean("active").notNull().default(true),
  token: text("token").notNull().unique(), // enlace público de la ficha (se usa en el QR)
  shortCode: text("short_code").unique(), // código corto para digitar, ej: AB3D7-K9MPQ
  createdAt: createdAt(),
}, (t) => [index("students_course_idx").on(t.courseId)]);

export const payments = pgTable("payments", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  month: smallint("month").notNull(), // 1..12
  amount: integer("amount").notNull(),
  paidAt: date("paid_at").notNull(),
  method: text("method").notNull().default("efectivo"),
  notes: text("notes"),
  receiptId: uuid("receipt_id"), // agrupa los meses cubiertos por un mismo comprobante
  source: text("source", { enum: ["manual", "mercadopago"] }).notNull().default("manual"),
  externalId: text("external_id"),
  createdAt: createdAt(),
}, (t) => [
  index("payments_course_idx").on(t.courseId),
  index("payments_student_idx").on(t.studentId),
  uniqueIndex("payments_external_uidx").on(t.externalId, t.studentId, t.month),
]);

export const expenses = pgTable("expenses", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category: text("category").notNull().default("otros"),
  amount: integer("amount").notNull(),
  date: date("date").notNull(),
  vendor: text("vendor"),
  docNumber: text("doc_number"),
  receiptFile: text("receipt_file"), // nombre del archivo en el almacenamiento
  driveFileId: text("drive_file_id"),
  createdAt: createdAt(),
}, (t) => [index("expenses_course_idx").on(t.courseId)]);

export const extraIncomes = pgTable("extra_incomes", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  date: date("date").notNull(),
  studentIds: jsonb("student_ids").$type<string[]>().notNull().default([]), // vacío = curso completo
  createdAt: createdAt(),
}, (t) => [index("extras_course_idx").on(t.courseId)]);

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  plan: text("plan", { enum: ["trial", "monthly", "annual", "manual"] }).notNull(),
  status: text("status", { enum: ["pending", "active", "cancelled", "expired"] }).notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("mercadopago"), // mercadopago | transferencia | manual | prueba
  note: text("note"), // comentario del tesorero o del administrador
  externalId: text("external_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("subs_course_idx").on(t.courseId)]);

// Integraciones Pro por curso (credenciales cifradas en la app, ver lib/crypto.ts)
export const integrations = pgTable("integrations", {
  courseId: uuid("course_id").primaryKey().references(() => courses.id, { onDelete: "cascade" }),
  mpAccessToken: text("mp_access_token"),
  mpRefreshToken: text("mp_refresh_token"), // solo si se conectó con el botón (OAuth)
  mpExpiresAt: timestamp("mp_expires_at", { withTimezone: true }),
  mpUserId: text("mp_user_id"),
  driveRefreshToken: text("drive_refresh_token"),
  driveFolderId: text("drive_folder_id"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(false),
  reminderDay: smallint("reminder_day").notNull().default(5), // día del mes
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- Ventas para eventos (punto de venta) ---------------- */

export const eventProducts = pgTable("event_products", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock"), // null = sin control de stock
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("event_products_course_idx").on(t.courseId)]);

export const events = pgTable("events", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  extraIncomeId: uuid("extra_income_id"), // ingreso extra del curso creado desde este evento
  createdAt: createdAt(),
}, (t) => [index("events_course_idx").on(t.courseId)]);

/** Venta (boleta), fiado (a crédito) o presupuesto de un evento. */
export const eventDocs = pgTable("event_docs", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["sale", "credit", "quote"] }).notNull(),
  number: text("number").notNull(), // B-0001 venta · F-0001 fiado · P-0001 presupuesto
  token: text("token").notNull().unique(), // enlace público de la boleta
  customer: text("customer").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: text("status", { enum: ["paid", "pending", "approved", "rejected"] }).notNull(),
  method: text("method"), // efectivo | transferencia | otro
  dueDate: date("due_date"), // fiado: fecha prometida de pago · presupuesto: válido hasta
  total: integer("total").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("event_docs_number_idx").on(t.courseId, t.number),
  index("event_docs_event_idx").on(t.eventId),
]);

export const eventLines = pgTable("event_lines", {
  id: id(),
  docId: uuid("doc_id").notNull().references(() => eventDocs.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => eventProducts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
}, (t) => [index("event_lines_doc_idx").on(t.docId)]);

export const eventSettings = pgTable("event_settings", {
  courseId: uuid("course_id").primaryKey().references(() => courses.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  footer: text("footer"),
  logo: text("logo"), // imagen pequeña en formato data URL
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Colectas y aportes distintos de la cuota mensual (regalo de la profe, venta, compra…). */
export const contributions = pgTable("contributions", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  amount: integer("amount"), // monto sugerido por familia (null = cada uno decide)
  dueDate: date("due_date"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("contrib_course_idx").on(t.courseId)]);

/** Aportes que informan o pagan los apoderados. Al confirmarse se registran solos como ingreso extra. */
export const contributionPayments = pgTable("contribution_payments", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  contributionId: uuid("contribution_id").references(() => contributions.id, { onDelete: "set null" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  concept: text("concept").notNull(),
  amount: integer("amount").notNull(),
  method: text("method", { enum: ["mercadopago", "transferencia"] }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull().default("pending"),
  note: text("note"), // N° de operación u observación del apoderado
  externalId: text("external_id").unique(), // id del pago en Mercado Pago
  extraIncomeId: uuid("extra_income_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("contribpay_course_idx").on(t.courseId), index("contribpay_student_idx").on(t.studentId)]);

/** Solicitudes que los usuarios envían al administrador/desarrollador desde la aplicación. */
export const supportRequests = pgTable("support_requests", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["feature", "message"] }).notNull(),
  featureKey: text("feature_key"),
  message: text("message"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  adminNote: text("admin_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [index("support_status_idx").on(t.status), index("support_user_idx").on(t.userId)]);

/** Bitácora del libro contable: cada edición o eliminación de un movimiento queda registrada (auditoría). */
export const ledgerAudit = pgTable("ledger_audit", {
  id: id(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  userName: text("user_name").notNull(),
  action: text("action", { enum: ["edit", "delete"] }).notNull(),
  entity: text("entity", { enum: ["payment", "expense", "extra"] }).notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: createdAt(),
}, (t) => [index("ledger_audit_course_idx").on(t.courseId)]);

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExtraIncome = typeof extraIncomes.$inferSelect;
export type EventProduct = typeof eventProducts.$inferSelect;
export type CourseEvent = typeof events.$inferSelect;
export type EventDoc = typeof eventDocs.$inferSelect;
export type EventLine = typeof eventLines.$inferSelect;
export type EventSettings = typeof eventSettings.$inferSelect;
export type LedgerAudit = typeof ledgerAudit.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type ContributionPayment = typeof contributionPayments.$inferSelect;
export type SupportRequest = typeof supportRequests.$inferSelect;
