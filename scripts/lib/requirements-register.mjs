#!/usr/bin/env node
// Requirements-register completeness checker (ADR-0061).
//
// ── Why this exists: the harvest ─────────────────────────────────────────
//
// ADR-0046 §5 deferred the requirements-analyst agent with a condition: "skill
// now, agent later — build once the pattern is proven on 2–3 requirements."
// Nine registers were authored (BR_01, BR_06–BR_13), three times the bar. The
// SKILL.md then insisted the nine be *harvested* before the agent shipped,
// because "an agent written from the format alone would discard exactly what the
// gate was for."
//
// The harvest (2026-08-13) found three things, none of which were guessable from
// the format:
//
//   1. THE SCHEMA SILENTLY DEGRADED. The skill specifies twelve fields. All nine
//      registers use the same *ten* different columns. Five specified fields
//      appear in ZERO registers: Assets/Cred/Other, Input Source or Condition,
//      Input Data Format, Output Data Format, and Next Step. Because Next Step
//      is absent, the skill's own validator rules 4 (every Next Step resolves)
//      and 5 (format handoffs type-check) have never been runnable — the two
//      rules aimed at the failure class the skill calls "where production
//      incidents live."
//
//   2. EXCEPTION DENSITY DECAYED AS THE PATTERN BECAME ROUTINE. The skill's
//      calibration baseline is ~1.7 exceptions per solution step (22 steps → 22
//      SE + 16 BE). Early registers hold it (BR_07: 13 exceptions / 3 steps).
//      Later ones collapse: BR_13 = 0.4/step, and BR_12 has FOUR steps and ZERO
//      exceptions. The skill already warns "a step with zero exceptions is not
//      simple; it is unexamined" — and it happened anyway, because nothing
//      measured it.
//
//   3. THE REAL DEFECTS WERE FOUND BY ADVERSARIES, NOT BY REVIEW. Both
//      substantive post-authoring revisions came from something attacking the
//      spec, not reading it: the Critic found a contained-scope bypass in BR_01
//      (a compound command mentioning `.worktrees` was wrongly allowed), and the
//      efficacy harness itself found the curl|sh RCE gap behind BR_13 (+8→+11).
//      Neither was a missing field. Both were a missing *adversary*.
//
// Findings 1 and 2 are mechanical, so they belong in code rather than in prose
// nobody re-reads — the same lesson ADR-0059/0060 landed on from the other side.
// Finding 3 is why ADR-0061 adds a Verifier column: an exception list is not
// validated by reviewing it.

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "../hooks/_lib.mjs";

/** The ADR-0061 schema: the ten columns in real use, plus the two this ADR adds. */
export const REQUIRED_COLUMNS = [
  "ID",
  "Type",
  "Framework Location",
  "Usecase",
  "Expected Input",
  "Expected Output",
  "Actual Input",
  "Actual Output",
  "Justification",
  "Status",
];

/** Added by ADR-0061. Warned about, not yet required, until the backlog clears. */
export const ADDED_COLUMNS = ["Owner Role", "Verifier"];

/**
 * Exceptions per solution step below which a step is treated as unexamined.
 * The skill's own calibration is ~1.7/step; 1.0 is a deliberately forgiving
 * floor so the check flags neglect rather than nagging about thoroughness.
 */
export const EXCEPTION_DENSITY_FLOOR = 1.0;

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** Parse a markdown register into { columns, rows }. */
export function parseRegister(text) {
  const lines = String(text || "").split("\n");
  let columns = null;
  const rows = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = t.slice(1, t.endsWith("|") ? -1 : undefined).split("|").map(norm);
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
    if (!columns) {
      // The first pipe row whose first cell is "ID" is the header. Anything
      // before that is some other table in the document.
      if (cells[0] === "ID") columns = cells;
      continue;
    }
    if (cells.length < 2) continue;
    const row = {};
    columns.forEach((c, i) => { row[c] = cells[i] ?? ""; });
    // Strip markdown emphasis/backticks from the two fields we key on.
    row.ID = (row.ID || "").replace(/[`*]/g, "").trim();
    row.Type = (row.Type || "").replace(/[`*]/g, "").trim();
    if (!row.ID) continue;
    rows.push(row);
  }
  return { columns: columns || [], rows };
}

const isStep = (r) => r.Type === "---";
const isSE = (r) => r.Type === "SE";
const isBE = (r) => r.Type === "BE";
const isTR = (r) => r.Type === "TR";

/**
 * The step an exception is attached to — the LONGEST step ID that prefixes it.
 *
 * Returns null when the exception hangs off the requirement instead
 * (`BR-01_SE-01` rather than `BR-01_Guard_SE-01`). That is not a parse failure;
 * it is the finding. The skill is explicit that attaching exceptions to a
 * requirement rather than a solution "produces a list that is wrong the moment
 * the approach changes" — and all nine registers do exactly that.
 */
function stepOf(exceptionRow, steps) {
  const id = exceptionRow.ID;
  let best = null;
  for (const s of steps) {
    if (id.startsWith(`${s.ID}_`) && (!best || s.ID.length > best.ID.length)) best = s;
  }
  return best;
}

/**
 * Analyse one parsed register.
 * @returns {{steps:number, se:number, be:number, tr:number, exceptions:number,
 *   density:number|null, unexamined_steps:string[], missing_columns:string[],
 *   missing_added_columns:string[], rows:number}}
 */
