#!/usr/bin/env node
// Tests for scripts/lib/secret-patterns.mjs — the security-critical redaction/
// scan layer behind LR-03 (secrets never in chat/args/logs). It was untested
// (surfaced by the 2026-08-04 flush); this closes that gap. Uses synthetic,
// obviously-fake secrets — no real credential appears here (LR-03).

import { SECRET_PATTERNS, redactSecrets, scanForSecrets } from "./secret-patterns.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

// Synthetic tokens that MATCH the documented shapes but are not real secrets.
const FAKE = {
  ghpClassic: "ghp_" + "A".repeat(36),
  ghFine: "github_pat_" + "B".repeat(70),
  anthropic: "sk-ant-" + "C".repeat(40),
  openai: "sk-" + "D".repeat(48),
  generic: 'api_key="' + "E".repeat(32) + '"',
};

console.log("\nhigh-confidence detection");
{
  for (const [name, tok] of Object.entries(FAKE)) {
    const hits = scanForSecrets(tok);
    assert(hits.length >= 1, `detects ${name}`);
  }
  assert(scanForSecrets(FAKE.anthropic)[0].label === "Anthropic API key", "labels the Anthropic key correctly");
}

console.log("\nredaction (high-confidence only)");
{
  const dirty = `here is my key ${FAKE.ghpClassic} ok`;
  const clean = redactSecrets(dirty);
  assert(!clean.includes(FAKE.ghpClassic), "the raw token is gone after redaction");
  assert(/<redacted:GitHub PAT \(classic\)>/.test(clean), "replaced with a labeled redaction marker");
  // Generic assignment is MEDIUM confidence → reported by scan, NOT redacted.
  const med = redactSecrets(FAKE.generic);
  assert(med.includes("E".repeat(32)) || !/<redacted/.test(med), "medium-confidence generic is not auto-redacted (reported only)");
  assert(scanForSecrets(FAKE.generic).some((h) => h.confidence === "medium"), "…but the generic assignment IS scan-reported at medium confidence");
}

console.log("\nno false positives on benign text");
{
  const benign = "The quick brown fox. A normal sentence with words like token and password in prose.";
  assert(scanForSecrets(benign).length === 0, "prose mentioning 'token'/'password' without an assignment is not a hit");
  assert(redactSecrets(benign) === benign, "benign text passes through redaction unchanged");
  const shortId = "id=abc123"; // too short for the 20+ char secret shapes
  assert(scanForSecrets(shortId).length === 0, "short identifiers are below the secret-length floor");
}

console.log("\nrobustness (dirty input never throws)");
{
  for (const bad of [null, undefined, 42, {}, []]) {
    let ok = true; try { redactSecrets(bad); scanForSecrets(bad); } catch { ok = false; }
    assert(ok, `handles ${JSON.stringify(bad)} without throwing`);
  }
  assert(redactSecrets(null) === null, "non-string redact returns input unchanged");
  assert(Array.isArray(scanForSecrets(null)) && scanForSecrets(null).length === 0, "non-string scan returns []");
}

console.log("\npattern set integrity");
{
  assert(SECRET_PATTERNS.length >= 8, "a meaningful pattern set");
  assert(SECRET_PATTERNS.every((p) => p.pattern instanceof RegExp && p.label && p.confidence), "every pattern has {pattern, label, confidence}");
  assert(SECRET_PATTERNS.every((p) => ["high", "medium"].includes(p.confidence)), "confidence is high|medium");
  assert(SECRET_PATTERNS.some((p) => p.confidence === "high"), "at least one high-confidence (redactable) pattern");
  // Every global pattern must be reset before use (scan relies on lastIndex=0) —
  // verify a second scan of the same text yields the same result (no stateful drift).
  const t = FAKE.openai;
  assert(scanForSecrets(t).length === scanForSecrets(t).length, "scan is idempotent across calls (lastIndex reset)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
