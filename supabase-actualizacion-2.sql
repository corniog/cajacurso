-- CajaCurso · ACTUALIZACIÓN 2: botón "Conectar con Mercado Pago" + Aportes y colectas de apoderados
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run, ANTES de publicar la versión nueva.
-- Se ejecuta una sola vez.

-- 0006_mp_oauth
ALTER TABLE "integrations" ADD COLUMN "mp_refresh_token" text;
ALTER TABLE "integrations" ADD COLUMN "mp_expires_at" timestamp with time zone;
ALTER TABLE "integrations" ADD COLUMN "mp_user_id" text;

-- 0007_aportes
CREATE TABLE "contribution_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"contribution_id" uuid,
	"student_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"external_id" text,
	"extra_income_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contribution_payments_external_id_unique" UNIQUE("external_id")
);
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" integer,
	"due_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "courses" ADD COLUMN "transfer_info" text;
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "contribution_payments" ADD CONSTRAINT "contribution_payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "contribpay_course_idx" ON "contribution_payments" USING btree ("course_id");
CREATE INDEX "contribpay_student_idx" ON "contribution_payments" USING btree ("student_id");
CREATE INDEX "contrib_course_idx" ON "contributions" USING btree ("course_id");

-- Seguridad (RLS) de las tablas nuevas
ALTER TABLE "contribution_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contributions" ENABLE ROW LEVEL SECURITY;
