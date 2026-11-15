// Prueba de extremo a extremo con un navegador real (Chrome). Uso:
//   BASE=http://localhost:3000 node e2e/flow.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const SHOTS = process.env.SHOTS || "/tmp/cajacurso-shots";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`); };
const stamp = Date.now();
const PASSWORD = "clave-segura-123";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const newCtx = () => browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
async function register(page, label) {
  await page.goto(`${BASE}/register`);
  await page.fill("#name", `Tesorero ${label}`);
  await page.fill("#email", `${label}.${stamp}@prueba.cl`);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(/\/app$/);
  return `${label}.${stamp}@prueba.cl`;
}
const formWith = (page, btn) => page.locator("form", { has: page.getByRole("button", { name: btn, exact: true }) }).first();
async function addStudent(page, s) {
  const f = formWith(page, "Agregar alumno");
  await f.locator("[name=firstName]").fill(s.first);
  await f.locator("[name=lastName]").fill(s.last);
  if (s.guardian) await f.locator("[name=guardianName]").fill(s.guardian);
  if (s.phone) await f.locator("[name=guardianPhone]").fill(s.phone);
  if (s.email) await f.locator("[name=guardianEmail]").fill(s.email);
  await f.getByRole("button", { name: "Agregar alumno", exact: true }).click();
  await page.getByText("Alumno agregado").first().waitFor();
}
const cell = (page, name, month) => page.locator(`[aria-label^="${name}, ${month}:"]`);
const dialogClosed = (page) => page.waitForSelector("dialog[open]", { state: "detached" });

