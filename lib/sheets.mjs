// Appends one registration row to the Google Sheet through the Apps Script web app.
import { config, ConfigError } from "./config.mjs";

export async function appendRegistration(row) {
  const c = config().sheet;
  if (!c.url || !c.secret) throw new ConfigError("Registration is not configured yet (GOOGLE_SHEET_WEBHOOK_URL, GOOGLE_SHEET_SECRET).");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: c.secret, timestamp: row.timestamp, name: row.name, email: row.email, phone: row.phone, designation: row.designation || "" }),
    redirect: "follow",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok !== true) {
    const err = new Error("Sheet write failed");
    err.publicMessage = "Registration could not be saved. Please try again in a moment.";
    err.detail = `HTTP ${res.status}`;
    throw err;
  }
  return true;
}
