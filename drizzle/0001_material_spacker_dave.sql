ALTER TABLE "courses" ADD COLUMN "public_students" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "public_expenses" boolean DEFAULT true NOT NULL;