#!/usr/bin/env node
// Verifier gate (ADR-0044) + reputation accrual (ADR-0053 Step 1).
//
// The map (2026-07-15) found `emitReputationEvent` was exported but NEVER called
// by any hook/script — so only the `invocation` kind (via specialist_spawned)
// ever populated the reputation projection. THIS is the missing call site: the
// verifier gate. When an agent's work is verified (a `verifier_type` outcome per
// ADR-0044 resolves), record it here — it logs an auditable `verifier_result`
// event AND accrues the corresponding `reputation_event` for that agent.
//
// This is still Step-1 PROJECTION only: recording a pass/fail changes an agent's
// visible track record; it confers NO dispatch preference (ADR-0053 Rule 2 gate).
//
// Callers today: scripts/lib/specialist-lifecycle.mjs (retire → verifier_pass,
// promote-lessons → lesson_contributed). Agents/hooks call recordVerification()
// wherever an ADR-0044 verifier resolves. CLI: node verify-gate.mjs <agent> <pass|fail> "<task>"

import { appendEvent, mechanicalRecord } from "../hooks/_lib.mjs";
import { emitReputationEvent } from "./reputation.mjs";
import { pathToFileURL } from "node:url";

// ADR-0044 verifier types.
export const VERIFIER_TYPES = ["exit_code", "schema_check", "test_suite", "human_gate", "surrogate"];

/**
 * Record a verified outcome for `agent`. Emits an auditable `verifier_result`
 * event and the matching `reputation_event` (verifier_pass|verifier_fail).
 * Best-effort: a missing agent still logs the audit row but accrues nothing.
 */
export function recordVerification({ agent, task = "", verifier_type = "human_gate", passed, detail = "", session_id } = {}) {
  const ok = passed === true;
  appendEvent(
    mechanicalRecord("verifier_result", {
      session_id, agent: agent || null, task,
      verifier_type: VERIFIER_TYPES.includes(verifier_type) ? verifier_type : "human_gate",
      passed: ok, detail,
    })
  );
  if (agent) {
    emitReputationEvent({ agent, kind: ok ? "verifier_pass" : "verifier_fail", source_event: `verifier_result:${verifier_type}`, session_id });
  }
  return { agent: agent || null, passed: ok, verifier_type };
}

/** A shared lesson was contributed by `agent` (accrues lesson_contributed). */
export function recordLessonContributed({ agent = "memory-keeper", lesson_id = "", session_id } = {}) {
  if (agent) emitReputationEvent({ agent, kind: "lesson_contributed", source_event: `lesson:${lesson_id}`, session_id });
  return { agent, lesson_id };
}

/** A critic approval (accrues critic_approval for the reviewing agent). */
export function recordCriticApproval({ agent = "critic", target = "", session_id } = {}) {
  if (agent) emitReputationEvent({ agent, kind: "critic_approval", source_event: `critic_approval:${target}`, session_id });
  return { agent, target };
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [agent, outcome, ...taskParts] = process.argv.slice(2);
  if (!agent || !["pass", "fail"].includes(outcome)) {
    process.stderr.write('usage: verify-gate.mjs <agent> <pass|fail> "<task>" [--type exit_code|schema_check|test_suite|human_gate|surrogate]\n');
    process.exit(2);
  }
  const typeIdx = taskParts.indexOf("--type");
  const verifier_type = typeIdx >= 0 ? taskParts[typeIdx + 1] : "human_gate";
  const task = taskParts.filter((_, i) => typeIdx < 0 || (i !== typeIdx && i !== typeIdx + 1)).join(" ");
  const r = recordVerification({ agent, task, verifier_type, passed: outcome === "pass", session_id: process.env.CLAUDE_SESSION_ID });
  process.stdout.write(`recorded ${r.passed ? "verifier_pass" : "verifier_fail"} for ${agent}\n`);
}
