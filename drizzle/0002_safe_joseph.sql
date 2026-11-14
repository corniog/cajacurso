ALTER TABLE "courses" ADD COLUMN "directive_code" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_directive_code_unique" UNIQUE("directive_code");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_short_code_unique" UNIQUE("short_code");