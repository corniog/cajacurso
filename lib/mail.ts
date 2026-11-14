import "server-only";
import nodemailer from "nodemailer";
import { BRAND } from "@/lib/brand";

export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function tx() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function layout(title: string, bodyHtml: string) {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;color:#1d2a27">
  <h2 style="color:#1f6f5c;margin:0 0 12px">${esc(BRAND.name)}</h2>
  <h3 style="margin:0 0 12px">${esc(title)}</h3>${bodyHtml}
  <p style="color:#5d6b67;font-size:12px;margin-top:24px">Este mensaje lo envió la tesorería del curso a través de ${esc(BRAND.name)}.</p></div>`;
}

/** Envía un correo. Devuelve false si el correo no está configurado o falla (nunca lanza). */
export type Attachment = { filename: string; content: Buffer; contentType: string };

export async function sendMail(to: string, subject: string, html: string, attachments?: Attachment[]): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    await tx().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, attachments });
    return true;
  } catch (e) {
    console.error("[mail] error:", e instanceof Error ? e.message : e);
    return false;
  }
}
