-- CajaCurso · ACTUALIZACIÓN 2: botón "Conectar con Mercado Pago"
-- Pega TODO en Supabase → SQL Editor → New query → Run, ANTES de publicar la versión nueva.

ALTER TABLE "integrations" ADD COLUMN "mp_refresh_token" text;
ALTER TABLE "integrations" ADD COLUMN "mp_expires_at" timestamp with time zone;
ALTER TABLE "integrations" ADD COLUMN "mp_user_id" text;
