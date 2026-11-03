// Overview numbers: aging, monthly trend, receivable and payable days (DSO/DPO), and value by use case.
import { inr } from "./format.mjs";
import { daysBetween, addDays } from "./bills.mjs";

const BUCKETS = ["0-30", "31-60", "61-90", "91-180", "Over 180"];
const bucketOf = (d) => (d <= 30 ? BUCKETS[0] : d <= 60 ? BUCKETS[1] : d <= 90 ? BUCKETS[2] : d <= 180 ? BUCKETS[3] : BUCKETS[4]);
const r0 = (n) => Math.round(n);
const partyAmount = (v) => v.entries.filter((e) => e.isParty).reduce((s, e) => s + Math.abs(e.amount), 0);

export function buildMetrics({ bills, vouchers, asOf, findings, summary }) {
  const open = bills.filter((b) => b.outstanding > 0.5);
  const aging = (kind) => {
    const m = Object.fromEntries(BUCKETS.map((k) => [k, 0]));
    open.filter((b) => b.kind === kind).forEach((b) => { m[bucketOf(Math.max(0, b.daysOverdue))] += b.outstanding; });
    return BUCKETS.map((label) => ({ label, value: r0(m[label]) }));
  };

  // Monthly sales vs customer receipts, and purchases vs supplier payments (last 12 months)
  const months = [];
  for (let i = 11; i >= 0; i--) months.push(addDays(asOf, -30 * i).slice(0, 7));
  const monthly = (types) => {
    const m = Object.fromEntries(months.map((k) => [k, 0]));
    vouchers.filter((v) => types.includes(v.type) && m[v.date.slice(0, 7)] !== undefined).forEach((v) => { m[v.date.slice(0, 7)] += partyAmount(v); });
    return months.map((k) => ({ x: k, y: r0(m[k]) }));
  };
  const since90 = addDays(asOf, -90);
  const sum90 = (types) => vouchers.filter((v) => types.includes(v.type) && v.date > since90).reduce((s, v) => s + partyAmount(v), 0);
  const sales90 = sum90(["Sales"]), purch90 = sum90(["Purchase"]);

  // Value by use case and severity mix
  const byUc = {};
  findings.forEach((f) => { byUc[f.uc] = byUc[f.uc] || { label: f.uc, value: 0, count: 0 }; byUc[f.uc].value += f.amount; byUc[f.uc].count += 1; });
  const sev = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach((f) => { sev[f.severity] += 1; });

  // Top overdue customers (receivable outstanding)
  const cust = {};
  open.filter((b) => b.kind === "customer").forEach((b) => { cust[b.party] = (cust[b.party] || 0) + b.outstanding; });
  const topCustomers = Object.entries(cust).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, v]) => ({ label, value: r0(v) }));

  return {
    summary,
    dso: sales90 ? Math.round((summary.receivable / sales90) * 90) : null,
    dpo: purch90 ? Math.round((summary.payable / purch90) * 90) : null,
    identified: r0(findings.reduce((s, f) => s + f.amount, 0)),
    findingCount: findings.length,
    agingReceivable: aging("customer"),
    agingPayable: aging("supplier"),
    trend: { months, sales: monthly(["Sales"]), receipts: monthly(["Receipt"]), purchases: monthly(["Purchase"]), payments: monthly(["Payment"]) },
    byUseCase: Object.values(byUc),
    severity: Object.entries(sev).map(([label, value]) => ({ label, value })),
    topCustomers,
    note: `Receivable days use customer sales of ${inr(r0(sales90))} in the last 90 days.`,
  };
}
