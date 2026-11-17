// Aportes y colectas. Uso: BASE=http://localhost:3000 node e2e/aportes.mjs
import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = []; const ck = (n, ok, e = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${e}`); };
const st = Date.now();
const tes = await (await b.newContext()).newPage();
const apo = await (await b.newContext()).newPage();
const formWith = (pg, btn) => pg.locator("form", { has: pg.getByRole("button", { name: btn, exact: true }) }).first();
try {
  await tes.goto(`${BASE}/register`); await tes.fill("#name", "Tes Aportes"); await tes.fill("#email", `ap.${st}@prueba.cl`); await tes.fill("#password", "clave-segura-123");
  await tes.getByRole("button", { name: "Crear cuenta" }).click(); await tes.waitForURL(/\/app$/);
  await tes.goto(`${BASE}/app/new`); await tes.fill("[name=school]", "Colegio Aportes"); await tes.fill("[name=name]", "5° A"); await tes.fill("[name=monthlyFee]", "5000");
  await tes.getByRole("button", { name: /Crear curso/ }).click(); await tes.waitForURL(/\/app\/c\/[0-9a-f-]+$/);
  const id = tes.url().split("/c/")[1]; const C = `${BASE}/app/c/${id}`;
  await tes.goto(`${C}/alumnos`);
  const f = formWith(tes, "Agregar alumno"); await f.locator("[name=firstName]").fill("Luz"); await f.locator("[name=lastName]").fill("Soto");
  await f.getByRole("button", { name: "Agregar alumno", exact: true }).click(); await tes.getByText("Alumno agregado").first().waitFor();
  await tes.goto(`${C}/aportes`);
  ck("Aportes bloqueado en plan Gratis", (await tes.getByText("parte del Plan Pro").count()) >= 1);
  await tes.goto(`${C}/plan`); await tes.getByRole("button", { name: /Probar Pro/ }).click(); await tes.getByRole("button", { name: /Probar Pro/ }).waitFor({ state: "detached" });
  for (let i = 0; i < 10; i++) { await tes.goto(`${C}/aportes`); if (!(await tes.getByText("parte del Plan Pro").count())) break; await tes.waitForTimeout(700); }
  const ti = formWith(tes, "Guardar"); await ti.locator("textarea").fill("Banco Estado\nCuenta Vista 999888777"); await ti.getByRole("button", { name: "Guardar", exact: true }).click(); await tes.getByText("Datos de transferencia guardados").waitFor();
  const cf = formWith(tes, "Crear colecta"); await cf.locator("[name=title]").fill("Regalo de la profesora"); await cf.locator("[name=amount]").fill("3000");
  await cf.getByRole("button", { name: "Crear colecta", exact: true }).click(); await tes.getByText(/Colecta creada/).waitFor();

  const token = execSync(`psql -h localhost -p 5433 -U postgres -d cajacurso -Atc "select s.token from students s join courses c on c.id=s.course_id where c.id='${id}'"`).toString().trim();
  await apo.goto(`${BASE}/f/${token}`);
  ck("La ficha muestra aviso de que no es la cuota mensual", await apo.getByText("no se descuenta de tus cuotas").isVisible());
  ck("Sin Mercado Pago solo ofrece transferencia", (await apo.getByText("Pagar en línea (Mercado Pago)").count()) === 0 && await apo.getByText("Cuenta Vista 999888777").isVisible());
  ck("Monto sugerido precargado", (await apo.locator("#ct-amt").inputValue()) === "3000");
  await apo.locator("#ct-note").fill("Op 12345");
  await apo.getByRole("button", { name: /Ya transferí/ }).click(); await apo.getByText(/Avisamos al tesorero/).waitFor();
  // Aporte libre ("Otro")
  await apo.locator("#ct-sel").selectOption("");
  await apo.locator("#ct-concept").fill("Rifa día del niño"); await apo.locator("#ct-amt").fill("2000");
  await apo.getByRole("button", { name: /Ya transferí/ }).click(); await apo.getByText(/Avisamos al tesorero/).waitFor();
  await apo.reload();
  ck("El apoderado ve sus aportes esperando confirmación", (await apo.getByText("Esperando confirmación").count()) === 2);

  await tes.goto(`${C}/aportes`);
  ck("El tesorero ve 2 aportes por confirmar", await tes.getByText("Por confirmar (2)").isVisible());
  tes.on("dialog", (d) => d.accept());
  await tes.getByRole("button", { name: /Confirmar/ }).first().click(); await tes.getByText("Por confirmar (1)").waitFor();
  await tes.getByRole("button", { name: "Rechazar" }).first().click(); await tes.getByText("Por confirmar (0)").waitFor();

  await tes.goto(`${C}/libro`);
  const t = await tes.locator("body").innerText();
  ck("El aporte confirmado entra al libro como ingreso y cuadra", t.includes("Aporte:") && await tes.getByText("El libro cuadra con la aplicación del curso").isVisible());
  ck("Ese ingreso queda bloqueado para edición", (await tes.locator('span[title^="Viene de un aporte"]').count()) === 1);
  await apo.reload();
  ck("La ficha muestra Confirmado y No confirmado", (await apo.getByText("Confirmado", { exact: true }).count()) === 1 && (await apo.getByText("No confirmado").count()) === 1);
  await tes.goto(`${C}/extras`);
  ck("El aporte aparece en Ingresos extra", await tes.getByText(/Aporte:/).first().isVisible());
} catch (e) { ck("Ejecución sin errores", false, String(e.message).split("\n")[0]); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
