import "server-only";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { appUrl } from "@/lib/course-data";

export const platformMpConfigured = () => !!process.env.MP_PLATFORM_ACCESS_TOKEN;

export const mpPreference = (token: string) => new Preference(new MercadoPagoConfig({ accessToken: token }));
export const mpPayment = (token: string) => new Payment(new MercadoPagoConfig({ accessToken: token }));

/** Comprueba que el Access Token pertenezca a una cuenta real de Mercado Pago. */
export async function validateMpToken(token: string): Promise<{ ok: boolean; nickname?: string }> {
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!r.ok) return { ok: false };
    const j = (await r.json()) as { nickname?: string; email?: string };
    return { ok: true, nickname: j.nickname ?? j.email };
  } catch {
    return { ok: false };
  }
}

export type PaymentInfo = {
  id: string; status: string; amount: number; externalReference: string | null;
};

export async function fetchPayment(token: string, id: string): Promise<PaymentInfo | null> {
  try {
    const p = await mpPayment(token).get({ id });
    return {
      id: String(p.id), status: String(p.status), amount: Number(p.transaction_amount ?? 0),
      externalReference: p.external_reference ?? null,
    };
  } catch {
    return null;
  }
}

/* ---- Botón "Conectar con Mercado Pago" (OAuth) ---- */
export const mpOAuthConfigured = () => !!(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
export const mpRedirectUri = () => `${appUrl()}/api/integrations/mp/callback`;

export function mpAuthUrl(courseId: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.MP_CLIENT_ID!, response_type: "code", platform_id: "mp",
    state: `${courseId}.${state}`, redirect_uri: mpRedirectUri(),
  });
  return `https://auth.mercadopago.com/authorization?${q}`;
}

type OAuthResult = { access_token: string; refresh_token?: string; expires_in?: number; user_id?: number | string };

async function oauthToken(body: Record<string, string>): Promise<OAuthResult> {
  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, cache: "no-store",
    body: JSON.stringify({ client_id: process.env.MP_CLIENT_ID, client_secret: process.env.MP_CLIENT_SECRET, ...body }),
  });
  const j = (await r.json().catch(() => ({}))) as OAuthResult & { message?: string; error?: string };
  if (!r.ok || !j.access_token) throw new Error(`Mercado Pago rechazó la conexión (${r.status}) ${j.message ?? j.error ?? ""}`.trim());
  return j;
}

async function saveOAuth(courseId: string, t: OAuthResult) {
  const values = {
    mpAccessToken: encrypt(t.access_token),
    mpRefreshToken: t.refresh_token ? encrypt(t.refresh_token) : null,
    mpExpiresAt: t.expires_in ? new Date(Date.now() + t.expires_in * 1000) : null,
    mpUserId: t.user_id ? String(t.user_id) : null,
    updatedAt: new Date(),
  };
  await db.insert(schema.integrations).values({ courseId, ...values })
    .onConflictDoUpdate({ target: schema.integrations.courseId, set: values });
}

export async function connectMpWithCode(courseId: string, code: string) {
  const t = await oauthToken({ grant_type: "authorization_code", code, redirect_uri: mpRedirectUri() });
  await saveOAuth(courseId, t);
}

/** Token vigente del tesorero. Si se conectó con el botón y vence en menos de 15 días, se renueva solo. */
export async function getCourseMpToken(courseId: string): Promise<string | null> {
  const [i] = await db.select().from(schema.integrations).where(eq(schema.integrations.courseId, courseId)).limit(1);
  if (!i?.mpAccessToken) return null;
  const soon = i.mpExpiresAt && i.mpExpiresAt.getTime() - Date.now() < 15 * 86400000;
  if (soon && i.mpRefreshToken && mpOAuthConfigured()) {
    try {
      const t = await oauthToken({ grant_type: "refresh_token", refresh_token: decrypt(i.mpRefreshToken) });
      await saveOAuth(courseId, t);
      return t.access_token;
    } catch (e) {
      console.error("[mp refresh]", e instanceof Error ? e.message : e);
    }
  }
  return decrypt(i.mpAccessToken);
}
