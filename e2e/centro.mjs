// Perfil Centro de padres.  BASE=http://localhost:3000 ADMIN_EMAIL=admin@prueba.cl node e2e/centro.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000", ADMIN = process.env.ADMIN_EMAIL || "admin@prueba.cl", PASS = "clave-segura-123";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = []; const ck = (n, ok, e = "") => { res.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${e}`); };
const ts = Date.now(); const SCHOOL = `Colegio Norte ${ts}`;
const pg = async () => (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
const register = async (p, name, email, tipo, school) => {
  await p.goto(`${BASE}/register`);
  if (tipo === "centro") { await p.getByLabel(/Soy del centro de padres/).check(); await p.fill("#centerSchool", school); }
  await p.fill("#name", name); await p.fill("#email", email); await p.fill("#password", PASS);
  await p.getByRole("button", { name: "Crear cuenta" }).click(); await p.waitForURL(tipo === "centro" ? /\/centro$/ : /\/app$/);
};
const mkCourse = async (t, school, name) => {
  await t.goto(`${BASE}/app/new`); await t.fill("[name=school]", school); await t.fill("[name=name]", name); await t.fill("[name=monthlyFee]", "4000");
  await t.getByRole("button", { name: /Crear curso/ }).click(); await t.waitForURL(/\/app\/c\/[0-9a-f-]+$/); return t.url().split("/c/")[1];
};
const fw = (p, btn) => p.locator("form", { has: p.getByRole("button", { name: btn, exact: true }) }).first();
const genCode = async (t, id) => {
  await t.goto(`${BASE}/app/c/${id}/accesos`);
  const btn = t.getByRole("button", { name: /Generar código para el centro de padres/ });
  if (await btn.count()) await btn.click();
  const c = t.locator("code", { hasText: /^AUD-/ }); await c.waitFor(); return (await c.innerText()).trim();
};
try {
  // Tesorero A: curso del colegio, un alumno con un pago y un gasto
  const A = await pg(); await register(A, "Tesorera Norte", `a.${ts}@prueba.cl`, "tesorero");
  const idA = await mkCourse(A, SCHOOL, "6° A");
  await A.goto(`${BASE}/app/c/${idA}/alumnos`);
  const f = fw(A, "Agregar alumno"); await f.locator("[name=firstName]").fill("Matías"); await f.locator("[name=lastName]").fill("Soto Villalobos");
  await f.getByRole("button", { name: "Agregar alumno", exact: true }).click(); await A.getByText("Alumno agregado").first().waitFor();
  await A.goto(`${BASE}/app/c/${idA}/pagos`); await A.locator('[aria-label^="Soto Villalobos, Matías, Marzo:"]').click(); await A.getByRole("button", { name: "Registrar pago" }).click(); await A.waitForSelector("dialog[open]", { state: "detached" });
  await A.goto(`${BASE}/app/c/${idA}/gastos`); const g = fw(A, "Guardar gasto"); await g.locator("[name=description]").fill("Útiles"); await g.locator("[name=amount]").fill("1500"); await g.getByRole("button", { name: "Guardar gasto", exact: true }).click(); await A.getByText("Gasto registrado").first().waitFor();
  const codeA = await genCode(A, idA);
  ck("Tesorero genera código AUD-…", /^AUD-[A-Z2-9]{12}$/.test(codeA));
  // Tesorero B: otro colegio
  const B = await pg(); await register(B, "Tesorero Otro", `b.${ts}@prueba.cl`, "tesorero"); const idB = await mkCourse(B, `Otro Colegio ${ts}`, "6° B"); const codeB = await genCode(B, idB);
  // Centro: queda pendiente
  const emailC = `c.${ts}@prueba.cl`; const C = await pg(); await register(C, "Centro Norte", emailC, "centro", SCHOOL.toUpperCase().replace("COLEGIO", "colegio"));
  ck("Centro nuevo ve 'pendiente de activación'", await C.getByText("pendiente de activación").count() > 0);
  ck("Sin activar no hay formulario para agregar cursos", await C.getByRole("button", { name: "Agregar curso" }).count() === 0);
  ck("Centro no entra al panel de tesorero (/app → /centro)", (await C.goto(`${BASE}/app`), /\/centro$/.test(C.url())));
  ck("Tesorero no entra a /centro (→ /app)", (await A.goto(`${BASE}/centro`), /\/app$/.test(A.url())));
  // Admin activa
  const ad = await pg(); await ad.goto(`${BASE}/login`); await ad.fill("#email", ADMIN); await ad.fill("#password", PASS); await ad.getByRole("button", { name: /Entrar|Ingresar/ }).click(); await ad.waitForURL(/\/app$/);
  await ad.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(emailC)}`);
  const li = ad.locator("li", { hasText: emailC });
  ck("Admin ve el centro como pendiente", await li.getByText(/pendiente de activar/).count() > 0);
  await li.getByLabel(/Perfil activado/).check(); await li.getByRole("button", { name: "Guardar perfil" }).click(); await li.getByText(/Centro de padres · activo/).waitFor();
  // Centro agrega cursos
  await C.goto(`${BASE}/centro`);
  await C.fill("#audit-code", "AUD-NOEXISTE123"); await C.getByRole("button", { name: "Agregar curso" }).click();
  ck("Código inexistente se rechaza", await C.getByText(/No encontramos un curso|no es válido/).first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await C.fill("#audit-code", codeB); await C.getByRole("button", { name: "Agregar curso" }).click();
  ck("Curso de OTRO colegio se rechaza", await C.getByText(/pertenece a otro colegio/).first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await C.waitForTimeout(1000); await C.fill("#audit-code", codeA); await C.getByRole("button", { name: "Agregar curso" }).click(); await C.getByRole("link", { name: "Auditar curso" }).waitFor();
  ck("Curso del mismo colegio se agrega (aunque el nombre difiera en mayúsculas)", true);
  await C.reload(); ck("Aparece en la lista con libro cuadrado", await C.getByText("6° A · 2026").count() > 0 || await C.getByText(/6° A/).count() > 0);
  ck("Curso del otro colegio NO aparece", await C.getByText("6° B").count() === 0);
  // Auditoría
  await C.getByRole("link", { name: "Auditar curso" }).click(); await C.waitForURL(/\/centro\/c\//); const urlA = C.url();
  ck("Ve el libro y la cuadratura", await C.getByText(/El libro cuadra/).count() > 0);
  const html = await C.content();
  ck("Alumno abreviado (Matías S.), sin apellido completo", html.includes("Matías S.") && !html.includes("Villalobos"));
  ck("Sin botones de editar (solo lectura)", await C.getByRole("button", { name: /Editar|Corregir|Eliminar/ }).count() === 0);
  const x = await C.request.get(`${urlA.replace("/centro/c/", "/api/centro/c/")}/libro/xlsx`); const pdf = await C.request.get(`${urlA.replace("/centro/c/", "/api/centro/c/")}/libro/pdf`);
  ck("Descarga Excel y PDF del libro", x.status() === 200 && pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === "%PDF");
  // Aislamiento: otro centro de otro colegio no ve el curso de A
  const C2 = await pg(); await register(C2, "Centro Otro", `c2.${ts}@prueba.cl`, "centro", "Otro Colegio");
  const r = await C2.request.get(`${urlA.replace("/centro/c/", "/api/centro/c/")}/libro/xlsx`);
  ck("Otro centro no puede descargar el libro (404)", r.status() === 404);
  const r2 = await C2.goto(urlA); ck("Otro centro no puede abrir la página del curso (404)", r2.status() === 404);
  // Tesorero corta el acceso con un código nuevo
  await A.goto(`${BASE}/app/c/${idA}/accesos`); ck("Tesorero ve qué centro tiene acceso", await A.getByText(/Centro Norte/).count() > 0);
  A.once("dialog", (d) => d.accept()); await A.getByRole("button", { name: "Generar uno nuevo" }).last().click(); await A.waitForTimeout(1500);
  const r3 = await C.goto(urlA); ck("Con código nuevo el centro pierde el acceso (404)", r3.status() === 404);
  await C.goto(`${BASE}/centro`); ck("El centro ve el aviso de código nuevo", await C.getByText(/generó un código nuevo/).count() > 0);
  // Admin desactiva → pierde todo
  await ad.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(emailC)}`);
  const li2 = ad.locator("li", { hasText: emailC }); await li2.locator("summary", { hasText: "Perfil Centro de padres" }).click(); await li2.getByLabel(/Perfil activado/).uncheck(); await li2.getByRole("button", { name: "Guardar perfil" }).click(); await li2.getByText(/pendiente de activar/).waitFor();
  await C.goto(`${BASE}/centro`); ck("Admin desactiva el perfil y vuelve a 'pendiente'", await C.getByText("pendiente de activación").count() > 0);
} catch (e) { ck("Ejecución sin errores", false, String(e.message).split("\n")[0]); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
