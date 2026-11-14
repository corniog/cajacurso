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
  publicStudents: boolean("public_students").notNull().default(true), // lista abreviada en la vista por código
  publicExpenses: boolean("public_expenses").notNull().default(true), // gastos y boletas visibles para apoderados
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

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExtraIncome = typeof extraIncomes.$inferSelect;
