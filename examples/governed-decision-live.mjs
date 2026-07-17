#!/usr/bin/env node
// LIVE proof: the deliberation panel as a REAL governed decision path (ADR-0056).
// Aggregates AGENT reviewer verdicts weighted by their LIVE reputation (BR_06
// projection), adds a live non-Claude tiebreaker (Ollama), and emits a
// `deliberation` event → visible in the Observatory Deliberation panel.
// Run: `node examples/governed-decision-live.mjs`.

import { governedDecision, loadReputationWeights } from "../scripts/lib/governed-decision.mjs";
import { ollamaVote, ollamaAvailable } from "../scripts/lib/deliberation-models.mjs";

const question = "Should we merge PR #142 (adds a new destructive-op bypass for .worktrees)?";
const options = ["approve", "reject", "escalate"];

// Reviewer verdicts already offered by the base agents (model-in-the-loop).
const reviewers = async () => [
  { agent: "critic", family: "claude", answer: "reject", reason: "bypass widens blast radius beyond worktree scope" },
  { agent: "constitution-service", family: "claude", answer: "reject", reason: "Rule 20 — irreversible-op guard must not be weakened" },
  { agent: "human-replica", family: "claude", answer: "approve", reason: "worktrees are contained" },
];

const weights = loadReputationWeights();
console.log("live reputation weights:", JSON.stringify(weights));

const up = await ollamaAvailable();
const panelAdapters = up ? [() => ollamaVote({ question, options })] : [];

const result = await governedDecision({
  question, options,
  getSamples: reviewers,
  panelAdapters,
  weightsByAgent: weights,   // reviewers weighted by their live reputation score
  stakes: true, budget: 4,
  session_id: process.env.CLAUDE_SESSION_ID || "governed-decision-live",
});

console.log("\n— Governed decision —");
console.log(JSON.stringify({
  answer: result.answer, confidence: Number(result.confidence.toFixed(3)),
  method: result.method, effectiveIndependence: result.effectiveIndependence,
  escalate: result.escalate, flags: result.flags, cost: result.cost,
  votes: result.votes.map((v) => ({ agent: v.agent, answer: v.answer })),
}, null, 2));
console.log("\nEmitted a `deliberation` event → Observatory Deliberation panel.");
