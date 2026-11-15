import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Diagnóstico temporal: /api/health?k=CRON_SECRET  (se puede borrar cuando todo funcione) */
const withTimeout = <T,>(p: Promise<T>, ms = 8000) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`sin respuesta en ${ms / 1000}s`)), ms))]);

export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get("k");
  if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) return new NextResponse("No autorizado", { status: 401 });

  let conn: Record<string, string> = {};
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    conn = { host: u.hostname, port: u.port, user: u.username.slice(0, 12) + "…" };
  } catch { conn = { error: "DATABASE_URL no es una dirección válida" }; }

  const steps: Record<string, string> = {};
  const run = async (name: string, f: () => Promise<unknown>) => {
    const t = Date.now();
    try { const r = await withTimeout(f()); steps[name] = `ok ${Date.now() - t}ms ${JSON.stringify(r)}`; }
    catch (e) {
      const err = e as { message?: string; code?: string };
      steps[name] = `ERROR ${Date.now() - t}ms ${err.code ?? ""} ${String(err.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "***").slice(0, 200)}`;
    }
  };
  await run("select1", async () => (await db.execute(sql`select 1 as ok`))[0]);
  await run("tablas", async () => (await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema='public'`))[0]);
  await run("usuarios", async () => (await db.execute(sql`select count(*)::int as n from users`))[0]);
  await run("rls_prueba_parallel", async () => Promise.all([db.execute(sql`select 1`), db.execute(sql`select 2`)]).then(() => "ok"));
  return NextResponse.json({ vercel: !!process.env.VERCEL, conn, steps });
}
