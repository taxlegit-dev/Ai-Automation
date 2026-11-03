// Builds bill-wise balances for customers (Sundry Debtors) and suppliers (Sundry Creditors)
// from voucher bill allocations. New Ref opens a bill; Agst Ref settles it.
import { RULES } from "./rules.mjs";

const day = (d) => Math.round((new Date(d + "T00:00:00Z")).getTime() / 86400000);
export const daysBetween = (a, b) => day(b) - day(a);

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildBills(ledgers, vouchers, asOf) {
  const byName = new Map(ledgers.map((l) => [l.name, l]));
  const bills = new Map(); // key: party|billName
  const settlements = []; // Agst Ref entries with date (for late/early analysis)

  for (const v of vouchers) {
    for (const e of v.entries) {
      if (!e.isParty) continue;
      const led = byName.get(e.ledger);
      if (!led) continue;
      const isDebtor = led.parent === "Sundry Debtors";
      const isCreditor = led.parent === "Sundry Creditors";
      if (!isDebtor && !isCreditor) continue;
      // Positive balance = amount owed by the party (customer owes us / we owe supplier).
      const owed = isDebtor ? -e.amount : e.amount;
      for (const b of e.bills) {
        const key = `${e.ledger}|${b.name}`;
        if (b.type === "New Ref") {
          const rec = bills.get(key) || {
            party: e.ledger, kind: isDebtor ? "customer" : "supplier", billName: b.name,
            billDate: v.date, voucher: v.number, voucherType: v.type, amount: 0, settled: 0,
            creditDays: led.creditDays ?? RULES.defaultCreditDays, paidOn: [],
          };
          rec.amount += owed === 0 ? b.amount * (isDebtor ? -1 : 1) : (owed > 0 ? Math.abs(b.amount) : -Math.abs(b.amount));
          if (!bills.has(key)) bills.set(key, rec);
        } else if (b.type === "Agst Ref") {
          const rec = bills.get(key);
          const amt = Math.abs(b.amount);
          if (rec) {
            rec.settled += amt;
            rec.paidOn.push({ date: v.date, amount: amt, voucher: v.number });
          }
          settlements.push({ party: e.ledger, kind: isDebtor ? "customer" : "supplier", billName: b.name, date: v.date, amount: amt, voucher: v.number, voucherType: v.type });
        }
      }
    }
  }

  const list = [];
  for (const rec of bills.values()) {
    rec.outstanding = Math.round((rec.amount - rec.settled) * 100) / 100;
    rec.dueDate = addDays(rec.billDate, rec.creditDays);
    rec.daysOverdue = Math.max(0, daysBetween(rec.dueDate, asOf));
    rec.age = daysBetween(rec.billDate, asOf);
    list.push(rec);
  }
  return { bills: list, settlements };
}
