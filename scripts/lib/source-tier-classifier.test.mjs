#!/usr/bin/env node
// Tests for the source-tier obvious-reject floor + a governed-vs-ungoverned
// measurement over the adversarial corpus (extends BR_13 to the intake filter).

import { classifySourceTier, REJECTED_HOST_PATTERNS, TIER1_HOST_PATTERNS } from "./source-tier-classifier.mjs";
import { TIER_FILTER_CORPUS } from "../../observability/eval-suite/adversarial/tier-filter-corpus.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nunit — obvious rejects");
{
  assert(classifySourceTier({ url: "https://reddit.com/r/x", date: "2026-01-01", author: "u" }).tier === "rejected", "reddit → rejected");
  assert(classifySourceTier({ url: "https://x.substack.com/p/y", date: "2026-01-01", author: "a" }).tier === "rejected", "substack → rejected");
  assert(classifySourceTier({ url: "https://e.example/p", date: null, author: null }).tier === "rejected", "undated+anon → rejected");
  assert(classifySourceTier({ url: "https://e.example/p", date: "2026-01-01", author: null }).tier === null, "dated-but-anon is NOT auto-rejected (judge it)");
  // flag 6 (2026-08-04 review): a recognized Tier-1 host must win over the
  // undated+anon heuristic — no false-reject of arxiv/NVD on missing metadata.
  assert(classifySourceTier({ url: "https://arxiv.org/abs/1", date: null, author: null }).tier === "1", "tier-1 host with no date+author → 1, NOT rejected");
  assert(REJECTED_HOST_PATTERNS.length >= 10 && TIER1_HOST_PATTERNS.length >= 5, "pattern sets populated");
}

console.log("\nunit — recognized tier-1 + unknown");
{
  assert(classifySourceTier({ url: "https://arxiv.org/abs/1", date: "2025-01-01", author: "x" }).tier === "1", "arxiv → 1");
  assert(classifySourceTier({ url: "https://nvd.nist.gov/vuln/x", date: "2026-01-01", author: "NIST" }).tier === "1", "nvd → 1");
  const unknown = classifySourceTier({ url: "https://some-lab.ai/blog", date: "2026-01-01", author: "Lab" });
  assert(unknown.tier === null && unknown.mechanical === false, "unknown host → null (scout judges), not an implicit admit");
}

console.log("\nmalformed input never throws");
{
  for (const bad of [{}, { url: null }, { url: "not a url" }, { url: 42 }]) {
    let ok = true; try { classifySourceTier(bad); } catch { ok = false; }
    assert(ok, `classifies ${JSON.stringify(bad)} without throwing`);
  }
}

console.log("\ncorpus — governed (floor on) vs ungoverned (floor off)");
{
  const mechanical = TIER_FILTER_CORPUS.filter((c) => c.catch === "mechanical");
  const judgment = TIER_FILTER_CORPUS.filter((c) => c.catch === "judgment");

  // Governed: the floor decides every mechanical case correctly.
  let floorCorrect = 0;
  for (const c of mechanical) {
    const got = classifySourceTier(c.item).tier;
    const want = c.expected === "1" ? "1" : "rejected";
    if (got === want) floorCorrect++;
    else console.error(`      floor missed ${c.id}: got ${got}, want ${want}`);
  }
  assert(floorCorrect === mechanical.length, `floor catches ${floorCorrect}/${mechanical.length} mechanical cases (governed)`);

  // Ungoverned: with no floor, every mechanical reject would reach the scout's
  // judgment step — the measurable safety delta BR_13-style.
  assert(mechanical.length >= 5, `${mechanical.length} obvious-noise items the floor drops before the scout spends judgment`);

  // Honesty invariant: the floor must never FALSE-REJECT a judgment case — it
  // passes it downstream (null → scout tiers it, or a legit tier-1 host → the
  // attack is caught by a LATER stage, not tier). A judgment attack hosted on
  // arxiv (injection-in-abstract, fabricated-benchmark) is correctly tiered "1"
  // BY HOST; catching the injection is admission-check.mjs axis 3, and the fake
  // number is the scout's >=2-source cross-validation — neither is tier's job.
  let passedDownstream = 0;
  for (const c of judgment) {
    const t = classifySourceTier(c.item).tier;
    if (t !== "rejected") passedDownstream++;
    else console.error(`      floor FALSE-REJECTED ${c.id} (a judgment case it can't legitimately reject)`);
  }
  assert(passedDownstream === judgment.length, `floor never false-rejects a judgment case (all ${judgment.length} pass to the correct downstream stage)`);
  assert(judgment.length >= 3, "corpus documents the judgment-only attack classes (disguised host, injection-in-abstract, fabricated benchmark)");
  // And it must NOT claim to have caught the real attack: the disguised-blog
  // case (unknown host) is the one the tier floor genuinely defers on.
  assert(classifySourceTier(judgment.find((c) => c.id === "disguised-blog").item).tier === null,
    "the genuinely-ambiguous host defers to scout judgment (null), not a guess");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
