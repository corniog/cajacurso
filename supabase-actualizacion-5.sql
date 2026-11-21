-- CajaCurso · ACTUALIZACIÓN 5: perfil Centro de padres (auditoría de cursos con un código único por curso)
-- Pega TODO en Supabase → SQL Editor → New query → Run, ANTES de publicar la versión nueva.
-- Crea la tabla de vínculos y le asigna un código AUD-… fijo a cada curso que ya existe.

CREATE TABLE "center_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "courses" ADD COLUMN "audit_code" text;
ALTER TABLE "users" ADD COLUMN "account_type" text DEFAULT 'tesorero' NOT NULL;
ALTER TABLE "users" ADD COLUMN "center_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "center_school" text;
ALTER TABLE "center_links" ADD CONSTRAINT "center_links_center_id_users_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "center_links" ADD CONSTRAINT "center_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "center_links_unique" ON "center_links" USING btree ("center_id","course_id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_audit_code_unique" UNIQUE("audit_code");
UPDATE "courses" SET "audit_code" = 'AUD-' || (SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') FROM generate_series(1, 12) g(i) WHERE "courses"."id" IS NOT NULL) WHERE "audit_code" IS NULL;
ALTER TABLE "center_links" ENABLE ROW LEVEL SECURITY;
