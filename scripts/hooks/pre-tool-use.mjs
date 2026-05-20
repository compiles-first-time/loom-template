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
import { loadPermissions, classifyToolCall } from "../lib/permissions-classifier.mjs";

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

// Production-mutation detection (LR-02 / ADR-0017 — now subsumed by LR-04 / ADR-0027).
// Kept for backward compatibility; LR-04 classifier below produces the unified events.
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
}

// LR-04 unified permissions classifier (PR-P / ADR-0027). Subsumes LR-02 +
// LR-03 as specializations of the permissions framework.
try {
  const perms = await loadPermissions();
  const hits = classifyToolCall({ tool: toolName, input: toolInput, permissions: perms });
  for (const h of hits) {
    appendEvent(
      mechanicalRecord(`${h.category}_attempted`, {
        session_id: sessionId,
        tool: toolName,
        matched_on: h.matched_on,
        enforcement: h.enforcement,
        required_protocol: h.required_protocol,
        rule: "LR-04",
      })
    );
    // Hard-enforcement categories also check for constitution-service claim.
    if (h.enforcement === "hard") {
      const hasCheck = await sessionHasConstitutionClaim(sessionId);
      if (!hasCheck) {
        appendEvent(
          mechanicalRecord("constitution_check_missing", {
            session_id: sessionId,
            tool: toolName,
            category: h.category,
            matched_on: h.matched_on,
            rule: "LR-04",
            message: `${h.category} action without constitution-service claim — LR-04 requires consultation for hard-enforcement categories.`,
          })
        );
      }
    }
  }
} catch {
  // Permissions classifier is best-effort. v0.5 functionality unaffected.
}

// Exit 0 — hook does not block the tool call. Blocking remains the existing
// destructive-op behavior of the model + Critic subagent review (read-only).
process.exit(0);
