#!/usr/bin/env node
// Unit tests for scripts/lib/session-compliance.mjs (ADR-0059).
// Each block corresponds to a row in
// observability/eval-suite/requirements/BR_15.md.

import {
  computeSessionCompliance,
  complianceSummary,
  CLAIM_DISCIPLINE_MIN_TOOL_CALLS,
} from "./session-compliance.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const ROSTER = ["critic", "constitution-service", "eac"];
const T = "2026-08-13T10:00:00Z";

function ev(event_type, extra = {}) {
  return { timestamp: T, session_id: "s1", event_type, ...extra };
}
function toolCalls(n) {
  return Array.from({ length: n }, () => ev("tool_call", { tool: "Bash" }));
}
function check(verdict, name) {
  return verdict.checks.find((c) => c.name === name);
}

// ─── clean session ──────────────────────────────────────────────────────────
console.log("\nBR_15 — a clean session grades pass");
{
  const v = computeSessionCompliance({ records: toolCalls(3), sessionId: "s1", roster: ROSTER });
  assert(v.grade === "pass", "trivial clean session → pass");
  assert(v.checks.length === 5, "five checks reported");
  assert(complianceSummary(v).startsWith("compliance: pass"), "summary reads pass");
}

// ─── 1. constitution coverage is the one HARD check ─────────────────────────
console.log("\nBR_15 — an uncovered hard-enforcement action fails hard");
{
  const v = computeSessionCompliance({
    records: [...toolCalls(3), ev("constitution_check_missing", { category: "destructive_actions", tool: "Bash" })],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(v.grade === "fail", "grade is fail, not warn");
  assert(check(v, "constitution-coverage").ok === false, "constitution-coverage failing");
  assert(
    check(v, "constitution-coverage").detail.includes("destructive_actions"),
    "detail names the offending category"
  );
  assert(check(v, "constitution-coverage").level === "hard", "it is a hard check");
}

// ─── 2. verifier resolution ─────────────────────────────────────────────────
console.log("\nBR_15 — a dispatched agent with no resolved verifier warns (ADR-0044)");
{
  const v = computeSessionCompliance({
    records: [...toolCalls(3), ev("agent_invoked", { agent: "eac", parent_agent: "main" })],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(v, "verifier-resolution").ok === false, "unresolved verifier flagged");
  assert(v.grade === "warn", "soft failure → warn, not fail");
  assert(check(v, "verifier-resolution").detail.includes("eac"), "detail names the agent");
}

console.log("\nBR_15 — a recorded verifier_result clears it");
{
  const v = computeSessionCompliance({
    records: [
      ...toolCalls(3),
      ev("agent_invoked", { agent: "eac" }),
      ev("verifier_result", { agent: "eac", passed: true, verifier_type: "test_suite" }),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(v, "verifier-resolution").ok === true, "resolved → ok");
  // A FAILED verifier is still a resolved verifier — the point is that the
  // question was asked, not that the answer was yes.
  const failedV = computeSessionCompliance({
    records: [
      ...toolCalls(3),
      ev("agent_invoked", { agent: "eac" }),
      ev("verifier_result", { agent: "eac", passed: false, verifier_type: "test_suite" }),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(failedV, "verifier-resolution").ok === true, "a failing verifier still counts as resolved");
}

// ─── 3. adherence feeds the verdict ─────────────────────────────────────────
console.log("\nBR_15 — silently ignored suggestions drag the grade");
{
  const v = computeSessionCompliance({
    records: [
      ...toolCalls(3),
      ev("subagent_suggestion", { suggestions: [{ intent: "review", suggest: ["critic"] }] }),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(v, "skill-adherence").ok === false, "0% adherence flagged");
  assert(v.adherence.unmatched === 1, "adherence detail is carried on the verdict");
}

console.log("\nBR_15 — no suggestions means no adherence opinion");
{
  const v = computeSessionCompliance({ records: toolCalls(3), sessionId: "s1", roster: ROSTER });
  assert(check(v, "skill-adherence").ok === true, "absence of suggestions is not a failure");
  assert(check(v, "skill-adherence").detail.includes("no invocable"), "detail says why");
}

// ─── 4. claim discipline scales with session size ───────────────────────────
console.log("\nBR_15 — claim discipline only applies to sessions that did work");
{
  const small = computeSessionCompliance({
    records: toolCalls(CLAIM_DISCIPLINE_MIN_TOOL_CALLS - 1),
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(small, "claim-discipline").ok === true, "short session exempt");

  const big = computeSessionCompliance({
    records: toolCalls(CLAIM_DISCIPLINE_MIN_TOOL_CALLS),
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(big, "claim-discipline").ok === false, "substantial session with no claim → flagged");

  const bigWithClaim = computeSessionCompliance({
    records: [...toolCalls(CLAIM_DISCIPLINE_MIN_TOOL_CALLS), ev("claim", { claim: "x", confidence: 0.9 })],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(bigWithClaim, "claim-discipline").ok === true, "a claim event clears it");
}

// ─── 5. provenance integrity ────────────────────────────────────────────────
console.log("\nBR_15 — unresolvable citations are a finding; unreachable ones are not");
{
  const unresolvable = computeSessionCompliance({
    records: [
      ...toolCalls(3),
      ev("claim", { claim: "x" }),
      ev("claim_provenance_result", { resolved: 1, unreachable: 0, unresolvable: 2 }),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(unresolvable, "provenance-integrity").ok === false, "unresolvable sources flagged");

  // The whole point of separating the two states: a blocked proxy is an
  // environment fact, not a discipline lapse (evidence review §0.1).
  const unreachable = computeSessionCompliance({
    records: [
      ...toolCalls(3),
      ev("claim", { claim: "x" }),
      ev("claim_provenance_result", { resolved: 1, unreachable: 5, unresolvable: 0 }),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(unreachable, "provenance-integrity").ok === true, "unreachable does NOT fail the session");

  const unchecked = computeSessionCompliance({
    records: [...toolCalls(3), ev("claim", { claim: "x" })],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(check(unchecked, "provenance-integrity").ok === false, "a claim with no provenance check is flagged");
  assert(
    check(unchecked, "provenance-integrity").detail.includes("/claim"),
    "detail points at the remedy"
  );
}

// ─── scoping and robustness ─────────────────────────────────────────────────
console.log("\nBR_15 — scoping and dirty input");
{
  const v = computeSessionCompliance({
    records: [{ timestamp: T, session_id: "other", event_type: "constitution_check_missing" }],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(v.grade === "pass", "another session's violation is not charged to this one");

  assert(computeSessionCompliance({}).grade === "pass", "no args → pass, never a throw");
  assert(computeSessionCompliance({ records: null }).grade === "pass", "null records → pass");
  assert(
    computeSessionCompliance({ records: [null, 7, "x"] }).checks.length === 5,
    "junk records still produce a full verdict"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
