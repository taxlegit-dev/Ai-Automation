// The five FlowIQ use cases (UC1-UC5) applied to the company's Tally data.
import { RULES, severityOf } from "./rules.mjs";
import { buildBills, daysBetween, addDays } from "./bills.mjs";
import { inr } from "./format.mjs";

const round = (n) => Math.round(n * 100) / 100;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

function recoveryPct(days) {
  const b = RULES.uc1.recoveryPctByAge.find((x) => days <= x.maxDays);
  return b.pct;
}

export function analyse({ ledgers, vouchers, asOf }) {
  const { bills, settlements } = buildBills(ledgers, vouchers, asOf);
  const findings = [];
  const add = (f) => findings.push({ id: `F${String(findings.length + 1).padStart(3, "0")}`, ...f });
  const limitOf = new Map(ledgers.map((l) => [l.name, l.creditLimit]));
  const open = bills.filter((b) => b.outstanding > 0.5);

  // UC1 - overdue receivables, aged per customer with a realistic recovery estimate
  const custs = [...new Set(open.filter((b) => b.kind === "customer").map((b) => b.party))];
  for (const party of custs) {
    const ob = open.filter((b) => b.kind === "customer" && b.party === party && b.daysOverdue > 0);
    const overdue = round(sum(ob, (b) => b.outstanding));
    if (overdue < RULES.materiality) continue;
    const oldest = ob.reduce((a, b) => (b.daysOverdue > a.daysOverdue ? b : a), ob[0]);
    const recoverable = round(sum(ob, (b) => b.outstanding * recoveryPct(b.daysOverdue) / 100));
    add({
      uc: "UC1", type: "overdue_receivable", party, severity: severityOf(overdue),
      amount: overdue, title: `${party}: ${ob.length} bill(s) overdue`,
      why: `Oldest bill ${oldest.billName} is ${oldest.daysOverdue} days past due. Realistic recovery ${inr(recoverable)} of ${inr(overdue)}.`,
      action: { kind: "reminder", label: "Payment reminder", channel: ["email", "whatsapp"], level: oldest.daysOverdue > 90 ? 3 : oldest.daysOverdue > 30 ? 2 : 1 },
      evidence: ob.map((b) => ({ bill: b.billName, date: b.billDate, dueDate: b.dueDate, daysOverdue: b.daysOverdue, outstanding: round(b.outstanding) })),
      recoverable,
    });
  }

  // UC2 - credit limit use, and large balances with no limit set in Tally
  for (const party of custs) {
    const bal = round(sum(open.filter((b) => b.kind === "customer" && b.party === party), (b) => b.outstanding));
    const limit = limitOf.get(party) || 0;
    if (limit > 0) {
      const pct = (bal / limit) * 100;
      if (pct >= RULES.uc2.warnPct) {
        add({
          uc: "UC2", type: "credit_limit", party, severity: pct >= RULES.uc2.criticalPct ? "critical" : pct >= RULES.uc2.highPct ? "high" : "medium",
          amount: bal, title: `${party}: ${Math.round(pct)}% of credit limit used`,
          why: `Outstanding ${inr(bal)} against a limit of ${inr(limit)}.`,
          action: { kind: "credit_review", label: "Credit review", tallyEntry: "set_credit_limit" },
          evidence: [{ limit, outstanding: bal, utilisationPct: Math.round(pct) }],
        });
      }
    } else if (bal > RULES.uc2.noLimitAbove) {
      add({
        uc: "UC2", type: "no_limit", party, severity: "medium", amount: bal,
        title: `${party}: large balance with no credit limit`,
        why: `Outstanding ${inr(bal)} and no credit limit set in Tally.`,
        action: { kind: "credit_review", label: "Set credit limit", tallyEntry: "set_credit_limit" },
        evidence: [{ outstanding: bal }],
      });
    }
  }

  // UC3 - new sales to customers who already have long-overdue bills
  const lastDate = addDays(asOf, -RULES.uc3.recentSalesDays);
  const recentSales = vouchers.filter((v) => v.type === "Sales" && v.date > lastDate);
  for (const v of recentSales) {
    const longOverdue = open.filter((b) => b.kind === "customer" && b.party === v.party && b.daysOverdue > RULES.uc3.mediumOverdueDays);
    if (!longOverdue.length) continue;
    const worst = Math.max(...longOverdue.map((b) => b.daysOverdue));
    const amt = round(sum(v.entries.filter((e) => e.isParty), (e) => Math.abs(e.amount)));
    add({
      uc: "UC3", type: "sales_on_overdue", party: v.party, severity: worst > RULES.uc3.highOverdueDays ? "high" : "medium",
      amount: amt, title: `${v.party}: new invoice ${v.number} despite overdue bills`,
      why: `Invoice dated ${v.date} while bills are up to ${worst} days overdue. No credit hold is recorded.`,
      action: { kind: "credit_hold", label: "Credit hold decision", channel: ["email"] },
      evidence: [{ invoice: v.number, date: v.date, amount: amt, oldestOverdueDays: worst }],
    });
  }

  // UC4 - duplicate invoices and payments
  const invoices = vouchers.filter((v) => v.type === "Sales" || v.type === "Purchase");
  const seenInv = new Set();
  for (const a of invoices) {
    for (const b of invoices) {
      if (a === b || a.party !== b.party || a.type !== b.type || a.number >= b.number) continue;
      const amtA = round(sum(a.entries.filter((e) => e.isParty), (e) => Math.abs(e.amount)));
      const amtB = round(sum(b.entries.filter((e) => e.isParty), (e) => Math.abs(e.amount)));
      if (amtA !== amtB || Math.abs(daysBetween(a.date, b.date)) > RULES.uc4.invoiceWindowDays) continue;
      const key = `${a.number}|${b.number}`;
      if (seenInv.has(key)) continue;
      seenInv.add(key);
      add({
        uc: "UC4", type: "duplicate_invoice", party: a.party, severity: severityOf(amtA, RULES) === "low" ? "medium" : severityOf(amtA),
        amount: amtA, title: `${a.party}: possible duplicate ${a.type.toLowerCase()} invoice`,
        why: `${a.number} and ${b.number} have the same amount ${inr(amtA)} within ${Math.abs(daysBetween(a.date, b.date))} day(s).`,
        action: { kind: "internal_check", label: "Check against documents", tallyEntry: "reverse_voucher" },
        evidence: [{ voucher: a.number, date: a.date }, { voucher: b.number, date: b.date }],
      });
    }
  }
  const pays = vouchers.filter((v) => v.type === "Payment" || v.type === "Receipt");
  const seenPay = new Set();
  for (const a of pays) {
    for (const b of pays) {
      if (a === b || a.party !== b.party || a.type !== b.type || a.number >= b.number) continue;
      const amtA = round(sum(a.entries.filter((e) => e.isParty), (e) => Math.abs(e.amount)));
      const amtB = round(sum(b.entries.filter((e) => e.isParty), (e) => Math.abs(e.amount)));
      if (amtA !== amtB || Math.abs(daysBetween(a.date, b.date)) > RULES.uc4.paymentWindowDays) continue;
      const key = `${a.number}|${b.number}`;
      if (seenPay.has(key)) continue;
      seenPay.add(key);
      add({
        uc: "UC4", type: "duplicate_payment", party: a.party, severity: severityOf(amtA) === "low" ? "medium" : severityOf(amtA),
        amount: amtA, title: `${a.party}: same payment recorded twice`,
        why: `${a.number} and ${b.number} are both ${inr(amtA)} within ${Math.abs(daysBetween(a.date, b.date))} day(s).`,
        action: { kind: "reversal", label: "Reversal entry", tallyEntry: "reverse_voucher" },
        evidence: [{ voucher: a.number, date: a.date }, { voucher: b.number, date: b.date }],
      });
    }
  }

  // UC5 - early supplier payments (cost of funds) and late payments (interest exposure)
  const supplierSettlements = settlements.filter((s) => s.kind === "supplier" && s.voucherType === "Payment");
  const earlyByParty = new Map();
  const lateByParty = new Map();
  for (const s of supplierSettlements) {
    const bill = bills.find((b) => b.party === s.party && b.billName === s.billName);
    if (!bill) continue;
    const days = daysBetween(s.date, bill.dueDate); // positive = paid before due
    if (days >= RULES.uc5.earlyDays && !RULES.uc5.excludeRegex.test(s.party)) {
      const cost = s.amount * RULES.uc5.costOfFundsPct / 100 * days / 365;
      const e = earlyByParty.get(s.party) || { count: 0, cost: 0, days: 0, amount: 0 };
      e.count += 1; e.cost += cost; e.days += days; e.amount += s.amount; earlyByParty.set(s.party, e);
    }
    const late = -days;
    if (late > 0 && daysBetween(s.date, asOf) <= RULES.uc5.lateLookbackDays) {
      const cost = s.amount * RULES.uc5.lateInterestPct / 100 * late / 365;
      const e = lateByParty.get(s.party) || { count: 0, interest: 0, amount: 0, maxLate: 0 };
      e.count += 1; e.interest += cost; e.amount += s.amount; e.maxLate = Math.max(e.maxLate, late); lateByParty.set(s.party, e);
    }
  }
  for (const [party, e] of earlyByParty) {
    if (e.cost < RULES.materiality) continue;
    add({
      uc: "UC5", type: "early_payment", party, severity: severityOf(e.cost) === "low" ? "low" : severityOf(e.cost),
      amount: round(e.cost), title: `${party}: ${e.count} bill(s) paid early`,
      why: `Paid on average ${Math.round(e.days / e.count)} days before due date, costing ${inr(Math.round(e.cost))} in cost of funds at ${RULES.uc5.costOfFundsPct}%.`,
      action: { kind: "payment_timing", label: "Payment timing decision", channel: ["email"] },
      evidence: [{ bills: e.count, amount: round(e.amount), avgDaysEarly: Math.round(e.days / e.count) }],
    });
  }
  for (const [party, e] of lateByParty) {
    if (e.interest < RULES.materiality) continue;
    add({
      uc: "UC5", type: "late_payment", party, severity: severityOf(e.interest) === "low" ? "low" : severityOf(e.interest),
      amount: round(e.interest), title: `${party}: late-payment interest exposure`,
      why: `${e.count} bill(s) paid late in the last 12 months, up to ${e.maxLate} days after due. Estimated interest ${inr(Math.round(e.interest))} at ${RULES.uc5.lateInterestPct}%.`,
      action: { kind: "penalty_flag", label: "Penalty flag", channel: ["email"] },
      evidence: [{ bills: e.count, amount: round(e.amount), maxDaysLate: e.maxLate }],
    });
  }

  return {
    asOf,
    summary: {
      customersOpen: custs.length,
      receivable: round(sum(open.filter((b) => b.kind === "customer"), (b) => b.outstanding)),
      payable: round(sum(open.filter((b) => b.kind === "supplier"), (b) => b.outstanding)),
    },
    bills, findings, settlements,
  };
}
