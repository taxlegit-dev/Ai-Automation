// POST /api/mis - builds the MIS as Excel, PDF or both, and emails it to the registered address only.
import { getWorkshopData } from "../lib/workshop.mjs";
import { buildMisReport, buildExcel, buildPdf, misFileName } from "../lib/mis.mjs";
import { sendEmail } from "../lib/brevo.mjs";
import { allowMethod, json, readBody, requireParticipant, rateLimited } from "../lib/http.mjs";
import { dmy, inr } from "../lib/format.mjs";

const FORMATS = { xlsx: ["xlsx"], pdf: ["pdf"], both: ["xlsx", "pdf"] };

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  const p = requireParticipant(req, res);
  if (!p) return;
  try {
    if (rateLimited(`mis:${p.email}`, 10, 60 * 60 * 1000)) {
      return json(res, 429, { error: "Report limit reached for this session. Please try again later." });
    }
    const body = await readBody(req);
    const kinds = FORMATS[body.format];
    if (!kinds) return json(res, 400, { error: "Choose Excel, PDF or Both." });
    const report = buildMisReport(getWorkshopData());
    const attachments = [];
    for (const ext of kinds) {
      const buf = ext === "xlsx" ? await buildExcel(report) : await buildPdf(report);
      attachments.push({ name: misFileName(report, ext), content: buf.toString("base64") });
    }
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2433;line-height:1.5">
<p>Dear ${escapeHtml(p.name)},</p>
<p>Your FlowIQ MIS report for <b>${escapeHtml(report.company)}</b>, as of ${dmy(report.asOf)}, is attached.</p>
<p>Receivables: ${escapeHtml(inr(report.summary.receivable))} &middot; Payables: ${escapeHtml(inr(report.summary.payable))}</p>
<p style="color:#5b6478;font-size:12px">${escapeHtml(report.note)}</p></div>`;
    const text = `Dear ${p.name},\n\nYour FlowIQ MIS report for ${report.company}, as of ${dmy(report.asOf)}, is attached.\n\n${report.note}`;
    await sendEmail({
      to: { email: p.email, name: p.name },
      subject: `FlowIQ MIS report (${kinds.map((k) => k.toUpperCase()).join(" + ")}) - ${report.company}`,
      html, text, attachments,
    });
    return json(res, 200, { sent: true, to: p.email, files: attachments.map((a) => a.name) });
  } catch (err) {
    console.error("mis failed:", err.name, err.detail || "");
    return json(res, err.status || 500, { error: err.publicMessage || "The MIS report could not be generated or sent." });
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
