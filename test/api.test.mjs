import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeReq, fakeRes, mockFetch, setEnv } from "./helpers.mjs";

setEnv({
  SESSION_SECRET: "test-secret-that-is-long-enough", GOOGLE_SHEET_WEBHOOK_URL: "https://script.google.com/macros/s/TEST/exec",
  GOOGLE_SHEET_SECRET: "sheet-secret", BREVO_API_KEY: "br", BREVO_SENDER_EMAIL: "s@example.com", BREVO_SENDER_NAME: "FlowIQ",
  SMARTPING_API_KEY: "sp", SMARTPING_CAMPAIGN_NAME: "overdue", SMARTPING_USER_NAME: "Taxlegit 8514", SMARTPING_SOURCE: "new-landing-page form",
});
const register = (await import("../api/register.mjs")).default;
const analysis = (await import("../api/analysis.mjs")).default;
const sendReminder = (await import("../api/send-reminder.mjs")).default;
const mis = (await import("../api/mis.mjs")).default;
const { signParticipant } = await import("../lib/token.mjs");
const { getWorkshopData } = await import("../lib/workshop.mjs");

const who = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210", designation: "" };
const auth = { authorization: "Bearer " + signParticipant(who) };

test("register: valid form writes to the sheet and returns a token", async () => {
  const calls = mockFetch(() => ({ body: { ok: true } }));
  const res = fakeRes();
  await register(fakeReq("POST", { name: "Asha Rao", email: "asha@example.com", phone: "9876543210", consent: true }), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.json.token);
  assert.equal(calls.length, 1);
});

test("register: invalid phone, missing consent and wrong method are refused", async () => {
  mockFetch(() => ({ body: { ok: true } }));
  let res = fakeRes();
  await register(fakeReq("POST", { name: "A", email: "a@b.co", phone: "123", consent: true }), res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await register(fakeReq("POST", { name: "A", email: "a@b.co", phone: "9876543210", consent: false }), res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await register(fakeReq("GET"), res);
  assert.equal(res.statusCode, 405);
});

test("register: if the sheet write fails the participant is told to retry (no false success)", async () => {
  mockFetch(() => ({ status: 500, body: "error" }));
  const res = fakeRes();
  await register(fakeReq("POST", { name: "Asha", email: "a@b.co", phone: "9876543210", consent: true }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.json.token, undefined);
});

test("analysis requires a token and returns the five use cases with notice", async () => {
  let res = fakeRes();
  await analysis(fakeReq("GET", null, {}), res);
  assert.equal(res.statusCode, 401);
  res = fakeRes();
  await analysis(fakeReq("GET", null, auth), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.findings.length, getWorkshopData().findings.length);
  assert.match(res.json.notice, /Tally is not connected/);
});

test("reminder: approved UC1 reminder goes to the registered email and WhatsApp number", async () => {
  const calls = mockFetch((c) => (c.url.includes("brevo") ? { status: 201, body: { messageId: "m" } } : { body: { success: true } }));
  const f = getWorkshopData().findings.find((x) => x.action.kind === "reminder");
  const res = fakeRes();
  await sendReminder(fakeReq("POST", { findingId: f.id, channels: ["email", "whatsapp"] }, auth), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.json.results.every((r) => r.ok));
  const email = calls.find((c) => c.url.includes("brevo"));
  const wa = calls.find((c) => c.url.includes("smartping") || c.url.includes("api-wa"));
  assert.deepEqual(email.body.to, [{ email: "asha@example.com", name: "Asha Rao" }]);
  assert.equal(wa.body.destination, "9876543210");
});

test("reminder: a non-reminder finding cannot be sent, and no channel means refusal", async () => {
  const calls = mockFetch(() => ({ body: {} }));
  const other = getWorkshopData().findings.find((x) => x.action.kind !== "reminder");
  let res = fakeRes();
  await sendReminder(fakeReq("POST", { findingId: other.id, channels: ["email"] }, auth), res);
  assert.equal(res.statusCode, 400);
  const f = getWorkshopData().findings.find((x) => x.action.kind === "reminder");
  res = fakeRes();
  await sendReminder(fakeReq("POST", { findingId: f.id, channels: [] }, auth), res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("reminder: partial failure is reported per channel (207)", async () => {
  mockFetch((c) => (c.url.includes("brevo") ? { status: 201, body: {} } : { status: 500, body: "x" }));
  const f = getWorkshopData().findings.find((x) => x.action.kind === "reminder");
  const res = fakeRes();
  await sendReminder(fakeReq("POST", { findingId: f.id, channels: ["email", "whatsapp"] }, auth), res);
  assert.equal(res.statusCode, 207);
  assert.equal(res.json.results.find((r) => r.channel === "whatsapp").ok, false);
});

test("MIS: Both sends Excel and PDF to the registered email only", async () => {
  const calls = mockFetch(() => ({ status: 201, body: { messageId: "m" } }));
  const res = fakeRes();
  await mis(fakeReq("POST", { format: "both" }, auth), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.to, "asha@example.com");
  const names = calls[0].body.attachment.map((a) => a.name);
  assert.equal(names.filter((n) => n.endsWith(".xlsx")).length, 1);
  assert.equal(names.filter((n) => n.endsWith(".pdf")).length, 1);
  assert.ok(calls.every((c) => !c.url.includes("api-wa")), "MIS must not use WhatsApp");
});

test("MIS: Excel-only and PDF-only send one attachment; unknown format is refused", async () => {
  const calls = mockFetch(() => ({ status: 201, body: {} }));
  let res = fakeRes();
  await mis(fakeReq("POST", { format: "xlsx" }, auth), res);
  assert.equal(calls.at(-1).body.attachment.length, 1);
  res = fakeRes();
  await mis(fakeReq("POST", { format: "pdf" }, auth), res);
  assert.equal(calls.at(-1).body.attachment[0].name.endsWith(".pdf"), true);
  res = fakeRes();
  await mis(fakeReq("POST", { format: "csv" }, auth), res);
  assert.equal(res.statusCode, 400);
});
