// Workshop desktop: overview (KPIs and charts), five use cases, Action Hub with previews, MIS. Text is escaped before rendering.
(function () {
  const TOKEN_KEY = "flowiq_token";
  const APPROVAL_KEY = "flowiq_approvals";
  const view = document.getElementById("view");
  let token = null, state = null, approvals = {}, openDetails = new Set(), evidenceOk = {};

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const N = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const inr = (n) => {
    const v = Math.round(N(n)); const neg = v < 0; let s = String(Math.abs(v));
    if (s.length > 3) s = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);
    return (neg ? "-" : "") + "₹" + s;
  };
  const money = (n) => { const v = N(n), a = Math.abs(v); if (a >= 1e7) return "₹" + (v / 1e7).toFixed(2) + " Cr"; if (a >= 1e5) return "₹" + (v / 1e5).toFixed(2) + " L"; return inr(v); };
  const dmy = (iso) => (iso ? String(iso).split("-").reverse().join("-") : "");
  const UC = {
    UC1: { title: "Overdue receivables", intro: "Customers with bills past their due date. Approving a reminder sends it to your registered email and WhatsApp number." },
    UC2: { title: "Credit limit control", intro: "Customers close to or above their credit limit, and large balances with no limit set. Approval records a credit review; the Tally limit update is not posted in this workshop." },
    UC3: { title: "Sales to overdue customers", intro: "New sales raised for customers who still have long overdue bills. Decide whether to hold further credit." },
    UC4: { title: "Duplicate invoices and payments", intro: "Same party, same amount, raised within a short window. Check the documents first; the reversal is recorded here, not posted to Tally." },
    UC5: { title: "Early and late supplier payments", intro: "Supplier bills paid before their due date, and late-payment interest exposure, with the timing decision and due-date alerts." },
  };
  const ACTION_NAMES = { reminder: "Payment reminder", credit_review: "Credit review", credit_hold: "Credit hold decision", internal_check: "Internal check", reversal: "Reversal entry", payment_timing: "Payment timing decision", penalty_flag: "Penalty flag" };
  const SEV_COLORS = { critical: "#7a0f0f", high: "#b42318", medium: "#9a5b00", low: "#3b4a66" };

  const readApprovals = () => { try { return JSON.parse(localStorage.getItem(APPROVAL_KEY) || "{}"); } catch (_) { return {}; } };
  const saveApprovals = () => { try { localStorage.setItem(APPROVAL_KEY, JSON.stringify(approvals)); } catch (_) {} };
  const signOut = () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(APPROVAL_KEY); } catch (_) {} window.location.href = "index.html"; };
  const pill = (sev) => `<span class="pill sev-${esc(sev)}">${esc(sev)}</span>`;

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut(); throw new Error("session"); }
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- charts (plain SVG, no library)
  function bars(items, { h = 180, fmt = money, color = "#0E6B66" } = {}) {
    if (!items.length) return '<div class="empty">No data</div>';
    const W = 640, pad = { l: 8, r: 8, t: 18, b: 40 }, max = Math.max(...items.map((i) => N(i.value)), 1);
    const bw = (W - pad.l - pad.r) / items.length;
    let s = `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="bar chart">`;
    items.forEach((it, i) => {
      const bh = (h - pad.t - pad.b) * N(it.value) / max, x = pad.l + i * bw + bw * 0.15, y = h - pad.b - bh;
      s += `<rect x="${x}" y="${y}" width="${bw * 0.7}" height="${Math.max(bh, 0)}" rx="3" style="fill:${it.color || color}"><title>${esc(it.label)}: ${esc(fmt(it.value))}</title></rect>`;
      s += `<text x="${x + bw * 0.35}" y="${Math.max(y - 4, 11)}" text-anchor="middle">${esc(fmt(it.value))}</text>`;
      s += `<text x="${x + bw * 0.35}" y="${h - pad.b + 14}" text-anchor="middle">${esc(String(it.label).slice(0, 14))}</text>`;
    });
    return s + "</svg>";
  }
  function lines(series, { h = 200 } = {}) {
    const pts = series[0].values; if (!pts.length) return '<div class="empty">No data</div>';
    const W = 640, pad = { l: 8, r: 8, t: 14, b: 26 };
    const max = Math.max(...series.flatMap((s) => s.values.map((v) => N(v.y))), 1);
    const x = (i) => pad.l + (W - pad.l - pad.r) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
    const y = (v) => h - pad.b - (h - pad.t - pad.b) * N(v) / max;
    let s = `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="trend chart">`;
    series.forEach((se) => { s += `<path d="${se.values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("")}" fill="none" style="stroke:${se.color}" stroke-width="2"/>`; });
    const step = Math.ceil(pts.length / 6);
    pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) s += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${esc(p.x)}</text>`; });
    return s + `<text x="${W - pad.r}" y="${pad.t - 3}" text-anchor="end">peak ${esc(money(max))}</text></svg>`;
  }
  function hbars(items) {
    if (!items.length) return '<div class="empty">No data</div>';
    const max = Math.max(...items.map((i) => N(i.value)), 1);
    return `<div class="hb">` + items.map((i) => `<div class="hb-row"><span title="${esc(i.label)}">${esc(i.label)}</span><span class="hb-bar"><i style="width:${(N(i.value) / max * 100).toFixed(1)}%"></i></span><span class="num">${esc(money(i.value))}</span></div>`).join("") + `</div>`;
  }
  const legend = (items) => `<div class="legend">` + items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join("") + `</div>`;

  // ---------- overview
  function overview() {
    const s = state.summary, m = state.metrics, counts = state.countsByUseCase;
    const approved = state.findings.filter((f) => approvals[f.finding_id || f.id]?.status && ["sent", "recorded"].includes(approvals[f.id]?.status));
    const actioned = approved.reduce((t, f) => t + N(f.amount), 0);
    const sent = Object.values(approvals).filter((a) => a.status === "sent").length;
    const kpis = [
      ["Receivables (customers)", money(s.receivable)],
      ["Payables (suppliers)", money(s.payable)],
      ["Receivable days (DSO)", m.dso == null ? "-" : m.dso + " days"],
      ["Payable days (DPO)", m.dpo == null ? "-" : m.dpo + " days"],
      ["Customers with overdue bills", s.customersOpen],
      ["Value at stake across all findings", money(m.identified)],
      ["Value actioned (approved here)", money(actioned)],
      ["Reminders sent to you", sent],
    ].map(([l, v]) => `<div class="kpi"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div></div>`).join("");
    const aging = (rows) => bars(rows.map((r) => ({ label: r.label, value: r.value })), { h: 170 });
    const ucRows = Object.keys(UC).map((k) => `<tr><td><button class="btn ghost small" data-goto="${k}" type="button">${esc(k)}</button></td><td>${esc(UC[k].title)}</td><td class="num">${counts[k] || 0}</td><td class="num">${money((m.byUseCase.find((u) => u.label === k) || {}).value || 0)}</td></tr>`).join("");
    const trend = legend([{ label: "Sales", color: "#0E6B66" }, { label: "Customer receipts", color: "var(--ok)" }]) +
      lines([{ values: m.trend.sales.map((v) => ({ x: v.x, y: v.y })), color: "#0E6B66" }, { values: m.trend.receipts.map((v) => ({ x: v.x, y: v.y })), color: "#1F7A4A" }]);
    const trendP = legend([{ label: "Purchases", color: "#0E6B66" }, { label: "Supplier payments", color: "#9a5b00" }]) +
      lines([{ values: m.trend.purchases.map((v) => ({ x: v.x, y: v.y })), color: "#0E6B66" }, { values: m.trend.payments.map((v) => ({ x: v.x, y: v.y })), color: "#9a5b00" }]);
    return `
      <section class="grid kpis">${kpis}</section>
      <section class="grid two">
        <div class="panel"><h2>Monthly sales and receipts</h2><p class="uc-intro">Last 12 months, from the Tally vouchers.</p>${trend}</div>
        <div class="panel"><h2>Monthly purchases and payments</h2><p class="uc-intro">Last 12 months, from the Tally vouchers.</p>${trendP}</div>
      </section>
      <section class="grid two">
        <div class="panel"><h2>Receivable aging</h2><p class="uc-intro">Outstanding customer bills by days overdue.</p>${aging(m.agingReceivable)}</div>
        <div class="panel"><h2>Payable aging</h2><p class="uc-intro">Outstanding supplier bills by days overdue.</p>${aging(m.agingPayable)}</div>
      </section>
      <section class="grid two">
        <div class="panel"><h2>Value identified by use case</h2><p class="uc-intro">Amount at stake in each use case.</p>${bars(m.byUseCase.map((u) => ({ label: u.label + " (" + u.count + ")", value: u.value })), { h: 170 })}</div>
        <div class="panel"><h2>Largest overdue customers</h2><p class="uc-intro">Outstanding receivable per customer.</p>${hbars(m.topCustomers)}</div>
      </section>
      <section class="panel"><h2>Use cases</h2><p class="uc-intro">The five use cases run on the sample company's Tally data. Open a use case for its findings, or the Action Hub to approve actions.</p>
        <div class="scroll"><table><thead><tr><th>Code</th><th>Use case</th><th class="num">Findings</th><th class="num">Value</th></tr></thead><tbody>${ucRows}</tbody></table></div></section>
      <p class="note">${esc(m.note)}</p>`;
  }

  function evidenceTable(rows) {
    if (!rows || !rows.length) return '<p class="muted">No rows.</p>';
    const cols = Object.keys(rows[0]);
    return `<div class="scroll"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function useCase(uc) {
    const rows = state.findings.filter((f) => f.uc === uc);
    const meta = UC[uc];
    const body = rows.length ? `<div class="scroll"><table><thead><tr><th>Severity</th><th>Party</th><th class="num">Amount</th><th>Finding</th><th>Action</th></tr></thead><tbody>
      ${rows.map((f) => `<tr>
        <td>${pill(f.severity)}</td>
        <td>${esc(f.party)}</td>
        <td class="num">${inr(f.amount)}</td>
        <td>${esc(f.title)}<div class="muted">${esc(f.why)}</div></td>
        <td>${esc(ACTION_NAMES[f.action.kind] || f.action.label)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">No findings for this use case in the sample data.</p>`;
    return `<section class="panel"><h2>${esc(uc)} - ${esc(meta.title)}</h2><p class="uc-intro">${esc(meta.intro)}</p>${body}</section>`;
  }

  function statusText(a) {
    if (!a) return `<span class="status-pending">Pending approval</span>`;
    if (a.status === "rejected") return `<span class="status-rejected">Rejected</span>`;
    if (a.status === "failed") return `<span class="status-failed">Not sent: ${esc(a.detail)}</span>`;
    return `<span class="status-done">${esc(a.detail)}</span>`;
  }

  // what the approval does, in plain words
  function previewBlock(f) {
    const p = f.preview || {};
    const what = (p.what || []).map((t) => `<li>${esc(t)}</li>`).join("");
    const effects = (p.effects || []).map((t) => `<li>${esc(t)}</li>`).join("");
    const msg = p.message ? `
      <div class="dsec"><h3>Message you will receive</h3>
        <div class="msg"><b>Email subject:</b> ${esc(p.message.subject)}</div>
        <pre class="msg-body">${esc(p.message.text)}</pre>
        <div class="msg"><b>WhatsApp template (Payment reminder):</b></div>
        <pre class="msg-body">${esc(p.message.whatsapp[0])}</pre>
        <ul class="dlist">${p.message.whatsapp.slice(1).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>` : "";
    const evid = p.evidence ? `<div class="dsec"><h3>${esc(p.evidenceTitle || "Evidence")}</h3>${evidenceTable(p.evidence)}</div>` : "";
    const alerts = p.alerts ? `<div class="dsec"><h3>Due-date alerts (next 15 days)</h3>${p.alerts.length ? evidenceTable(p.alerts) : '<p class="muted">No open bills fall due in the next 15 days.</p>'}</div>` : "";
    const decision = p.decision ? `<div class="dsec"><h3>Decision for the finance head</h3><p><b>${esc(p.decision.question)}</b></p></div>` : "";
    return `<div class="dsec"><h3>What this will do</h3><ul class="dlist">${what}</ul></div>
      <div class="dsec"><h3>What happens next</h3><ul class="dlist">${effects}</ul></div>
      ${evid}${alerts}${msg}${decision}`;
  }

  function hub() {
    const rows = state.findings.map((f) => {
      const a = approvals[f.id];
      const done = a && a.status !== "failed";
      const p = f.preview || {};
      const isReminder = f.action.kind === "reminder";
      const needsEvidence = !!p.evidenceCheck;
      const evOk = !!evidenceOk[f.id];
      const gate = needsEvidence && !evOk && !done;
      const open = openDetails.has(f.id);
      const channels = isReminder ? `<div class="checks">
            <label><input type="checkbox" data-ch="email" data-id="${esc(f.id)}" checked> Email</label>
            <label><input type="checkbox" data-ch="whatsapp" data-id="${esc(f.id)}" checked> WhatsApp</label></div>` : "";
      const evBox = needsEvidence && !done ? `<label class="evcheck"><input type="checkbox" data-evidence="${esc(f.id)}" ${evOk ? "checked" : ""}> ${esc(p.evidenceCheck)}</label>` : "";
      const approveLabel = isReminder ? "Approve and send" : (p.decision ? p.decision.approve : "Approve");
      const rejectLabel = p.decision ? p.decision.reject : "Reject";
      return `<div class="hub-row" data-row="${esc(f.id)}">
        <div class="hub-head">
          <div class="hub-main">
            <div class="hub-title"><span class="uc-tag">${esc(f.uc)}</span> <b>${esc(f.party)}</b> <span class="muted">${esc(ACTION_NAMES[f.action.kind] || f.action.label)}</span></div>
            <div class="muted">${esc(f.title)}</div>
            <div class="res" id="res-${esc(f.id)}">${statusText(a)}</div>
          </div>
          <div class="hub-amt num">${inr(f.amount)}</div>
          <div class="hub-btns"><button class="btn ghost small" data-toggle="${esc(f.id)}" type="button">${open ? "Hide details" : "View details"}</button></div>
        </div>
        ${open ? `<div class="hub-detail">
          ${previewBlock(f)}
          <div class="dsec"><h3>Your approval</h3>
            ${channels}${evBox}
            <div class="actions">
              <button class="btn primary small" data-approve="${esc(f.id)}" type="button" ${done || gate ? "disabled" : ""}>${esc(approveLabel)}</button>
              <button class="btn ghost small" data-reject="${esc(f.id)}" type="button" ${done ? "disabled" : ""}>${esc(rejectLabel)}</button>
            </div>
            ${gate ? `<p class="muted">Tick the evidence check above to enable approval.</p>` : ""}
          </div></div>` : ""}
      </div>`;
    }).join("");
    return `<section class="panel"><h2>Action Hub</h2>
      <p class="uc-intro">Open an item to see exactly what approving it will do. Approved payment reminders are sent to the email address and WhatsApp number you registered with. Other approvals are recorded here; Tally is not connected in this workshop.</p>
      <div class="hub-list">${rows}</div></section>`;
  }

  function mis() {
    return `<section class="panel"><h2>MIS report</h2>
      <p class="uc-intro">Choose the format. The report is emailed to ${esc(state.participant.email)} only. It is not sent by WhatsApp.</p>
      <div class="radio-row" role="radiogroup" aria-label="Report format">
        <label><input type="radio" name="fmt" value="xlsx"> Excel (.xlsx)</label>
        <label><input type="radio" name="fmt" value="pdf"> PDF (.pdf)</label>
        <label><input type="radio" name="fmt" value="both" checked> Both Excel and PDF</label>
      </div>
      <div class="actions"><button id="mis-send" class="btn primary small" type="button">Email the report</button></div>
      <div id="mis-result" class="result"></div></section>`;
  }

  function render(tab) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "overview") view.innerHTML = overview();
    else if (tab === "hub") view.innerHTML = hub();
    else if (tab === "mis") view.innerHTML = mis();
    else view.innerHTML = useCase(tab);
    window.scrollTo({ top: 0 });
    location.hash = tab;
  }

  async function approve(id, rejectOnly) {
    const f = state.findings.find((x) => x.id === id);
    if (!f) return;
    if (rejectOnly) { approvals[id] = { status: "rejected", detail: "Rejected", at: Date.now() }; saveApprovals(); return render("hub"); }
    if (f.action.kind !== "reminder") {
      const p = f.preview || {};
      const decision = p.decision ? ` Decision recorded: "${p.decision.approve}".` : "";
      approvals[id] = { status: "recorded", detail: "Approved and recorded in the Action Hub." + decision + (f.action.tallyEntry || p.effects ? " Tally entry not posted: Tally is not connected." : ""), at: Date.now() };
      saveApprovals(); return render("hub");
    }
    const checks = [...document.querySelectorAll(`input[data-ch][data-id="${CSS.escape(id)}"]`)].filter((c) => c.checked).map((c) => c.dataset.ch);
    if (!checks.length) { document.getElementById("res-" + id).innerHTML = `<span class="status-failed">Choose at least one channel.</span>`; return; }
    const btn = document.querySelector(`button[data-approve="${CSS.escape(id)}"]`);
    if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
    try {
      const { ok, data } = await api("api/send-reminder", { method: "POST", body: JSON.stringify({ findingId: id, channels: checks }) });
      if (!ok && !data.results) {
        approvals[id] = { status: "failed", detail: data.error || "The reminder could not be sent.", at: Date.now() };
      } else {
        const label = (c) => (c === "email" ? "Email" : "WhatsApp");
        const parts = data.results.map((r) => (r.ok ? `${label(r.channel)}: ${r.detail}` : `${label(r.channel)} not sent: ${r.detail}`));
        approvals[id] = { status: data.results.every((r) => r.ok) ? "sent" : "failed", detail: parts.join(" | "), at: Date.now() };
      }
    } catch (e) {
      if (e.message !== "session") approvals[id] = { status: "failed", detail: "Network problem. Please try again.", at: Date.now() };
    }
    saveApprovals(); render("hub");
  }

  async function sendMis() {
    const fmt = document.querySelector('input[name="fmt"]:checked')?.value;
    const out = document.getElementById("mis-result"), btn = document.getElementById("mis-send");
    btn.disabled = true; out.textContent = "Building the report and sending the email...";
    try {
      const { ok, data } = await api("api/mis", { method: "POST", body: JSON.stringify({ format: fmt }) });
      out.innerHTML = ok ? `<span class="status-done">Sent to ${esc(data.to)}: ${data.files.map(esc).join(", ")}</span>`
                         : `<span class="status-failed">${esc(data.error || "The report could not be sent.")}</span>`;
    } catch (e) { if (e.message !== "session") out.innerHTML = `<span class="status-failed">Network problem. Please try again.</span>`; }
    finally { btn.disabled = false; }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) return render(t.dataset.tab);
    if (t.dataset.goto) return render(t.dataset.goto);
    if (t.dataset.toggle) { const id = t.dataset.toggle; openDetails.has(id) ? openDetails.delete(id) : openDetails.add(id); return render("hub"); }
    if (t.dataset.approve) return approve(t.dataset.approve, false);
    if (t.dataset.reject) return approve(t.dataset.reject, true);
    if (t.id === "mis-send") return sendMis();
    if (t.id === "signout") return signOut();
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.evidence) { evidenceOk[t.dataset.evidence] = t.checked; render("hub"); }
  });

  async function start() {
    try { token = localStorage.getItem(TOKEN_KEY); } catch (_) { token = null; }
    if (!token) { window.location.href = "index.html"; return; }
    approvals = readApprovals();
    try {
      const { ok, data } = await api("api/analysis");
      if (!ok) throw new Error(data.error || "load failed");
      state = data;
    } catch (e) {
      if (e.message !== "session") view.innerHTML = `<section class="panel"><p class="status-failed">The sample analysis could not be loaded. Please reload the page.</p></section>`;
      return;
    }
    document.getElementById("company").textContent = state.company + " | as of " + dmy(state.asOf);
    document.getElementById("who").textContent = state.participant.name + " | " + state.participant.email + " | " + state.participant.phone;
    document.getElementById("notice").textContent = state.notice;
    const h = (location.hash || "#overview").slice(1);
    render(UC[h] || h === "hub" || h === "mis" ? h : "overview");
  }
  start();
})();
