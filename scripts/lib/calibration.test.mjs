#!/usr/bin/env node
// Tests for scripts/lib/calibration.mjs — the "measure your own judgment" audit.

import { partitionEvents, calibrationReport, claimKey, claimKeyHashed, BANDS } from "./calibration.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const claim = (ts, agent, confidence) => ({ timestamp: ts, agent, event_type: "claim", confidence, claim: "x" });
const resolve = (ts, agent, outcome) => ({ event_type: "claim_resolution", resolves: `${ts}|${agent}`, outcome });

console.log("\npartitionEvents");
{
  const { claims, resolutions } = partitionEvents([
    claim("t1", "a", 0.9),
    resolve("t1", "a", true),
    { event_type: "tool_call" },
    { event_type: "claim", timestamp: "t2", agent: "b" }, // no numeric confidence → skipped
    null,
    "garbage",
  ]);
  assert(claims.length === 1, "only numeric-confidence claims collected");
  assert(resolutions.size === 1, "resolutions keyed by resolves string");
  assert(claimKey(claims[0]) === "t1|a", "claim key = timestamp|agent");
}

console.log("\ncalibrationReport");
{
  const claims = [
    claim("t1", "a", 0.9),  // resolved true
    claim("t2", "a", 0.9),  // resolved false
    claim("t3", "a", 0.85), // unresolved
    claim("t4", "a", 0.65), // resolved true
    claim("t5", "a", 0.97), // resolved true
  ];
  const { resolutions } = partitionEvents([
    resolve("t1", "a", true), resolve("t2", "a", false),
    resolve("t4", "a", true), resolve("t5", "a", true),
  ]);
  const r = calibrationReport(claims, resolutions);
  const b8095 = r.bands.find((b) => b.band === "80–95%");
  assert(b8095.total === 3 && b8095.resolved === 2 && b8095.correct === 1, "80–95 band counts correct");
  assert(b8095.observed_accuracy === 0.5, "observed accuracy = correct/resolved");
  assert(Math.abs(b8095.brier - (((0.9 - 1) ** 2 + (0.9 - 0) ** 2) / 2)) < 1e-9, "Brier = mean squared error on resolved");
  const b6080 = r.bands.find((b) => b.band === "60–80%");
  assert(b6080.observed_accuracy === 1, "60–80 band fully correct");
  const b95 = r.bands.find((b) => b.band === ">95%");
  assert(b95.total === 1 && b95.correct === 1, "0.97 lands in >95% band (boundary inclusive)");
  assert(r.unresolved.length === 1 && r.unresolved[0].key === "t3|a", "unresolved queue lists pending claims");
  assert(r.total_claims === 5 && r.total_resolved === 4, "totals consistent");
}

console.log("\nkey collisions (found by the first monthly audit)");
{
  // Two different claims batch-appended with an identical timestamp+agent.
  const c1 = { ...claim("tX", "s", 0.9), claim: "the filter bar fix shipped" };
  const c2 = { ...claim("tX", "s", 0.75), claim: "the cost projection is still open" };
  // A BASE-key resolution is ambiguous here — must resolve NEITHER.
  const { resolutions: baseRes } = partitionEvents([resolve("tX", "s", true)]);
  const r1 = calibrationReport([c1, c2], baseRes);
  assert(r1.total_resolved === 0, "ambiguous base-key resolution resolves nothing");
  assert(r1.unresolved.every((u) => u.ambiguous_base_key === true), "collision surfaced on the unresolved queue");
  // A HASHED-key resolution targets exactly one sibling.
  const hashedRes = new Map([[claimKeyHashed(c1), { event_type: "claim_resolution", resolves: claimKeyHashed(c1), outcome: true }]]);
  const r2 = calibrationReport([c1, c2], hashedRes);
  assert(r2.total_resolved === 1, "hashed-key resolution resolves exactly its target");
  assert(r2.unresolved.length === 1 && /cost projection/.test(r2.unresolved[0].claim), "the sibling claim stays open");
}

console.log("\nband boundaries");
{
  assert(BANDS.length === 4, "four bands mirror the CLAUDE.md autonomy table");
  const r = calibrationReport([claim("t9", "a", 0.8)], new Map());
  assert(r.bands.find((b) => b.band === "80–95%").total === 1, "0.80 belongs to 80–95 (lower-inclusive)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
