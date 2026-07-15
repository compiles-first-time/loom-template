#!/usr/bin/env node
// BR_07 — Multi-LLM deliberation panel (ADR-0056).
// Runs each canonical case (sync or async), asserts its `pass`, and re-emits it
// as a `test_case` event (upserted by id) so the Observatory Requirements panel
// + regression history populate on every `node scripts/test.mjs`.
//
// Deterministic + CI-safe: model gathering is injected (mock adapters). The
// LIVE Ollama 2nd-model vote is proven separately by examples/deliberation-live.mjs.

import { emitTestCase } from "./testcase.mjs";
import { BR_07_CASES } from "../../observability/eval-suite/requirements/BR_07.cases.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

console.log("\nBR_07 — multi-LLM deliberation panel (ADR-0056)");
for (const c of BR_07_CASES) {
  let actual = "";
  let ok = false;
  try {
    const r = await c.run();
    actual = r.actual;
    ok = r.pass;
  } catch (e) {
    actual = `threw: ${e.message}`;
    ok = false;
  }
  assert(ok, `${c.id} — ${c.title}  [${actual}]`);
  emitTestCase({
    id: c.id, parent_id: c.id === "BR_07" ? null : "BR_07", type: c.type,
    title: c.title, framework_location: c.framework_location,
    expected_input: c.expected_input, expected_output: c.expected_output,
    actual_input: c.expected_input, actual_output: actual,
    status: ok ? "pass" : "fail", justification: c.justification,
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
