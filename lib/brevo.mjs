// Brevo transactional email (https://api.brevo.com/v3/smtp/email). The API key is read from the environment only.
import { config, ConfigError } from "./config.mjs";

export async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const c = config().brevo;
  if (!c.apiKey || !c.senderEmail || !c.senderName) {
    throw new ConfigError("Email is not configured yet (BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME).");
  }
  const body = {
    sender: { email: c.senderEmail, name: c.senderName },
    to: [{ email: to.email, name: to.name }],
    subject, htmlContent: html, textContent: text,
  };
  if (attachments.length) body.attachment = attachments; // [{ name, content: base64 }]
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": c.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Brevo returned HTTP ${res.status}`);
    err.publicMessage = `Email was not accepted (HTTP ${res.status}).`;
    err.detail = detail.slice(0, 200);
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  return { messageId: data.messageId || null };
}
