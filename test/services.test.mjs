import { test } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, setEnv } from "./helpers.mjs";
import { sendWhatsAppReminder } from "../lib/smartping.mjs";
import { sendEmail } from "../lib/brevo.mjs";
import { appendRegistration } from "../lib/sheets.mjs";

setEnv({
  SMARTPING_API_KEY: "sp-test-key", SMARTPING_CAMPAIGN_NAME: "overdue", SMARTPING_USER_NAME: "Taxlegit 8514",
  SMARTPING_SOURCE: "new-landing-page form", BREVO_API_KEY: "br-test-key", BREVO_SENDER_EMAIL: "sender@example.com",
  BREVO_SENDER_NAME: "FlowIQ Workshop", GOOGLE_SHEET_WEBHOOK_URL: "https://script.google.com/macros/s/TEST/exec", GOOGLE_SHEET_SECRET: "sheet-secret",
});

test("SmartPing request follows the approved campaign structure", async () => {
  const calls = mockFetch(() => ({ status: 200, body: { success: true } }));
  const params = ["Asha Rao", "Kalindi", "1,99,264", "INV-1, INV-2", "10-10-2026", "32"];
  await sendWhatsAppReminder({ destination: "9876543210", templateParams: params });
  const c = calls[0];
  assert.equal(c.url, "https://backend.api-wa.co/campaign/smartping/api/v2");
  assert.equal(c.method, "POST");
  assert.equal(c.body.apiKey, "sp-test-key");
  assert.equal(c.body.campaignName, "overdue");
  assert.equal(c.body.destination, "9876543210");
  assert.equal(c.body.userName, "Taxlegit 8514");
  assert.deepEqual(c.body.templateParams, params);
  assert.deepEqual(c.body.paramsFallbackValue, { FirstName: "user" });
  assert.deepEqual(c.body.buttons, []);
});

test("SmartPing rejects a bad destination or wrong parameter count without calling the API", async () => {
  const calls = mockFetch(() => ({ status: 200, body: {} }));
  await assert.rejects(sendWhatsAppReminder({ destination: "123", templateParams: ["a", "b", "c", "d", "e", "f"] }));
  await assert.rejects(sendWhatsAppReminder({ destination: "9876543210", templateParams: ["a"] }));
  assert.equal(calls.length, 0);
});

test("Brevo email sends with the configured sender and base64 attachments", async () => {
  const calls = mockFetch(() => ({ status: 201, body: { messageId: "<m1>" } }));
  const out = await sendEmail({
    to: { email: "asha@example.com", name: "Asha" }, subject: "MIS", html: "<p>x</p>", text: "x",
    attachments: [{ name: "a.pdf", content: "JVBERi0=" }],
  });
  assert.equal(out.messageId, "<m1>");
  assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(calls[0].headers["api-key"], "br-test-key");
  assert.deepEqual(calls[0].body.sender, { email: "sender@example.com", name: "FlowIQ Workshop" });
  assert.deepEqual(calls[0].body.to, [{ email: "asha@example.com", name: "Asha" }]);
  assert.deepEqual(calls[0].body.attachment, [{ name: "a.pdf", content: "JVBERi0=" }]);
});

test("Brevo failure surfaces a safe message and never the API key", async () => {
  mockFetch(() => ({ status: 401, body: { message: "Key not found" } }));
  await assert.rejects(sendEmail({ to: { email: "a@b.co", name: "A" }, subject: "s", html: "h", text: "t" }), (e) => {
    assert.ok(!String(e.publicMessage).includes("br-test-key"));
    assert.match(e.publicMessage, /HTTP 401/);
    return true;
  });
});

test("registration row is posted to Apps Script with the secret and the five columns", async () => {
  const calls = mockFetch(() => ({ status: 200, body: { ok: true } }));
  await appendRegistration({ timestamp: "03/11/2026, 10:00:00", name: "Asha", email: "a@b.co", phone: "9876543210", designation: "" });
  assert.equal(calls[0].url, "https://script.google.com/macros/s/TEST/exec");
  assert.equal(calls[0].body.secret, "sheet-secret");
  assert.equal(calls[0].body.phone, "9876543210");
});
