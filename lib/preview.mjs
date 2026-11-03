// What each Action Hub item will do, shown before approval. Only facts from the sample data are used.
import { buildReminder } from "./messages.mjs";
import { inr, dmy } from "./format.mjs";
import { daysBetween, addDays } from "./bills.mjs";
import { RULES } from "./rules.mjs";

const money = (n) => inr(Math.round(n));

export function buildPreview(f, data, participant) {
  const { bills, asOf } = data;
  const settlements = data.settlements || [];
  const openFor = (kind, party) => bills.filter((b) => b.kind === kind && b.party === party && b.outstanding > 0.5);
  const billRows = (list) => list.map((b) => ({ Bill: b.billName, "Due date": dmy(b.dueDate), "Days overdue": b.daysOverdue, "Outstanding (₹)": money(b.outstanding) }));
  const out = { what: [], effects: [], evidence: null, evidenceTitle: "", decision: null, evidenceCheck: null, message: null };

  switch (f.action.kind) {
    case "reminder": {
      const r = buildReminder(f, participant, data.company);
      out.what = [`Send a payment reminder about ${f.party}'s overdue bills (${money(f.amount)}).`,
                  "Goes to you, at the email address and WhatsApp number you registered with. No customer receives it."];
      out.effects = ["Email and WhatsApp are sent only after you approve.", "Nothing is posted to Tally."];
      out.evidenceTitle = "Bills in this reminder";
      out.evidence = billRows(openFor("customer", f.party).filter((b) => b.daysOverdue > 0));
      out.message = {
        subject: r.subject, text: r.text,
        whatsapp: [
          "Dear {{1}}, This is a reminder from {{2}} that ₹{{3}} against bill(s) {{4}} was due on {{5}} and is now {{6}} days overdue. Please arrange the payment at the earliest. Thank you. Please ignore if already paid.",
          ...r.whatsappParams.map((p, i) => `{{${i + 1}}} = ${p}`),
        ],
      };
      break;
    }
    case "credit_review": {
      const e = (f.evidence || [])[0] || {};
      const open = openFor("customer", f.party);
      out.what = e.limit
        ? [`Review ${f.party}'s credit limit: ${e.utilisationPct}% of the limit is used.`]
        : [`Set a credit limit for ${f.party}: none is recorded in Tally, but ${money(f.amount)} is outstanding.`];
      out.effects = e.limit
        ? [`Tally ledger "${f.party}": credit limit ${money(e.limit)} stays until the finance head changes it.`,
           "Until the review is closed, new sales to this customer are flagged for approval."]
        : [`Tally ledger "${f.party}": credit limit is blank today.`,
           `Suggested limit: ${money(Math.ceil((f.amount * 1.2) / 50000) * 50000)} (outstanding × 1.2, rounded up to ₹50,000). The finance head can change it before approving.`];
      out.effects.push("Posting to Tally is not connected in this workshop, so the approval is recorded here.");
      out.evidenceTitle = "Open bills for this customer";
      out.evidence = billRows(open);
      break;
    }
    case "credit_hold": {
      const e = (f.evidence || [])[0] || {};
      out.what = [`Put ${f.party} on credit hold for new sales until its bills older than ${RULES.uc3.mediumOverdueDays} days are cleared.`];
      out.effects = [`Invoice ${e.invoice} dated ${dmy(e.date)} (${money(e.amount)}) is flagged for the finance head's review.`,
                     `Their oldest bill is ${e.oldestOverdueDays} days overdue.`,
                     "A reminder for the overdue bills can be sent from UC1."];
      out.evidenceTitle = "Overdue bills behind the hold";
      out.evidence = billRows(openFor("customer", f.party).filter((b) => b.daysOverdue > RULES.uc3.mediumOverdueDays));
      break;
    }
    case "internal_check": {
      const docs = (f.evidence || []).map((v) => ({ Document: v.voucher, Date: dmy(v.date), "Amount (₹)": money(f.amount) }));
      out.what = [`Check the possible duplicate for ${f.party}: ${f.title.replace(/^[^:]+: /, "")}.`];
      out.effects = ["Compare both documents with the original bill copies and GST invoice numbers.",
                     "If it is a duplicate, a reversal voucher for the later entry is posted in Tally after approval (not connected in this workshop)."];
      out.evidenceTitle = "Documents to compare";
      out.evidence = docs;
      out.evidenceCheck = "I have compared both documents with the originals and confirmed the duplicate.";
      break;
    }
    case "reversal": {
      const docs = (f.evidence || []).map((v) => ({ Voucher: v.voucher, Date: dmy(v.date), "Amount (₹)": money(f.amount) }));
      out.what = [`Reverse a duplicate payment of ${money(f.amount)} with ${f.party}.`];
      out.effects = [`A reversal voucher for ${(f.evidence || [])[1]?.voucher || "the later entry"} is posted in Tally after approval (not connected in this workshop).`,
                     "The party balance changes by the same amount after the reversal."];
      out.evidenceTitle = "Payments that look the same";
      out.evidence = docs;
      out.evidenceCheck = "I have matched both payments to the bank statement and confirmed the second one is a duplicate.";
      break;
    }
    case "payment_timing": {
      const paid = settlements.filter((s) => s.kind === "supplier" && s.voucherType === "Payment" && s.party === f.party);
      const rows = paid.map((s) => {
        const bill = bills.find((b) => b.party === s.party && b.billName === s.billName);
        const early = bill ? daysBetween(s.date, bill.dueDate) : 0;
        return { Bill: s.billName, "Paid on": dmy(s.date), "Due date": bill ? dmy(bill.dueDate) : "", "Days early": early, "Cost of funds (₹)": money((s.amount * RULES.uc5.costOfFundsPct / 100 * Math.max(early, 0)) / 365) };
      }).filter((r) => r["Days early"] >= RULES.uc5.earlyDays);
      const alerts = openFor("supplier", f.party).filter((b) => b.dueDate >= asOf && b.dueDate <= addDays(asOf, 15));
      out.what = [`Decide how to pay ${f.party} from now on: ${rows.length} bills were paid early.`];
      out.effects = [`Paying early cost about ${f.amount ? money(f.amount) : "₹0"} in cost of funds at ${RULES.uc5.costOfFundsPct}% a year.`,
                     alerts.length ? `${alerts.length} open bill(s) fall due in the next 15 days (listed below).` : "No open bills fall due in the next 15 days.",
                     "In the live automation, the finance head gets an email 2 days before each open bill is due. In this workshop the alert is shown, not sent."];
      out.evidenceTitle = "Early payments";
      out.evidence = rows;
      out.alerts = billRows(alerts).map((r) => ({ Bill: r.Bill, "Due date": r["Due date"], "Outstanding (₹)": r["Outstanding (₹)"] }));
      out.decision = { question: `Pay future bills to ${f.party} on the due date?`, approve: "Yes - pay on due date", reject: "No - keep paying early" };
      break;
    }
    case "penalty_flag": {
      out.what = [`Flag late-payment interest exposure to ${f.party}.`];
      out.effects = ["Interest is estimated at 18% a year on the late days shown below.", "The finance head is asked to pay on time next cycle."];
      out.evidenceTitle = "Late payments";
      out.evidence = (f.evidence || []).map((e) => ({ Bills: e.bills, "Amount (₹)": money(e.amount), "Max days late": e.maxDaysLate }));
      break;
    }
    default:
      out.what = [f.title];
  }
  return out;
}
