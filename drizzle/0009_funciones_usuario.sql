ALTER TABLE "users" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "owner_features" jsonb DEFAULT '{}'::jsonb NOT NULL;
