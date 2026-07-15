#!/usr/bin/env node
// LIVE proof for the deliberation panel (ADR-0056 / BR_07): a genuine
// model-diverse vote where the SECOND model really runs (local Ollama) — not a
// stub. The Claude arm is model-in-the-loop (the orchestrating model supplies
// its self-consistency votes, the Loom Claim convention); the second arm is a
// live llama3 call. Run: `node examples/deliberation-live.mjs`.
//
// This is a demonstration/eval, NOT part of the deterministic suite (which must
// pass without Ollama). Its captured output is recorded in BR_07's register.

import { runDeliberation } from "../scripts/lib/deliberation.mjs";
import { ollamaVote, ollamaAvailable, emitDeliberationCost } from "../scripts/lib/deliberation-models.mjs";

const question = "What is the capital city of Australia?";
const options = ["Sydney", "Canberra", "Melbourne"];

const up = await ollamaAvailable();
console.log(`Ollama reachable: ${up}`);
if (!up) {
  console.log("No local Ollama — the panel would DEGRADE to self-consistency (SE-01). Start Ollama to see a live second-model vote.");
  process.exit(0);
}

// Claude's self-consistency votes (model-in-the-loop). The orchestrating model
// answers "Canberra" across paths.
const claudeSamples = async () => [
  { agent: "claude#1", model: "claude-opus-4-8", family: "claude", answer: "Canberra" },
  { agent: "claude#2", model: "claude-opus-4-8", family: "claude", answer: "Canberra" },
  { agent: "claude#3", model: "claude-opus-4-8", family: "claude", answer: "Canberra" },
];

// stakes:true forces the cost gate to escalate → the LIVE llama3 vote is cast.
const result = await runDeliberation({
  getSamples: claudeSamples,
  panelAdapters: [() => ollamaVote({ question, options })],
  stakes: true,
  budget: 4,
  // LR-06: the orchestrator emits a loop_cost_summary at completion.
  onCost: (r) => emitDeliberationCost(r, { loop_id: "deliberation-live" }),
});

console.log("\nQuestion:", question);
console.log("Options :", options.join(" | "));
console.log("\n— Live panel result —");
console.log(JSON.stringify({
  answer: result.answer,
  confidence: Number(result.confidence.toFixed(3)),
  method: result.method,
  effectiveIndependence: result.effectiveIndependence,
  escalate: result.escalate,
  flags: result.flags,
  cost: result.cost,
  votes: result.votes.map((v) => ({ agent: v.agent, family: v.family, answer: v.answer, reason: v.reason })),
}, null, 2));
