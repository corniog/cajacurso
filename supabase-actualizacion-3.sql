-- CajaCurso · ACTUALIZACIÓN 3: superusuario (usuarios suspendidos y solicitudes a la administración)
-- Pega TODO en Supabase → SQL Editor → New query → Run, ANTES de publicar la versión nueva.

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

ALTER TABLE "support_requests" ENABLE ROW LEVEL SECURITY;
