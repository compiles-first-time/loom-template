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
    state.cost.cumulative.input_tokens += inp;
    state.cost.cumulative.output_tokens += out;
    state.cost.cumulative.estimated_usd += usd;
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
