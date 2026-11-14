import "server-only";
import QRCode from "qrcode";

/** Genera el QR como imagen PNG en data URL (se usa directo en <img>). */
export function qrDataUrl(text: string, width = 240): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d2a27", light: "#ffffff" } });
}
