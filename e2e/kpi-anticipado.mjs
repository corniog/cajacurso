// KPI de un curso cuyo año aún no comienza (ej. curso 2027 visto en 2026): pagos por adelantado.
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000", PASS = "clave-segura-123";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = []; const ck = (n, ok) => { res.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); };
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const fw = (btn) => p.locator("form", { has: p.getByRole("button", { name: btn, exact: true }) }).first();
try {
  const nextYear = new Date().getFullYear() + 1;
  await p.goto(`${BASE}/register`); await p.fill("#name", "T KPI"); await p.fill("#email", `k.${Date.now()}@prueba.cl`); await p.fill("#password", PASS); await p.getByRole("button", { name: "Crear cuenta" }).click(); await p.waitForURL(/\/app$/);
  await p.goto(`${BASE}/app/new`); await p.fill("[name=school]", "Colegio KPI"); await p.fill("[name=name]", "1° A"); await p.fill("[name=year]", String(nextYear)); await p.fill("[name=monthlyFee]", "5000");
  await p.getByRole("button", { name: /Crear curso/ }).click(); await p.waitForURL(/\/app\/c\/[0-9a-f-]+$/); const C = p.url();
  await p.goto(`${C}/alumnos`); const f = fw("Agregar alumno"); await f.locator("[name=firstName]").fill("Ana"); await f.locator("[name=lastName]").fill("Pérez"); await f.getByRole("button", { name: "Agregar alumno", exact: true }).click(); await p.getByText("Alumno agregado").first().waitFor();
  await p.goto(`${C}/pagos`); await p.locator('[aria-label^="Pérez, Ana, Marzo:"]').click(); await p.getByRole("button", { name: "Registrar pago" }).click(); await p.waitForSelector("dialog[open]", { state: "detached" });
  await p.goto(C); const t = await p.locator("body").innerText();
  ck("Explica que el cobro parte en Marzo", t.includes(`Parte en Marzo ${nextYear}`));
  ck("Muestra lo pagado por adelantado ($5.000)", t.includes("Pagado por adelantado") && t.includes("$5.000"));
  ck("Ya no muestra '$0 de $0' ni '100% pendiente a la fecha'", !t.includes("$0 de $0") && !t.includes("pendiente a la fecha"));
  ck("El año completo sí refleja el pago (1 de 10 meses)", /\$5\.000 de \$[\d.]+ que se cobrarán en todo el año/.test(t));
} catch (e) { ck("Ejecución sin errores: " + String(e.message).split("\n")[0], false); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
