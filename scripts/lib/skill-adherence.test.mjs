#!/usr/bin/env node
// Unit tests for scripts/lib/skill-adherence.mjs (ADR-0059).
// Each block corresponds to a row in
// observability/eval-suite/requirements/BR_14.md.

import { computeSkillAdherence, normalizeSuggestion } from "./skill-adherence.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const ROSTER = ["critic", "constitution-service", "eac", "hr", "memory-keeper"];

function suggestion(at, intent, suggest, sessionId = "s1") {
  return {
    timestamp: at,
    session_id: sessionId,
    event_type: "subagent_suggestion",
    suggestions: [{ intent, suggest, rationale: "test" }],
  };
}
function invoked(at, agent, sessionId = "s1") {
  return { timestamp: at, session_id: sessionId, event_type: "agent_invoked", agent };
}
function declined(at, skill, reason, sessionId = "s1") {
  return { timestamp: at, session_id: sessionId, event_type: "skill_declined", skill, reason };
}

// ─── normalizeSuggestion ────────────────────────────────────────────────────
console.log("\nBR_14 — suggestion normalization");
{
  assert(normalizeSuggestion("critic", ROSTER).kind === "agent", "bare roster name → agent");
  assert(normalizeSuggestion("critic", ROSTER).key === "critic", "key is the identifier");
  assert(
    normalizeSuggestion("deploy primitive (scripts/deploy.{sh,ps1})", ROSTER).kind === "advisory",
    "script advice → advisory, not a missable agent"
  );
  assert(
    normalizeSuggestion("`constitution-service`", ROSTER).key === "constitution-service",
    "backticks stripped"
  );
  assert(
    normalizeSuggestion("not-in-roster", ROSTER).kind === "advisory",
    "unknown name with a roster present → advisory (cannot be invoked)"
  );
  assert(
    normalizeSuggestion("not-in-roster", []).kind === "agent",
    "unknown name with NO roster → trusted as agent (never inflate the rate)"
  );
  assert(normalizeSuggestion("", ROSTER) === null, "empty string → null");
  assert(normalizeSuggestion(null, ROSTER) === null, "null → null");
}

// ─── matched ────────────────────────────────────────────────────────────────
console.log("\nBR_14 — a suggested agent that was invoked counts as matched");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "review", ["critic"]),
      invoked("2026-08-13T10:01:00Z", "critic"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.matched === 1, "matched === 1");
  assert(r.unmatched === 0, "unmatched === 0");
  assert(r.adherence_rate === 1, "adherence 100%");
}

console.log("\nBR_14 — alternatives: satisfying ANY suggested agent satisfies the suggestion");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "agent_lifecycle", ["hr", "eac"]),
      invoked("2026-08-13T10:05:00Z", "eac"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.matched === 1, "second alternative satisfies it");
  assert(r.detail[0].matched_on === "eac", "matched_on names which one");
}

// ─── ordering ───────────────────────────────────────────────────────────────
console.log("\nBR_14 — an invocation BEFORE the suggestion does not count");
{
  const r = computeSkillAdherence({
    records: [
      invoked("2026-08-13T09:00:00Z", "critic"),
      suggestion("2026-08-13T10:00:00Z", "review", ["critic"]),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.matched === 0, "prior invocation is not acting on the suggestion");
  assert(r.unmatched === 1, "counted as unmatched");
}

// ─── declined ───────────────────────────────────────────────────────────────
console.log("\nBR_14 — an owned refusal is adherence, not a miss (Rule 1)");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "review", ["critic"]),
      declined("2026-08-13T10:02:00Z", "critic", "diff is a one-line typo fix"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.declined === 1, "declined === 1");
  assert(r.unmatched === 0, "not counted as unmatched");
  assert(r.adherence_rate === 1, "declined counts toward adherence");
  assert(r.detail[0].reason === "diff is a one-line typo fix", "reason is preserved for audit");
}

// ─── unmatched: the actual defect ───────────────────────────────────────────
console.log("\nBR_14 — silence is the defect");
{
  const r = computeSkillAdherence({
    records: [suggestion("2026-08-13T10:00:00Z", "governance", ["constitution-service"])],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.unmatched === 1, "neither used nor refused → unmatched");
  assert(r.adherence_rate === 0, "adherence 0%");
  assert(r.detail[0].reason === null, "no reason recorded — that is the finding");
}

// ─── advisory excluded from the denominator ─────────────────────────────────
console.log("\nBR_14 — advisory suggestions are not scoreable");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "deploy", ["deploy primitive (scripts/deploy.{sh,ps1})"]),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.advisory === 1, "counted as advisory");
  assert(r.invocable === 0, "excluded from the denominator");
  assert(r.adherence_rate === null, "no rate when nothing was invocable — never a false 0%");
}

console.log("\nBR_14 — a mixed suggestion is scored on its invocable part");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "deploy", [
        "constitution-service",
        "deploy primitive (scripts/deploy.{sh,ps1})",
      ]),
      invoked("2026-08-13T10:01:00Z", "constitution-service"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.matched === 1, "invocable half matched");
  assert(r.advisory === 0, "not double-counted as advisory");
}

// ─── session scoping ────────────────────────────────────────────────────────
console.log("\nBR_14 — another session's invocation must not satisfy this session");
{
  const r = computeSkillAdherence({
    records: [
      suggestion("2026-08-13T10:00:00Z", "review", ["critic"], "s1"),
      invoked("2026-08-13T10:01:00Z", "critic", "s2"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(r.unmatched === 1, "cross-session credit is not given");
}

// ─── robustness ─────────────────────────────────────────────────────────────
console.log("\nBR_14 — dirty input degrades, never throws");
{
  assert(computeSkillAdherence({}).suggestions === 0, "no args → zeroed result");
  assert(computeSkillAdherence({ records: null }).suggestions === 0, "null records → zeroed");
  assert(
    computeSkillAdherence({ records: [null, 42, "x", {}] }).suggestions === 0,
    "junk records skipped"
  );
  const noSuggest = computeSkillAdherence({
    records: [{ timestamp: "2026-08-13T10:00:00Z", session_id: "s1", event_type: "subagent_suggestion" }],
    sessionId: "s1",
  });
  assert(noSuggest.suggestions === 0, "suggestion event with no suggestions array → nothing counted");
  const badTs = computeSkillAdherence({
    records: [
      { timestamp: "not-a-date", session_id: "s1", event_type: "subagent_suggestion", suggestions: [{ intent: "x", suggest: ["critic"] }] },
      invoked("2026-08-13T10:00:00Z", "critic"),
    ],
    sessionId: "s1",
    roster: ROSTER,
  });
  assert(badTs.matched === 1, "unparseable timestamp sorts to 0 and still matches");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
