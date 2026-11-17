ALTER TABLE "integrations" ADD COLUMN "mp_refresh_token" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "mp_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "mp_user_id" text;