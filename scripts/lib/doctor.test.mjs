#!/usr/bin/env node
// Smoke test for scripts/lib/doctor.mjs — "who tests the tester" (gap surfaced
// by the 2026-08-04 flush). doctor.mjs ends in process.exit() and exports
// nothing, so a unit test of individual checks isn't possible without a
// refactor; the honest, real test is a SUBPROCESS run that asserts doctor
// itself runs clean on the template and that its load-bearing checks are
// present (a silently-dropped check is the failure this guards against).

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = spawnSync("node", [path.join(ROOT, "scripts", "lib", "doctor.mjs")], { cwd: ROOT, encoding: "utf8" });
const out = (run.stdout || "") + (run.stderr || "");

console.log("\ndoctor runs and reports");
{
  assert(run.status === 0, `doctor exits 0 on the template (0 hard failures) — got ${run.status}`);
  assert(/hard failure\(s\)/.test(out), "prints a hard-failure tally line");
}

console.log("\nload-bearing checks are present (a dropped check must fail here)");
{
  for (const check of [
    "placeholders",
    "CLAUDE.md",              // size cap
    "proposed-adrs-in-claude",
    "mcp-yaml-json-alignment",
    "subagents-present",
    "kernel-integrity",       // the 2026-08-04 kernel-immutability hard check
    "skeleton-intact",
  ]) {
    assert(out.includes(check), `doctor still runs the '${check}' check`);
  }
}

console.log("\nhard checks pass (green tree)");
{
  // No check line should be marked failing (✗). Soft warnings (!) are allowed.
  const failingLines = out.split(/\r?\n/).filter((l) => /✗/.test(l));
  assert(failingLines.length === 0, `no failing check lines${failingLines.length ? " — " + failingLines.join(" | ") : ""}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
