import "server-only";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(ALLOWED).map(([m, e]) => [e, m]));
// Vercel limita el cuerpo de una función a ~4,5 MB; las fotos se comprimen en el navegador antes de subir
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Almacenamiento de boletas.
 *  - Con SUPABASE_URL + SUPABASE_SERVICE_KEY: bucket privado de Supabase Storage (producción en Vercel).
 *  - Sin ellas: carpeta local UPLOAD_DIR (desarrollo y Docker con volumen).
 */
const sb = () => {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // claves antiguas (JWT)
  return { url, headers, bucket: process.env.SUPABASE_BUCKET || "boletas" };
};

const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./uploads");

function checkNames(courseId: string, file: string) {
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || !/^[0-9a-f-]{36}\.[a-z]{3,4}$/i.test(file)) throw new Error("Archivo no válido");
}
const localPath = (courseId: string, file: string) => { checkNames(courseId, file); return path.join(/*turbopackIgnore: true*/ root(), courseId, file); };

export async function saveReceipt(courseId: string, file: File): Promise<{ name: string; buffer: Buffer; mime: string }> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Formato no permitido. Sube una foto (JPG, PNG, WEBP) o un PDF.");
  if (file.size > MAX_BYTES) throw new Error("El archivo supera los 4 MB. Si es una foto se reduce sola; si es un PDF, comprímelo.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}${ext}`;
  checkNames(courseId, name);

  const s = sb();
  if (s) {
    const r = await fetch(`${s.url}/storage/v1/object/${s.bucket}/${courseId}/${name}`, {
      method: "POST",
      headers: { ...s.headers, "Content-Type": file.type, "x-upsert": "false" },
      body: new Uint8Array(buffer),
    });
    if (!r.ok) {
      console.error("[storage] subida falló:", r.status, (await r.text()).slice(0, 200));
      throw new Error("No se pudo guardar la boleta. Inténtalo de nuevo.");
    }
  } else {
    const p = localPath(courseId, name);
    await mkdir(/*turbopackIgnore: true*/ path.dirname(p), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ p, buffer);
  }
  return { name, buffer, mime: file.type };
}

export async function readReceipt(courseId: string, name: string) {
  checkNames(courseId, name);
  const mime = MIME_BY_EXT[path.extname(name)] ?? "application/octet-stream";
  const s = sb();
  if (s) {
    const r = await fetch(`${s.url}/storage/v1/object/authenticated/${s.bucket}/${courseId}/${name}`, { headers: s.headers, cache: "no-store" });
    if (!r.ok) throw new Error("No encontrado");
    return { buf: Buffer.from(await r.arrayBuffer()), mime };
  }
  const buf = await readFile(/*turbopackIgnore: true*/ localPath(courseId, name));
  return { buf, mime };
}

export async function deleteReceipt(courseId: string, name: string | null) {
  if (!name) return;
  try {
    checkNames(courseId, name);
    const s = sb();
    if (s) {
      await fetch(`${s.url}/storage/v1/object/${s.bucket}/${courseId}/${name}`, { method: "DELETE", headers: s.headers });
    } else {
      await unlink(/*turbopackIgnore: true*/ localPath(courseId, name));
    }
  } catch { /* ya no existe */ }
}
