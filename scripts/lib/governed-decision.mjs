#!/usr/bin/env node
// Governed decision (ADR-0056 deliberation panel, made a REAL decision path).
//
// The map (2026-07-15) found the panel was a standalone library: no entry point,
// no event emission, no Observatory presence — "the deliberation panel as a
// user-facing feature does not exist yet." This wires it into the governed
// workflow: a callable decision that
//   1. aggregates AGENT reviewer verdicts (critic / constitution-service /
//      human-replica / a live 2nd model) via the disciplined panel,
//   2. weights each reviewer by its LIVE reputation score (BR_06 projection) —
//      closing the reputation→panel loop,
//   3. emits a `deliberation` event (Observatory Deliberation panel) + a
//      loop_cost_summary (LR-06),
//   4. returns the robust, cost-gated, confidence-calibrated verdict.
//
// Reputation weighting here is DISPLAY/AGGREGATION only — it does not steer which
// agent is dispatched (that is ADR-0053 Step 3, gated on constitution-service).
// Weighting reviewer votes you already have is not narrowing anyone's possibility
// space; it's robust aggregation of opinions already offered.

import { runDeliberation } from "./deliberation.mjs";
import { emitDeliberationCost } from "./deliberation-models.mjs";
import { appendEvent, mechanicalRecord, EVENT_LOG_DIR } from "../hooks/_lib.mjs";
import { computeReputation } from "../../observatory/lib/reputation.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Read the live reputation projection from the event log → { agent: score }. */
export function loadReputationWeights(eventLogDir = EVENT_LOG_DIR) {
  if (!existsSync(eventLogDir)) return {};
  const events = [];
  for (const f of readdirSync(eventLogDir).filter((x) => x.endsWith(".jsonl"))) {
    for (const line of readFileSync(path.join(eventLogDir, f), "utf8").split("\n")) {
      if (line.trim()) { try { events.push(JSON.parse(line)); } catch { /* skip */ } }
    }
  }
  const proj = computeReputation(events);
  const w = {};
  for (const [agent, rec] of Object.entries(proj.agents)) w[agent] = rec.score ?? 1;
  return w;
}

/**
 * Run a governed decision. `getSamples`/`panelAdapters` are injected (testable);
 * `weightsByAgent` maps agent→weight (default: the live reputation projection).
 * Emits a `deliberation` event + loop_cost_summary unless emit:false.
 */
export async function governedDecision({
  question, options = null, getSamples, panelAdapters = [],
  weightsByAgent = null, stakes = false, budget = 4, session_id, emit = true,
} = {}) {
  const weights = weightsByAgent || loadReputationWeights();
  const weightFor = (v) => {
    const w = weights[v.agent] ?? weights[v.family] ?? 1;
    return Number.isFinite(w) && w > 0 ? w : 1;
  };

  const result = await runDeliberation({
    getSamples, panelAdapters, weightFor, stakes, budget,
    onCost: emit ? (r) => emitDeliberationCost(r, { loop_id: "governed-decision" }) : null,
  });

  if (emit) {
    appendEvent(
      mechanicalRecord("deliberation", {
        session_id,
        question: String(question || "").slice(0, 300),
        options: options || null,
        answer: result.answer,
        confidence: result.confidence,
        method: result.method,
        effective_independence: result.effectiveIndependence,
        escalate: result.escalate,
        flags: result.flags,
        cost: result.cost,
        votes: (result.votes || []).map((v) => ({ agent: v.agent, family: v.family, answer: v.answer })),
      })
    );
  }
  return result;
}

// ── CLI (guarded) — decide from reviewer votes supplied as JSON ──────────────
// node governed-decision.mjs "question" '[{"agent":"critic","family":"claude","answer":"approve"}, ...]'
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [question, votesJson] = process.argv.slice(2);
  if (!question || !votesJson) {
    process.stderr.write('usage: governed-decision.mjs "<question>" \'[{"agent","family","answer"}...]\'\n');
    process.exit(2);
  }
  let votes;
  try { votes = JSON.parse(votesJson); } catch { process.stderr.write("votes must be JSON\n"); process.exit(2); }
  const result = await governedDecision({
    question,
    getSamples: async () => votes,
    stakes: true,
    session_id: process.env.CLAUDE_SESSION_ID,
  });
  process.stdout.write(JSON.stringify({ answer: result.answer, confidence: Number(result.confidence.toFixed(3)), method: result.method, escalate: result.escalate, flags: result.flags }, null, 2) + "\n");
}
