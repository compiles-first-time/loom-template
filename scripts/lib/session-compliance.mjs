#!/usr/bin/env node
// Session compliance verdict (ADR-0059).
//
// The Stop hook already wrote a *descriptive* row: tool calls, errors,
// destructive ops. Description is not a grade. Nothing in the session's exhaust
// ever answered "did this session hold the discipline?" — which is the question
// ADR-0054 says Loom keeps failing silently.
//
// This module computes the verdict from records the hooks already emit. Five
// checks, all deterministic, all $0 — no inference anywhere in this file. That
// is the point: the thing that measures whether the model behaved must not
// itself be a model (see the evidence review §3.1 — a judge can be perfectly
// self-consistent and wrong).
//
//   1. constitution_coverage  — hard-enforcement tool calls paired with a
//                               constitution-service claim (LR-04)
//   2. verifier_resolution    — every dispatched agent has a resolved verifier
//                               (ADR-0044; MAST's 21.3% failure bucket)
//   3. skill_adherence        — suggested agents used, or refused with a reason
//   4. claim_discipline       — non-trivial sessions emit claim events (Rule 22)
//   5. provenance_integrity   — claims carry resolvable sources (ADR-0060)
//
// Grades: `pass` (no failing check), `warn` (soft checks failing), `fail` (a
// hard check failing). A grade is a signal to the architect, never a block —
// blocking a session at Stop cannot help, the work is already done.

import { pathToFileURL } from "node:url";
import { computeSkillAdherence, loadRoster } from "./skill-adherence.mjs";

// Below this many tool calls a session is a lookup, not a piece of work, and
// requiring a claim event from it would train the operator to emit noise.
export const CLAIM_DISCIPLINE_MIN_TOOL_CALLS = 12;

// Adherence floor. Deliberately not 100%: the metric counts an owned refusal as
// adherence, so the remaining gap is genuinely unexplained silence, and a
// handful of those in a long session is a nag rather than a failure.
export const ADHERENCE_WARN_BELOW = 0.8;

function count(records, type) {
  return records.filter((r) => r && r.event_type === type).length;
}

/**
 * @param {object}   opts
 * @param {object[]} opts.records
 * @param {string}   [opts.sessionId]
 * @param {string[]} [opts.roster]
 * @returns {{grade: "pass"|"warn"|"fail", checks: object[], adherence: object, session_id: string|null}}
 */
