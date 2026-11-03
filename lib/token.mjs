// Signed participant token. The registration response carries it; the desktop sends it back with
// every action, so reminders and reports go to the registered details without asking again.
// Stateless: nothing is stored on the server. Signed with SESSION_SECRET (Vercel environment variable).
import crypto from "node:crypto";

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url");

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set (16+ characters required).");
  return s;
}

export function signParticipant(p, { ttlHours = 72 } = {}) {
  const payload = { n: p.name, e: p.email, p: p.phone, d: p.designation || "", exp: Date.now() + ttlHours * 3600 * 1000 };
  const body = b64(JSON.stringify(payload));
  const sig = b64(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyParticipant(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = b64(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const p = JSON.parse(unb64(body).toString("utf8"));
  if (!p.exp || p.exp < Date.now()) return null;
  return { name: p.n, email: p.e, phone: p.p, designation: p.d };
}
