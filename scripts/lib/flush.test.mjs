#!/usr/bin/env node
// Tests for scripts/lib/flush.mjs — the read-only flush reporter. Verifies the
// tuning that stops it crying wolf (bootstrap forward-refs + immutable archive
// excluded) and that runFlush is pure/read-only over the real repo.

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBrokenLinks, runFlush } from "./flush.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

console.log("\nfindBrokenLinks — tuned, no false positives on the real repo");
{
  const broken = findBrokenLinks(ROOT);
  assert(Array.isArray(broken), "returns an array");
  // The bootstrap forward-refs (discovery/*, work-graph.json) and the immutable
  // constitution/history archive must NOT appear — that was the whole tuning point.
  assert(!broken.some((b) => /discovery\/(requirements|risk-register|open-questions|quick-scan)/.test(b)), "bootstrap discovery forward-refs excluded");
  assert(!broken.some((b) => b.startsWith("constitution/history/")), "immutable constitution/history archive excluded");
  // Baseline is clean after the 2026-08-04 cleanup — a NEW dangling link should surface.
  assert(broken.length === 0, `repo baseline has zero dangling links (got ${broken.length}${broken.length ? ": " + broken.join(", ") : ""})`);
}

console.log("\nrunFlush — all axes, read-only");
{
  const before = readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
  const f = await runFlush(ROOT);
  const after = readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
  assert(before === after, "runFlush changes no files (read-only)");
  for (const k of ["brokenLinks", "untestedLibs", "fuzzCrashes", "deadRefs"]) {
    assert(Array.isArray(f[k]), `reports ${k} as an array`);
  }
  assert(f.fuzzCrashes.length === 0, "pure fns degrade on dirty input — zero fuzz crashes (guards from this PR hold)");
  assert(f.deadRefs.length === 0, "zero dead references to removed paths");
}

console.log("\nfabricated fixtures — detector active + tuning doesn't over-suppress (real test, critic flag 2)");
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), "flush-fixture-"));
  try {
    writeFileSync(path.join(tmp, "doc.md"), [
      "[a](./missing.md)",                       // genuinely broken → MUST be caught
      "[b](./old-self-knowledge.md)",            // typo lookalike of an allowlisted name → MUST NOT be suppressed
      "[c](./discovery/requirements.md)",        // real bootstrap forward-ref → MUST be excluded
    ].join("\n") + "\n");
    const res = findBrokenLinks(tmp);
    assert(res.some((r) => /missing\.md/.test(r)), "genuinely-missing link is caught (detector active)");
    assert(res.some((r) => /old-self-knowledge\.md/.test(r)), "path-boundary anchoring: a lookalike is NOT suppressed (flag-1 fix holds)");
    assert(!res.some((r) => /discovery\/requirements/.test(r)), "a real bootstrap forward-ref IS excluded");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
