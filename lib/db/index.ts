import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta la variable DATABASE_URL");

const serverless = !!process.env.VERCEL;
const opts = {
  // Supabase exige SSL
  ssl: /supabase\.(co|com)/.test(url) ? ("require" as const) : undefined,
  // El "pooler" de Supabase (modo transacción) no admite sentencias preparadas
  prepare: false,
  connect_timeout: 15,
};

type Db = ReturnType<typeof drizzle<typeof schema>>;
const make = (o: Record<string, unknown>) => drizzle(postgres(url, { ...opts, ...o }), { schema });

/**
 * En Vercel las funciones se "congelan" entre visitas y una conexión que se dejó abierta puede quedar muerta
 * (las consultas esperan para siempre). Por eso allí se usa una conexión nueva si la anterior lleva más de 1,5 s
 * sin usarse; las viejas se cierran solas (idle_timeout).
 */
let cur: Db | null = null;
let lastUse = 0;
function serverlessDb(): Db {
  const now = Date.now();
  if (!cur || now - lastUse > 1500) cur = make({ max: 3, idle_timeout: 3 });
  lastUse = now;
  return cur;
}

const g = globalThis as unknown as { __db?: Db };
const local: Db | null = serverless ? null : (g.__db ??= make({ max: 10, idle_timeout: 20 }));

export const db: Db = serverless
  ? (new Proxy({} as Db, {
      get(_t, prop) {
        const inst = serverlessDb();
        const v = Reflect.get(inst, prop, inst);
        return typeof v === "function" ? v.bind(inst) : v;
      },
    }) as Db)
  : local!;
export { schema };
