// Workshop desktop: overview, five use cases, Action Hub and MIS. All text is escaped before it is rendered.
(function () {
  const TOKEN_KEY = "flowiq_token";
  const APPROVAL_KEY = "flowiq_approvals";
  const view = document.getElementById("view");
  let token = null;
  let state = null; // { company, asOf, summary, findings, countsByUseCase, participant, notice }
  let approvals = {}; // findingId -> { status, detail, at }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => {
    const v = Math.round(Number(n) || 0);
    const neg = v < 0;
    let s = String(Math.abs(v));
    if (s.length > 3) s = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);
    return (neg ? "-" : "") + "\u20B9" + s;
  };
  const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");
  const UC = {
    UC1: { title: "Overdue receivables", intro: "Customers with bills past their due date. Approving a reminder sends it to your registered email and WhatsApp number." },
    UC2: { title: "Credit limit control", intro: "Customers close to or above their credit limit, and large balances with no limit set. Approval records a credit review; the Tally limit update is not posted in this workshop." },
    UC3: { title: "Sales to overdue customers", intro: "New sales raised for customers who still have long overdue bills. Decide whether to hold further credit." },
    UC4: { title: "Duplicate invoices and payments", intro: "Same party, same amount, raised within a short window. Check the documents; the reversal is recorded here, not posted to Tally." },
    UC5: { title: "Early and late supplier payments", intro: "Supplier bills paid before their due date, and late-payment interest exposure, with the timing decision for each." },
  };
  const ACTION_NAMES = { reminder: "Payment reminder", credit_review: "Credit review", internal_check: "Internal check", reversal: "Reversal entry", credit_hold: "Credit hold decision", payment_timing: "Payment timing decision", penalty_flag: "Penalty flag" };

  const readApprovals = () => { try { return JSON.parse(localStorage.getItem(APPROVAL_KEY) || "{}"); } catch (_) { return {}; } };
  const saveApprovals = () => { try { localStorage.setItem(APPROVAL_KEY, JSON.stringify(approvals)); } catch (_) { /* memory only */ } };
  const signOut = () => { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(APPROVAL_KEY); } catch (_) {} window.location.href = "index.html"; };
  const pill = (sev) => `<span class="pill sev-${esc(sev)}">${esc(sev)}</span>`;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut(); throw new Error("session"); }
    return { ok: res.ok, status: res.status, data };
  }

  function overview() {
    const s = state.summary;
    const counts = state.countsByUseCase;
    const cards = [
      ["Receivables (customers)", inr(s.receivable)],
      ["Payables (suppliers)", inr(s.payable)],
      ["Customers with overdue bills", s.customersOpen],
      ["Findings in the Action Hub", state.findings.length],
    ].map(([l, v]) => `<div class="kpi"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div></div>`).join("");
    const rows = Object.keys(UC).map((k) => `<tr><td><button class="btn ghost small" data-goto="${k}" type="button">${esc(k)}</button></td><td>${esc(UC[k].title)}</td><td class="num">${counts[k] || 0}</td></tr>`).join("");
    return `<section class="grid">${cards}</section>
      <section class="panel"><h2>Use cases</h2><p class="uc-intro">The five use cases run on the sample company's Tally data. Open a use case for its findings, or go to the Action Hub to approve actions.</p>
      <div class="scroll"><table><thead><tr><th>Code</th><th>Use case</th><th class="num">Findings</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  function useCase(uc) {
    const rows = state.findings.filter((f) => f.uc === uc);
    const meta = UC[uc];
    const body = rows.length ? `<div class="scroll"><table><thead><tr><th>Severity</th><th>Party</th><th class="num">Amount</th><th>Finding</th><th>Action</th></tr></thead><tbody>
      ${rows.map((f) => `<tr>
        <td>${pill(f.severity)}</td>
        <td>${esc(f.party)}</td>
        <td class="num">${inr(f.amount)}</td>
        <td>${esc(f.title)}<div class="muted">${esc(f.why)}</div>
          <details><summary>Evidence</summary>${evidenceTable(f)}</details></td>
        <td>${esc(ACTION_NAMES[f.action.kind] || f.action.label)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="muted">No findings for this use case in the sample data.</p>`;
    return `<section class="panel"><h2>${esc(uc)} - ${esc(meta.title)}</h2><p class="uc-intro">${esc(meta.intro)}</p>${body}</section>`;
  }

  function evidenceTable(f) {
    const ev = f.evidence || [];
    if (!ev.length) return "";
    const cols = Object.keys(ev[0]);
    const head = cols.map((c) => `<th>${esc(c.replace(/([A-Z])/g, " $1").toLowerCase())}</th>`).join("");
    const body = ev.map((r) => `<tr>${cols.map((c) => {
      const v = r[c];
      const isMoney = /outstanding|amount|limit/i.test(c) && typeof v === "number";
      return `<td class="${isMoney ? "num" : ""}">${esc(isMoney ? inr(v) : (/date$/i.test(c) ? dmy(v) : v))}</td>`;
    }).join("")}</tr>`).join("");
    return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function statusText(a) {
    if (!a) return `<span class="status-pending">Pending approval</span>`;
    if (a.status === "rejected") return `<span class="status-rejected">Rejected</span>`;
    if (a.status === "failed") return `<span class="status-failed">Not sent: ${esc(a.detail)}</span>`;
    return `<span class="status-done">${esc(a.detail)}</span>`;
  }

  function hub() {
    const rows = state.findings.map((f) => {
      const a = approvals[f.id];
      const done = a && a.status !== "failed";
      let controls;
      if (f.action.kind === "reminder") {
        controls = `<div class="checks actions">
            <label><input type="checkbox" data-ch="email" data-id="${esc(f.id)}" checked> Email</label>
            <label><input type="checkbox" data-ch="whatsapp" data-id="${esc(f.id)}" checked> WhatsApp</label>
          </div>
          <div class="actions" style="margin-top:6px">
            <button class="btn primary small" data-approve="${esc(f.id)}" type="button" ${done ? "disabled" : ""}>Approve and send</button>
            <button class="btn ghost small" data-reject="${esc(f.id)}" type="button" ${done ? "disabled" : ""}>Reject</button>
          </div>`;
      } else {
        controls = `<div class="actions">
            <button class="btn primary small" data-approve="${esc(f.id)}" type="button" ${done ? "disabled" : ""}>Approve</button>
            <button class="btn ghost small" data-reject="${esc(f.id)}" type="button" ${done ? "disabled" : ""}>Reject</button>
          </div>`;
      }
      return `<tr>
        <td>${esc(f.uc)}</td>
        <td>${esc(f.party)}<div class="muted">${esc(f.title)}</div></td>
        <td class="num">${inr(f.amount)}</td>
        <td>${esc(ACTION_NAMES[f.action.kind] || f.action.label)}${f.action.tallyEntry ? `<div class="muted">Tally entry: ${esc(f.action.tallyEntry)} (not posted)</div>` : ""}</td>
        <td>${controls}<div class="result" id="res-${esc(f.id)}">${statusText(a)}</div></td>
      </tr>`;
    }).join("");
    return `<section class="panel"><h2>Action Hub</h2>
      <p class="uc-intro">Every action waits for your approval. Approved payment reminders are sent to the email address and WhatsApp number you registered with. Other approvals are recorded here; Tally is not connected in this workshop.</p>
      <div class="scroll"><table><thead><tr><th>Use case</th><th>Party and finding</th><th class="num">Amount</th><th>Action</th><th>Approval</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
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
    if (rejectOnly) {
      approvals[id] = { status: "rejected", detail: "Rejected", at: Date.now() };
      saveApprovals(); render("hub"); return;
    }
    if (f.action.kind !== "reminder") {
      approvals[id] = { status: "recorded", detail: `Approved and recorded in the Action Hub${f.action.tallyEntry ? ". Tally entry not posted: Tally is not connected" : ""}`, at: Date.now() };
      saveApprovals(); render("hub"); return;
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
        const parts = data.results.map((r) => (r.ok ? `${r.channel === "email" ? "Email" : "WhatsApp"}: ${r.detail}` : `${r.channel === "email" ? "Email" : "WhatsApp"} not sent: ${r.detail}`));
        const allOk = data.results.every((r) => r.ok);
        approvals[id] = { status: allOk ? "sent" : "failed", detail: parts.join(" | "), at: Date.now() };
      }
    } catch (e) {
      if (e.message !== "session") approvals[id] = { status: "failed", detail: "Network problem. Please try again.", at: Date.now() };
    }
    saveApprovals();
    render("hub");
  }

  async function sendMis() {
    const fmt = document.querySelector('input[name="fmt"]:checked')?.value;
    const out = document.getElementById("mis-result");
    const btn = document.getElementById("mis-send");
    btn.disabled = true; out.textContent = "Building the report and sending the email...";
    try {
      const { ok, data } = await api("api/mis", { method: "POST", body: JSON.stringify({ format: fmt }) });
      out.innerHTML = ok
        ? `<span class="status-done">Sent to ${esc(data.to)}: ${data.files.map(esc).join(", ")}</span>`
        : `<span class="status-failed">${esc(data.error || "The report could not be sent.")}</span>`;
    } catch (e) {
      if (e.message !== "session") out.innerHTML = `<span class="status-failed">Network problem. Please try again.</span>`;
    } finally { btn.disabled = false; }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.tab) return render(t.dataset.tab);
    if (t.dataset.goto) return render(t.dataset.goto);
    if (t.dataset.approve) return approve(t.dataset.approve, false);
    if (t.dataset.reject) return approve(t.dataset.reject, true);
    if (t.id === "mis-send") return sendMis();
    if (t.id === "signout") return signOut();
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
    const initial = (location.hash || "#overview").slice(1);
    render(UC[initial] || initial === "hub" || initial === "mis" ? initial : "overview");
  }
  start();
})();
