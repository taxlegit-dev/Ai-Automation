// Builds the reminder for one Action Hub finding. The recipient is the registered participant, so the
// six WhatsApp parameters map to: recipient name, company, amount, bill numbers, due date, days overdue.
import { inr, dmy } from "./format.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function buildReminder(finding, participant, companyName) {
  const bills = (finding.evidence || []).filter((b) => b.bill || b.billName || b.dueDate);
  const billRows = bills.map((b) => ({
    bill: b.bill || b.billName, dueDate: b.dueDate, daysOverdue: b.daysOverdue ?? 0, outstanding: b.outstanding ?? 0,
  }));
  const oldest = billRows.reduce((a, b) => (b.daysOverdue > (a?.daysOverdue ?? -1) ? b : a), null) || { dueDate: "", daysOverdue: 0 };
  const total = finding.amount;
  const billNos = billRows.map((b) => b.bill).join(", ");
  const subject = `Payment reminder from ${companyName}: ${inr(total)} overdue`;
  const intro = `This reminder is for the bills of ${finding.party}, as flagged by FlowIQ. It is sent to you because you registered for the workshop, so you can see the message exactly as a customer would receive it.`;
  const text = [
    `Dear ${participant.name},`,
    "",
    `This is a reminder from ${companyName} that ${inr(total)} against bill(s) ${billNos} was due on ${dmy(oldest.dueDate)} and is now ${oldest.daysOverdue} days overdue.`,
    "",
    "Please arrange the payment at the earliest.",
    "",
    "Thank you.",
    "",
    "Please ignore if already paid.",
    "",
    "---",
    intro,
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2433;line-height:1.5">
<p>Dear ${esc(participant.name)},</p>
<p>This is a reminder from <b>${esc(companyName)}</b> that <b>${esc(inr(total))}</b> against bill(s) <b>${esc(billNos)}</b> was due on ${esc(dmy(oldest.dueDate))} and is now ${oldest.daysOverdue} days overdue.</p>
<p>Please arrange the payment at the earliest.</p>
<p>Thank you.</p>
<p>Please ignore if already paid.</p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #d9dee8;margin-top:12px">
<tr style="background:#f1f4f9"><th align="left">Bill</th><th align="left">Due</th><th align="right">Days overdue</th><th align="right">Outstanding</th></tr>
${billRows.map((b) => `<tr><td>${esc(b.bill)}</td><td>${esc(dmy(b.dueDate))}</td><td align="right">${b.daysOverdue}</td><td align="right">${esc(inr(b.outstanding))}</td></tr>`).join("")}
</table>
<p style="color:#5b6478;font-size:12px;margin-top:16px">---<br>${esc(intro)}</p>
</div>`;
  return {
    subject, text, html,
    whatsappParams: [
      participant.name,                 // {{1}} recipient
      companyName,                      // {{2}} sender company
      inr(total, { symbol: false }),    // {{3}} amount (template already shows the rupee sign)
      billNos,                          // {{4}} bill number(s)
      dmy(oldest.dueDate),              // {{5}} due date of the oldest bill
      String(oldest.daysOverdue),       // {{6}} days overdue of the oldest bill
    ],
  };
}
