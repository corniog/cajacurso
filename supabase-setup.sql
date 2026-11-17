-- CajaCurso · instalación de la base de datos (Supabase)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Se ejecuta una sola vez. Generado con: node scripts/build-setup-sql.mjs

-- 0000_harsh_crusher_hogan
CREATE TABLE "course_members" (
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_members_course_id_user_id_pk" PRIMARY KEY("course_id","user_id")
);
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"school" text NOT NULL,
	"name" text NOT NULL,
	"year" smallint NOT NULL,
	"monthly_fee" integer NOT NULL,
	"months" jsonb NOT NULL,
	"code" text NOT NULL,
	"pro_until" timestamp with time zone,
	"pro_trial_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_code_unique" UNIQUE("code")
);
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'otros' NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"vendor" text,
	"doc_number" text,
	"receipt_file" text,
	"drive_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "extra_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"student_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "integrations" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"mp_access_token" text,
	"drive_refresh_token" text,
	"drive_folder_id" text,
	"reminders_enabled" boolean DEFAULT false NOT NULL,
	"reminder_day" smallint DEFAULT 5 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"month" smallint NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" date NOT NULL,
	"method" text DEFAULT 'efectivo' NOT NULL,
	"notes" text,
	"receipt_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"rut" text,
	"guardian_name" text,
	"guardian_phone" text,
	"guardian_email" text,
	"billing_start" smallint,
	"billing_end" smallint,
	"active" boolean DEFAULT true NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_token_unique" UNIQUE("token")
);
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"external_id" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
ALTER TABLE "course_members" ADD CONSTRAINT "course_members_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "course_members" ADD CONSTRAINT "course_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses" ADD CONSTRAINT "courses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "extra_incomes" ADD CONSTRAINT "extra_incomes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "students" ADD CONSTRAINT "students_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "courses_owner_idx" ON "courses" USING btree ("owner_id");
CREATE INDEX "expenses_course_idx" ON "expenses" USING btree ("course_id");
CREATE INDEX "extras_course_idx" ON "extra_incomes" USING btree ("course_id");
CREATE INDEX "payments_course_idx" ON "payments" USING btree ("course_id");
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_id");
CREATE UNIQUE INDEX "payments_external_uidx" ON "payments" USING btree ("external_id","student_id","month");
CREATE INDEX "students_course_idx" ON "students" USING btree ("course_id");
CREATE INDEX "subs_course_idx" ON "subscriptions" USING btree ("course_id");

-- 0001_material_spacker_dave
ALTER TABLE "courses" ADD COLUMN "public_students" boolean DEFAULT true NOT NULL;
ALTER TABLE "courses" ADD COLUMN "public_expenses" boolean DEFAULT true NOT NULL;

-- 0002_safe_joseph
ALTER TABLE "courses" ADD COLUMN "directive_code" text;
ALTER TABLE "students" ADD COLUMN "short_code" text;
ALTER TABLE "courses" ADD CONSTRAINT "courses_directive_code_unique" UNIQUE("directive_code");
ALTER TABLE "students" ADD CONSTRAINT "students_short_code_unique" UNIQUE("short_code");

-- 0003_freezing_blob
ALTER TABLE "subscriptions" ADD COLUMN "method" text DEFAULT 'mercadopago' NOT NULL;
ALTER TABLE "subscriptions" ADD COLUMN "note" text;

-- 0004_eventos_y_funciones
CREATE TABLE "event_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"number" text NOT NULL,
	"token" text NOT NULL,
	"customer" text NOT NULL,
	"phone" text,
	"email" text,
	"status" text NOT NULL,
	"method" text,
	"due_date" date,
	"total" integer NOT NULL,
	"notes" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_docs_token_unique" UNIQUE("token")
);
CREATE TABLE "event_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL
);
CREATE TABLE "event_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"stock" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "event_settings" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"business_name" text,
	"address" text,
	"phone" text,
	"email" text,
	"footer" text,
	"logo" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"extra_income_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "courses" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "event_docs" ADD CONSTRAINT "event_docs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_docs" ADD CONSTRAINT "event_docs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_lines" ADD CONSTRAINT "event_lines_doc_id_event_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."event_docs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_lines" ADD CONSTRAINT "event_lines_product_id_event_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."event_products"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "event_docs_number_idx" ON "event_docs" USING btree ("course_id","number");
CREATE INDEX "event_docs_event_idx" ON "event_docs" USING btree ("event_id");
CREATE INDEX "event_lines_doc_idx" ON "event_lines" USING btree ("doc_id");
CREATE INDEX "event_products_course_idx" ON "event_products" USING btree ("course_id");
CREATE INDEX "events_course_idx" ON "events" USING btree ("course_id");

-- 0005_libro_contable
CREATE TABLE "ledger_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "ledger_audit" ADD CONSTRAINT "ledger_audit_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ledger_audit_course_idx" ON "ledger_audit" USING btree ("course_id");

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

-- 0008_superusuario
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid,
	"kind" text NOT NULL,
	"feature_key" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "users" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "support_status_idx" ON "support_requests" USING btree ("status");
CREATE INDEX "support_user_idx" ON "support_requests" USING btree ("user_id");

-- Seguridad: el acceso a las tablas es solo desde la aplicación (rol postgres, que ignora RLS).
-- Al activar RLS sin políticas, nadie puede leerlas por la API pública de Supabase.
ALTER TABLE "course_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extra_incomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contribution_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_requests" ENABLE ROW LEVEL SECURITY;

-- Bucket PRIVADO para las fotos de boletas
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('boletas', 'boletas', false) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
