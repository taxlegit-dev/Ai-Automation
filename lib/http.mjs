// Small helpers for Vercel Node functions (request body, JSON replies, participant check, rate limit).
import { verifyParticipant } from "./token.mjs";

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export function allowMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", method);
  json(res, 405, { error: "Method not allowed." });
  return false;
}

// Returns the participant from the Bearer token, or sends 401 and returns null.
export function requireParticipant(req, res) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  let p = null;
  try { p = verifyParticipant(token); } catch (err) {
    json(res, 503, { error: "The workshop is not fully configured yet (SESSION_SECRET)." });
    return null;
  }
  if (!p) { json(res, 401, { error: "Your session has expired. Please register again." }); return null; }
  return p;
}

const hits = new Map();
// Simple per-instance limiter. It protects the demo from accidental floods; it is not a security boundary.
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
