-- CajaCurso · ACTUALIZACIÓN 4: funciones activables por usuario (además de por curso)
-- Pega TODO en Supabase → SQL Editor → New query → Run, ANTES de publicar la versión nueva.

ALTER TABLE "users" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "courses" ADD COLUMN "owner_features" jsonb DEFAULT '{}'::jsonb NOT NULL;
