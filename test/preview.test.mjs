import { test } from "node:test";
import assert from "node:assert/strict";
import { getWorkshopData } from "../lib/workshop.mjs";
import { buildPreview } from "../lib/preview.mjs";

const who = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };
const d = getWorkshopData();

test("every finding has a 'what will happen' and a Tally or message effect", () => {
  for (const f of d.findings) {
    const p = buildPreview(f, d, who);
    assert.ok(p.what.length > 0, f.id);
    assert.ok(p.effects.length > 0, f.id);
  }
});

test("duplicate payments and invoices require evidence review before approval", () => {
  for (const f of d.findings.filter((x) => ["internal_check", "reversal"].includes(x.action.kind))) {
    const p = buildPreview(f, d, who);
    assert.ok(p.evidenceCheck, f.id);
    assert.ok(p.evidence && p.evidence.length >= 2, f.id);
  }
});

test("UC5 early payments show the timing decision and due-date alerts", () => {
  const f = d.findings.find((x) => x.action.kind === "payment_timing");
  const p = buildPreview(f, d, who);
  assert.ok(p.decision && p.decision.approve && p.decision.reject);
  assert.ok(Array.isArray(p.alerts));
  assert.ok(p.evidence.length > 0);
});

test("reminder preview shows the email and the filled WhatsApp template", () => {
  const f = d.findings.find((x) => x.action.kind === "reminder");
  const p = buildPreview(f, d, who);
  assert.match(p.message.text, /^Dear Asha Rao,/);
  assert.equal(p.message.whatsapp.length, 7);
});
