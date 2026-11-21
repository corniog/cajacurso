CREATE TABLE "center_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "audit_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" text DEFAULT 'tesorero' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "center_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "center_school" text;--> statement-breakpoint
ALTER TABLE "center_links" ADD CONSTRAINT "center_links_center_id_users_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "center_links" ADD CONSTRAINT "center_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "center_links_unique" ON "center_links" USING btree ("center_id","course_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_audit_code_unique" UNIQUE("audit_code");