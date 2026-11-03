// Rule settings for the workshop, taken from FlowIQ's rules (global defaults, company-specific values
// set for the demo company). Change values here, not in the analysis code.
export const RULES = {
  asOfDefault: null, // set from the last voucher date
  materiality: 10000,
  defaultCreditDays: 30,
  severity: { critical: 2500000, high: 500000, medium: 100000 },
  uc1: {
    overdueFromDays: 30,
    recoveryPctByAge: [
      { maxDays: 30, pct: 90 }, { maxDays: 60, pct: 70 }, { maxDays: 90, pct: 50 },
      { maxDays: 180, pct: 30 }, { maxDays: Infinity, pct: 10 },
    ],
  },
  uc2: { warnPct: 80, highPct: 100, criticalPct: 120, noLimitAbove: 500000 },
  uc3: { mediumOverdueDays: 60, highOverdueDays: 90, recentSalesDays: 30 },
  uc4: { invoiceWindowDays: 7, paymentWindowDays: 3 },
  uc5: {
    earlyDays: 5, costOfFundsPct: 11, excludeRegex: /NOIDA|VIDYUT|ELECTRIC|GAS|WATER|MUNICIPAL|GOVT|GOVERNMENT|TAX/i,
    lateLookbackDays: 365, lateInterestPct: 18,
  },
};

export function severityOf(amount, rules = RULES) {
  if (amount >= rules.severity.critical) return "critical";
  if (amount >= rules.severity.high) return "high";
  if (amount >= rules.severity.medium) return "medium";
  return "low";
}
