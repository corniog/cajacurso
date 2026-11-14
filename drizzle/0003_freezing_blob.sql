ALTER TABLE "subscriptions" ADD COLUMN "method" text DEFAULT 'mercadopago' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "note" text;