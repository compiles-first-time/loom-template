#!/usr/bin/env node
// BR_09 — cold-start bootstrap fixes (lesson 2026-07-10-first-governed-session-cold-start).
// Runs each canonical case, asserts its `pass`, and re-emits it as a
// `test_case` event so the Observatory Requirements panel + regression history
// populate on every `node scripts/test.mjs`.

import { emitTestCase } from "./testcase.mjs";
import { BR_09_CASES } from "../../observability/eval-suite/requirements/BR_09.cases.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nBR_09 — cold-start bootstrap fixes");
for (const c of BR_09_CASES) {
  let actual = "";
  let ok = false;
  try { const r = c.run(); actual = r.actual; ok = r.pass; }
  catch (e) { actual = `threw: ${e.message}`; ok = false; }
  assert(ok, `${c.id} — ${c.title}  [${actual}]`);
  emitTestCase({
    id: c.id, parent_id: c.id === "BR_09" ? null : "BR_09", type: c.type,
    title: c.title, framework_location: c.framework_location,
    expected_input: c.expected_input, expected_output: c.expected_output,
    actual_input: c.expected_input, actual_output: actual,
    status: ok ? "pass" : "fail", justification: c.justification,
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
