#!/usr/bin/env node
// Loom PreToolUse hook.
//
// Fired before each tool call. Appends one JSON line per call to today's
// event log, with the tool name and a redacted/truncated argument summary.
//
// The Rule-22 fields a hook can mechanically supply are written here; the
// introspective fields (confidence, what_would_raise_to_95, decision_log)
// are emitted by the model itself as `event_type: claim` records (see
// CLAUDE.md "Claim convention").

import {
  appendEvent,
  mechanicalRecord,
  readStdinJson,
  summarizeToolArgs,
} from "./_lib.mjs";

const event = await readStdinJson();

appendEvent(
  mechanicalRecord("tool_call", {
    session_id: event.session_id || process.env.CLAUDE_SESSION_ID || "unknown",
    tool: event.tool_name || event.tool || "unknown",
    tool_args_summary: summarizeToolArgs(event.tool_input || event.input || null),
  })
);

// Exit 0 — hook does not block the tool call. Blocking belongs to the
// Critic/Constitution-Service subagents (PR-2), not to this transparency hook.
process.exit(0);
