import { test } from "node:test";
import assert from "node:assert/strict";
import { signParticipant, verifyParticipant } from "../lib/token.mjs";
import { setEnv } from "./helpers.mjs";

setEnv({ SESSION_SECRET: "test-secret-that-is-long-enough" });
const p = { name: "Asha", email: "asha@example.com", phone: "9876543210", designation: "CA" };

test("a signed token verifies and returns the registered details", () => {
  assert.deepEqual(verifyParticipant(signParticipant(p)), p);
});

test("a tampered token is rejected", () => {
  const t = signParticipant(p);
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ n: "X", e: "x@x.co", p: "1111111111", d: "", exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(verifyParticipant(`${forged}.${sig}`), null);
  assert.equal(verifyParticipant(`${body}.abc`), null);
  assert.equal(verifyParticipant("garbage"), null);
});

test("an expired token is rejected", () => {
  assert.equal(verifyParticipant(signParticipant(p, { ttlHours: -1 })), null);
});
