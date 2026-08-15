#!/usr/bin/env node
// Unit tests for scripts/lib/requirements-register.mjs (ADR-0061).
// Each block corresponds to a row in
// observability/eval-suite/requirements/BR_17.md.

import {
  parseRegister,
  analyzeRegister,
  summarizeFindings,
  REQUIRED_COLUMNS,
  ADDED_COLUMNS,
  EXCEPTION_DENSITY_FLOOR,
} from "./requirements-register.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓  ${label}`); }
  else { failed++; console.error(`  ✗  ${label}`); }
}

const HEADER = `| ${REQUIRED_COLUMNS.join(" | ")} |`;
const SEP = `|${REQUIRED_COLUMNS.map(() => "---").join("|")}|`;
function row(id, type, rest = "x") {
  const cells = [id, type, ...REQUIRED_COLUMNS.slice(2).map(() => rest)];
  return `| ${cells.join(" | ")} |`;
}
function register(...rows) {
  return ["# Some register", "", HEADER, SEP, ...rows, ""].join("\n");
}

// ─── parsing ────────────────────────────────────────────────────────────────
console.log("\nBR_17 — parsing");
{
  const p = parseRegister(register(row("BR_20", "BR"), row("BR-20_Step", "---")));
  assert(p.columns.length === REQUIRED_COLUMNS.length, "header captured");
  assert(p.rows.length === 2, "two data rows");
  assert(p.rows[0].ID === "BR_20" && p.rows[0].Type === "BR", "cells map to column names");

  const backticked = parseRegister(register("| `BR-20_SE-01` | `SE` | a | a | a | a | a | a | a | a |"));
  assert(backticked.rows[0].Type === "SE", "backticks stripped from Type");
  assert(backticked.rows[0].ID === "BR-20_SE-01", "backticks stripped from ID");

  // A register document usually contains other tables before the register.
  const withPreamble = ["| Metric | Value |", "|---|---|", "| speed | fast |", "", HEADER, SEP, row("BR_20", "BR")].join("\n");
  assert(parseRegister(withPreamble).rows.length === 1, "only the ID-headed table is parsed");

  assert(parseRegister("").rows.length === 0, "empty text → no rows");
  assert(parseRegister(null).rows.length === 0, "null → no rows, no throw");
  assert(parseRegister("no tables here").rows.length === 0, "prose → no rows");
}

// ─── attachment: the central harvest finding ────────────────────────────────
console.log("\nBR_17 — exception attachment is detected, not assumed");
{
  const stepLevel = analyzeRegister(
    parseRegister(
      register(
        row("BR_20", "BR"),
        row("BR-20_Guard", "---"),
        row("BR-20_Guard_SE-01", "SE"),
        row("BR-20_Guard_BE-01", "BE")
      )
    )
  );
  assert(stepLevel.attachment === "step-level", "exceptions named off the step → step-level");
  assert(stepLevel.orphan_exceptions.length === 0, "no orphans");
  assert(stepLevel.unexamined_steps.length === 0, "the covered step is not flagged");

  const reqLevel = analyzeRegister(
    parseRegister(
      register(row("BR_20", "BR"), row("BR-20_Guard", "---"), row("BR-20_SE-01", "SE"), row("BR-20_BE-01", "BE"))
    )
  );
  assert(reqLevel.attachment === "requirement-level", "exceptions named off the BR → requirement-level");
  assert(reqLevel.orphan_exceptions.length === 2, "both counted as orphans");
  // The bug this test locks: reporting every step as unexamined when the
  // register simply uses a different naming convention manufactures false
  // findings, and a check that cries wolf gets switched off.
  assert(
    reqLevel.unexamined_steps.length === 0,
    "requirement-level attachment does NOT manufacture false 'unexamined step' findings"
  );

  const none = analyzeRegister(parseRegister(register(row("BR_20", "BR"), row("BR-20_Guard", "---"))));
  assert(none.attachment === "none", "no exceptions at all → 'none'");
}

