#!/usr/bin/env node
// BR_12 — governed decision (deliberation panel as a real decision path, ADR-0056).
// Runs each canonical case (sync or async), asserts its `pass`, and re-emits it
// as a `test_case` event so the Observatory Requirements panel populates on every
// `node scripts/test.mjs`.

import { emitTestCase } from "./testcase.mjs";
import { BR_12_CASES } from "../../observability/eval-suite/requirements/BR_12.cases.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nBR_12 — governed decision (panel as a real decision path)");
for (const c of BR_12_CASES) {
  let actual = "";
  let ok = false;
  try { const r = await c.run(); actual = r.actual; ok = r.pass; }
  catch (e) { actual = `threw: ${e.message}`; ok = false; }
  assert(ok, `${c.id} — ${c.title}  [${actual}]`);
  emitTestCase({
    id: c.id, parent_id: c.id === "BR_12" ? null : "BR_12", type: c.type,
    title: c.title, framework_location: c.framework_location,
    expected_input: c.expected_input, expected_output: c.expected_output,
    actual_input: c.expected_input, actual_output: actual,
    status: ok ? "pass" : "fail", justification: c.justification,
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
