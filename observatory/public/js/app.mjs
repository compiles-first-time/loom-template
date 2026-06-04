import { SSEClient } from "./components/sse-client.mjs";
import { setState, applyDelta, subscribe, getState } from "./state.mjs";

const main = document.getElementById("main-content");
const nav = document.getElementById("nav");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

let activePanel = "overview";

// ─── Theme toggle ────────────────────────────────────────────
function getStoredTheme() {
  try { return localStorage.getItem("loom-observatory-theme"); } catch { return null; }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☽" : "☀";
  try { localStorage.setItem("loom-observatory-theme", theme); } catch { /* private browsing */ }
}

applyTheme(getStoredTheme() || document.documentElement.getAttribute("data-theme") || "dark");

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

const sse = new SSEClient("/api/events/stream", {
  onInit(data) {
    setState(data);
    renderPanel(activePanel);
  },
  onDelta(data) {
    applyDelta(data);
    renderPanel(activePanel);
  },
  onFileChanged() {
    renderPanel(activePanel);
  },
  onConnect() {
    statusDot.classList.add("connected");
    statusText.textContent = "live";
  },
  onDisconnect() {
    statusDot.classList.remove("connected");
    statusText.textContent = "reconnecting...";
  },
});

sse.connect();

nav.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-panel]");
  if (!btn) return;
  nav.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activePanel = btn.dataset.panel;
  renderPanel(activePanel);
});

function renderPanel(name) {
  const state = getState();
  if (!state) {
    main.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#8987;</div><div class="empty-state-text">Waiting for data...</div></div>`;
    return;
  }

  const renderer = PANELS[name];
  if (renderer) {
    main.innerHTML = renderer(state);
  } else {
    main.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#128736;</div><div class="empty-state-text">${name} panel ships in a later PR.</div></div>`;
  }
}