try {
  /* ---------- Tesorero principal ---------- */
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const ownerEmail = await register(page, "owner");
  check("Registro de tesorero y acceso al panel", page.url().endsWith("/app"));

  await page.goto(`${BASE}/app/new`);
  await page.fill("#school", "Colegio Prueba");
  await page.fill("#name", "3° Básico A");
  await page.fill("#monthlyFee", "5000");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await page.waitForURL(/\/app\/c\/[0-9a-f-]{36}$/);
  const courseId = page.url().split("/").pop();
  check("Creación de curso", /^[0-9a-f-]{36}$/.test(courseId));
  const courseCode = (await page.locator("code").first().innerText()).trim();
  check("Código del curso generado", /^[A-Z0-9]+-[A-Z0-9]{6}$/.test(courseCode), courseCode);

  await page.goto(`${BASE}/app/c/${courseId}/alumnos`);
  await addStudent(page, { first: "Ana", last: "Pérez", guardian: "Rosa Pérez", phone: "912345678", email: "rosa@prueba.cl" });
  await addStudent(page, { first: "Luis", last: "Soto" });
  await addStudent(page, { first: "María", last: "Díaz" });
  await page.reload();
  const body = await page.locator("body").innerText();
  check("Alumnos agregados y listados", ["Pérez, Ana", "Soto, Luis", "Díaz, María"].every((n) => body.includes(n)));
  const codes = body.match(/[A-Z2-9]{5}-[A-Z2-9]{5}/g) || [];
  check("Cada alumno tiene código corto", new Set(codes).size >= 3, codes.slice(0, 3).join(" "));
  const anaCode = (await page.locator("li", { hasText: "Pérez, Ana" }).first().innerText()).match(/[A-Z2-9]{5}-[A-Z2-9]{5}/)?.[0];

  // RUT inválido debe rechazarse
  {
    const f = formWith(page, "Agregar alumno");
    await f.locator("[name=firstName]").fill("Pedro");
    await f.locator("[name=lastName]").fill("Rut");
    await f.locator("[name=rut]").fill("12.345.678-0");
    await f.getByRole("button", { name: "Agregar alumno", exact: true }).click();
    await page.getByText(/RUT no es válido/).first().waitFor();
    check("RUT con dígito verificador incorrecto se rechaza", true);
    await page.reload();
  }

  /* ---------- Pagos ---------- */
  await page.goto(`${BASE}/app/c/${courseId}/pagos`);
  await cell(page, "Pérez, Ana", "Marzo").click();
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await dialogClosed(page);
  check("Pago completo marca el mes como pagado", await cell(page, "Pérez, Ana", "Marzo").getAttribute("aria-label").then((a) => a.includes("Pagado")));

  await cell(page, "Pérez, Ana", "Abril").click();
  await page.fill("#pay-amount", "7000");
  const prev = await page.locator("dialog [aria-live=polite]").innerText();
  check("Vista previa: el pago se reparte solo entre los meses siguientes", /Abril.*pagado/s.test(prev) && /Mayo.*abono/s.test(prev), prev.replace(/\s+/g, " "));
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await dialogClosed(page);
  const abr = await cell(page, "Pérez, Ana", "Abril").getAttribute("aria-label");
  const may = await cell(page, "Pérez, Ana", "Mayo").getAttribute("aria-label");
  check("Un comprobante cubre varios meses (abril pagado, mayo abonado)", abr.includes("Pagado") && may.includes("Abonado"), `${abr} | ${may}`);

  await cell(page, "Soto, Luis", "Marzo").click();
  await page.fill("#pay-amount", "2000");
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await dialogClosed(page);
  check("Abono parcial queda como abonado", (await cell(page, "Soto, Luis", "Marzo").getAttribute("aria-label")).includes("Abonado"));
  await page.screenshot({ path: `${SHOTS}/pagos.png` });

  // Eliminar un pago
  await cell(page, "Soto, Luis", "Marzo").click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Quitar" }).click();
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog[open]", { state: "detached" }).catch(() => {});
  check("Se puede eliminar un pago", (await cell(page, "Soto, Luis", "Marzo").getAttribute("aria-label")).includes("Pendiente"));
  // dejarlo abonado otra vez para los totales
  await cell(page, "Soto, Luis", "Marzo").click();
  await page.fill("#pay-amount", "2000");
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await dialogClosed(page);

  /* ---------- Gastos con boleta ---------- */
  await page.goto(`${BASE}/app/c/${courseId}/gastos`);
  const gf = formWith(page, "Guardar gasto");
  await gf.locator("[name=description]").fill("Útiles de arte");
  await gf.locator("[name=amount]").fill("12000");
  await gf.locator("[name=receipt]").setInputFiles({ name: "boleta.png", mimeType: "image/png", buffer: png });
  await gf.getByRole("button", { name: "Guardar gasto" }).click();
  await page.getByText("Gasto registrado").first().waitFor();
  await page.reload();
  const href = await page.getByRole("link", { name: /Ver/ }).first().getAttribute("href");
  const rr = await page.request.get(`${BASE}${href}`);
  check("Boleta subida y visible para el tesorero", rr.status() === 200 && (rr.headers()["content-type"] || "").includes("image/png"));
  const anon = await (await newCtx()).request.get(`${BASE}${href}`, { maxRedirects: 0 });
  check("Boleta privada: sin sesión no se puede ver", anon.status() !== 200, `status ${anon.status()}`);

  // archivo no permitido
  await gf.locator("[name=description]").fill("Archivo malo");
  await gf.locator("[name=amount]").fill("100");
  await gf.locator("[name=receipt]").setInputFiles({ name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await gf.getByRole("button", { name: "Guardar gasto" }).click();
  await page.getByText(/Formato no permitido/).first().waitFor();
  check("Archivo con formato no permitido se rechaza", true);

  /* ---------- Ingresos extra y límite del plan gratis ---------- */
  await page.goto(`${BASE}/app/c/${courseId}/extras`);
  for (let i = 1; i <= 10; i++) {
    const ef = formWith(page, "Guardar ingreso");
    await ef.locator("[name=description]").fill(`Rifa ${i}`);
    await ef.locator("[name=amount]").fill("1000");
    await ef.getByRole("button", { name: "Guardar ingreso" }).click();
    await page.getByText(`${i} de 10 en plan Gratis`).waitFor({ timeout: 8000 }).catch(() => {});
    await page.getByText("Ingreso extra registrado").first().waitFor().catch(() => {});
    if (i < 10) await page.reload();
  }
  await page.reload();
  check("Plan Gratis: tras 10 extras se bloquea el formulario", await page.getByText(/Llegaste al límite de 10/).count() > 0);

  /* ---------- Resumen y totales ---------- */
  await page.goto(`${BASE}/app/c/${courseId}`);
  const resumen = await page.locator("body").innerText();
  // cuotas 5000+5000+2000 (Ana) + 2000 (Luis) = 14000; extras 10000; gasto 12000 => balance 12000
  check("Balance correcto (cuotas 14.000 + extras 10.000 − gastos 12.000)", /balance\s*\n?\s*\$12\.000/i.test(resumen), resumen.match(/balance[\s\S]{0,20}/i)?.[0]?.replace(/\n/g, " "));
  check("Recaudado correcto en cuotas", /\$14\.000/.test(resumen));
  await page.screenshot({ path: `${SHOTS}/resumen.png`, fullPage: true });

  // Exportación Excel (gratis) y PDF bloqueado en plan gratis
  const x = await page.request.get(`${BASE}/api/c/${courseId}/export/xlsx`);
  const xb = await x.body();
  check("Excel se descarga en plan Gratis", x.status() === 200 && xb.slice(0, 2).toString() === "PK" && xb.length > 3000, `${xb.length} bytes`);
  const pdf403 = await page.request.get(`${BASE}/api/c/${courseId}/export/pdf`);
  check("PDF del curso bloqueado en plan Gratis (403)", pdf403.status() === 403);

  /* ---------- Accesos: directivos ---------- */
  await page.goto(`${BASE}/app/c/${courseId}/accesos`);
  await page.getByRole("button", { name: "Activar acceso para directivos" }).click();
  await page.getByText(/DIR-[A-Z2-9]{12}/).first().waitFor();
  const dirCode = (await page.locator("code", { hasText: "DIR-" }).first().innerText()).trim();
  check("Código de directivos generado", /^DIR-[A-Z2-9]{12}$/.test(dirCode), dirCode);
  await page.screenshot({ path: `${SHOTS}/accesos.png`, fullPage: true });

  const dctx = await newCtx();
  const dp = await dctx.newPage();
  await dp.goto(`${BASE}/d/${dirCode}`);
  const dtxt = await dp.locator("body").innerText();
  check("Directivos ven todos los alumnos, montos y gastos sin iniciar sesión",
    dtxt.includes("solo lectura") && dtxt.includes("Pérez, Ana") && dtxt.includes("Útiles de arte") && dtxt.includes("$12.000"));
  check("Directivos: no hay botones de edición", await dp.getByRole("button", { name: /Registrar pago|Guardar|Eliminar/ }).count() === 0);
  await dp.locator('[aria-label^="Pérez, Ana, Marzo:"]').click();
  check("Directivos: la ventana de un pago es de solo lectura", await dp.getByText("Tu rol es de solo lectura").isVisible());
  await dp.keyboard.press("Escape");
  const [dl] = await Promise.all([dp.waitForEvent("download"), dp.getByRole("link", { name: /Excel/ }).click()]);
  check("Directivos descargan Excel", (fs.statSync(await dl.path()).size) > 3000);
  check("Directivos: PDF oculto en plan Gratis", await dp.getByRole("link", { name: /PDF/ }).count() === 0);
  const dRecibo = await dp.request.get(`${BASE}${href.replace(`/api/c/${courseId}/receipt`, `/api/d/${dirCode}/receipt`)}`);
  check("Directivos ven las boletas", dRecibo.status() === 200);
  await dp.screenshot({ path: `${SHOTS}/directivos.png`, fullPage: true });
  const bad = await dp.goto(`${BASE}/d/DIR-AAAAAAAAAAAA`);
  check("Código de directivos inválido da 404", bad.status() === 404);
  // el directivo no puede entrar al panel del tesorero
  const dPanel = await dp.goto(`${BASE}/app/c/${courseId}`);
  check("Directivos no acceden al panel de edición (redirige a login)", dp.url().includes("/login"));

  /* ---------- Apoderados: código corto, QR, curso ---------- */
  const pctx = await newCtx();
  const pp = await pctx.newPage();
  await pp.goto(BASE);
  await pp.locator("#code").fill(anaCode.toLowerCase());
  await pp.getByRole("button", { name: "Entrar" }).click();
  await pp.waitForURL(/\/f\//);
  const ptxt = await pp.locator("body").innerText();
  check("Apoderado entra con el código corto y ve solo a su hijo(a)", ptxt.includes("Ana Pérez") && !ptxt.includes("Luis") && !ptxt.includes("Díaz"));
  check("Ficha muestra pagado y deuda", /Pagado/.test(ptxt) && /Debe/.test(ptxt));
  const fpdf = await pp.request.get(`${BASE}/api/f/${anaCode}/pdf`);
  const fb = await fpdf.body();
  check("Apoderado descarga su estado de cuenta en PDF", fpdf.status() === 200 && fb.slice(0, 4).toString() === "%PDF", `${fb.length} bytes`);
  await pp.screenshot({ path: `${SHOTS}/ficha.png`, fullPage: true });

  await pp.goto(BASE);
  await pp.locator("#code").fill(courseCode);
  await pp.getByRole("button", { name: "Entrar" }).click();
  await pp.waitForURL(/\/c\//);
  const ctxt = await pp.locator("body").innerText();
  check("Código del curso: nombres abreviados y sin montos individuales", ctxt.includes("Ana P.") && !ctxt.includes("Pérez") && ctxt.includes("Útiles de arte"));
  const badFicha = await pp.goto(`${BASE}/f/ZZZZZ-ZZZZZ`);
  check("Código de alumno inexistente da 404", badFicha.status() === 404);

  // Hoja de QR del tesorero
  await page.goto(`${BASE}/app/c/${courseId}/accesos/qr`);
  check("Hoja de QR con una tarjeta por alumno", await page.locator("img[alt^='QR de']").count() >= 3);
  await page.screenshot({ path: `${SHOTS}/qr.png`, fullPage: true });

  /* ---------- Plan Pro ---------- */
  await page.goto(`${BASE}/app/c/${courseId}/plan`);
  await page.getByRole("button", { name: /Probar Pro 30 días/ }).click();
  await page.getByText(/Vigente hasta/).first().waitFor();
  const pdfOk = await page.request.get(`${BASE}/api/c/${courseId}/export/pdf`);
  const pb = await pdfOk.body();
  check("Prueba Pro activada y PDF del curso disponible", pdfOk.status() === 200 && pb.slice(0, 4).toString() === "%PDF", `${pb.length} bytes`);
  await page.goto(`${BASE}/app/c/${courseId}/plan`);
  check("La prueba gratuita no se ofrece de nuevo", await page.getByRole("button", { name: /Probar Pro 30 días/ }).count() === 0);
  await dp.goto(`${BASE}/d/${dirCode}`);
  const [dl2] = await Promise.all([dp.waitForEvent("download"), dp.getByRole("link", { name: /PDF/ }).click()]);
  check("Con Pro, directivos también descargan PDF", fs.statSync(await dl2.path()).size > 1000);

  // Extras ilimitados con Pro
  await page.goto(`${BASE}/app/c/${courseId}/extras`);
  check("Con Pro se vuelve a permitir agregar ingresos extra", await formWith(page, "Guardar ingreso").count() > 0);

  // Enviar PDF por correo: sin SMTP debe avisar con claridad
  await page.goto(`${BASE}/app/c/${courseId}/alumnos`);
  await page.getByRole("button", { name: /Enviar PDF/ }).first().click();
  await page.getByText(/no está configurado/).first().waitFor();
  check("Envío de PDF por correo avisa si falta configurar SMTP", true);
  await page.screenshot({ path: `${SHOTS}/alumnos.png`, fullPage: true });

  /* ---------- Co-tesorero ---------- */
  const c2 = await newCtx();
  const p2 = await c2.newPage();
  const coEmail = await register(p2, "co");
  const c3 = await newCtx();
  const p3 = await c3.newPage();
  const thirdEmail = await register(p3, "tercero");

  await page.goto(`${BASE}/app/c/${courseId}/plan`);
  const af = formWith(page, "Agregar co-tesorero");
  await af.locator("[name=email]").fill(coEmail);
  await af.getByRole("button", { name: "Agregar co-tesorero" }).click();
  await page.getByText(coEmail).first().waitFor();
  check("Se agrega un co-tesorero", true);

  await p2.goto(`${BASE}/app/c/${courseId}/pagos`);
  check("Co-tesorero accede al curso y ve la grilla de pagos", await p2.locator('[aria-label^="Pérez, Ana, Marzo:"]').count() === 1);
  await p2.locator('[aria-label^="Díaz, María, Marzo:"]').click();
  await p2.getByRole("button", { name: "Registrar pago" }).click();
  await dialogClosed(p2);
  check("Co-tesorero puede registrar pagos", (await p2.locator('[aria-label^="Díaz, María, Marzo:"]').getAttribute("aria-label")).includes("Pagado"));
  await p2.goto(`${BASE}/app/c/${courseId}/config`);
  check("Co-tesorero no puede cambiar la configuración del curso", await p2.getByText(/Solo quien creó el curso/).count() > 0);
  await p2.goto(`${BASE}/app/c/${courseId}/plan`);
  check("Co-tesorero no puede cambiar el plan", await p2.getByRole("button", { name: /Pro mensual|Pro anual/ }).count() === 0);

  // Segundo co-tesorero: debe rechazarse (máximo 1)
  await page.goto(`${BASE}/app/c/${courseId}/plan`);
  check("Con un co-tesorero ya no se ofrece agregar otro", await page.getByRole("button", { name: "Agregar co-tesorero" }).count() === 0);

  // Un usuario ajeno no entra al curso
  await p3.goto(`${BASE}/app/c/${courseId}`);
  check("Un tercero sin permiso no ve el curso", p3.url().endsWith("/app"));

  /* ---------- Seguridad de acceso ---------- */
  const lctx = await newCtx();
  const lp = await lctx.newPage();
  let blocked = false;
  for (let i = 0; i < 7; i++) {
    await lp.goto(`${BASE}/login`);
    await lp.fill("#email", ownerEmail);
    await lp.fill("#password", "incorrecta-" + i);
    await lp.getByRole("button", { name: "Entrar" }).click();
    await lp.waitForSelector('form p[role="alert"]');
    if ((await lp.locator('form p[role="alert"]').innerText()).includes("Demasiados intentos")) { blocked = true; break; }
  }
  check("Login se bloquea tras varios intentos fallidos", blocked);
  await lp.goto(`${BASE}/login`);
  await lp.fill("#email", ownerEmail);
  await lp.fill("#password", PASSWORD);
  await lp.getByRole("button", { name: "Entrar" }).click();
  await lp.waitForSelector('form p[role="alert"]');
  check("Aun con la clave correcta, el bloqueo temporal se mantiene", (await lp.locator('form p[role="alert"]').innerText()).includes("Demasiados intentos"));

  // Cerrar sesión
  await page.goto(`${BASE}/app`);
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/app`);
  check("Al salir, el panel exige iniciar sesión", page.url().includes("/login"));

  // Capturas de landing
  const lc = await newCtx();
  const l = await lc.newPage();
  await l.goto(BASE);
  await l.screenshot({ path: `${SHOTS}/landing.png`, fullPage: true });
} catch (e) {
  check("Ejecución sin errores inesperados", false, String(e?.message || e).split("\n")[0]);
  console.error(e);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`);
if (failed.length) { console.log("Fallaron:\n- " + failed.map((f) => f.name).join("\n- ")); process.exit(1); }
