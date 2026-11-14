import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta la variable DATABASE_URL");

// Reutiliza la conexión entre recargas en desarrollo
const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };
const serverless = !!process.env.VERCEL;
const sql =
  g.__sql ??
  postgres(url, {
    // Supabase exige SSL; en funciones serverless se usa 1 conexión por instancia
    ssl: /supabase\.(co|com)/.test(url) ? "require" : undefined,
    max: serverless ? 1 : 10,
    // El "pooler" de Supabase (modo transacción) no admite sentencias preparadas
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
if (process.env.NODE_ENV !== "production") g.__sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