console.log("\nBR_17 — a genuinely unexamined step is caught when attachment is used");
{
  const r = analyzeRegister(
    parseRegister(
      register(
        row("BR_20", "BR"),
        row("BR-20_Guard", "---"),
        row("BR-20_Guard_SE-01", "SE"),
        row("BR-20_Wire", "---") // no exceptions of its own
      )
    )
  );
  assert(r.attachment === "step-level", "step-level attachment in use");
  assert(r.unexamined_steps.length === 1, "one step flagged");
  assert(r.unexamined_steps[0] === "BR-20_Wire", "the right step is named");
}

console.log("\nBR_17 — the longest matching step wins (nested step ids)");
{
  const r = analyzeRegister(
    parseRegister(
      register(
        row("BR_20", "BR"),
        row("BR-20_Load", "---"),
        row("BR-20_LoadCache", "---"),
        row("BR-20_LoadCache_SE-01", "SE")
      )
    )
  );
  assert(r.unexamined_steps.includes("BR-20_Load"), "the shorter prefix does not steal the exception");
  assert(!r.unexamined_steps.includes("BR-20_LoadCache"), "the longest match owns it");
}

// ─── density ────────────────────────────────────────────────────────────────
console.log("\nBR_17 — exception density");
{
  const thin = analyzeRegister(
    parseRegister(register(row("BR_20", "BR"), row("BR-20_A", "---"), row("BR-20_B", "---"), row("BR-20_SE-01", "SE")))
  );
  assert(thin.density === 0.5, "1 exception / 2 steps = 0.5");
  assert(thin.density < EXCEPTION_DENSITY_FLOOR, "below the floor");

  const noSteps = analyzeRegister(parseRegister(register(row("BR_20", "BR"))));
  assert(noSteps.density === null, "no steps → null density, never a divide-by-zero");
}

// ─── columns ────────────────────────────────────────────────────────────────
console.log("\nBR_17 — schema drift is detected");
{
  const full = analyzeRegister(parseRegister(register(row("BR_20", "BR"))));
  assert(full.missing_columns.length === 0, "the in-use schema satisfies REQUIRED_COLUMNS");
  assert(
    full.missing_added_columns.length === ADDED_COLUMNS.length,
    "the ADR-0061 columns are reported as not yet adopted"
  );

  const short = parseRegister(["| ID | Type | Usecase |", "|---|---|---|", "| BR_20 | BR | x |"].join("\n"));
  const shortA = analyzeRegister(short);
  assert(shortA.missing_columns.includes("Justification"), "a dropped required column is named");
  assert(shortA.missing_columns.includes("Status"), "all dropped columns are named");
}

// ─── findings summary ───────────────────────────────────────────────────────
console.log("\nBR_17 — findings summary");
{
  // Two steps, one requirement-level exception → density 0.5 (below the floor)
  // AND requirement-level attachment: both findings from one fixture.
  const reqLevel = analyzeRegister(
    parseRegister(
      register(row("BR_20", "BR"), row("BR-20_G", "---"), row("BR-20_H", "---"), row("BR-20_SE-01", "SE"))
    )
  );
  const findings = summarizeFindings([{ file: "BR_20.md", ...reqLevel }]);
  assert(findings.some((f) => f.includes("attach exceptions to the requirement")), "attachment finding surfaced");
  assert(findings.some((f) => f.includes("below the")), "density finding surfaced");
  assert(findings.some((f) => f.includes("Verifier column")), "missing Verifier column surfaced");
  assert(summarizeFindings([]).length === 0, "no reports → no findings");

  const clean = analyzeRegister(
    parseRegister(
      [
        `| ${[...REQUIRED_COLUMNS, ...ADDED_COLUMNS].join(" | ")} |`,
        `|${[...REQUIRED_COLUMNS, ...ADDED_COLUMNS].map(() => "---").join("|")}|`,
        `| BR_20 | BR | ${Array(10).fill("x").join(" | ")} |`,
        `| BR-20_G | --- | ${Array(10).fill("x").join(" | ")} |`,
        `| BR-20_G_SE-01 | SE | ${Array(10).fill("x").join(" | ")} |`,
        `| BR-20_G_BE-01 | BE | ${Array(10).fill("x").join(" | ")} |`,
      ].join("\n")
    )
  );
  assert(summarizeFindings([{ file: "BR_20.md", ...clean }]).length === 0, "a compliant register produces no findings");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
