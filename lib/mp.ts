import "server-only";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

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
