// Prueba del almacenamiento contra un servidor que imita la API de Supabase Storage.
import http from "node:http";
import assert from "node:assert/strict";

const store = new Map<string, { type: string; body: Buffer }>();
const seen: string[] = [];
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    seen.push(`${req.method} ${req.url} apikey=${req.headers.apikey ?? "-"} auth=${req.headers.authorization ?? "-"}`);
    if (req.headers.apikey !== "sb_secret_test") { res.writeHead(401).end("no"); return; }
    const u = req.url!;
    if (req.method === "POST" && u.startsWith("/storage/v1/object/boletas/")) {
      const key = u.replace("/storage/v1/object/boletas/", "");
      if (store.has(key)) { res.writeHead(409).end("dup"); return; }
      store.set(key, { type: String(req.headers["content-type"]), body: Buffer.concat(chunks) });
      res.writeHead(200, { "content-type": "application/json" }).end('{"Key":"ok"}'); return;
    }
    if (req.method === "GET" && u.startsWith("/storage/v1/object/authenticated/boletas/")) {
      const f = store.get(u.replace("/storage/v1/object/authenticated/boletas/", ""));
      if (!f) { res.writeHead(404).end("nf"); return; }
      res.writeHead(200, { "content-type": f.type }).end(f.body); return;
    }
    if (req.method === "DELETE" && u.startsWith("/storage/v1/object/boletas/")) {
      store.delete(u.replace("/storage/v1/object/boletas/", "")); res.writeHead(200).end("{}"); return;
    }
    res.writeHead(404).end("?");
  });
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_KEY = "sb_secret_test";

const { saveReceipt, readReceipt, deleteReceipt } = await import("../lib/storage");
const courseId = crypto.randomUUID();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const saved = await saveReceipt(courseId, new File([png], "b.png", { type: "image/png" }));
assert.match(saved.name, /^[0-9a-f-]{36}\.png$/);
assert.equal(store.size, 1, "se subió un objeto");
const got = await readReceipt(courseId, saved.name);
assert.equal(got.mime, "image/png");
assert.deepEqual(got.buf, png, "contenido idéntico");
await assert.rejects(() => saveReceipt(courseId, new File([Buffer.from("MZ")], "x.exe", { type: "application/x-msdownload" })), /Formato no permitido/);
await assert.rejects(() => saveReceipt(courseId, new File([Buffer.alloc(5 * 1024 * 1024)], "big.png", { type: "image/png" })), /4 MB/);
await assert.rejects(() => readReceipt(courseId, "../../etc/passwd"), /no válido/);
await deleteReceipt(courseId, saved.name);
assert.equal(store.size, 0, "se borró");
await assert.rejects(() => readReceipt(courseId, saved.name));
console.log("PASS almacenamiento Supabase (simulado)");
console.log(seen.slice(0, 2).join("\n"));
server.close();
