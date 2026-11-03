import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminder } from "../lib/messages.mjs";
import { getWorkshopData } from "../lib/workshop.mjs";

const participant = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };

test("WhatsApp parameters map to recipient, company, amount, bills, due date and days overdue", () => {
  const f = getWorkshopData().findings.find((x) => x.action.kind === "reminder");
  const r = buildReminder(f, participant, "Kalindi Industrial Components (Test)");
  assert.equal(r.whatsappParams.length, 6);
  assert.equal(r.whatsappParams[0], "Asha Rao");               // recipient, not a copy of the first name everywhere
  assert.equal(r.whatsappParams[1], "Kalindi Industrial Components (Test)");
  assert.ok(!r.whatsappParams[2].includes("₹"));                // template already prints the rupee sign
  assert.ok(r.whatsappParams[3].length > 0);                     // bill numbers
  assert.match(r.whatsappParams[4], /^\d{2}-\d{2}-\d{4}$/);     // due date
  assert.match(r.whatsappParams[5], /^\d+$/);                    // days overdue
  assert.notEqual(new Set(r.whatsappParams).size, 1);
});

test("the email is addressed to the participant and says it is a workshop demonstration", () => {
  const f = getWorkshopData().findings.find((x) => x.action.kind === "reminder");
  const r = buildReminder(f, participant, "Kalindi Industrial Components (Test)");
  assert.match(r.text, /^Dear Asha Rao,/);
  assert.match(r.text, /Please ignore if already paid\./);
  assert.match(r.text, new RegExp(f.party.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
