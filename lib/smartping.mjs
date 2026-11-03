// SmartPing WhatsApp campaign API (v2). Request structure follows the account's approved "overdue" campaign.
import { config, ConfigError } from "./config.mjs";

export async function sendWhatsAppReminder({ destination, templateParams }) {
  const c = config().smartping;
  if (!c.apiKey) throw new ConfigError("WhatsApp is not configured yet (SMARTPING_API_KEY).");
  if (!/^\d{10}$/.test(destination)) throw new Error("Destination must be 10 digits.");
  if (!Array.isArray(templateParams) || templateParams.length !== 6 || templateParams.some((p) => typeof p !== "string")) {
    throw new Error("The reminder template needs exactly six text parameters.");
  }
  const body = {
    apiKey: c.apiKey,
    campaignName: c.campaignName,
    destination,
    userName: c.userName,
    templateParams,
    source: c.source,
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: { FirstName: "user" },
  };
  const res = await fetch(c.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`SmartPing returned HTTP ${res.status}`);
    err.publicMessage = `WhatsApp message was not accepted (HTTP ${res.status}).`;
    err.detail = text.slice(0, 200);
    throw err;
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { httpStatus: res.status, response: parsed };
}
