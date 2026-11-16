import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Course, LedgerAudit } from "@/lib/db/schema";
import type { LedgerEntry, Reconciliation } from "@/lib/ledger";
import { fmtDate } from "@/lib/ledger";
import { clp } from "@/lib/finance";

type Totals = { income: number; expense: number; fees: number; extras: number; balance: number; count: number };
export type LedgerExportData = { course: Course; entries: LedgerEntry[]; totals: Totals; rec: Reconciliation; audit: LedgerAudit[]; treasurer: string };

const stamp = () => new Date().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" });

export async function buildLedgerXlsx(d: LedgerExportData): Promise<Buffer> {
  const { course, entries, totals, rec, audit } = d;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CajaCurso";
  const head = (ws: ExcelJS.Worksheet, row = 1) => {
    ws.getRow(row).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6F5C" } };
  };
  const money = '"$"#,##0;[Red]-"$"#,##0';

  const ws = wb.addWorksheet("Libro contable");
  ws.addRow([`${course.school} · ${course.name} ${course.year} — Libro de contabilidad`]);
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([`Emitido el ${stamp()} · Tesorero(a): ${d.treasurer}`]);
  ws.addRow([]);
  ws.addRow(["N°", "Fecha", "Tipo", "Concepto", "Detalle", "Ingreso", "Egreso", "Saldo"]);
  head(ws, 4);
  entries.forEach((e) => ws.addRow([e.n, fmtDate(e.date), e.source, e.concept, e.detail, e.income || null, e.expense || null, e.balance]));
  const last = ws.rowCount;
  // Totales con fórmulas, para que cualquiera pueda comprobarlos en Excel
  const t = ws.addRow(["", "", "", "TOTALES", "", { formula: `SUM(F5:F${last})`, result: totals.income }, { formula: `SUM(G5:G${last})`, result: totals.expense }, { formula: `F${last + 1}-G${last + 1}`, result: totals.balance }]);
  t.font = { bold: true };
  ws.columns = [{ width: 7 }, { width: 12 }, { width: 14 }, { width: 44 }, { width: 38 }, { width: 14, style: { numFmt: money } }, { width: 14, style: { numFmt: money } }, { width: 14, style: { numFmt: money } }];
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const rs = wb.addWorksheet("Cuadratura");
  rs.addRow(["Concepto", "Libro contable", "Aplicación del curso", "Diferencia", "Estado"]);
  head(rs);
  rec.rows.forEach((r) => rs.addRow([r.label, r.ledger, r.app, r.ledger - r.app, r.ok ? "Cuadra" : "NO CUADRA"]));
  rs.addRow([]);
  rs.addRow([rec.ok ? "El libro cuadra con la aplicación del curso." : "ATENCIÓN: hay diferencias entre el libro y la aplicación."]);
  rs.columns = [{ width: 28 }, { width: 18, style: { numFmt: money } }, { width: 22, style: { numFmt: money } }, { width: 14, style: { numFmt: money } }, { width: 14 }];

  const au = wb.addWorksheet("Bitácora de cambios");
  au.addRow(["Fecha", "Usuario", "Acción", "Detalle"]);
  head(au);
  audit.forEach((a) => au.addRow([a.createdAt.toLocaleString("es-CL", { timeZone: "America/Santiago" }), a.userName, a.action === "edit" ? "Corrección" : "Eliminación", a.summary]));
  if (!audit.length) au.addRow(["Sin cambios: ningún movimiento ha sido corregido ni eliminado."]);
  au.columns = [{ width: 20 }, { width: 22 }, { width: 14 }, { width: 70 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildLedgerPdf(d: LedgerExportData): Promise<Buffer> {
  const { course, entries, totals, rec, audit } = d;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: `Libro contable ${course.name} ${course.year}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const G = "#1f6f5c", MUTED = "#5d6b67", INK = "#1d2a27";
    const L = 36, W = doc.page.width - 72;
    const bottom = () => doc.page.height - 50;
    const cols = [
      { k: "n", t: "N°", w: 34, a: "left" }, { k: "d", t: "Fecha", w: 58, a: "left" },
      { k: "c", t: "Concepto", w: W - 34 - 58 - 80 * 3 - 70, a: "left" }, { k: "s", t: "Tipo", w: 70, a: "left" },
      { k: "i", t: "Ingreso", w: 80, a: "right" }, { k: "e", t: "Egreso", w: 80, a: "right" }, { k: "b", t: "Saldo", w: 80, a: "right" },
    ] as const;
    const cell = (txt: string, x: number, y: number, w: number, a: "left" | "right", bold = false, color = INK) =>
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(color).text(txt, x, y, { width: w - 6, align: a, lineBreak: false, ellipsis: true });
    const header = () => {
      const y = doc.y; doc.rect(L, y - 3, W, 16).fill(G);
      let x = L; for (const c of cols) { cell(c.t, x + 2, y, c.w, c.a, true, "#ffffff"); x += c.w; }
      doc.y = y + 16;
    };

    doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(`${course.school} · ${course.name} ${course.year}`, L, 36);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(G).text("Libro de contabilidad");
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`Emitido el ${stamp()} · Tesorero(a): ${d.treasurer} · ${totals.count} movimientos`);
    doc.moveDown(0.6);

    // Resumen y cuadratura
    doc.font("Helvetica-Bold").fontSize(10).fillColor(G).text("Cuadratura con la aplicación del curso", L);
    doc.moveDown(0.3);
    let y = doc.y;
    const rc = [{ w: 220, a: "left" as const }, { w: 110, a: "right" as const }, { w: 110, a: "right" as const }, { w: 90, a: "right" as const }];
    let x = L; ["Concepto", "Libro", "Aplicación", "Estado"].forEach((t, i) => { cell(t, x, y, rc[i].w, rc[i].a, true, MUTED); x += rc[i].w; });
    y += 14;
    for (const r of rec.rows) {
      x = L;
      [r.label, clp(r.ledger), clp(r.app), r.ok ? "Cuadra ✓" : "NO CUADRA"].forEach((t, i) => { cell(t, x, y, rc[i].w, rc[i].a, r.label.startsWith("Total") || r.label.startsWith("Saldo"), i === 3 ? (r.ok ? "#1e8e5a" : "#c0392b") : INK); x += rc[i].w; });
      y += 13;
    }
    doc.y = y + 8;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(G).text("Movimientos", L, doc.y);
    doc.moveDown(0.3);
    header();
    entries.forEach((e, idx) => {
      if (doc.y + 16 > bottom()) { doc.addPage(); header(); }
      const yy = doc.y;
      if (idx % 2) doc.rect(L, yy - 2, W, 14).fill("#f4f7f6");
      const vals = [String(e.n).padStart(4, "0"), fmtDate(e.date), e.concept, e.source, e.income ? clp(e.income) : "", e.expense ? clp(e.expense) : "", clp(e.balance)];
      let xx = L;
      cols.forEach((c, i) => { cell(vals[i], xx + 2, yy, c.w, c.a, false, i === 4 ? "#1e8e5a" : i === 5 ? "#c0392b" : INK); xx += c.w; });
      doc.y = yy + 14;
    });
    if (!entries.length) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Sin movimientos registrados.", L);

    if (doc.y + 40 > bottom()) doc.addPage();
    const ty = doc.y + 2;
    doc.moveTo(L, ty).lineTo(L + W, ty).strokeColor("#94a3b8").stroke();
    let tx = L + cols[0].w + cols[1].w;
    cell("TOTALES", tx + 2, ty + 5, cols[2].w, "left", true);
    tx += cols[2].w + cols[3].w;
    cell(clp(totals.income), tx, ty + 5, cols[4].w, "right", true, "#1e8e5a");
    cell(clp(totals.expense), tx + cols[4].w, ty + 5, cols[5].w, "right", true, "#c0392b");
    cell(clp(totals.balance), tx + cols[4].w + cols[5].w, ty + 5, cols[6].w, "right", true);
    doc.y = ty + 24;

    // Bitácora
    if (doc.y + 50 > bottom()) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(G).text("Bitácora de cambios", L, doc.y + 6);
    doc.moveDown(0.3);
    if (!audit.length) doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text("Sin cambios: ningún movimiento ha sido corregido ni eliminado.", L);
    for (const a of audit) {
      if (doc.y + 14 > bottom()) doc.addPage();
      const yy = doc.y;
      cell(a.createdAt.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }), L, yy, 100, "left", false, MUTED);
      cell(a.userName, L + 100, yy, 120, "left");
      cell(`${a.action === "edit" ? "Corrección" : "Eliminación"}: ${a.summary}`, L + 220, yy, W - 220, "left");
      doc.y = yy + 13;
    }

    // Firmas
    if (doc.y + 70 > bottom()) doc.addPage();
    const fy = doc.y + 40;
    [["Tesorero(a)", 0], ["Presidente(a) / Directiva", 1]].forEach(([label, i]) => {
      const fx = L + 40 + (i as number) * (W / 2);
      doc.moveTo(fx, fy).lineTo(fx + 220, fy).strokeColor("#64748b").stroke();
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label as string, fx, fy + 4, { width: 220, align: "center" });
    });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`CajaCurso · Libro contable · Página ${i + 1} de ${range.count}`, L, doc.page.height - 28, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
