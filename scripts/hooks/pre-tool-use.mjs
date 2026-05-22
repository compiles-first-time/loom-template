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
  sessionHasConstitutionClaim,
} from "./_lib.mjs";
import { classifyProductionMutation } from "./_classify.mjs";

const event = await readStdinJson();
const sessionId = event.session_id || process.env.CLAUDE_SESSION_ID || "unknown";
const toolName = event.tool_name || event.tool || "unknown";
const toolInput = event.tool_input || event.input || null;

appendEvent(
  mechanicalRecord("tool_call", {
    session_id: sessionId,
    tool: toolName,
    tool_args_summary: summarizeToolArgs(toolInput),
  })
);

// Production-mutation detection (LR-02 / ADR-0017).
// If the tool is about to mutate production state and no `constitution-service`
// claim has been emitted earlier in this session, log a `constitution_check_missing`
// event. Non-blocking — the warning lives in the event log and is surfaced by
// the doctor's soft check.
const prodMutation = classifyProductionMutation({ tool: toolName, input: toolInput });
if (prodMutation) {
  appendEvent(
    mechanicalRecord("production_mutation_attempted", {
      session_id: sessionId,
      tool: toolName,
      production_mutation_pattern: prodMutation.label,
      matched_on: prodMutation.matched_on,
    })
  );
  const hasCheck = await sessionHasConstitutionClaim(sessionId);
  if (!hasCheck) {
    appendEvent(
      mechanicalRecord("constitution_check_missing", {
        session_id: sessionId,
        tool: toolName,
        production_mutation_pattern: prodMutation.label,
        rule: "LR-02",
        message:
          "production mutation about to occur without a constitution-service claim in this session; invoke constitution-service before proceeding (LR-02).",
      })
    );
  }
}

// Exit 0 — hook does not block the tool call. Blocking remains the existing
// destructive-op behavior of the model + Critic subagent review (read-only).
process.exit(0);
