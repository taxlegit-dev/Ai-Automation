// POST /api/register - validates the form, appends the row to the Google Sheet and returns a signed session token.
import { validateRegistration } from "../lib/validate.mjs";
import { appendRegistration } from "../lib/sheets.mjs";
import { signParticipant } from "../lib/token.mjs";
import { allowMethod, json, readBody, rateLimited, clientIp } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    if (rateLimited(`register:${clientIp(req)}`, 15, 60 * 60 * 1000)) {
      return json(res, 429, { error: "Too many attempts from this network. Please try again later." });
    }
    const body = await readBody(req);
    const v = validateRegistration(body);
    if (!v.ok) return json(res, 400, { error: "Please correct the highlighted fields.", errors: v.errors });
    if (body.consent !== true) {
      return json(res, 400, { error: "Please confirm consent to receive workshop messages.", errors: { consent: "Required." } });
    }
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    await appendRegistration({ timestamp, ...v.value });
    const token = signParticipant(v.value, { ttlHours: 72 });
    return json(res, 200, { token, participant: { name: v.value.name, email: v.value.email, phone: v.value.phone } });
  } catch (err) {
    console.error("register failed:", err.name, err.detail || "");
    return json(res, err.status || 500, { error: err.publicMessage || "Registration could not be saved. Please try again." });
  }
}
