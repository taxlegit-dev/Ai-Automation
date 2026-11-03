import { Readable } from "node:stream";
export function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: "", done: false,
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b; this.done = true; },
    get json() { return JSON.parse(this.body || "{}"); },
  };
}
export function fakeReq(method, body, headers = {}) {
  const r = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  r.method = method; r.headers = headers; r.socket = { remoteAddress: "127.0.0.1" };
  return r;
}
export function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const call = { url: String(url), method: opts.method || "GET", headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null };
    calls.push(call);
    const r = await handler(call);
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  };
  return calls;
}
export function setEnv(vars) { Object.assign(process.env, vars); }
