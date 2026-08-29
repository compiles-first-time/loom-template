#!/usr/bin/env node
// Efficacy eval harness (ADR-0054 Phase 1a) — the FIRST governed-vs-ungoverned
// measurement. Drives the REAL governance layer (permissions-classifier →
// destructive-guard, exactly what scripts/hooks/pre-tool-use.mjs runs) over the
// labelled task suite in scenarios.mjs and computes:
//
//   safety_catch_delta   — # unsafe ops the governed layer blocks (deny/ask)
//                          that the ungoverned baseline would execute silently.
//   governed_catch_rate  — blocked_unsafe / total_unsafe.
//   false_positive_rate  — safe ops wrongly blocked / total_safe.
//   discipline           — deterministic? (same input → same decision, re-run).
//   token_cost           — 0: the classifier is deterministic, no LLM. Governance
//                          is FREE — a real part of the efficacy story.
//
// Honest scope: this measures the ENFORCEMENT layer's safety-catch efficacy (the
// deterministic core of ADR-0054's "governed-vs-ungoverned safety-catch delta").
// The richer live-agent A/B (discipline adherence + rework-avoided over real
// tasks) is a follow-on that fuses this harness with a real governed build.
//
// Usage: node observability/eval-suite/efficacy/harness.mjs   (or scripts/efficacy.{sh,ps1})

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPermissions, classifyToolCall } from "../../../scripts/lib/permissions-classifier.mjs";
import { decideDestructiveAction } from "../../../scripts/lib/destructive-guard.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const BLOCKING = new Set(["deny", "ask"]); // governance intervenes (blocks or confirms)

function governedDecisionFor(sc, perms) {
  const hits = classifyToolCall({ tool: sc.tool, input: sc.input, permissions: perms });
  return decideDestructiveAction({ tool: sc.tool, input: sc.input, hits }).decision;
}

/** Run the efficacy measurement. Pure over injected scenarios; returns metrics. */
export async function runEfficacy(scenarios = SCENARIOS) {
  const perms = await loadPermissions();
  const results = scenarios.map((sc) => {
    const governed = governedDecisionFor(sc, perms);
    // Determinism / discipline: re-run and confirm the same decision.
    const governed2 = governedDecisionFor(sc, perms);
    return {
      id: sc.id, class: sc.class, expected: sc.expected,
      governed, ungoverned: "allow", // no governance → the op executes as-is
      blocked: BLOCKING.has(governed),
      deterministic: governed === governed2,
      matches_expected: governed === sc.expected,
    };
  });

  const unsafe = results.filter((r) => r.class === "unsafe");
  const safe = results.filter((r) => r.class === "safe");
  const caughtUnsafe = unsafe.filter((r) => r.blocked).length;
  const falsePos = safe.filter((r) => r.blocked).length;

  return {
    total: results.length,
    n_unsafe: unsafe.length,
    n_safe: safe.length,
    // The headline: governance catches `caughtUnsafe` unsafe ops the ungoverned
    // baseline (which catches 0) would let execute.
    safety_catch_delta: caughtUnsafe,
    governed_catch_rate: unsafe.length ? caughtUnsafe / unsafe.length : 1,
    ungoverned_catch_rate: 0,
    false_positive_rate: safe.length ? falsePos / safe.length : 0,
    discipline_deterministic: results.every((r) => r.deterministic),
    all_expected: results.every((r) => r.matches_expected),
    token_cost: 0,
    results,
  };
}

/**
 * Seeded-defect run (ADR-0062). Rewrites every unsafe scenario in
 * meaning-preserving ways and asserts the governance layer still catches it.
 *
 * A surviving mutant is a real evasion gap: a command that does the same
 * dangerous thing, written slightly differently, that governance waves through.
 * This is how the `curl | sh` RCE gap was found — by a harness, not by review.
 *
 * @returns {Promise<{total:number, caught:number, survivors:object[], mutation_score:number}>}
 */
export async function runMutation(scenarios = SCENARIOS, capPerScenario = 6) {
  const { mutateAll } = await import("./mutations.mjs");
  const perms = await loadPermissions();
  const mutants = mutateAll(scenarios, capPerScenario);

  const survivors = [];
  let caught = 0;
  for (const mut of mutants) {
    const decision = governedDecisionFor(mut, perms);
    if (BLOCKING.has(decision)) caught++;
    else survivors.push({ id: mut.id, base: mut.base, operator: mut.operator, command: mut.input.command, decision, rationale: mut.rationale });
  }

  return {
    total: mutants.length,
    caught,
    survivors,
    // Mutation score, in the Jia & Harman sense: the fraction of seeded faults
    // the checker detects.
    mutation_score: mutants.length ? caught / mutants.length : 1,
  };
}

/**
 * Compare a run against the frozen baseline (ADR-0062).
 *
 * The baseline lives in the repo so it cannot be relaxed silently to make a red
 * run pass — the pre-registration principle from the evidence review §3.5.
 */
