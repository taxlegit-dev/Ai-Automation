import { test } from "node:test";
import assert from "node:assert/strict";
import { getWorkshopData, findFinding } from "../lib/workshop.mjs";

test("the five use cases run on the Kalindi export and give the expected findings", () => {
  const d = getWorkshopData();
  const by = {};
  for (const f of d.findings) by[f.uc] = (by[f.uc] || 0) + 1;
  assert.equal(d.findings.length, 20);
  assert.deepEqual(by, { UC1: 8, UC2: 4, UC3: 2, UC4: 4, UC5: 2 });
  assert.equal(d.summary.customersOpen, 18);
  assert.equal(Math.round(d.summary.receivable), 2976945);
  assert.equal(Math.round(d.summary.payable), 1416429);
});

test("every finding carries an action the Action Hub can show", () => {
  for (const f of getWorkshopData().findings) {
    assert.ok(f.id && f.uc && f.title && f.why, f.id);
    assert.ok(f.action && f.action.kind && f.action.label, f.id);
  }
});

test("reminders exist for UC1 only, and resolve by id", () => {
  const reminders = getWorkshopData().findings.filter((f) => f.action.kind === "reminder");
  assert.ok(reminders.length >= 1);
  assert.ok(reminders.every((f) => f.uc === "UC1"));
  assert.equal(findFinding(reminders[0].id).id, reminders[0].id);
  assert.equal(findFinding("F999"), null);
});

test("no finding or label uses the words dummy or simulated", () => {
  const text = JSON.stringify(getWorkshopData().findings).toLowerCase();
  assert.ok(!/dummy|simulated/.test(text));
});

test("overview metrics: aging, trend, days and value by use case are present", () => {
  const m = getWorkshopData().metrics;
  assert.equal(m.agingReceivable.length, 5);
  assert.equal(m.trend.months.length, 12);
  assert.equal(m.trend.sales.length, 12);
  assert.equal(m.byUseCase.length, 5);
  assert.ok(m.dso === null || m.dso > 0);
  assert.ok(m.topCustomers.length > 0);
});
