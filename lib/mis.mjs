// One MIS report model, rendered to Excel (exceljs) and PDF (pdfkit) by the code below.
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inr, dmy } from "./format.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_REG = path.join(HERE, "..", "assets", "fonts", "DejaVuSans.ttf");
const FONT_BOLD = path.join(HERE, "..", "assets", "fonts", "DejaVuSans-Bold.ttf");

export const UC_LABELS = {
  UC1: "Overdue receivables",
  UC2: "Credit limit control",
  UC3: "Sales to overdue customers",
  UC4: "Duplicate invoices and payments",
  UC5: "Early and late supplier payments",
};

export function buildMisReport(data) {
  const ucs = Object.keys(UC_LABELS).map((uc) => ({
    uc,
    label: UC_LABELS[uc],
    rows: data.findings.filter((f) => f.uc === uc).map((f) => ({
      party: f.party, severity: f.severity, amount: f.amount, finding: f.title, action: f.action.label,
    })),
  }));
  const openBills = data.bills.filter((b) => b.outstanding > 0.5).map((b) => ({
    party: b.party, kind: b.kind === "customer" ? "Receivable" : "Payable", bill: b.billName,
    billDate: b.billDate, dueDate: b.dueDate, daysOverdue: b.daysOverdue, outstanding: Math.round(b.outstanding * 100) / 100,
  }));
  return {
    title: "FlowIQ MIS - Receivables, Payables and Action Hub",
    company: data.company,
    asOf: data.asOf,
    summary: data.summary,
    useCases: ucs,
    openBills,
    note: "Analysis uses sample data from a Tally test company. Tally is not connected in this workshop.",
  };
}

export function misFileName(report, ext) {
  return `FlowIQ_MIS_${report.asOf}.${ext}`;
}

export async function buildExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FlowIQ Workshop";
  wb.created = new Date();

  const s = wb.addWorksheet("Summary");
  s.addRow([report.title]).font = { bold: true, size: 14 };
  s.addRow([`Company: ${report.company}`]);
  s.addRow([`As of: ${dmy(report.asOf)}`]);
  s.addRow([report.note]).font = { italic: true };
  s.addRow([]);
  s.addRow(["Receivables from customers (INR)", report.summary.receivable]);
  s.addRow(["Payables to suppliers (INR)", report.summary.payable]);
  s.addRow(["Customers with overdue balances", report.summary.customersOpen]);
  s.getColumn(1).width = 40;
  s.getColumn(2).width = 18;
  for (const r of [6, 7]) s.getCell(`B${r}`).numFmt = "#,##0.00";

  for (const uc of report.useCases) {
    const ws = wb.addWorksheet(uc.uc);
    ws.addRow([`${uc.uc} - ${uc.label}`]).font = { bold: true, size: 12 };
    const header = ws.addRow(["Party", "Severity", "Amount (INR)", "Finding", "Action"]);
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECF3" } };
    for (const r of uc.rows) {
      const row = ws.addRow([r.party, r.severity, r.amount, r.finding, r.action]);
      row.getCell(3).numFmt = "#,##0.00";
    }
    if (!uc.rows.length) ws.addRow(["No findings in this period."]);
    ws.getColumn(1).width = 28; ws.getColumn(2).width = 12; ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 60; ws.getColumn(5).width = 26;
  }

  const ob = wb.addWorksheet("Open bills");
  const h = ob.addRow(["Party", "Type", "Bill", "Bill date", "Due date", "Days overdue", "Outstanding (INR)"]);
  h.font = { bold: true };
  for (const b of report.openBills) {
    const row = ob.addRow([b.party, b.kind, b.bill, dmy(b.billDate), dmy(b.dueDate), b.daysOverdue, b.outstanding]);
    row.getCell(7).numFmt = "#,##0.00";
  }
  [30, 12, 18, 12, 12, 14, 18].forEach((w, i) => (ob.getColumn(i + 1).width = w));
  ob.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: report.title, Author: "FlowIQ Workshop" } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("reg", FONT_REG);
    doc.registerFont("bold", FONT_BOLD);
    const W = doc.page.width - 72;

    doc.font("bold").fontSize(15).text(report.title);
    doc.font("reg").fontSize(9).fillColor("#444")
      .text(`${report.company}  |  As of ${dmy(report.asOf)}`)
      .text(report.note);
    doc.moveDown(0.8);

    doc.font("bold").fontSize(11).fillColor("#000").text("Summary");
    doc.font("reg").fontSize(10);
    doc.text(`Receivables from customers: ${inr(report.summary.receivable)}`);
    doc.text(`Payables to suppliers: ${inr(report.summary.payable)}`);
    doc.text(`Customers with overdue balances: ${report.summary.customersOpen}`);
    doc.moveDown(0.8);

    const table = (headers, widths, rows, alignRight = []) => {
      const drawRow = (cells, bold) => {
        const y = doc.y;
        let x = doc.page.margins.left;
        const h = 14;
        if (y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
        const top = doc.y;
        cells.forEach((c, i) => {
          doc.font(bold ? "bold" : "reg").fontSize(8.5).fillColor("#000")
            .text(String(c ?? ""), x + 2, top, { width: widths[i] - 4, lineBreak: false, ellipsis: true, align: alignRight.includes(i) ? "right" : "left" });
          x += widths[i];
        });
        doc.y = top + h;
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + W, doc.y).lineWidth(0.3).strokeColor("#c9cfdb").stroke();
        doc.y += 2;
      };
      drawRow(headers, true);
      if (!rows.length) drawRow(["No rows."], false);
      rows.forEach((r) => drawRow(r, false));
      doc.moveDown(0.8);
    };

    for (const uc of report.useCases) {
      doc.font("bold").fontSize(11).text(`${uc.uc} - ${uc.label}`);
      doc.moveDown(0.3);
      table(["Party", "Severity", "Amount", "Finding", "Action"], [120, 60, 80, 190, 80],
        uc.rows.map((r) => [r.party, r.severity, inr(r.amount), r.finding, r.action]), [2]);
    }

    doc.addPage();
    doc.font("bold").fontSize(11).text("Open bills");
    doc.moveDown(0.3);
    table(["Party", "Type", "Bill", "Due date", "Days overdue", "Outstanding"], [150, 65, 90, 75, 65, 90],
      report.openBills.map((b) => [b.party, b.kind, b.bill, dmy(b.dueDate), b.daysOverdue, inr(b.outstanding)]), [4, 5]);

    doc.end();
  });
}
