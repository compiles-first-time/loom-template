import { redact } from "./redactor.mjs";

export class Aggregator {
  constructor({ costRates = {} } = {}) {
    this._costRates = costRates;
    this._sseClients = new Set();
    this.state = {
      sessions: { active: [], history: [] },
      agents: { active: [], specialists: { spawned: [], available: [], retired: [] } },
      tasks: { work_items: [], ledger: [], progress: [] },
      cost: { by_session: {}, cumulative: { input_tokens: 0, output_tokens: 0, estimated_usd: 0 } },
      failures: { errors: [], error_signatures: {}, lessons_drafts: [] },
      deploys: { history: [], active: null },
      compliance: { constitution_checks: [], redaction_hits: 0, destructive_ops: [] },
      update_bus: { inbox: [] },
      testing: { last_run: null, runs: [], results: [] },
      activity: { feed: [] },
    };
  }

  addSSEClient(res) { this._sseClients.add(res); }
  removeSSEClient(res) { this._sseClients.delete(res); }

  getState() {
    return redact(this.state);
  }

  ingestEvent(record) {
    const safe = redact(record);
    const handler = EVENT_HANDLERS[safe.event_type];
    if (handler) handler(this.state, safe, this._costRates);
    recordActivity(this.state, safe);
    this._broadcast("delta", { event_type: safe.event_type, payload: safe });
  }

  ingestFileChange(filePath) {
    this._broadcast("file_changed", { path: filePath });
  }

  ingestUpdateBusItem(item) {
    const idx = this.state.update_bus.inbox.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      this.state.update_bus.inbox[idx] = item;
    } else {
      this.state.update_bus.inbox.push(item);
    }
    this._broadcast("delta", { event_type: "update_bus_item", payload: item });
  }

  updateUpdateBusDecision(id, decision) {
    const item = this.state.update_bus.inbox.find((i) => i.id === id);
    if (item) {
      item.user_decision = decision;
      this._broadcast("delta", { event_type: "update_bus_decision", payload: { id, decision } });
    }
  }

  _broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this._sseClients) {
      try { client.write(msg); } catch { this._sseClients.delete(client); }
    }
  }
}

function calcUsd(inputTokens, outputTokens, model, costRates) {
  let rates = model ? costRates[model] : undefined;
  if (!rates && model) {
    for (const [k, v] of Object.entries(costRates)) {
      if (model.includes(k) || k.includes(model)) { rates = v; break; }
    }
  }
  if (!rates) rates = costRates["claude-sonnet-4"] || null;
  if (!rates) return 0;
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

// Cumulative token/cost is always the sum of per-session totals — never
// incremented directly — so handlers with different semantics (loop_cost_summary
// accumulates loops; session_token_usage sets a per-turn total) compose without
// double-counting.
function recomputeCumulative(state) {
  let input = 0;
  let output = 0;
  let usd = 0;
  for (const s of Object.values(state.cost.by_session)) {
    input += s.input_tokens || 0;
    output += s.output_tokens || 0;
    usd += s.estimated_usd || 0;
  }
  state.cost.cumulative = { input_tokens: input, output_tokens: output, estimated_usd: usd };
}

// ── Activity feed (observatory live-data fix, item 4) ─────────────────────
// A capped, reverse-chronological feed of what's happening in the session —
// tool calls, file edits, bash runs, failures, lifecycle, token + test events.
// Built from events the hooks already emit; redaction happens on read.

const ACTIVITY_MAX = 300;

function activityDetail(ev) {
  const a = ev.tool_args_summary;
  if (a == null) return "";
  if (typeof a === "string") return a;
  if (typeof a === "object") {
    return (
      a.command || a.Command || a.script || a.file_path || a.path ||
      a.pattern || a.description || a.url || a.prompt || ""
    );
  }
  return String(a);
}

function pushActivity(state, entry) {
  state.activity.feed.push(entry);
  if (state.activity.feed.length > ACTIVITY_MAX) {
    state.activity.feed = state.activity.feed.slice(-ACTIVITY_MAX);
  }
}

function recordActivity(state, ev) {
  switch (ev.event_type) {
    case "tool_call":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "tool", tool: ev.tool, detail: activityDetail(ev),
      });
      break;
    case "tool_result":
      // Only surface failures — successful results would double the feed.
      // Errors are the high-signal "output" trace.
      if (ev.exit_code != null && ev.exit_code !== 0) {
        pushActivity(state, {
          timestamp: ev.timestamp, session_id: ev.session_id,
          kind: "error", tool: ev.tool, exit_code: ev.exit_code,
          detail: ev.error_preview || ev.error_signature || "non-zero exit",
        });
      }
      break;
    case "session_start":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "session", tool: "session_start", detail: ev.source || "",
      });
      break;
    case "session_end":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "session", tool: "session_end",
        detail: `${ev.tool_calls || 0} calls, ${ev.errors || 0} errors`,
      });
      break;
    case "destructive_op":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "destructive", tool: ev.tool,
        detail: ev.destructive_pattern || ev.label || "",
      });
      break;
    case "session_token_usage":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "tokens", tool: ev.model || "tokens",
        detail: `${ev.input_tokens || 0} in / ${ev.output_tokens || 0} out`,
      });
      break;
    case "test_run_summary":
      pushActivity(state, {
        timestamp: ev.timestamp, session_id: ev.session_id,
        kind: "test", tool: "node --test",
        detail: `${ev.passed || 0}/${ev.total || 0} passed${ev.failed ? `, ${ev.failed} failed` : ""}`,
      });
      break;
    default:
      // Governance/attempt events have their own panels; keep the feed focused.
      break;
  }
}

