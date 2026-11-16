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
--> statement-breakpoint
CREATE TABLE "event_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"stock" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_docs" ADD CONSTRAINT "event_docs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_docs" ADD CONSTRAINT "event_docs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_lines" ADD CONSTRAINT "event_lines_doc_id_event_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."event_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_lines" ADD CONSTRAINT "event_lines_product_id_event_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."event_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_products" ADD CONSTRAINT "event_products_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_docs_number_idx" ON "event_docs" USING btree ("course_id","number");--> statement-breakpoint
CREATE INDEX "event_docs_event_idx" ON "event_docs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_lines_doc_idx" ON "event_lines" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "event_products_course_idx" ON "event_products" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "events_course_idx" ON "events" USING btree ("course_id");