const PANELS = {

  // ─── Overview ───────────────────────────────────────────────
  overview(s) {
    const totalToolCalls = s.sessions.history.reduce((n, h) => n + (h.tool_calls || 0), 0)
      + s.sessions.active.reduce((n, a) => n + (a.tool_calls || 0), 0);
    const totalErrors = s.failures.errors.length;
    const errorRate = totalToolCalls > 0 ? ((totalErrors / totalToolCalls) * 100).toFixed(1) : "0.0";
    const activeSessions = s.sessions.active.length;
    const activeAgents = s.agents.specialists.spawned.length;
    const totalSpecialists = s.agents.specialists.spawned.length + s.agents.specialists.available.length;
    const lastDeploy = s.deploys.history.length > 0
      ? s.deploys.history[s.deploys.history.length - 1]
      : null;
    const deployState = lastDeploy ? lastDeploy.state || "unknown" : "none";
    const deployBadge = deployState === "succeeded" ? "badge-success"
      : deployState === "failed" ? "badge-danger"
      : deployState === "non_progressing" ? "badge-warning"
      : "badge-muted";
    const pendingBus = s.update_bus.inbox.length;
    const constitutionFails = s.compliance.constitution_checks.length;
    const destructiveOps = s.compliance.destructive_ops.length;
    const inputTokens = s.cost.cumulative.input_tokens;
    const outputTokens = s.cost.cumulative.output_tokens;
    const tokenStr = formatTokens(inputTokens + outputTokens);

    return `
      <div class="panel-title">Overview</div>
      <div class="card-grid">
        <div class="card">
          <div class="card-label">Active Sessions</div>
          <div class="card-value">${activeSessions}</div>
          <div class="card-sub">${s.sessions.history.length} total</div>
        </div>
        <div class="card">
          <div class="card-label">Specialists Active</div>
          <div class="card-value">${activeAgents}</div>
          <div class="card-sub">${totalSpecialists} total in registry</div>
        </div>
        <div class="card">
          <div class="card-label">Token Spend</div>
          <div class="card-value">${tokenStr}</div>
          <div class="card-sub">${formatTokens(inputTokens)} in / ${formatTokens(outputTokens)} out</div>
        </div>
        <div class="card">
          <div class="card-label">Error Rate</div>
          <div class="card-value">${errorRate}%</div>
          <div class="card-sub">${totalErrors} errors / ${totalToolCalls} tool calls</div>
        </div>
        <div class="card">
          <div class="card-label">Last Deploy</div>
          <div class="card-value"><span class="badge ${deployBadge}">${deployState}</span></div>
          <div class="card-sub">${lastDeploy ? lastDeploy.platform || "" : "no deploys"}</div>
        </div>
        <div class="card">
          <div class="card-label">Update Bus</div>
          <div class="card-value">${pendingBus}</div>
          <div class="card-sub">pending proposals</div>
        </div>
        <div class="card">
          <div class="card-label">Compliance</div>
          <div class="card-value">${constitutionFails}</div>
          <div class="card-sub">constitution check failures</div>
        </div>
        <div class="card">
          <div class="card-label">Destructive Ops</div>
          <div class="card-value">${destructiveOps}</div>
          <div class="card-sub">${s.compliance.redaction_hits} redaction hits</div>
        </div>
      </div>

      ${s.sessions.active.length > 0 ? `
        <div class="panel-title" style="margin-top:2rem">Active Sessions</div>
        <table class="data-table">
          <thead><tr><th>Session</th><th>Started</th><th>Tool Calls</th><th>Last Tool</th></tr></thead>
          <tbody>
            ${s.sessions.active.map((a) => `
              <tr>
                <td><code>${truncate(a.session_id, 20)}</code></td>
                <td>${formatTime(a.started_at)}</td>
                <td>${a.tool_calls || 0}</td>
                <td>${a.last_tool || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      ${s.failures.errors.length > 0 ? `
        <div class="panel-title" style="margin-top:2rem">Recent Errors</div>
        <table class="data-table">
          <thead><tr><th>Time</th><th>Tool</th><th>Exit</th><th>Signature</th></tr></thead>
          <tbody>
            ${s.failures.errors.slice(-10).reverse().map((e) => `
              <tr>
                <td>${formatTime(e.timestamp)}</td>
                <td>${e.tool || "-"}</td>
                <td><span class="badge badge-danger">${e.exit_code}</span></td>
                <td><code>${e.error_signature || "-"}</code></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
    `;
  },

  // ─── Agents ─────────────────────────────────────────────────
  agents(s) {
    const base = ["hr", "eac", "human-replica", "critic", "memory-keeper", "constitution-service"];
    const spawned = s.agents.specialists.spawned;
    const retired = s.agents.specialists.retired;

    return `
      <div class="panel-title">Agents</div>

      <div style="margin-bottom:1.5rem">
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">BASE AGENTS (6)</h3>
        <div class="card-grid">
          ${base.map((name) => `
            <div class="card">
              <div class="card-label">${name}</div>
              <div class="card-sub"><span class="badge badge-info">base</span> always active</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="margin-bottom:1.5rem">
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">SPAWNED SPECIALISTS (${spawned.length})</h3>
        ${spawned.length > 0 ? `
          <table class="data-table">
            <thead><tr><th>Specialist</th><th>Work Item</th><th>Spawned</th></tr></thead>
            <tbody>
              ${spawned.map((sp) => `
                <tr>
                  <td><strong>${sp.name}</strong></td>
                  <td><code>${sp.work_item || "-"}</code></td>
                  <td>${formatTime(sp.spawned_at)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="empty-state"><div class="empty-state-text">No specialists spawned in this window. Use <code>specialist-lifecycle spawn</code> to instantiate.</div></div>`}
      </div>

      ${retired.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">RETIRED (${retired.length})</h3>
        <table class="data-table">
          <thead><tr><th>Specialist</th><th>Retired</th><th>Archive</th></tr></thead>
          <tbody>
            ${retired.map((r) => `
              <tr>
                <td>${r.name}</td>
                <td>${formatTime(r.retired_at)}</td>
                <td><code>${truncate(r.archived_path, 40)}</code></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
    `;
  },

  // ─── Tasks ──────────────────────────────────────────────────
  tasks(s) {
    const items = s.tasks.work_items;
    const ledger = s.tasks.ledger;

    if (items.length === 0 && ledger.length === 0) {
      return `
        <div class="panel-title">Tasks</div>
        <div class="empty-state">
          <div class="empty-state-icon">&#9654;</div>
          <div class="empty-state-text">No work graph generated yet. Run <code>scripts/discover.sh</code> to populate requirements, then <code>scripts/hr-work-graph.sh</code> to generate the work graph.</div>
        </div>
      `;
    }

    const statusBadge = (st) => {
      const map = { pending: "badge-muted", dispatched: "badge-info", in_progress: "badge-info", completed: "badge-success", reviewed: "badge-success", blocked: "badge-danger", cancelled: "badge-warning" };
      return `<span class="badge ${map[st] || "badge-muted"}">${st || "pending"}</span>`;
    };

    return `
      <div class="panel-title">Tasks</div>

      ${items.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">WORK ITEMS (${items.length})</h3>
        <table class="data-table">
          <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Specialists</th><th>Risks</th></tr></thead>
          <tbody>
            ${items.map((wi) => `
              <tr>
                <td><code>${wi.id}</code></td>
                <td>${truncate(wi.title, 50)}</td>
                <td>${statusBadge(wi.status)}</td>
                <td>${(wi.assigned_specialists || []).map((s) => `<span class="badge badge-info">${s}</span> `).join("")}</td>
                <td>${(wi.risks || []).join(", ") || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      ${ledger.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;margin-top:1.5rem">TASK LEDGER</h3>
        <table class="data-table">
          <thead><tr><th>Task</th><th>Agent</th><th>Status</th><th>Dependencies</th></tr></thead>
          <tbody>
            ${ledger.map((t) => `
              <tr>
                <td><code>${t.task_id}</code></td>
                <td>${t.agent_assigned || "-"}</td>
                <td>${statusBadge(t.status)}</td>
                <td>${(t.dependencies || []).map((d) => `<code>${d}</code>`).join(", ") || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
    `;
  },

  // ─── Cost ───────────────────────────────────────────────────
  cost(s) {
    const cum = s.cost.cumulative;
    const sessions = Object.entries(s.cost.by_session);

    return `
      <div class="panel-title">Cost</div>

      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-label">Total Input Tokens</div>
          <div class="card-value">${formatTokens(cum.input_tokens)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Output Tokens</div>
          <div class="card-value">${formatTokens(cum.output_tokens)}</div>
        </div>
        <div class="card">
          <div class="card-label">Estimated Cost</div>
          <div class="card-value">$${cum.estimated_usd.toFixed(2)}</div>
          <div class="card-sub">based on config.yaml rates</div>
        </div>
      </div>

      ${sessions.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">BY SESSION</h3>
        <table class="data-table">
          <thead><tr><th>Session</th><th>Input</th><th>Output</th><th>Loops</th></tr></thead>
          <tbody>
            ${sessions.map(([sid, data]) => `
              <tr>
                <td><code>${truncate(sid, 20)}</code></td>
                <td>${formatTokens(data.input_tokens)}</td>
                <td>${formatTokens(data.output_tokens)}</td>
                <td>${data.loops.length}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        ${sessions.flatMap(([, d]) => d.loops).length > 0 ? `
          <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;margin-top:1.5rem">LOOP DETAILS</h3>
          <table class="data-table">
            <thead><tr><th>Loop</th><th>Pattern</th><th>Iterations</th><th>Agents</th><th>Tokens</th><th>Wall Clock</th><th>Exit</th></tr></thead>
            <tbody>
              ${sessions.flatMap(([, d]) => d.loops).map((l) => `
                <tr>
                  <td><code>${truncate(l.loop_id, 15)}</code></td>
                  <td><span class="badge badge-info">${l.pattern || "custom"}</span></td>
                  <td>${l.iterations || "-"}</td>
                  <td>${l.agents || "-"}</td>
                  <td>${formatTokens((l.input_tokens || 0) + (l.output_tokens || 0))}</td>
                  <td>${l.wall_clock_ms ? (l.wall_clock_ms / 1000).toFixed(1) + "s" : "-"}</td>
                  <td>${l.exit_reason || "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}
      ` : `<div class="empty-state"><div class="empty-state-text">No loop_cost_summary events recorded yet. Cost tracking populates as iterative patterns (CRAG, self-RAG, fan-out) execute.</div></div>`}
    `;
  },

  // ─── Failures ───────────────────────────────────────────────
  failures(s) {
    const errors = s.failures.errors;
    const sigs = Object.entries(s.failures.error_signatures).sort((a, b) => b[1] - a[1]);
    const lessons = s.failures.lessons_drafts;

    return `
      <div class="panel-title">Failures</div>

      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-label">Total Errors</div>
          <div class="card-value">${errors.length}</div>
        </div>
        <div class="card">
          <div class="card-label">Unique Signatures</div>
          <div class="card-value">${sigs.length}</div>
        </div>
        <div class="card">
          <div class="card-label">Lessons Suggested</div>
          <div class="card-value">${lessons.reduce((n, l) => n + (l.suggested || 0), 0)}</div>
        </div>
      </div>

      ${sigs.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">ERROR SIGNATURES (by frequency)</h3>
        <table class="data-table">
          <thead><tr><th>Signature</th><th>Count</th></tr></thead>
          <tbody>
            ${sigs.map(([sig, count]) => `
              <tr>
                <td><code>${sig}</code></td>
                <td><span class="badge badge-danger">${count}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      ${errors.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;margin-top:1.5rem">ERROR TIMELINE</h3>
        <table class="data-table">
          <thead><tr><th>Time</th><th>Session</th><th>Tool</th><th>Exit</th><th>Signature</th><th>Preview</th></tr></thead>
          <tbody>
            ${errors.slice(-25).reverse().map((e) => `
              <tr>
                <td>${formatTime(e.timestamp)}</td>
                <td><code>${truncate(e.session_id, 12)}</code></td>
                <td>${e.tool || "-"}</td>
                <td><span class="badge badge-danger">${e.exit_code}</span></td>
                <td><code>${e.error_signature || "-"}</code></td>
                <td>${truncate(e.error_preview, 60)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-state"><div class="empty-state-icon">&#10003;</div><div class="empty-state-text">No errors recorded. Tool calls are completing successfully.</div></div>`}
    `;
  },

  // ─── Deploys ────────────────────────────────────────────────
  deploys(s) {
    const history = s.deploys.history;
    const active = s.deploys.active;

    const stateClass = (st) => {
      if (st === "succeeded") return "badge-success";
      if (st === "failed") return "badge-danger";
      if (st === "non_progressing") return "badge-warning";
      return "badge-muted";
    };

    return `
      <div class="panel-title">Deploys</div>

      ${active ? `
        <div class="card" style="border-color:var(--warning);margin-bottom:1.5rem">
          <div class="card-label">ACTIVE DEPLOY</div>
          <div class="card-value"><span class="badge badge-warning">in progress</span></div>
          <div class="card-sub">${active.platform || "unknown"} &mdash; started ${formatTime(active.started_at)}</div>
        </div>
      ` : ""}

      ${history.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">DEPLOY HISTORY (${history.length})</h3>
        <table class="data-table">
          <thead><tr><th>Time</th><th>Platform</th><th>State</th><th>Duration</th><th>Health</th><th>URL</th></tr></thead>
          <tbody>
            ${history.slice().reverse().map((d) => `
              <tr>
                <td>${formatTime(d.completed_at)}</td>
                <td>${d.platform || "-"}</td>
                <td><span class="badge ${stateClass(d.state)}">${d.state || "unknown"}</span></td>
                <td>${d.duration_ms ? (d.duration_ms / 1000).toFixed(1) + "s" : "-"}</td>
                <td>${d.health || "-"}</td>
                <td>${d.url ? `<code>${truncate(d.url, 30)}</code>` : "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        ${history.some((d) => d.state === "non_progressing") ? `
          <div class="card" style="border-color:var(--danger);margin-top:1rem">
            <div class="card-label" style="color:var(--danger)">NON-PROGRESSING DEPLOYS DETECTED</div>
            <div class="card-sub">One or more deploys exited without reaching a terminal state. The deploy command returned but the outcome was never confirmed. This is the most dangerous failure mode per ADR-0032 &mdash; investigate manually.</div>
          </div>
        ` : ""}
      ` : `<div class="empty-state"><div class="empty-state-icon">&#9730;</div><div class="empty-state-text">No deploys recorded. Deploy events appear when scripts/deploy.sh runs.</div></div>`}
    `;
  },

  // ─── Compliance ─────────────────────────────────────────────
  compliance(s) {
    const checks = s.compliance.constitution_checks;
    const destructive = s.compliance.destructive_ops;
    const redactionHits = s.compliance.redaction_hits;

    return `
      <div class="panel-title">Compliance</div>

      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="card" style="${checks.length > 0 ? "border-color:var(--danger)" : ""}">
          <div class="card-label">Constitution Violations</div>
          <div class="card-value">${checks.length}</div>
          <div class="card-sub">hard-enforcement actions without prior constitution-service claim</div>
        </div>
        <div class="card">
          <div class="card-label">Destructive Operations</div>
          <div class="card-value">${destructive.length}</div>
        </div>
        <div class="card">
          <div class="card-label">Redaction Hits</div>
          <div class="card-value">${redactionHits}</div>
          <div class="card-sub">OAuth preference hints triggered</div>
        </div>
      </div>

      ${checks.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">CONSTITUTION CHECK FAILURES</h3>
        <table class="data-table">
          <thead><tr><th>Time</th><th>Session</th><th>Tool</th><th>Category</th><th>Message</th></tr></thead>
          <tbody>
            ${checks.map((c) => `
              <tr>
                <td>${formatTime(c.timestamp)}</td>
                <td><code>${truncate(c.session_id, 12)}</code></td>
                <td>${c.tool || "-"}</td>
                <td><span class="badge badge-danger">${c.category || "-"}</span></td>
                <td>${truncate(c.message, 60)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      ${destructive.length > 0 ? `
        <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem;margin-top:1.5rem">DESTRUCTIVE OPERATIONS AUDIT</h3>
        <table class="data-table">
          <thead><tr><th>Time</th><th>Session</th><th>Tool</th><th>Pattern</th><th>Exit</th></tr></thead>
          <tbody>
            ${destructive.map((d) => `
              <tr>
                <td>${formatTime(d.timestamp)}</td>
                <td><code>${truncate(d.session_id, 12)}</code></td>
                <td>${d.tool || "-"}</td>
                <td><span class="badge badge-warning">${d.pattern}</span></td>
                <td>${d.exit_code ?? "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      ${checks.length === 0 && destructive.length === 0 ? `
        <div class="empty-state"><div class="empty-state-icon">&#9745;</div><div class="empty-state-text">Clean compliance record. No constitution violations or destructive operations in the replay window.</div></div>
      ` : ""}
    `;
  },

  // ─── Update Bus ─────────────────────────────────────────────
  "update-bus"(s) {
    const inbox = s.update_bus.inbox;

    const riskClass = (r) => r === "high" ? "badge-danger" : r === "medium" ? "badge-warning" : "badge-info";

    return `
      <div class="panel-title">Update Bus</div>

      ${inbox.length > 0 ? `
        <div style="display:grid;gap:1rem">
          ${inbox.map((item) => `
            <div class="card" style="${item.collapse_risk ? "border-color:var(--danger)" : ""}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.5rem">
                <div>
                  <strong>${item.id}</strong>
                  ${item.collapse_risk ? `<span class="badge badge-danger" style="margin-left:0.5rem">COLLAPSE RISK</span>` : ""}
                </div>
                <span class="badge ${riskClass(item.risk)}">${item.risk}</span>
              </div>
              <div class="card-sub">
                Source: <span class="badge badge-muted">${item.source}</span>
                &bull; Proposed by: ${item.proposed_by || "unknown"}
                &bull; ${item.date || ""}
              </div>
              ${item.affects ? `<div class="card-sub" style="margin-top:0.3rem">Affects: ${item.affects.map((a) => `<code>${a}</code>`).join(", ")}</div>` : ""}
              ${item.critic_review ? `
                <div class="card-sub" style="margin-top:0.5rem">
                  Critic: <span class="badge ${item.critic_review.verdict === "approve" ? "badge-success" : item.critic_review.verdict === "reject" ? "badge-danger" : "badge-warning"}">${item.critic_review.verdict}</span>
                  ${item.critic_review.reason ? ` &mdash; ${truncate(item.critic_review.reason, 80)}` : ""}
                </div>
              ` : ""}
              ${item.human_replica_recommendation ? `
                <div class="card-sub" style="margin-top:0.3rem">
                  Human Replica: <span class="badge ${item.human_replica_recommendation.verdict === "approve" ? "badge-success" : "badge-warning"}">${item.human_replica_recommendation.verdict}</span>
                  (confidence: ${(item.human_replica_recommendation.confidence * 100).toFixed(0)}%)
                </div>
              ` : ""}
              <div style="margin-top:0.75rem;display:flex;gap:0.5rem">
                <button onclick="postDecision('${item.id}','approve')" class="btn btn-accept">Accept</button>
                <button onclick="postDecision('${item.id}','reject')" class="btn btn-reject">Reject</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty-state"><div class="empty-state-icon">&#8634;</div><div class="empty-state-text">No pending proposals. The Update Bus populates when research feeds, project lessons, or internal audits generate improvement suggestions.</div></div>`}
    `;
  },

  // ─── Testing ────────────────────────────────────────────────
  testing(s) {
    return `
      <div class="panel-title">Testing</div>

      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-label">Eval Categories</div>
          <div class="card-value">6</div>
          <div class="card-sub">smoke, capability, drift, adversarial, retrieval, subagent</div>
        </div>
      </div>

      <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">EVAL SUITE STATUS</h3>
      <table class="data-table">
        <thead><tr><th>Category</th><th>Frequency</th><th>Gate</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Smoke</td><td>every commit</td><td>gates <code>loom run</code></td><td><span class="badge badge-muted">awaiting run</span></td></tr>
          <tr><td>Capability</td><td>nightly</td><td>advisory</td><td><span class="badge badge-muted">awaiting run</span></td></tr>
          <tr><td>Drift</td><td>weekly</td><td>primary drift signal</td><td><span class="badge badge-muted">awaiting run</span></td></tr>
          <tr><td>Adversarial</td><td>pre-release</td><td>blocks release</td><td><span class="badge badge-muted">awaiting run</span></td></tr>
          <tr><td>Retrieval</td><td>nightly</td><td>faithfulness threshold</td><td><span class="badge badge-muted">awaiting run</span></td></tr>
          <tr><td>Subagent</td><td>per release</td><td>human-graded</td><td><span class="badge badge-muted">awaiting run</span></td></tr>
        </tbody>
      </table>

      <div class="empty-state" style="margin-top:1.5rem">
        <div class="empty-state-text">Eval results populate when <code>scripts/eval-subagents.sh</code> runs. Results are stored in <code>observability/eval-suite/runs/</code>.</div>
      </div>
    `;
  },

  // ─── Systems ────────────────────────────────────────────────
  systems(s) {
    const toolCounts = {};
    const allErrors = s.failures.errors;
    for (const sess of [...s.sessions.active, ...s.sessions.history]) {
      if (sess.last_tool) {
        toolCounts[sess.last_tool] = (toolCounts[sess.last_tool] || 0) + 1;
      }
    }

    const platforms = [
      "vercel", "netlify", "fly", "render", "supabase", "railway",
      "planetscale", "aws", "gcp", "azure", "digitalocean", "cloudflare",
      "openai", "anthropic",
    ];

    return `
      <div class="panel-title">Systems</div>

      <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">BILLABLE PLATFORMS</h3>
      <div class="card-grid" style="margin-bottom:1.5rem">
        ${platforms.map((p) => `
          <div class="card">
            <div class="card-label">${p}</div>
            <div class="card-sub"><span class="badge badge-muted">not active</span></div>
          </div>
        `).join("")}
      </div>

      <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">CREDENTIAL HYGIENE</h3>
      <div class="card-grid" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-label">OAuth Preference Hints</div>
          <div class="card-value">${s.compliance.redaction_hits}</div>
          <div class="card-sub">times a long-lived token was used where OAuth exists</div>
        </div>
      </div>

      <h3 style="font-size:0.9rem;color:var(--text-muted);margin-bottom:0.75rem">MCP SERVERS</h3>
      <div class="empty-state">
        <div class="empty-state-text">MCP server status reads from <code>tools/mcp-servers/config.yaml</code> and cross-references with recent tool_call events. Run <code>scripts/discover-runtime.sh</code> to refresh discovery.</div>
      </div>
    `;
  },
};

// ─── Update Bus decision handler ──────────────────────────────
window.postDecision = async function(id, verdict) {
  if (verdict === "approve") {
    if (!confirm("Accept this proposal? This will record your decision.")) return;
  }
  try {
    const res = await fetch(`/api/update-bus/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, decided_by: "user", note: "" }),
    });
    const data = await res.json();
    alert(data.note || "Decision recorded.");
  } catch (e) {
    alert("Failed to record decision: " + e.message);
  }
};

// ─── Helpers ──────────────────────────────────────────────────

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatTime(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function truncate(s, len) {
  if (!s) return "-";
  return s.length > len ? s.slice(0, len) + "..." : s;
}
