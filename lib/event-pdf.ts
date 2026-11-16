import "server-only";
import PDFDocument from "pdfkit";
import type { EventDoc, EventLine } from "@/lib/db/schema";
import { clp } from "@/lib/finance";
import { KIND_LABEL, docDate, type BusinessInfo } from "@/lib/events";

/** Boleta / presupuesto en formato angosto tipo ticket (80 mm). */
export function buildDocPdf(doc: EventDoc, lines: EventLine[], biz: BusinessInfo, eventName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const W = 226, M = 14, IW = W - M * 2;
    const logoBuf = (() => {
      const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(biz.logo || "");
      return m ? Buffer.from(m[2], "base64") : null;
    })();
    const estimate = 190 + (logoBuf ? 70 : 0) + lines.length * 30 + (doc.notes ? 30 : 0) + (biz.address || biz.phone || biz.email ? 24 : 0);
    const pdf = new PDFDocument({ size: [W, Math.max(estimate, 300)], margins: { top: M, left: M, right: M, bottom: M } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const line = () => { pdf.moveDown(0.4); const y = pdf.y; pdf.moveTo(M, y).lineTo(W - M, y).dash(2, { space: 2 }).strokeColor("#999").stroke().undash(); pdf.moveDown(0.5); };
    const center = (t: string, size = 9, bold = false) => pdf.font(bold ? "Courier-Bold" : "Courier").fontSize(size).fillColor("#111").text(t, M, pdf.y, { width: IW, align: "center" });

    if (logoBuf) {
      try { pdf.image(logoBuf, (W - 52) / 2, pdf.y, { fit: [52, 52], align: "center" }); pdf.y += 58; } catch { /* logo inválido: se omite */ }
    }
    center(biz.businessName.toUpperCase(), 11, true);
    const contact = [biz.address, biz.phone, biz.email].filter(Boolean).join(" · ");
    if (contact) center(contact, 7);
    line();
    center(`${KIND_LABEL[doc.kind].toUpperCase()} ${doc.number}`, 10, true);
    pdf.font("Courier").fontSize(8).fillColor("#111").moveDown(0.3);
    pdf.text(`Fecha: ${docDate(doc)}`, M, pdf.y, { width: IW });
    pdf.text(`Evento: ${eventName}`, { width: IW });
    pdf.text(`Cliente: ${doc.customer}`, { width: IW });
    if (doc.kind === "credit") pdf.text(`Estado: ${doc.status === "paid" ? "PAGADO" : "PENDIENTE DE PAGO"}${doc.dueDate && doc.status !== "paid" ? ` · paga el ${doc.dueDate}` : ""}`, { width: IW });
    if (doc.kind === "quote" && doc.dueDate) pdf.text(`Válido hasta: ${doc.dueDate}`, { width: IW });
    if (doc.kind === "sale" && doc.method) pdf.text(`Pago: ${doc.method}`, { width: IW });
    line();
    for (const l of lines) {
      pdf.font("Courier").fontSize(8).text(`${l.qty} x ${l.name}`, M, pdf.y, { width: IW });
      pdf.text(`${clp(l.unitPrice)} c/u`, M, pdf.y, { width: IW - 60, continued: true }).font("Courier-Bold").text(clp(l.qty * l.unitPrice), { width: 60, align: "right" });
      pdf.moveDown(0.3);
    }
    line();
    pdf.font("Courier-Bold").fontSize(12).text("TOTAL", M, pdf.y, { width: IW - 80, continued: true }).text(clp(doc.total), { width: 80, align: "right" });
    if (doc.notes) { pdf.moveDown(0.5); pdf.font("Courier").fontSize(7).text(doc.notes, M, pdf.y, { width: IW }); }
    line();
    center(biz.footer, 8);
    center(`N° ${doc.number}`, 7);
    pdf.end();
  });
}
