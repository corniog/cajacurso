// Aplica las migraciones SQL de ./drizzle en orden, una sola vez cada una.
// Solo depende del paquete "postgres", así funciona dentro de la imagen Docker.
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
const dir = path.resolve(process.argv[2] || "drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf8"));
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS app_migrations (tag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql`SELECT tag FROM app_migrations`).map((r) => r.tag));
  let applied = 0;
  for (const entry of journal.entries) {
    if (done.has(entry.tag)) continue;
    const statements = fs.readFileSync(path.join(dir, `${entry.tag}.sql`), "utf8")
      .split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    await sql.begin(async (tx) => {
      for (const st of statements) await tx.unsafe(st);
      await tx`INSERT INTO app_migrations (tag) VALUES (${entry.tag})`;
    });
    console.log("Migración aplicada:", entry.tag);
    applied++;
  }
  console.log(applied ? `Listo: ${applied} migración(es) aplicada(s).` : "Base de datos al día.");
} catch (e) {
  console.error("Error de migración:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
