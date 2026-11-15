import { NextResponse } from "next/server";
import net from "node:net";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Diagnóstico temporal: /api/health?k=CRON_SECRET  (se puede borrar cuando todo funcione) */
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`sin respuesta en ${ms / 1000}s`)), ms))]);

export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get("k");
  if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) return new NextResponse("No autorizado", { status: 401 });

  const raw = process.env.DATABASE_URL || "";
  let u: URL;
  try { u = new URL(raw); } catch { return NextResponse.json({ error: "DATABASE_URL no es una dirección válida" }); }

  const out: Record<string, string> = {};
  const t0 = () => Date.now();
  const clean = (e: unknown) => {
    const err = e as { message?: string; code?: string };
    return `${err.code ?? ""} ${String(err.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "***")}`.slice(0, 220);
  };

  const tcp = async (name: string, port: number) => {
    const t = t0();
    try {
      await withTimeout(new Promise<void>((res, rej) => {
        const s = net.connect({ host: u.hostname, port }, () => { s.destroy(); res(); });
        s.on("error", rej);
      }), 6000);
      out[name] = `ok ${t0() - t}ms`;
    } catch (e) { out[name] = `ERROR ${t0() - t}ms ${clean(e)}`; }
  };

  const variant = async (name: string, opts: Record<string, unknown>, f: (c: ReturnType<typeof postgres>) => Promise<unknown>) => {
    const t = t0();
    const c = postgres(raw, { ssl: "require", max: 1, prepare: false, connect_timeout: 6, idle_timeout: 5, ...opts } as never);
    try { const r = await withTimeout(f(c), 7000); out[name] = `ok ${t0() - t}ms ${JSON.stringify(r).slice(0, 80)}`; }
    catch (e) { out[name] = `ERROR ${t0() - t}ms ${clean(e)}`; }
    finally { c.end({ timeout: 1 }).catch(() => {}); }
  };

  await Promise.all([
    tcp("tcp_6543", 6543),
    variant("1_plantilla", {}, (c) => c`select 1 as ok`),
    variant("2_unsafe_simple", {}, (c) => c.unsafe("select 1 as ok")),
    variant("3_unsafe_params_values", {}, (c) => c.unsafe("select $1::int as ok", [1], { prepare: false }).values()),
    variant("4_drizzle_execute", {}, (c) => drizzle(c).execute(sql`select 1 as ok`)),
    variant("5_drizzle_tabla_users", {}, (c) => drizzle(c, { schema }).select({ id: schema.users.id }).from(schema.users).limit(1)),
    variant("6_config_de_la_app", { idle_timeout: 20, connect_timeout: 15 }, (c) => c`select count(*)::int as n from users`),
  ]);
  return NextResponse.json({ vercel: !!process.env.VERCEL, region: process.env.VERCEL_REGION, host: u.hostname, out });
}
