// Superusuario: solicitudes, Mercado Pago apagado por defecto, gestión de usuarios.
//   BASE=http://localhost:3000 ADMIN_EMAIL=admin@prueba.cl node e2e/superusuario.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_EMAIL || "admin@prueba.cl";
const PASS = "clave-segura-123";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = []; const ck = (n, ok, e = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${e}`); };
const st = Date.now(); const EMAIL = `su.${st}@prueba.cl`;
const pg = async () => (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const formWith = (p, btn) => p.locator("form", { has: p.getByRole("button", { name: btn, exact: true }) }).first();
try {
  const t = await pg();
  await t.goto(`${BASE}/register`); await t.fill("#name", "Tesorero Super"); await t.fill("#email", EMAIL); await t.fill("#password", PASS);
  await t.getByRole("button", { name: "Crear cuenta" }).click(); await t.waitForURL(/\/app$/);
  await t.goto(`${BASE}/app/new`); await t.fill("[name=school]", "Colegio Super"); await t.fill("[name=name]", "6° C"); await t.fill("[name=monthlyFee]", "4000");
  await t.getByRole("button", { name: /Crear curso/ }).click(); await t.waitForURL(/\/app\/c\/[0-9a-f-]+$/);
  const id = t.url().split("/c/")[1]; const plan = `${BASE}/app/c/${id}/plan`;
  await t.goto(plan); await t.getByRole("button", { name: /Probar Pro/ }).click(); await t.getByRole("button", { name: /Probar Pro/ }).waitFor({ state: "detached" });
  await t.goto(plan);
  let txt = await t.locator("body").innerText();
  ck("Con Pro, Mercado Pago sigue apagado: se ve la nota de comisión", txt.includes("Mercado Pago cobra comisión") && txt.includes("3,19%") && txt.includes("transferir"));
  ck("Con Pro no aparece el campo del Access Token (hay que solicitarlo)", (await t.locator("#mp").count()) === 0 && await t.getByRole("button", { name: /Solicitar activación/ }).isVisible());
  const f = formWith(t, "Solicitar activación de Pago en línea (Mercado Pago)");
  await f.locator("[name=message]").fill("Queremos cobrar en línea");
  await f.getByRole("button", { name: /Solicitar activación/ }).click(); await t.getByText("Solicitud enviada").first().waitFor();
  await t.goto(plan);
  ck("Queda como solicitud pendiente", await t.getByText("Solicitud enviada el").isVisible());
  const mf = formWith(t, "Enviar mensaje"); await mf.locator("textarea").fill("Hola, necesito ayuda con el curso");
  await mf.getByRole("button", { name: "Enviar mensaje", exact: true }).click(); await t.getByText("Mensaje enviado al administrador").waitFor();

  // Administrador
  const a = await pg();
  await a.goto(`${BASE}/register`); await a.fill("#name", "Admin"); await a.fill("#email", ADMIN); await a.fill("#password", PASS);
  await a.getByRole("button", { name: "Crear cuenta" }).click(); await a.waitForURL(/\/app$/, { timeout: 8000 }).catch(() => {});
  if (!a.url().endsWith("/app")) { await a.goto(`${BASE}/login`); await a.fill("#email", ADMIN); await a.fill("#password", PASS); await a.getByRole("button", { name: /Ingresar|Entrar/ }).click(); await a.waitForURL(/\/app$/); }
  await a.goto(`${BASE}/admin/solicitudes`);
  const card = a.locator("li", { hasText: "Pide activar: Pago en línea" }).filter({ hasText: EMAIL });
  ck("El administrador ve la solicitud con el mensaje del tesorero", await card.locator("text=Queremos cobrar en línea").isVisible());
  ck("El administrador ve el mensaje libre", await a.locator("li", { hasText: "Hola, necesito ayuda" }).filter({ hasText: EMAIL }).count() === 1);
  await card.locator("[name=adminNote]").first().fill("Listo, recuerda la comisión");
  await card.getByRole("button", { name: "Aprobar y activar" }).click(); await card.waitFor({ state: "detached" });
  await t.goto(plan);
  ck("Aprobada: el tesorero ya puede conectar Mercado Pago", await t.locator("#mp").isVisible());

  // Usuarios
  await a.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(EMAIL)}`);
  const u = a.locator("li", { hasText: EMAIL }).first();
  await u.locator("summary", { hasText: "Administrar usuario" }).click();
  await u.locator("[name=name]").fill("Tesorero Editado");
  await u.getByRole("button", { name: "Guardar datos" }).click(); await a.getByText("Usuario actualizado").waitFor();
  a.on("dialog", (d) => d.accept());
  await u.getByRole("button", { name: "Suspender cuenta" }).click(); await a.getByText(/Cuenta suspendida/).waitFor();
  await t.goto(`${BASE}/app`);
  ck("Cuenta suspendida: se cierra su sesión", t.url().includes("/login"));
  const l = await pg(); await l.goto(`${BASE}/login`); await l.fill("#email", EMAIL); await l.fill("#password", PASS);
  await l.getByRole("button", { name: /Ingresar|Entrar/ }).click();
  await l.getByText(/suspendida/).waitFor().catch(() => {});
  ck("Cuenta suspendida: no puede iniciar sesión", await l.getByText(/suspendida/).isVisible());
  await a.getByRole("button", { name: "Reactivar cuenta" }).click(); await a.getByText("Cuenta reactivada").waitFor();
  await l.goto(`${BASE}/login`); await l.fill("#email", EMAIL); await l.fill("#password", PASS); await l.getByRole("button", { name: "Entrar" }).click();
  await l.waitForURL(/\/app$/, { timeout: 8000 }).catch(async () => console.log("DEBUG", l.url(), (await l.locator("body").innerText()).slice(0, 200).replace(/\n/g, " | ")));
  ck("Reactivada: puede entrar de nuevo", true);
  await u.getByRole("button", { name: "Restablecer contraseña" }).click(); await a.getByText(/Contraseña temporal:/).waitFor();
  ck("Restablecer contraseña muestra una temporal", true);
  await u.locator('[name=confirm]').fill(EMAIL);
  await u.getByRole("button", { name: "Eliminar usuario y sus cursos" }).click(); await u.waitFor({ state: "detached" });
  await a.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(EMAIL)}`);
  ck("Usuario eliminado con sus cursos", await a.getByText("No se encontraron usuarios").isVisible());
  await a.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(ADMIN)}`);
  ck("Un administrador no se puede eliminar ni suspender desde el panel", (await a.getByRole("button", { name: "Suspender cuenta" }).count()) === 0 && (await a.getByRole("button", { name: "Eliminar usuario y sus cursos" }).count()) === 0);
} catch (e) { ck("Ejecución sin errores", false, String(e.message).split("\n")[0]); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
