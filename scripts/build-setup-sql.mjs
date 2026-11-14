// Junta todas las migraciones en UN archivo (supabase-setup.sql) para pegarlo en el editor SQL de Supabase.
// Además: activa la seguridad por filas (RLS) en cada tabla y crea el bucket privado de boletas.
import fs from "node:fs";
const dir = "drizzle";
const journal = JSON.parse(fs.readFileSync(`${dir}/meta/_journal.json`, "utf8"));
const parts = [];
const tables = [];
for (const e of journal.entries) {
  const sql = fs.readFileSync(`${dir}/${e.tag}.sql`, "utf8");
  for (const m of sql.matchAll(/CREATE TABLE "([^"]+)"/g)) tables.push(m[1]);
  parts.push(`-- ${e.tag}\n${sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean).join("\n")}`);
}
const out = `-- CajaCurso · instalación de la base de datos (Supabase)
-- Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Se ejecuta una sola vez. Generado con: node scripts/build-setup-sql.mjs

${parts.join("\n\n")}

-- Seguridad: el acceso a las tablas es solo desde la aplicación (rol postgres, que ignora RLS).
-- Al activar RLS sin políticas, nadie puede leerlas por la API pública de Supabase.
${tables.map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join("\n")}

-- Bucket PRIVADO para las fotos de boletas
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('boletas', 'boletas', false) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
`;
fs.writeFileSync("supabase-setup.sql", out);
console.log(`supabase-setup.sql generado: ${journal.entries.length} migraciones, ${tables.length} tablas con RLS`);
