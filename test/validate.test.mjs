import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRegistration } from "../lib/validate.mjs";

test("valid registration passes and trims values", () => {
  const v = validateRegistration({ name: "  Asha   Rao ", email: " Asha@Example.COM ", phone: "98765 43210", designation: "" });
  assert.equal(v.ok, true);
  assert.deepEqual(v.value, { name: "Asha Rao", email: "asha@example.com", phone: "9876543210", designation: "" });
});

test("phone must be exactly 10 digits; +91 prefix is accepted", () => {
  assert.equal(validateRegistration({ name: "A", email: "a@b.co", phone: "+91 98765 43210" }).ok, true);
  assert.match(validateRegistration({ name: "A", email: "a@b.co", phone: "987654321" }).errors.phone, /10 digits/);
  assert.match(validateRegistration({ name: "A", email: "a@b.co", phone: "98765432109" }).errors.phone, /10 digits/);
  assert.match(validateRegistration({ name: "A", email: "a@b.co", phone: "98765abcde" }).errors.phone, /10 digits/);
});

test("email format and required fields are enforced; designation is optional", () => {
  const v = validateRegistration({ name: "", email: "not-an-email", phone: "" });
  assert.equal(v.ok, false);
  assert.ok(v.errors.name && v.errors.email && v.errors.phone);
  assert.equal(v.errors.designation, undefined);
});