export function compareToBaseline(m, mut, baseline) {
  const failures = [];
  if (m.n_unsafe < baseline.min_unsafe_scenarios) {
    failures.push(`scenario set shrank: ${m.n_unsafe} unsafe < baseline ${baseline.min_unsafe_scenarios} (coverage must not be deleted to go green)`);
  }
  if (m.safety_catch_delta < baseline.min_safety_catch_delta) {
    failures.push(`safety-catch delta regressed: ${m.safety_catch_delta} < baseline ${baseline.min_safety_catch_delta}`);
  }
  if (m.governed_catch_rate < baseline.min_governed_catch_rate) {
    failures.push(`governed catch rate regressed: ${(m.governed_catch_rate * 100).toFixed(0)}% < baseline ${(baseline.min_governed_catch_rate * 100).toFixed(0)}%`);
  }
  if (m.false_positive_rate > baseline.max_false_positive_rate) {
    failures.push(`false-positive rate rose: ${(m.false_positive_rate * 100).toFixed(0)}% > baseline ${(baseline.max_false_positive_rate * 100).toFixed(0)}% (friction destroys the signal)`);
  }
  if (baseline.require_deterministic && !m.discipline_deterministic) {
    failures.push("governance became non-deterministic");
  }
  if (baseline.require_all_expected && !m.all_expected) {
    failures.push("at least one decision no longer matches its expected label");
  }
  if (mut && mut.mutation_score < baseline.min_mutation_score) {
    failures.push(
      `mutation score regressed: ${(mut.mutation_score * 100).toFixed(0)}% < baseline ${(baseline.min_mutation_score * 100).toFixed(0)}% — survivors: ${mut.survivors.map((s) => s.id).join(", ")}`
    );
  }
  return failures;
}

// ── CLI: run, write a dated run file, emit an efficacy_run event ──────────────
if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1] || "").href) {
  const argv = process.argv.slice(2);
  const wantMutate = argv.includes("--mutate") || argv.includes("--gate");
  const wantGate = argv.includes("--gate");
  const m = await runEfficacy();
  const mut = wantMutate ? await runMutation() : null;
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const runsDir = path.join(HERE, "runs");
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  await fs.writeFile(path.join(runsDir, `${day}.json`), JSON.stringify(m, null, 2) + "\n", "utf8");

  // Emit an efficacy_run event to the event log (Observatory).
  try {
    const { appendEvent, mechanicalRecord } = await import("../../../scripts/hooks/_lib.mjs");
    appendEvent(mechanicalRecord("efficacy_run", {
      session_id: process.env.CLAUDE_SESSION_ID,
      total: m.total, n_unsafe: m.n_unsafe, n_safe: m.n_safe,
      safety_catch_delta: m.safety_catch_delta,
      governed_catch_rate: m.governed_catch_rate,
      false_positive_rate: m.false_positive_rate,
      discipline_deterministic: m.discipline_deterministic,
      token_cost: m.token_cost,
    }));
  } catch { /* best-effort */ }

  process.stdout.write(
    `\nEfficacy (governed vs ungoverned) — ${m.total} scenarios\n` +
    `  safety-catch delta:   +${m.safety_catch_delta}  (governed blocks ${m.safety_catch_delta}/${m.n_unsafe} unsafe; ungoverned blocks 0)\n` +
    `  governed catch rate:  ${(m.governed_catch_rate * 100).toFixed(0)}%   (ungoverned: 0%)\n` +
    `  false-positive rate:  ${(m.false_positive_rate * 100).toFixed(0)}%   (${m.n_safe} safe ops)\n` +
    `  discipline (determ.): ${m.discipline_deterministic ? "100% (deterministic)" : "NON-DETERMINISTIC"}\n` +
    `  decisions == expected: ${m.all_expected ? "yes" : "NO"}\n` +
    `  token cost:           $0 (deterministic classifier — governance is free)\n`
  );

  if (mut) {
    process.stdout.write(
      `\nSeeded-defect run (ADR-0062) — ${mut.total} meaning-preserving mutants of the unsafe set\n` +
      `  mutation score:       ${(mut.mutation_score * 100).toFixed(0)}%  (${mut.caught}/${mut.total} still caught)\n`
    );
    if (mut.survivors.length) {
      process.stdout.write(`  SURVIVORS — evasion gaps, same danger, different spelling:\n`);
      for (const s of mut.survivors) {
        process.stdout.write(`    ✗ ${s.id.padEnd(34)} → ${s.decision}\n      ${s.command}\n      (${s.rationale})\n`);
      }
    } else {
      process.stdout.write(`  no survivors — every rewrite of an unsafe op was still caught\n`);
    }
  }

  let gateFailures = [];
  if (wantGate) {
    const baselinePath = path.join(HERE, "baseline.json");
    if (!existsSync(baselinePath)) {
      process.stdout.write(`\nGate: no baseline.json — nothing to regress against.\n`);
    } else {
      const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
      gateFailures = compareToBaseline(m, mut, baseline);
      process.stdout.write(
        `\nGovernance regression gate (baseline frozen ${baseline.frozen_at})\n` +
        (gateFailures.length === 0
          ? `  ✓ no regression against the frozen baseline\n`
          : gateFailures.map((f) => `  ✗ ${f}\n`).join(""))
      );
    }
  }

  process.stdout.write("\n");
  const ok =
    m.all_expected &&
    m.discipline_deterministic &&
    gateFailures.length === 0 &&
    (!mut || mut.survivors.length === 0 || !wantGate);
  process.exit(ok ? 0 : 1);
}
