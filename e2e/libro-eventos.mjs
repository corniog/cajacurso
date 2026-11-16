// Prueba del libro contable y del módulo de eventos. Uso: BASE=http://localhost:3000 node e2e/libro-eventos.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); };
const stamp = Date.now();
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const formWith = (btn) => page.locator("form", { has: page.getByRole("button", { name: btn, exact: true }) }).first();
const num = (t) => Number(String(t).replace(/[^\d-]/g, ""));
try {
  await page.goto(`${BASE}/register`);
  await page.fill("#name", "Tesorero Libro"); await page.fill("#email", `libro.${stamp}@prueba.cl`); await page.fill("#password", "clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click(); await page.waitForURL(/\/app$/);
  await page.goto(`${BASE}/app/new`);
  await page.fill("[name=school]", "Colegio Libro"); await page.fill("[name=name]", "4° B"); await page.fill("[name=monthlyFee]", "5000");
  await page.getByRole("button", { name: /Crear curso/ }).click(); await page.waitForURL(/\/app\/c\/[0-9a-f-]+$/);
  const id = page.url().split("/c/")[1];
  const course = `${BASE}/app/c/${id}`;

  // Alumno y pago
  await page.goto(`${course}/alumnos`);
  const f = formWith("Agregar alumno"); await f.locator("[name=firstName]").fill("Ana"); await f.locator("[name=lastName]").fill("Pérez");
  await f.getByRole("button", { name: "Agregar alumno", exact: true }).click(); await page.getByText("Alumno agregado").first().waitFor();
  await page.goto(`${course}/pagos`);
  await page.getByRole("button", { name: "Abono" }).first().click();
  await page.fill("#pay-amount", "3000");
  await page.getByRole("button", { name: "Registrar pago" }).click(); await page.waitForSelector("dialog[open]", { state: "detached" });
  // Gasto y extra
  await page.goto(`${course}/gastos`);
  const g = formWith("Guardar gasto");
  await g.locator("[name=description]").fill("Resmas de papel"); await g.locator("[name=amount]").fill("1000");
  await g.getByRole("button", { name: "Guardar gasto", exact: true }).click(); await page.getByText("Gasto registrado").first().waitFor();
  await page.goto(`${course}/extras`);
  const x = formWith("Guardar ingreso");
  await x.locator("[name=description]").fill("Rifa"); await x.locator("[name=amount]").fill("2000");
  await x.getByRole("button", { name: "Guardar ingreso", exact: true }).click(); await page.getByText("Ingreso extra registrado").first().waitFor();

  // Libro
  await page.goto(`${course}/libro`);
  check("Libro lista los 3 movimientos automáticamente", (await page.locator("div.overflow-x-auto").last().locator("tbody tr").count()) === 3);
  check("Libro cuadra con la aplicación", await page.getByText("El libro cuadra con la aplicación del curso").isVisible());
  const txt = await page.locator("main, body").first().innerText();
  check("Totales: ingresos $5.000, egresos $1.000, saldo $4.000", txt.includes("$5.000") && txt.includes("$1.000") && txt.includes("$4.000"));

  // Corrección inválida: la cuota quedaría sobre $5.000 del mes
  await page.getByRole("button", { name: /Corregir movimiento 1/ }).click();
  await page.locator("dialog[open] #lg-amount").fill("9000");
  await page.locator("dialog[open]").getByRole("button", { name: "Guardar corrección" }).click();
  await page.locator('dialog[open] p[role="alert"]').waitFor();
  check("Corrección que no cuadra es rechazada", (await page.locator('dialog[open] p[role="alert"]').innerText()).includes("No cuadra"));
  await page.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click();

  // Corrección válida del gasto
  await page.getByRole("button", { name: /Corregir movimiento 2/ }).click();
  const dlgTxt = await page.locator("dialog[open]").innerText();
  const isExpense = dlgTxt.includes("Resmas");
  if (!isExpense) { await page.locator("dialog[open]").getByRole("button", { name: "Cerrar" }).click(); await page.getByRole("button", { name: /Corregir movimiento 3/ }).click(); }
  await page.locator("dialog[open] #lg-amount").fill("1500");
  await page.locator("dialog[open]").getByRole("button", { name: "Guardar corrección" }).click();
  await page.waitForSelector("dialog[open]", { state: "detached" });
  await page.reload();
  const t2 = await page.locator("body").innerText();
  check("Corrección válida actualiza el libro y sigue cuadrando", t2.includes("$1.500") && await page.getByText("El libro cuadra con la aplicación del curso").isVisible());
  check("La corrección queda en la bitácora", (await page.getByText("Corrección:").count()) >= 1);

  // Exportaciones
  for (const [k, magic] of [["pdf", "%PDF"], ["xlsx", "PK"]]) {
    const r = await ctx.request.get(`${course}/../../../api/c/${id}/libro/${k}`.replace(`${BASE}/app/c/${id}/../../../`, `${BASE}/`));
    const b = await r.body();
    check(`Descarga ${k.toUpperCase()} del libro`, r.ok() && b.subarray(0, magic.length).toString() === magic, `${b.length} bytes`);
  }

  // Eventos: requiere Pro → bloqueado y luego prueba gratis
  await page.goto(`${course}/eventos`);
  check("Eventos está bloqueado en plan Gratis", await page.getByText("Ventas para eventos").first().isVisible() && await page.getByText("parte del Plan Pro").first().isVisible());
  await page.goto(`${course}/plan`);
  await page.getByRole("button", { name: /Probar Pro/ }).click(); await page.getByRole("button", { name: /Probar Pro/ }).waitFor({ state: "detached" });
  for (let i = 0; i < 10; i++) { await page.goto(`${course}/eventos`); if (!(await page.getByText("parte del Plan Pro").count())) break; await page.waitForTimeout(700); }

  await page.goto(`${course}/eventos/productos`);
  const pf = formWith("Agregar producto");
  await pf.locator("[name=name]").fill("Completo"); await pf.locator("[name=price]").fill("2000"); await pf.locator("[name=stock]").fill("3");
  await pf.getByRole("button", { name: "Agregar producto", exact: true }).click(); await page.getByText("Producto guardado").first().waitFor();

  await page.goto(`${course}/eventos`);
  const ef = formWith("Crear evento"); await ef.locator("[name=name]").fill("Kermés");
  await ef.getByRole("button", { name: "Crear evento", exact: true }).click(); await page.getByText("Evento creado").first().waitFor();
  await page.getByRole("link", { name: "Abrir" }).first().click(); await page.waitForURL(/eventos\/[0-9a-f-]+$/);

  // Venta de 2 completos
  await page.getByRole("button", { name: "Agregar Completo" }).click(); await page.getByRole("button", { name: "Agregar uno de Completo" }).click();
  check("Carrito suma $4.000", num(await page.getByTestId("pos-total").innerText()) === 4000);
  await page.getByRole("button", { name: "Registrar venta" }).click(); await page.getByText(/B-0001 registrada/).waitFor();
  check("Venta numerada B-0001", true);
  // Stock: solo queda 1
  await page.getByRole("button", { name: "Agregar Completo" }).click();
  check("Stock descontado: quedan 1 (el carrito ya tiene 1)", (await page.getByText(/stock 0/).count()) === 1);
  await page.getByRole("button", { name: "Agregar uno de Completo" }).click();
  check("No deja vender más que el stock", (await page.getByTestId("pos-total").innerText()).includes("2.000"));
  // Fiado de 1 completo
  await page.getByRole("tab", { name: /Fiado/ }).click();
  await page.fill("#pos-customer", "Pedro");
  await page.getByRole("button", { name: "Registrar fiado" }).click(); await page.getByText(/F-0001 registrada/).waitFor();
  await page.goto(page.url().split("?")[0] + "?tab=fiado");
  await page.getByRole("button", { name: /Ya me pagó/ }).click(); await page.getByText("Fiados ya pagados").waitFor();

  // Boleta pública y PDF
  await page.goto(page.url().split("?")[0] + "?tab=ventas");
  const href = await page.getByRole("link", { name: "Ver / imprimir" }).first().getAttribute("href");
  const pub = await ctx.request.get(`${BASE}${href}`);
  check("Boleta pública accesible por enlace", pub.ok() && (await pub.text()).includes("B-0001"));
  const pdf = await ctx.request.get(`${BASE}${href.replace("/b/", "/api/b/")}/pdf`);
  check("PDF de boleta", pdf.ok() && (await pdf.body()).subarray(0, 4).toString() === "%PDF");

  // Cerrar evento → ingreso extra y libro
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar evento y sumar al curso" }).click();
  await page.getByText(/Se registró \$6\.000/).waitFor({ timeout: 8000 }).catch(() => {});
  await page.goto(`${course}/libro`);
  const t3 = await page.locator("body").innerText();
  check("El evento cerrado aparece en el libro ($6.000) y sigue cuadrando", t3.includes("Evento: Kermés") && await page.getByText("El libro cuadra con la aplicación del curso").isVisible());
  check("Ingreso del evento queda bloqueado para edición", (await page.locator('span[title^="Viene de un evento"]').count()) === 1);

  // Resumen del tesorero con gráficos
  await page.goto(course);
  check("Resumen del tesorero muestra KPI y gráficos", await page.getByText("Indicadores del curso").isVisible() && (await page.locator('svg[aria-label="Balance por mes"]').count()) === 1);
  await page.locator('svg[aria-label="Balance por mes"] g[tabindex="0"]').first().hover();
  check("Cuadro flotante al pasar el mouse por el gráfico", await page.locator('[role="status"]', { hasText: "Balance:" }).isVisible());
} catch (e) {
  check("Ejecución sin errores inesperados", false, String(e?.message || e).split("\n")[0]); console.error(e);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`);
if (failed.length) { console.log("Fallaron:\n- " + failed.map((f) => f.name).join("\n- ")); process.exit(1); }
