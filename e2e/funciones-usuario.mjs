// Funciones por usuario y por curso (con origen identificado).
//   BASE=http://localhost:3000 ADMIN_EMAIL=admin@prueba.cl node e2e/funciones-usuario.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_EMAIL || "admin@prueba.cl";
const PASS = "clave-segura-123";
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const res = []; const ck = (n, ok, e = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${e}`); };
const EMAIL = `fu.${Date.now()}@prueba.cl`;
const pg = async () => (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const mkCourse = async (t, name) => {
  await t.goto(`${BASE}/app/new`); await t.fill("[name=school]", "Colegio FU"); await t.fill("[name=name]", name); await t.fill("[name=monthlyFee]", "4000");
  await t.getByRole("button", { name: /Crear curso/ }).click(); await t.waitForURL(/\/app\/c\/[0-9a-f-]+$/);
  return t.url().split("/c/")[1];
};
try {
  const t = await pg();
  await t.goto(`${BASE}/register`); await t.fill("#name", "Tesorero FU"); await t.fill("#email", EMAIL); await t.fill("#password", PASS);
  await t.getByRole("button", { name: "Crear cuenta" }).click(); await t.waitForURL(/\/app$/);
  const c1 = await mkCourse(t, "7° A");
  const a = await pg();
  await a.goto(`${BASE}/login`); await a.fill("#email", ADMIN); await a.fill("#password", PASS); await a.getByRole("button", { name: /Ingresar|Entrar/ }).click(); await a.waitForURL(/\/app$/);
  // 1) Por usuario: activar Pago en línea para todos sus cursos
  await a.goto(`${BASE}/admin/usuarios?q=${encodeURIComponent(EMAIL)}`);
  const u = a.locator("li", { hasText: EMAIL });
  await u.locator("summary", { hasText: "Funciones para todos sus cursos" }).click();
  await u.locator("[name=mercadopago]").selectOption("on");
  await u.getByRole("button", { name: "Guardar funciones del usuario" }).click(); await a.getByText(/Funciones del usuario guardadas/).waitFor();
  // 2) Curso existente refleja origen "por usuario"
  await a.goto(`${BASE}/admin/cursos?q=${encodeURIComponent("7° A")}`);
  let card = a.locator("li", { hasText: "Colegio FU" }).filter({ hasText: "7° A" }).first();
  await card.locator("summary", { hasText: "Funciones del curso" }).click();
  let mp = card.locator("label", { hasText: "Pago en línea" });
  ck("Curso existente muestra Mercado Pago disponible, origen por usuario", (await mp.innerText()).includes("disponible") && (await mp.innerText()).includes("por usuario"));
  // 3) Curso nuevo hereda lo del usuario
  const c2 = await mkCourse(t, "7° B");
  await a.goto(`${BASE}/admin/cursos?q=${encodeURIComponent("7° B")}`);
  card = a.locator("li", { hasText: "Colegio FU" }).filter({ hasText: "7° B" }).first();
  await card.locator("summary", { hasText: "Funciones del curso" }).click();
  mp = card.locator("label", { hasText: "Pago en línea" });
  ck("Curso creado después hereda el ajuste del usuario", (await mp.innerText()).includes("por usuario") && (await mp.innerText()).includes("disponible"));
  // 4) Ajuste por curso tiene prioridad: desactivar solo 7° B
  await mp.locator("select").selectOption("off");
  await card.getByRole("button", { name: "Guardar funciones" }).click(); await a.getByText(/Funciones guardadas|guardad/i).first().waitFor();
  await a.goto(`${BASE}/admin/cursos?q=${encodeURIComponent("7° B")}`);
  card = a.locator("li", { hasText: "Colegio FU" }).filter({ hasText: "7° B" }).first();
  await card.locator("summary", { hasText: "Funciones del curso" }).click();
  mp = card.locator("label", { hasText: "Pago en línea" });
  ck("Ajuste por curso gana sobre el de usuario (bloqueada, origen por curso)", (await mp.innerText()).includes("bloqueada") && (await mp.innerText()).includes("por curso"));
  // 5) Efecto real: el tesorero ve el campo de Mercado Pago en 7° A y no en 7° B
  await t.goto(`${BASE}/app/c/${c1}/plan`);
  ck("Tesorero: 7° A tiene Mercado Pago habilitado", await t.getByRole("button", { name: /Solicitar activación/ }).count() === 0);
  await t.goto(`${BASE}/app/c/${c2}/plan`);
  ck("Tesorero: 7° B (bloqueada por curso) sigue pidiendo solicitud", await t.getByRole("button", { name: /Solicitar activación/ }).count() > 0);
} catch (e) { ck("Ejecución sin errores", false, String(e.message).split("\n")[0]); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
