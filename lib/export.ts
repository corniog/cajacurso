import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { loadCourseData } from "@/lib/course-data";
import { MONTH_NAMES, MONTH_SHORT, clp } from "@/lib/finance";

type Data = Awaited<ReturnType<typeof loadCourseData>>;
const STATUS = { pagado: "Pagado", abonado: "Abonado", pendiente: "Pendiente", no_aplica: "—" } as const;

export async function buildXlsx(d: Data): Promise<Buffer> {
  const { course, rows, expenses, extras, summary: s } = d;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CajaCurso";

  const head = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6F5C" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const res = wb.addWorksheet("Resumen");
  res.addRows([
    [`${course.school} · ${course.name} ${course.year}`], [],
    ["Cuotas recaudadas", s.collected], ["Ingresos extra", s.extras], ["Gastos", s.expenses],
    ["Balance disponible", s.balance], ["Deuda vencida", s.debt],
  ]);
  res.getCell("A1").font = { bold: true, size: 14 };
  res.columns = [{ width: 28 }, { width: 18 }];
  res.getColumn(2).numFmt = '"$"#,##0';

  const pay = wb.addWorksheet("Pagos");
  pay.addRow(["Alumno", ...course.months.map((m) => MONTH_NAMES[m - 1]), "Pagado", "Deuda vencida"]);
  head(pay);
  for (const r of rows) {
    pay.addRow([
      `${r.student.lastName}, ${r.student.firstName}`,
      ...course.months.map((m) => {
        const c = r.months[m];
        return c.status === "abonado" ? `Abonado ${clp(c.paid)}` : STATUS[c.status];
      }),
      r.paid, r.debt,
    ]);
  }
  pay.getColumn(1).width = 30;
  pay.getColumn(course.months.length + 2).numFmt = '"$"#,##0';
  pay.getColumn(course.months.length + 3).numFmt = '"$"#,##0';

  const ex = wb.addWorksheet("Gastos");
  ex.addRow(["Fecha", "Descripción", "Categoría", "Proveedor", "N° boleta", "Monto"]);
  head(ex);
  expenses.forEach((e) => ex.addRow([e.date, e.description, e.category, e.vendor ?? "", e.docNumber ?? "", e.amount]));
  ex.columns = [{ width: 12 }, { width: 38 }, { width: 16 }, { width: 22 }, { width: 12 }, { width: 14, style: { numFmt: '"$"#,##0' } }];

  const ei = wb.addWorksheet("Ingresos extra");
  ei.addRow(["Fecha", "Descripción", "Monto"]);
  head(ei);
  extras.forEach((e) => ei.addRow([e.date, e.description, e.amount]));
  ei.columns = [{ width: 12 }, { width: 40 }, { width: 14, style: { numFmt: '"$"#,##0' } }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildPdf(d: Data): Promise<Buffer> {
  const { course, rows, expenses, summary: s } = d;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Informe ${course.name} ${course.year}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const G = "#1f6f5c", MUTED = "#5d6b67";
    const W = doc.page.width - 96;
    const line = () => { doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).strokeColor("#dde5e2").stroke(); doc.moveDown(0.4); };
    const ensure = (h: number) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };
    const row = (cols: { t: string; w: number; align?: "left" | "right" | "center"; bold?: boolean; color?: string }[]) => {
      ensure(18);
      const y = doc.y; let x = 48;
      for (const c of cols) {
        doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fillColor(c.color ?? "#1d2a27").fontSize(9.5)
          .text(c.t, x, y, { width: c.w - 6, align: c.align ?? "left", lineBreak: false, ellipsis: true });
        x += c.w;
      }
      doc.y = y + 16; doc.x = 48;
    };
    const h2 = (t: string) => { ensure(60); doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor(G).text(t, 48); doc.moveDown(0.3); line(); };

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1d2a27").text(`${course.school}`, 48);
    doc.font("Helvetica").fontSize(13).fillColor(MUTED).text(`${course.name} · ${course.year} · Informe de tesorería`);
    doc.fontSize(9).text(`Emitido el ${new Date().toLocaleDateString("es-CL")} · Cuota mensual ${clp(course.monthlyFee)}`);

    h2("Resumen financiero");
    ([["Cuotas recaudadas", s.collected], ["Ingresos extra", s.extras], ["Gastos", -s.expenses], ["Balance disponible", s.balance], ["Deuda vencida de apoderados", s.debt]] as [string, number][])
      .forEach(([k, v], i) => row([{ t: k, w: 300, bold: i === 3 }, { t: clp(v), w: W - 300, align: "right", bold: i === 3 }]));

    h2("Recaudación por mes");
    row([{ t: "Mes", w: 200, bold: true }, { t: "Recaudado", w: 150, align: "right", bold: true }, { t: "Esperado", w: W - 350, align: "right", bold: true }]);
    s.byMonth.forEach((m) => row([{ t: MONTH_NAMES[m.month - 1], w: 200 }, { t: clp(m.collected), w: 150, align: "right" }, { t: clp(m.expected), w: W - 350, align: "right", color: MUTED }]));

    h2(`Gastos (${expenses.length})`);
    if (!expenses.length) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("Sin gastos registrados.", 48);
    expenses.forEach((e) => row([
      { t: e.date, w: 70 }, { t: e.description, w: W - 70 - 90 - 90 }, { t: e.category, w: 90 }, { t: clp(e.amount), w: 90, align: "right" },
    ]));
    if (s.byCategory.length) {
      doc.moveDown(0.4);
      s.byCategory.forEach((c) => row([{ t: `Total ${c.category}`, w: W - 90, color: MUTED }, { t: clp(c.total), w: 90, align: "right", color: MUTED }]));
    }

    h2("Estado por alumno");
    const mw = Math.min(26, Math.floor((W - 170 - 80) / Math.max(1, course.months.length)));
    row([{ t: "Alumno", w: 170, bold: true }, ...course.months.map((m) => ({ t: MONTH_SHORT[m - 1], w: mw, align: "center" as const, bold: true })), { t: "Deuda", w: W - 170 - mw * course.months.length, align: "right", bold: true }]);
    rows.filter((r) => r.student.active).forEach((r) => row([
      { t: `${r.student.lastName}, ${r.student.firstName}`, w: 170 },
      ...course.months.map((m) => {
        const st = r.months[m].status;
        return { t: st === "pagado" ? "✓" : st === "abonado" ? "$" : st === "no_aplica" ? "–" : "·", w: mw, align: "center" as const, color: st === "pagado" ? "#1e8e5a" : st === "abonado" ? "#c98a00" : MUTED };
      }),
      { t: r.debt > 0 ? clp(r.debt) : "Al día", w: W - 170 - mw * course.months.length, align: "right", color: r.debt > 0 ? "#c0392b" : "#1e8e5a" },
    ]));
    doc.moveDown().font("Helvetica").fontSize(8).fillColor(MUTED).text("✓ pagado   $ abonado   · pendiente   – no aplica", 48);
    doc.end();
  });
}

