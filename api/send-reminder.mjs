// POST /api/send-reminder - sends an approved Action Hub reminder to the registered email and WhatsApp number.
import { findFinding } from "../lib/workshop.mjs";
import { sendApprovedReminder } from "../lib/actions.mjs";
import { allowMethod, json, readBody, requireParticipant, rateLimited } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  const p = requireParticipant(req, res);
  if (!p) return;
  try {
    if (rateLimited(`send:${p.email}`, 30, 60 * 60 * 1000)) {
      return json(res, 429, { error: "Reminder limit reached for this session. Please try again later." });
    }
    const body = await readBody(req);
    const f = findFinding(String(body.findingId || ""));
    if (!f) return json(res, 404, { error: "That action is not in the Action Hub." });
    if (f.action.kind !== "reminder") return json(res, 400, { error: "This action is approved in the Action Hub; it is not a reminder." });
    const allowed = ["email", "whatsapp"];
    const channels = (Array.isArray(body.channels) ? body.channels : []).filter((c) => allowed.includes(c));
    if (!channels.length) return json(res, 400, { error: "Choose at least one channel: email or WhatsApp." });
    const results = await sendApprovedReminder(f, p, channels);
    const allOk = results.every((r) => r.ok);
    return json(res, allOk ? 200 : 207, { findingId: f.id, results });
  } catch (err) {
    console.error("send-reminder failed:", err.name, err.detail || "");
    return json(res, err.status || 500, { error: err.publicMessage || "The reminder could not be sent." });
  }
}
