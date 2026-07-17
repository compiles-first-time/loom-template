// Canonical BR_12 test cases (governed decision — the panel as a real decision path / ADR-0056).
//
// Consumed by scripts/lib/governed-decision.test.mjs. Deterministic: reviewer
// votes + weights are injected. The emission case spawns the entrypoint in a
// temp Loom root and reads back the emitted `deliberation` event.

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { governedDecision, loadReputationWeights } from "../../../scripts/lib/governed-decision.mjs";
import { Aggregator } from "../../../observatory/lib/aggregator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const T = "2026-07-15T12:00:00.000Z";
const ev = (event_type, extra = {}) => ({ timestamp: T, session_id: "s1", event_type, ...extra });
const v = (agent, answer) => ({ agent, family: "claude", answer });

export const BR_12_CASES = [
  {
    id: "BR_12", type: "BR", framework_location: "scripts/lib/governed-decision.mjs",
    title: "Governed decision aggregates reviewer verdicts, reputation-weighted",
    expected_input: "3 reviewer verdicts + per-agent reputation weights",
    expected_output: "robust verdict; weights applied; no emission when emit:false",
    justification: "The map found the panel had no entry point — this is the real, callable decision path closing the reputation→panel loop.",
    async run() {
      const r = await governedDecision({
        question: "merge?",
        getSamples: async () => [v("critic", "reject"), v("constitution-service", "reject"), v("human-replica", "approve")],
        weightsByAgent: { critic: 0.9, "constitution-service": 0.8, "human-replica": 0.3 },
        stakes: true, emit: false,
      });
      const ok = r.answer === "reject" && typeof r.confidence === "number";
      return { actual: `answer=${r.answer}, conf=${r.confidence.toFixed(3)}, method=${r.method}`, pass: ok };
    },
  },
  {
    id: "BR-12_RepWeight", type: "---", framework_location: "scripts/lib/governed-decision.mjs",
    title: "Reputation weighting is applied (higher-rep reviewer counts more, capped)",
    expected_input: "reviewers where reputation flips a naive count",
    expected_output: "weighting changes the outcome vs uniform, but stays robust",
    justification: "Weighting reviewer votes you already have (not steering dispatch) is Rule-2-safe robust aggregation.",
    async run() {
      // Naive count: A=1, B=2 → B. But A's reviewers have high reputation.
      const votes = [v("critic", "A"), v("eac", "A"), v("rookie1", "B"), v("rookie2", "B"), v("rookie3", "B")];
      const uniform = await governedDecision({ question: "q", getSamples: async () => votes, weightsByAgent: {}, emit: false });
      const weighted = await governedDecision({
        question: "q", getSamples: async () => votes,
        weightsByAgent: { critic: 0.95, eac: 0.9, rookie1: 0.15, rookie2: 0.15, rookie3: 0.15 },
        emit: false,
      });
      // Uniform → B (3 vs 2). Weighted → A should win or at least escalate (contested).
      const ok = uniform.answer === "B" && (weighted.answer === "A" || weighted.escalate === true);
      return { actual: `uniform=${uniform.answer}, weighted=${weighted.answer} (escalate=${weighted.escalate})`, pass: ok };
    },
  },
  {
    id: "BR-12_Load", type: "---", framework_location: "scripts/lib/governed-decision.mjs",
    title: "loadReputationWeights reads the live projection → {agent: score}",
    expected_input: "a temp event log with reputation_events",
    expected_output: "weights map with the agent's projected score",
    justification: "The panel weights reviewers by the LIVE reputation projection, not a static config.",
    run() {
      const tmp = mkdtempSync(path.join(os.tmpdir(), "loom-repw-"));
      try {
        const logDir = path.join(tmp, "memory", "event-log");
        mkdirSync(logDir, { recursive: true });
        const lines = [
          ev("reputation_event", { agent: "critic", kind: "verifier_pass" }),
          ev("reputation_event", { agent: "critic", kind: "verifier_pass" }),
          ev("reputation_event", { agent: "critic", kind: "critic_approval" }),
        ].map((x) => JSON.stringify(x)).join("\n");
        writeFileSync(path.join(logDir, "2026-07-15.jsonl"), lines + "\n");
        const w = loadReputationWeights(logDir);
        const ok = typeof w.critic === "number" && w.critic > 0.5;
        return { actual: `critic weight=${w.critic?.toFixed(3)}`, pass: ok };
      } finally { rmSync(tmp, { recursive: true, force: true }); }
    },
  },
  {
    id: "BR-12_Emit", type: "---", framework_location: "scripts/lib/governed-decision.mjs",
    title: "Governed decision EMITS a deliberation event (Observatory)",
    expected_input: "governed-decision CLI in a temp Loom root",
    expected_output: "a `deliberation` event lands in the event log",
    justification: "The decision must be observable — it emits a deliberation event the Observatory renders.",
    run() {
      const tmp = mkdtempSync(path.join(os.tmpdir(), "loom-delib-"));
      try {
        writeFileSync(path.join(tmp, "loom-spec.md"), "x");
        mkdirSync(path.join(tmp, "constitution"), { recursive: true });
        writeFileSync(path.join(tmp, "constitution", "kernel-v6.md"), "x");
        mkdirSync(path.join(tmp, ".claude"), { recursive: true });
        writeFileSync(path.join(tmp, ".claude", "loom-permissions.yaml"), "x");
        const votes = JSON.stringify([v("critic", "reject"), v("constitution-service", "reject"), v("human-replica", "approve")]);
        const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/lib/governed-decision.mjs"), "merge PR?", votes], {
          cwd: tmp, env: { ...process.env, LOOM_PROJECT_ROOT: tmp }, encoding: "utf8",
        });
        let found = null;
        const logDir = path.join(tmp, "memory", "event-log");
        if (existsSync(logDir)) {
          for (const f of readdirSync(logDir)) {
            for (const line of readFileSync(path.join(logDir, f), "utf8").split("\n")) {
              if (!line.trim()) continue;
              const rec = JSON.parse(line);
              if (rec.event_type === "deliberation") found = rec;
            }
          }
        }
        const ok = r.status === 0 && found && found.answer === "reject" && Array.isArray(found.votes);
        return { actual: found ? `deliberation: answer=${found.answer}, votes=${found.votes.length}` : "no deliberation event", pass: !!ok };
      } finally { rmSync(tmp, { recursive: true, force: true }); }
    },
  },
  {
    id: "BR-12_Wire", type: "---", framework_location: "observatory/lib/aggregator.mjs",
    title: "deliberation event is projected + surfaces in activity",
    expected_input: "Aggregator.ingestEvent(deliberation)",
    expected_output: "state.deliberations.decisions populated + activity entry",
    justification: "The Deliberation dashboard panel reads state.deliberations.",
    run() {
      const agg = new Aggregator();
      agg.ingestEvent(ev("deliberation", { question: "merge?", answer: "reject", confidence: 0.71, method: "panel:reputation-weighted-vote", escalate: false, flags: [], cost: 2, votes: [v("critic", "reject")] }));
      const rec = agg.state.deliberations.decisions[0];
      const feed = agg.state.activity.feed.some((f) => f.kind === "deliberation");
      const ok = !!rec && rec.answer === "reject" && rec.confidence === 0.71 && feed;
      return { actual: `decision=${rec?.answer}@${rec?.confidence}, feed=${feed}`, pass: !!ok };
    },
  },
];
