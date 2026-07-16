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

// ── CLI: run, write a dated run file, emit an efficacy_run event ──────────────
if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1] || "").href) {
  const m = await runEfficacy();
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
  process.exit(m.all_expected && m.discipline_deterministic ? 0 : 1);
}