const EVENT_HANDLERS = {
  session_start(state, ev) {
    state.sessions.active.push({
      session_id: ev.session_id,
      started_at: ev.timestamp,
      source: ev.source,
    });
  },

  session_end(state, ev) {
    state.sessions.active = state.sessions.active.filter((s) => s.session_id !== ev.session_id);
    state.sessions.history.push({
      session_id: ev.session_id,
      started_at: ev.started_at,
      ended_at: ev.ended_at,
      tool_calls: ev.tool_calls || 0,
      errors: ev.errors || 0,
    });
  },

  tool_call(state, ev) {
    const session = state.sessions.active.find((s) => s.session_id === ev.session_id);
    if (session) {
      session.tool_calls = (session.tool_calls || 0) + 1;
      session.last_tool = ev.tool;
      session.last_activity = ev.timestamp;
    }
  },

  tool_result(state, ev) {
    if (ev.exit_code && ev.exit_code !== 0) {
      const err = {
        timestamp: ev.timestamp,
        session_id: ev.session_id,
        tool: ev.tool,
        exit_code: ev.exit_code,
        error_signature: ev.error_signature,
        error_preview: ev.error_preview,
      };
      state.failures.errors.push(err);
      if (ev.error_signature) {
        const sig = ev.error_signature;
        state.failures.error_signatures[sig] = (state.failures.error_signatures[sig] || 0) + 1;
      }
    }
  },

  destructive_op(state, ev) {
    state.compliance.destructive_ops.push({
      timestamp: ev.timestamp,
      session_id: ev.session_id,
      tool: ev.tool,
      pattern: ev.destructive_pattern || ev.label,
      exit_code: ev.exit_code,
    });
  },

  constitution_check_missing(state, ev) {
    state.compliance.constitution_checks.push({
      timestamp: ev.timestamp,
      session_id: ev.session_id,
      tool: ev.tool,
      category: ev.category,
      message: ev.message,
    });
  },

  deployment_started(state, ev) {
    state.deploys.active = {
      session_id: ev.session_id,
      started_at: ev.timestamp,
      platform: ev.platform,
      command: ev.deploy_command,
    };
  },

  deployment_completed(state, ev) {
    const deploy = {
      session_id: ev.session_id,
      completed_at: ev.timestamp,
      platform: ev.platform,
      exit_code: ev.exit_code,
      duration_ms: ev.duration_ms,
      url: ev.deployment_url,
      health: ev.health,
      state: ev.wait_for_deploy_state || (ev.exit_code === 0 ? "succeeded" : "failed"),
    };
    state.deploys.history.push(deploy);
    state.deploys.active = null;
  },

  deployment_non_progressing(state, ev) {
    const deploy = {
      session_id: ev.session_id,
      completed_at: ev.timestamp,
      state: "non_progressing",
      reason: ev.reason,
      message: ev.message,
    };
    state.deploys.history.push(deploy);
    state.deploys.active = null;
  },

  specialist_spawned(state, ev) {
    state.agents.specialists.spawned.push({
      name: ev.specialist_name,
      work_item: ev.work_item_id,
      spawned_at: ev.timestamp,
    });
  },

  specialist_retired(state, ev) {
    state.agents.specialists.spawned = state.agents.specialists.spawned.filter(
      (s) => s.name !== ev.specialist_name,
    );
    state.agents.specialists.retired.push({
      name: ev.specialist_name,
      retired_at: ev.timestamp,
      archived_path: ev.archived_path,
    });
  },

  loop_cost_summary(state, ev, costRates = {}) {
    const sid = ev.session_id || "unknown";
    if (!state.cost.by_session[sid]) {
      state.cost.by_session[sid] = { input_tokens: 0, output_tokens: 0, estimated_usd: 0, loops: [] };
    }
    const s = state.cost.by_session[sid];
    const inp = ev.estimated_input_tokens || 0;
    const out = ev.estimated_output_tokens || 0;
    const usd = calcUsd(inp, out, ev.model, costRates);
    s.input_tokens += inp;
    s.output_tokens += out;
    s.estimated_usd += usd;
    s.loops.push({
      loop_id: ev.loop_id,
      pattern: ev.pattern,
      iterations: ev.iteration_count,
      agents: ev.agent_count,
      input_tokens: inp,
      output_tokens: out,
      estimated_usd: usd,
      wall_clock_ms: ev.wall_clock_ms,
      exit_reason: ev.exit_reason,
    });
    // Cumulative is derived from by_session (see recomputeCumulative) so that
    // loop_cost_summary (Agentum loop runner) and session_token_usage (Claude
    // Code transcript) can both contribute without double-counting.
    recomputeCumulative(state);
  },

  // Claude Code session token usage, emitted per turn by the Stop hook from
  // the transcript (observatory live-data fix). SET semantics — re-emitting
  // each turn with the cumulative session total is idempotent and never
  // double-counts. Cost panels read by_session + cumulative.
  session_token_usage(state, ev, costRates = {}) {
    const sid = ev.session_id || "unknown";
    if (!state.cost.by_session[sid]) {
      state.cost.by_session[sid] = { input_tokens: 0, output_tokens: 0, estimated_usd: 0, loops: [] };
    }
    const s = state.cost.by_session[sid];
    s.input_tokens = ev.input_tokens || 0;
    s.output_tokens = ev.output_tokens || 0;
    s.estimated_usd = calcUsd(s.input_tokens, s.output_tokens, ev.model, costRates);
    if (ev.model) s.model = ev.model;
    s.source = "claude-code";
    recomputeCumulative(state);
  },

  test_result(state, ev) {
    state.testing.results.push({
      timestamp: ev.timestamp,
      session_id: ev.session_id,
      suite: ev.suite,
      name: ev.name,
      status: ev.status,
      asserts_passed: ev.asserts_passed,
      asserts_failed: ev.asserts_failed,
      duration_ms: ev.duration_ms,
      error_preview: ev.error_preview,
    });
    // Cap the live result list so a big suite can't grow state unbounded.
    if (state.testing.results.length > 500) {
      state.testing.results = state.testing.results.slice(-500);
    }
  },

  test_run_summary(state, ev) {
    const run = {
      timestamp: ev.timestamp,
      session_id: ev.session_id,
      total: ev.total || 0,
      passed: ev.passed || 0,
      failed: ev.failed || 0,
      skipped: ev.skipped || 0,
      todo: ev.todo || 0,
      duration_ms: ev.duration_ms,
      files: ev.files || 0,
      files_passed: ev.files_passed,
      files_failed: ev.files_failed,
      // The summary closes a run; the run's own per-file results are the last
      // `files` results pushed (one test_result was emitted per file just now).
      results: ev.files ? state.testing.results.slice(-ev.files) : [],
    };
    state.testing.runs.push(run);
    state.testing.last_run = run;
    // A run summary closes the books on the prior result set: keep only the
    // results from the most recent run window in the live list.
    if (state.testing.runs.length > 25) {
      state.testing.runs = state.testing.runs.slice(-25);
    }
  },

  subagent_suggestion(state, ev) {
    const session = state.sessions.active.find((s) => s.session_id === ev.session_id);
    if (session) {
      session.last_suggestions = ev.suggestions;
    }
  },

  oauth_preference_hint(state, ev) {
    state.compliance.redaction_hits++;
  },

  lessons_autosuggest(state, ev) {
    state.failures.lessons_drafts.push({
      timestamp: ev.timestamp,
      session_id: ev.session_id,
      suggested: ev.suggested,
      skipped: ev.skipped,
    });
  },
};
