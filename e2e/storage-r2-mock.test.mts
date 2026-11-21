// Prueba del almacenamiento con Cloudflare R2 (servidor que imita la API S3) y de la lectura de respaldo en Supabase.
import http from "node:http";
import assert from "node:assert/strict";

const r2: Map<string, { type: string; body: Buffer; auth: string }> = new Map();
const sb: Map<string, Buffer> = new Map();
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const u = req.url!;
    if (u.startsWith("/storage/v1/object/authenticated/boletas/")) { // Supabase (solo lectura de respaldo)
      const f = sb.get(u.replace("/storage/v1/object/authenticated/boletas/", ""));
      if (!f) { res.writeHead(404).end("nf"); return; }
      res.writeHead(200).end(f); return;
    }
    if (u.startsWith("/storage/v1/object/boletas/")) { sb.delete(u.replace("/storage/v1/object/boletas/", "")); res.writeHead(200).end("{}"); return; }
    if (u.startsWith("/bucket-test/")) { // R2 (S3, ruta tipo path)
      const key = u.replace("/bucket-test/", "");
      const auth = String(req.headers.authorization ?? "");
      if (!auth.startsWith("AWS4-HMAC-SHA256")) { res.writeHead(403).end("sin firma"); return; }
      if (req.method === "PUT") { r2.set(key, { type: String(req.headers["content-type"]), body: Buffer.concat(chunks), auth }); res.writeHead(200).end(); return; }
      if (req.method === "GET") { const f = r2.get(key); if (!f) { res.writeHead(404).end("nf"); return; } res.writeHead(200, { "content-type": f.type }).end(f.body); return; }
      if (req.method === "DELETE") { r2.delete(key); res.writeHead(204).end(); return; }
    }
    res.writeHead(404).end("?");
  });
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
process.env.R2_ACCOUNT_ID = "acc"; process.env.R2_ACCESS_KEY_ID = "AKIATEST"; process.env.R2_SECRET_ACCESS_KEY = "secret"; process.env.R2_BUCKET = "bucket-test";
process.env.R2_ENDPOINT = `http://127.0.0.1:${port}`;
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`; process.env.SUPABASE_SERVICE_KEY = "sb_secret_test";

const { saveReceipt, readReceipt, deleteReceipt } = await import("../lib/storage");
const courseId = crypto.randomUUID();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const saved = await saveReceipt(courseId, new File([png], "b.png", { type: "image/png" }));
assert.equal(r2.size, 1, "la boleta nueva se guardó en R2");
assert.ok([...r2.values()][0].auth.includes("AKIATEST"), "la petición va firmada");
const got = await readReceipt(courseId, saved.name);
assert.deepEqual(got.buf, png, "se lee desde R2");
// boleta antigua que solo existe en Supabase: sigue funcionando
const oldName = `${crypto.randomUUID()}.png`; sb.set(`${courseId}/${oldName}`, png);
assert.deepEqual((await readReceipt(courseId, oldName)).buf, png, "respaldo en Supabase para boletas antiguas");
await assert.rejects(() => readReceipt(courseId, `${crypto.randomUUID()}.png`), /No encontrado/);
await assert.rejects(() => saveReceipt(courseId, new File([Buffer.from("MZ")], "x.exe", { type: "application/x-msdownload" })), /Formato no permitido/);
await deleteReceipt(courseId, saved.name); await deleteReceipt(courseId, oldName);
assert.equal(r2.size, 0, "se borró de R2"); assert.equal(sb.size, 0, "y de Supabase");
console.log("PASS almacenamiento Cloudflare R2 (simulado) + respaldo Supabase");
server.close();