/** PDF de estado de cuenta de un alumno (para enviar por correo o descargar desde la ficha). */
export function buildStudentPdf(
  course: Data["course"], student: Data["students"][number], row: Data["rows"][number], payments: Data["payments"],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Estado de cuenta ${student.firstName} ${student.lastName}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const G = "#1f6f5c", MUTED = "#5d6b67", W = doc.page.width - 96;
    const row2 = (cols: { t: string; w: number; align?: "left" | "right" | "center"; bold?: boolean; color?: string }[]) => {
      if (doc.y + 18 > doc.page.height - 60) doc.addPage();
      const y = doc.y; let x = 48;
      for (const c of cols) {
        doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fillColor(c.color ?? "#1d2a27").fontSize(10)
          .text(c.t, x, y, { width: c.w - 6, align: c.align ?? "left", lineBreak: false, ellipsis: true });
        x += c.w;
      }
      doc.y = y + 17; doc.x = 48;
    };
    const h2 = (t: string) => {
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor(G).text(t, 48).moveDown(0.3);
      doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).strokeColor("#dde5e2").stroke(); doc.moveDown(0.4);
    };

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1d2a27").text("Estado de cuenta", 48);
    doc.font("Helvetica").fontSize(12).fillColor(MUTED)
      .text(`${student.firstName} ${student.lastName} · ${course.name} ${course.year}`)
      .text(course.school)
      .fontSize(9).text(`Emitido el ${new Date().toLocaleDateString("es-CL")}`);

    h2("Resumen");
    row2([{ t: "Cuota mensual", w: 300 }, { t: clp(course.monthlyFee), w: W - 300, align: "right" }]);
    row2([{ t: "Total pagado", w: 300 }, { t: clp(row.paid), w: W - 300, align: "right", color: "#1e8e5a" }]);
    row2([{ t: "Deuda vencida", w: 300, bold: true }, { t: row.debt > 0 ? clp(row.debt) : "Al día", w: W - 300, align: "right", bold: true, color: row.debt > 0 ? "#c0392b" : "#1e8e5a" }]);

    h2("Cuotas del año");
    for (const m of course.months) {
      const c = row.months[m];
      const label = c.status === "pagado" ? "Pagado" : c.status === "abonado" ? `Abonado ${clp(c.paid)}` : c.status === "no_aplica" ? "No aplica" : "Pendiente";
      const color = c.status === "pagado" ? "#1e8e5a" : c.status === "abonado" ? "#c98a00" : MUTED;
      row2([{ t: MONTH_NAMES[m - 1], w: 250 }, { t: label, w: W - 250, align: "right", color }]);
    }

    h2("Pagos registrados");
    if (!payments.length) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("Aún no hay pagos registrados.", 48);
    [...payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).forEach((p) =>
      row2([{ t: p.paidAt, w: 90 }, { t: MONTH_NAMES[p.month - 1], w: 140 }, { t: p.method, w: 120 }, { t: clp(p.amount), w: W - 350, align: "right" }]));

    doc.moveDown(2).font("Helvetica").fontSize(8).fillColor(MUTED)
      .text("Documento informativo generado por la tesorería del curso. Si ves alguna diferencia, avisa al tesorero.", 48, undefined, { width: W });
    doc.end();
  });
}
