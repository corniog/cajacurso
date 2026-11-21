import { customAlphabet } from "nanoid";

const codeChars = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const tokenChars = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 18);

export const newToken = () => tokenChars();

const longCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);
const shortChars = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

/** Código corto de la ficha de un alumno para digitar (10 caracteres): AB3D7-K9MPQ */
export const newStudentCode = () => `${shortChars()}-${shortChars()}`;
export const STUDENT_CODE_RE = /^[A-Z2-9]{5}-[A-Z2-9]{5}$/;

/** Código de acceso de solo lectura para directivos (12 caracteres): DIR-XXXXXXXXXXXX */
export const newDirectiveCode = () => `DIR-${longCode()}`;
export const DIRECTIVE_CODE_RE = /^DIR-[A-Z2-9]{12}$/;

/** Código público del curso, ej: 3BASICOA-AB12CD */
export function courseCode(name: string): string {
  const slug = name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "CURSO";
  return `${slug}-${codeChars()}`;
}

/** Valida y normaliza un RUT chileno. Devuelve null si el dígito verificador no calza. */
export function normalizeRut(input: string | null | undefined): string | null {
  if (!input) return null;
  const clean = input.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1), dv = clean.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  const exp = r === 11 ? "0" : r === 10 ? "K" : String(r);
  if (exp !== dv) return null;
  return `${Number(body).toLocaleString("es-CL")}-${dv}`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 9) d = "56" + d; // móvil chileno sin prefijo
  if (d.length < 10) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Código para que un Centro de padres agregue el curso a su vista de auditoría: AUD-XXXXXXXXXXXX */
export const newAuditCode = () => `AUD-${longCode()}`;
export const AUDIT_CODE_RE = /^AUD-[A-Z2-9]{12}$/;

/** "Soto, Matías" → "Matías S." (el Centro de padres audita las cuentas, no necesita ver los apellidos). */
export function maskName(full: string): string {
  const [last, first] = full.split(",").map((x) => x.trim());
  if (!first) return full;
  return `${first.split(/\s+/)[0]} ${last.charAt(0).toUpperCase()}.`;
}
