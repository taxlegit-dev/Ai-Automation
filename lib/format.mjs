// Indian number and date formatting used across the workshop.
export function inr(n, { symbol = true } = {}) {
  const v = Math.round(Number(n) || 0);
  const neg = v < 0;
  let s = String(Math.abs(v));
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    s = `${rest},${last3}`;
  }
  return `${neg ? "-" : ""}${symbol ? "₹" : ""}${s}`;
}

export function dmy(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function monthLabel(iso) {
  const d = new Date(iso + "-01T00:00:00Z");
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