export function analyzeRegister(parsed) {
  const rows = parsed.rows || [];
  const cols = parsed.columns || [];
  const steps = rows.filter(isStep);
  const ses = rows.filter(isSE);
  const bes = rows.filter(isBE);
  const trs = rows.filter(isTR);

  const perStep = new Map(steps.map((s) => [s.ID, 0]));
  const orphans = [];
  for (const e of [...ses, ...bes]) {
    const s = stepOf(e, steps);
    if (s) perStep.set(s.ID, (perStep.get(s.ID) || 0) + 1);
    else orphans.push(e.ID);
  }
  const exceptions = ses.length + bes.length;
  const stepAttached = exceptions - orphans.length;

  // "Unexamined step" is only a meaningful reading when the register attaches
  // exceptions to steps at all. Where every exception hangs off the requirement,
  // reporting each step as unexamined would be an artefact of the naming
  // convention, not a coverage finding — and a check that manufactures 26 false
  // findings is a check people turn off.
  const attachment = exceptions === 0 ? "none" : stepAttached === 0 ? "requirement-level" : "step-level";
  const unexamined =
    attachment === "step-level"
      ? [...perStep.entries()].filter(([, n]) => n === 0).map(([id]) => id)
      : [];

  return {
    rows: rows.length,
    steps: steps.length,
    se: ses.length,
    be: bes.length,
    tr: trs.length,
    exceptions,
    density: steps.length === 0 ? null : exceptions / steps.length,
    attachment,
    orphan_exceptions: orphans,
    unexamined_steps: unexamined,
    missing_columns: REQUIRED_COLUMNS.filter((c) => !cols.includes(c)),
    missing_added_columns: ADDED_COLUMNS.filter((c) => !cols.includes(c)),
  };
}

/** Analyse every register under a directory. */
export async function analyzeAll(root = PROJECT_ROOT) {
  const dir = path.join(root, "observability", "eval-suite", "requirements");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => /^BR_\d+\.md$/.test(f)).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    const text = await fs.readFile(path.join(dir, f), "utf8");
    out.push({ file: f, ...analyzeRegister(parseRegister(text)) });
  }
  return out;
}

/** Findings worth a doctor warning, in priority order. */
export function summarizeFindings(reports) {
  const findings = [];
  const schemaBroken = reports.filter((r) => r.missing_columns.length > 0);
  if (schemaBroken.length) {
    findings.push(
      `${schemaBroken.length} register(s) missing required column(s): ` +
        schemaBroken.map((r) => `${r.file} → ${r.missing_columns.join(", ")}`).join("; ")
    );
  }
  const thin = reports.filter((r) => r.density !== null && r.density < EXCEPTION_DENSITY_FLOOR);
  if (thin.length) {
    findings.push(
      `${thin.length} register(s) below the ${EXCEPTION_DENSITY_FLOOR}/step exception floor: ` +
        thin.map((r) => `${r.file} ${r.density.toFixed(1)}/step`).join(", ")
    );
  }
  const reqLevel = reports.filter((r) => r.attachment === "requirement-level");
  if (reqLevel.length) {
    findings.push(
      `${reqLevel.length} register(s) attach exceptions to the requirement, not the solution step ` +
        `(e.g. BR-01_SE-01 rather than BR-01_Guard_SE-01) — the list goes stale the moment the approach changes: ` +
        reqLevel.map((r) => r.file).join(", ")
    );
  }
  const unexamined = reports.filter((r) => r.unexamined_steps.length > 0);
  if (unexamined.length) {
    const total = unexamined.reduce((n, r) => n + r.unexamined_steps.length, 0);
    findings.push(
      `${total} solution step(s) with zero exceptions (unexamined, not simple): ` +
        unexamined.map((r) => `${r.file} → ${r.unexamined_steps.join(", ")}`).join("; ")
    );
  }
  const noVerifier = reports.filter((r) => r.missing_added_columns.includes("Verifier"));
  if (noVerifier.length === reports.length && reports.length > 0) {
    findings.push(
      `no register carries the ADR-0061 Verifier column yet — ${reports.length} to migrate ` +
        `(the harvest found real defects came from adversaries, not review)`
    );
  }
  return findings;
}

// ── CLI (guarded — importing never runs it) ──────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const reports = await analyzeAll();
  if (reports.length === 0) {
    console.log("no registers found under observability/eval-suite/requirements/");
    process.exit(0);
  }
  console.log("\n  register   steps  SE  BE  TR  exc/step   attachment");
  console.log("  " + "─".repeat(62));
  for (const r of reports) {
    const d = r.density === null ? "  n/a" : r.density.toFixed(1).padStart(5);
    const flag = r.density !== null && r.density < EXCEPTION_DENSITY_FLOOR ? " ⚠" : "  ";
    console.log(
      `  ${r.file.replace(".md", "").padEnd(9)}  ${String(r.steps).padStart(5)}  ${String(r.se).padStart(2)}  ${String(r.be).padStart(2)}  ${String(r.tr).padStart(2)}  ${d}${flag}   ${r.attachment}`
    );
  }
  const findings = summarizeFindings(reports);
  console.log("");
  if (findings.length === 0) console.log("  ✓ all registers complete\n");
  else for (const f of findings) console.log(`  ! ${f}\n`);
  process.exit(0);
}
