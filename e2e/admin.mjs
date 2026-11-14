// Pruebas del panel de administrador, opciones de pago y compresión de fotos.
//   BASE=http://localhost:3000 ADMIN_EMAIL=admin@prueba.cl node e2e/admin.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_EMAIL || "admin@prueba.cl";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = [];
const check = (n, ok, x = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  → " + x : ""}`); };
const stamp = Date.now();
const PASS = "clave-segura-123";
const COURSE = `Curso ${stamp}`;
const newPage = async () => (await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
const form = (p, btn) => p.locator("form", { has: p.getByRole("button", { name: btn, exact: true }) }).first();

try {
  /* ---- Tesorero con curso gratis pide plan por transferencia ---- */
  const t = await newPage();
  await t.goto(`${BASE}/register`);
  await t.fill("#name", "Tesorera Dos"); await t.fill("#email", `dos.${stamp}@prueba.cl`); await t.fill("#password", PASS);
  await t.getByRole("button", { name: "Crear cuenta" }).click(); await t.waitForURL(/\/app$/);
  await t.goto(`${BASE}/app/new`);
  await t.fill("#school", "Colegio Admin"); await t.fill("#name", COURSE); await t.fill("#monthlyFee", "4000");
  await t.getByRole("button", { name: "Crear curso" }).click(); await t.waitForURL(/\/app\/c\/[0-9a-f-]{36}$/);
  const courseId = t.url().split("/").pop();

  check("Un tesorero común no ve el botón de Administración", await t.getByRole("link", { name: /Administración/ }).count() === 0);
  await t.goto(`${BASE}/admin`);
  check("Un tesorero común no puede entrar a /admin", t.url().endsWith("/app"), t.url());

  await t.goto(`${BASE}/app/c/${courseId}/plan`);
  const ptxt = await t.locator("body").innerText();
  check("Plan: se ofrecen Mercado Pago y Transferencia", ptxt.includes("Pagar en línea (Mercado Pago)") && ptxt.includes("Transferencia bancaria"));
  check("Plan: se muestran los datos de transferencia del administrador", ptxt.includes("Cuenta Vista 123456789") && ptxt.includes("RUT 11.111.111-1"));
  const rf = form(t, "Ya transferí · Pro mensual $4.990");
  await rf.locator("[name=note]").fill("Operación 98765");
  await rf.getByRole("button", { name: /Ya transferí · Pro mensual/ }).click();
  await t.getByText("Solicitud pendiente:").first().waitFor();
  check("La solicitud por transferencia queda pendiente", true);
  check("Con una solicitud pendiente no se puede pedir otra", await t.getByRole("button", { name: /Ya transferí/ }).count() === 0);

  /* ---- Administrador ---- */
  const a = await newPage();
  await a.goto(`${BASE}/register`);
  await a.fill("#name", "Admin"); await a.fill("#email", ADMIN); await a.fill("#password", PASS);
  await a.getByRole("button", { name: "Crear cuenta" }).click();
  await a.waitForURL(/\/app$/, { timeout: 8000 }).catch(() => {});
  if (!a.url().endsWith("/app")) {
    await a.goto(`${BASE}/login`); await a.fill("#email", ADMIN); await a.fill("#password", PASS);
    await a.getByRole("button", { name: "Entrar" }).click(); await a.waitForURL(/\/app$/);
  }
  check("El administrador ve el botón de Administración", await a.getByRole("link", { name: /Administración/ }).count() === 1);
  await a.goto(`${BASE}/admin`);
  check("El administrador entra al panel", (await a.locator("body").innerText()).includes("Solicitudes por transferencia"));
  check("El panel muestra estadísticas", /usuarios/i.test(await a.locator("body").innerText()) && /ingresos totales/i.test(await a.locator("body").innerText()));
  await a.screenshot({ path: "/tmp/cajacurso-shots/admin.png", fullPage: true });

  const card = a.locator("li", { hasText: COURSE }).first();
  check("La solicitud aparece en el panel con la nota del tesorero", (await card.innerText()).includes("Operación 98765"));
  await card.getByRole("button", { name: "✓ Aprobar y activar" }).click();
  await a.locator("li", { hasText: COURSE }).first().waitFor({ state: "detached", timeout: 15000 });
  check("Al aprobar, la solicitud sale de la lista de pendientes", true);
  await t.goto(`${BASE}/app/c/${courseId}/plan`);
  check("Aprobar la solicitud activa el Plan Pro (lo ve el tesorero)", (await t.locator("body").innerText()).includes("Plan Pro activo"));

  /* ---- Activar / extender / quitar manualmente ---- */
  await a.goto(`${BASE}/admin/cursos?q=${encodeURIComponent(COURSE)}`);
  const c1 = a.locator("li", { hasText: COURSE }).first();
  check("El buscador encuentra el curso", await c1.count() === 1);
  check("Se ve que el curso tiene Pro", (await c1.innerText()).includes("Pro hasta"));
  await c1.locator("summary").click();
  await c1.getByRole("button", { name: "Quitar Pro ahora" }).evaluate((b) => { window.confirm = () => true; });
  a.once("dialog", (d) => d.accept());
  await c1.getByRole("button", { name: "Quitar Pro ahora" }).click();
  await a.waitForTimeout(1500);
  await a.reload();
  const c2 = a.locator("li", { hasText: COURSE }).first();
  check("El administrador puede quitar el Plan Pro", (await c2.innerText()).includes("Gratis"));

  await c2.locator("summary").click();
  const gf = c2.locator("form", { has: a.getByRole("button", { name: "Sumar días de Pro" }) });
  await gf.locator("[name=days]").selectOption("365");
  await gf.locator("[name=note]").fill("Cortesía prueba");
  await gf.getByRole("button", { name: "Sumar días de Pro" }).click();
  await a.getByText(/Plan Pro activo hasta/).first().waitFor();
  check("Activación manual sin pago (365 días)", true);
  await a.reload();
  const until = (await a.locator("li", { hasText: COURSE }).first().innerText()).match(/Pro hasta (\d+)-(\d+)-(\d+)|Pro hasta (\d+)\/(\d+)\/(\d+)/);
  const yearOk = (await a.locator("li", { hasText: COURSE }).first().innerText()).includes(String(new Date().getFullYear() + 1));
  check("La vigencia manual quedó ~1 año adelante", !!until && yearOk, until?.[0]);

  const c3 = a.locator("li", { hasText: COURSE }).first();
  await c3.locator("summary").click();
  const df = c3.locator("form", { has: a.getByRole("button", { name: "Fijar fecha exacta" }) });
  await df.locator("[name=date]").fill("2031-03-15");
  await df.getByRole("button", { name: "Fijar fecha exacta" }).click();
  await a.getByText(/Vigencia fijada al/).first().waitFor();
  await a.reload();
  check("Se puede fijar una fecha exacta de término", (await a.locator("li", { hasText: COURSE }).first().innerText()).includes("15-03-2031") || (await a.locator("li", { hasText: COURSE }).first().innerText()).includes("15/3/2031") || /15.{1,2}3.{1,2}2031/.test(await a.locator("li", { hasText: COURSE }).first().innerText()));

  await a.goto(`${BASE}/admin/historial`);
  const h = await a.locator("body").innerText();
  check("El historial registra transferencia y activaciones manuales", h.includes(COURSE) && /transferencia/i.test(h) && /manual/i.test(h) && h.includes("$4.990"));
  await a.screenshot({ path: "/tmp/cajacurso-shots/admin-historial.png", fullPage: true });

  /* ---- Compresión de foto de boleta ---- */
  await t.goto(`${BASE}/app/c/${courseId}/gastos`);
  const info = await t.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 2600; c.height = 2600;
    const x = c.getContext("2d"); const d = x.createImageData(2600, 2600);
    for (let i = 0; i < d.data.length; i += 4) { const v = (Math.random() * 255) | 0; d.data[i] = v; d.data[i + 1] = (v * 7) % 255; d.data[i + 2] = (v * 13) % 255; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const big = await new Promise((r) => c.toBlob(r, "image/jpeg", 1));
    const input = document.querySelector("input[name=receipt]");
    const dt = new DataTransfer(); dt.items.add(new File([big], "foto-grande.jpg", { type: "image/jpeg" }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 100 && !/Foto lista/.test(document.body.innerText); i++) await new Promise((r) => setTimeout(r, 100));
    const f = input.files[0];
    return { before: big.size, after: f.size, type: f.type, msg: /Foto lista/.test(document.body.innerText) };
  });
  check("Una foto pesada se reduce sola antes de subir", info.msg && info.after < info.before && info.after < 3.6 * 1024 * 1024 && info.type === "image/jpeg", `${(info.before / 1048576).toFixed(1)} MB → ${(info.after / 1048576).toFixed(2)} MB`);
  const gf2 = form(t, "Guardar gasto");
  await gf2.locator("[name=description]").fill("Boleta con foto grande");
  await gf2.locator("[name=amount]").fill("5000");
  await gf2.getByRole("button", { name: "Guardar gasto" }).click();
  await t.getByText("Gasto registrado").first().waitFor({ timeout: 20000 });
  check("El gasto con la foto reducida se guarda correctamente", true);
} catch (e) {
  check("Ejecución sin errores inesperados", false, String(e?.message || e).split("\n")[0]);
  console.error(e);
} finally { await browser.close(); }

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`);
if (failed.length) { console.log("Fallaron:\n- " + failed.map((f) => f.n).join("\n- ")); process.exit(1); }
