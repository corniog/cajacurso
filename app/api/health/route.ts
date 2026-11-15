import { NextResponse } from "next/server";
import net from "node:net";
import postgres from "postgres";

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

  const pg = async (name: string, port: string, ssl: unknown) => {
    const t = t0();
    const url = new URL(raw); url.port = port;
    const c = postgres(url.toString(), { max: 1, prepare: false, connect_timeout: 6, idle_timeout: 5, ssl: ssl as never });
    try {
      const r = await withTimeout(c`select count(*)::int as tablas from information_schema.tables where table_schema='public'`, 7000);
      out[name] = `ok ${t0() - t}ms tablas=${r[0].tablas}`;
    } catch (e) { out[name] = `ERROR ${t0() - t}ms ${clean(e)}`; }
    finally { c.end({ timeout: 1 }).catch(() => {}); }
  };

  await Promise.all([
    tcp("tcp_6543", 6543),
    tcp("tcp_5432", 5432),
    pg("transaccion_ssl_require", "6543", "require"),
    pg("transaccion_ssl_sin_verificar", "6543", { rejectUnauthorized: false }),
    pg("sesion_5432_ssl_require", "5432", "require"),
  ]);
  return NextResponse.json({ vercel: !!process.env.VERCEL, region: process.env.VERCEL_REGION, host: u.hostname, out });
}