export function computeSessionCompliance({ records = [], sessionId = null, roster = [] } = {}) {
  const rows = (Array.isArray(records) ? records : []).filter(
    (r) => r && typeof r === "object" && (!sessionId || !r.session_id || r.session_id === sessionId)
  );

  const checks = [];
  const add = (name, level, ok, detail) => checks.push({ name, level, ok, detail });

  // ── 1. Constitution coverage (LR-04) ──────────────────────────────────
  // pre-tool-use already emits `constitution_check_missing` when a
  // hard-enforcement category fires without a prior constitution-service claim.
  // Any such event is an unambiguous hard failure — nothing to re-derive.
  const missing = rows.filter((r) => r.event_type === "constitution_check_missing");
  add(
    "constitution-coverage",
    "hard",
    missing.length === 0,
    missing.length === 0
      ? "no hard-enforcement action ran without a constitution-service claim"
      : `${missing.length} hard-enforcement action(s) without a constitution-service claim: ${[
          ...new Set(missing.map((m) => m.category || m.tool || "?")),
        ].join(", ")}`
  );

  // ── 2. Verifier resolution (ADR-0044) ─────────────────────────────────
  // Doctor checks that skills *declare* a verifier. Nothing checked that a
  // dispatched task ever *resolved* one. Declared-but-never-resolved is exactly
  // MAST's "incomplete verification" (8.2% of multi-agent failures).
  const spawned = rows.filter((r) => r.event_type === "agent_invoked" && r.agent);
  const verified = new Set(
    rows.filter((r) => r.event_type === "verifier_result" && r.agent).map((r) => String(r.agent).toLowerCase())
  );
  const unresolved = [
    ...new Set(
      spawned
        .map((r) => String(r.agent).toLowerCase())
        .filter((a) => !verified.has(a))
    ),
  ];
  // Read-only agents cannot fail a verifier in any meaningful sense — they
  // produce an opinion, and ADR-0044's types don't fit. Soft, not hard.
  add(
    "verifier-resolution",
    "soft",
    unresolved.length === 0,
    spawned.length === 0
      ? "no agents dispatched"
      : unresolved.length === 0
      ? `all ${spawned.length} dispatched agent(s) have a recorded verifier_result`
      : `no verifier_result recorded for: ${unresolved.join(", ")}`
  );

  // ── 3. Skill adherence (ADR-0017 → measured, ADR-0059) ────────────────
  const adherence = computeSkillAdherence({ records: rows, sessionId, roster });
  const rate = adherence.adherence_rate;
  add(
    "skill-adherence",
    "soft",
    rate === null || rate >= ADHERENCE_WARN_BELOW,
    rate === null
      ? "no invocable suggestions this session"
      : `${Math.round(rate * 100)}% (${adherence.matched} used, ${adherence.declined} declined with reason, ${adherence.unmatched} silently ignored)`
  );

  // ── 4. Claim discipline (Rule 22, introspective subset) ───────────────
  const toolCalls = count(rows, "tool_call");
  const claims = rows.filter((r) => r.event_type === "claim");
  const claimNeeded = toolCalls >= CLAIM_DISCIPLINE_MIN_TOOL_CALLS;
  add(
    "claim-discipline",
    "soft",
    !claimNeeded || claims.length > 0,
    claimNeeded
      ? `${claims.length} claim event(s) for ${toolCalls} tool calls`
      : `${toolCalls} tool calls — below the ${CLAIM_DISCIPLINE_MIN_TOOL_CALLS}-call threshold, no claim required`
  );

  // ── 5. Provenance integrity (ADR-0060) ────────────────────────────────
  // A claim whose sources do not resolve is not evidence. `unreachable` is
  // deliberately NOT a failure — a blocked network is an environment fact, not
  // a discipline lapse, and conflating them would punish the operator for the
  // proxy (this session's own experience; see the evidence review §0.1).
  const provenance = rows.filter((r) => r.event_type === "claim_provenance_result");
  const bad = provenance.filter((r) => Number(r.unresolvable || 0) > 0);
  // Unchecked is its own failure state, distinct from "checked and clean". A
  // claim nobody verified is not evidence just because nothing contradicted it.
  const unchecked = claims.length > 0 && provenance.length === 0;
  add(
    "provenance-integrity",
    "soft",
    bad.length === 0 && !unchecked,
    provenance.length === 0
      ? claims.length === 0
        ? "no claims to verify"
        : `${claims.length} claim(s) with no provenance check recorded — run /claim or claim-provenance.mjs`
      : bad.length === 0
      ? `${provenance.length} claim(s) checked, all sources resolvable`
      : `${bad.length} claim(s) cite unresolvable sources`
  );

  const failedHard = checks.some((c) => c.level === "hard" && !c.ok);
  const failedSoft = checks.some((c) => c.level === "soft" && !c.ok);
  const grade = failedHard ? "fail" : failedSoft ? "warn" : "pass";

  return { grade, checks, adherence, session_id: sessionId };
}

/** One-line human summary for the progress ledger. */
export function complianceSummary(verdict) {
  const failing = verdict.checks.filter((c) => !c.ok).map((c) => c.name);
  if (failing.length === 0) return `compliance: pass (${verdict.checks.length} checks)`;
  return `compliance: ${verdict.grade} — ${failing.join(", ")}`;
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { readTodayRecords } = await import("./event-log-read.mjs");
  const sessionId = process.argv[2] || null;
  const records = await readTodayRecords();
  const roster = await loadRoster();
  const verdict = computeSessionCompliance({ records, sessionId, roster });
  console.log(`\nsession compliance: ${verdict.grade.toUpperCase()}\n`);
  for (const c of verdict.checks) {
    console.log(`  ${c.ok ? "✓" : c.level === "hard" ? "✗" : "!"}  ${c.name.padEnd(22)} ${c.detail}`);
  }
  console.log("");
  process.exit(verdict.grade === "fail" ? 1 : 0);
}
