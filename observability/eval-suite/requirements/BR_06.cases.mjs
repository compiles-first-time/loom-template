// Canonical BR_06 test cases (ADR-0053 Step 1 / registry per ADR-0046).
//
// ONE source of truth, consumed by observatory/lib/reputation.test.mjs, which
// runs each case's `run()`, asserts `pass`, and emits a `test_case` event with
// the captured actual (so the Observatory Requirements panel + regression
// history populate on every `node scripts/test.mjs`).

import {
  computeReputation,
  scoreAgent,
  emptyRecord,
} from "../../../observatory/lib/reputation.mjs";
import * as reputationModule from "../../../observatory/lib/reputation.mjs";
import { Aggregator } from "../../../observatory/lib/aggregator.mjs";

const T = "2026-07-15T12:00:00.000Z";
const re = (agent, kind, ts = T) => ({ event_type: "reputation_event", agent, kind, timestamp: ts });

// The COMPLETE, intended public surface of the projection module (Step 1). The
// BE-01 check asserts the actual exports equal exactly this set — an allowlist,
// not a denylist — so ANY new export (even an innocuously-named `rankAgents` or
// `topAgentFor`) trips this test and forces a constitution-service review
// before a dispatch-shaped API can land (ADR-0053 Steps 2-3, Rule 2).
const ALLOWED_EXPORTS = [
  "REPUTATION_KINDS", "REPUTATION_PRIOR", "REPUTATION_WEIGHTS", "REPUTATION_FORMULA",
  "emptyRecord", "scoreAgent", "applySignal", "computeReputation",
].sort();

// Defense-in-depth: verb prefixes that would indicate a preferential-dispatch
// API. Ranking-for-display is fine; selecting/steering work is not.
const DISPATCH_EXPORT_RE = /^(dispatch|select|prefer|route|assign|pick|choose|rank|recommend|top)/i;

export const BR_06_CASES = [
  {
    id: "BR_06", type: "BR", framework_location: "Observatory projection",
    title: "Transparent per-agent reputation from emitted events",
    expected_input: "reputation_event + specialist signals",
    expected_output: "published-formula score per agent, no dispatch",
    justification:
      "ADR-0053 Step 1 (Guardrail A) — passive projection only; panel dependency for BR_07. Steps 2-3 (dispatch) gated on constitution-service (Rule 2).",
    run() {
      const proj = computeReputation([re("critic", "verifier_pass"), re("critic", "lesson_contributed")]);
      const ok = !!proj.formula && !!proj.agents.critic && proj.agents.critic.score > 0;
      return { actual: `agents=${Object.keys(proj.agents).length}, formula:published`, pass: ok };
    },
  },
  {
    id: "BR-06_TR-01", type: "TR", framework_location: "event-log",
    title: "Agent-scoped signals exist (reputation_event; specialist_spawned invocation)",
    expected_input: "specialist_spawned{specialist_name}",
    expected_output: "invocation derived for that agent",
    justification: "A projection needs a substrate; derive passively from events already emitted.",
    run() {
      const proj = computeReputation([
        { event_type: "specialist_spawned", specialist_name: "eac", timestamp: T },
      ]);
      const ok = proj.agents.eac && proj.agents.eac.invocations === 1;
      return { actual: `eac.invocations=${proj.agents.eac?.invocations}`, pass: !!ok };
    },
  },
  {
    id: "BR-06_SE-01", type: "SE", framework_location: "observatory/lib/reputation.mjs",
    title: "Malformed / id-less reputation_event",
    expected_input: '{event_type:"reputation_event"} (no agent) + null + "junk"',
    expected_output: "skipped; agents empty; no throw",
    justification: "Dirty logs must not crash the projection (best-effort resilience).",
    run() {
      let threw = false;
      let proj;
      try {
        proj = computeReputation([
          { event_type: "reputation_event", kind: "verifier_pass" }, // no agent
          null,
          "junk",
          42,
        ]);
      } catch { threw = true; }
      const ok = !threw && proj && Object.keys(proj.agents).length === 0;
      return { actual: threw ? "threw" : `agents=${Object.keys(proj.agents).length}`, pass: ok };
    },
  },
  {
    id: "BR-06_SE-02", type: "SE", framework_location: "observatory/lib/reputation.mjs",
    title: "Small-sample agent tanked by one failure",
    expected_input: "1× verifier_fail",
    expected_output: "smoothed_pass_rate = 0.4, score > 0 (not 0)",
    justification: "Confidence smoothing (Beta prior 2,2) — reputation is a quality rate, not a total (2026-07-07).",
    run() {
      const proj = computeReputation([re("newbie", "verifier_fail")]);
      const rec = proj.agents.newbie;
      // (0 + 2) / (0 + 1 + 2 + 2) = 2/5 = 0.4
      const ok = rec && Math.abs(rec.smoothed_pass_rate - 0.4) < 1e-9 && rec.score > 0;
      return { actual: `smoothed=${rec?.smoothed_pass_rate}, score=${rec?.score}`, pass: !!ok };
    },
  },
  {
    id: "BR-06_BE-01", type: "BE", framework_location: "observatory/lib/reputation.mjs",
    title: "Score used for preferential dispatch (scope creep past Step 1)",
    expected_input: "assert module exports == the Step-1 allowlist (no dispatch API)",
    expected_output: "exports match allowlist exactly; no dispatch/rank/select export",
    justification: "Rule 2 — an explicit export allowlist trips on ANY new surface, forcing a constitution-service review before dispatch (Steps 2-3) can land; never ship Step 3 before 1-2 (ADR-0053).",
    run() {
      const exportNames = Object.keys(reputationModule).sort();
      const allowlistOk =
        exportNames.length === ALLOWED_EXPORTS.length &&
        exportNames.every((k, i) => k === ALLOWED_EXPORTS[i]);
      const denyOffenders = exportNames.filter((k) => DISPATCH_EXPORT_RE.test(k));
      const ok = allowlistOk && denyOffenders.length === 0;
      const drift = allowlistOk ? "" : ` (drift: ${exportNames.filter((k) => !ALLOWED_EXPORTS.includes(k)).join(",") || "missing export"})`;
      return { actual: ok ? "exports == allowlist; no dispatch API" : `MISMATCH${drift}`, pass: ok };
    },
  },
  {
    id: "BR-06_BE-02", type: "BE", framework_location: "observatory/lib/reputation.mjs",
    title: "Opaque / black-box score",
    expected_input: "an agent's own visible counts",
    expected_output: "scoreAgent(counts) reproduces the projected score",
    justification: "Rule 22 — published, auditable formula; agents recompute their own score from visible data.",
    run() {
      const proj = computeReputation([
        re("critic", "verifier_pass"), re("critic", "verifier_pass"), re("critic", "verifier_fail"),
        re("critic", "critic_approval"), re("critic", "lesson_contributed"),
      ]);
      const rec = proj.agents.critic;
      // Recompute independently from the visible counts.
      const recomputed = scoreAgent({
        verifier_pass: rec.verifier_pass, verifier_fail: rec.verifier_fail,
        lessons_contributed: rec.lessons_contributed, critic_approvals: rec.critic_approvals,
        retractions: rec.retractions,
      });
      const ok = Math.abs(recomputed.score - rec.score) < 1e-9;
      return { actual: `projected=${rec.score.toFixed(6)}, recomputed=${recomputed.score.toFixed(6)}`, pass: ok };
    },
  },
  {
    id: "BR-06_Wire", type: "---", framework_location: "observatory/lib/aggregator.mjs",
    title: "Ingest reputation_event → state.reputation.agents",
    expected_input: "Aggregator.ingestEvent(reputation_event) ×N",
    expected_output: "state.reputation.agents populated + formula present",
    justification: "Live panel via the existing aggregator (streamed, not batch).",
    run() {
      const agg = new Aggregator();
      agg.ingestEvent(re("memory-keeper", "verifier_pass"));
      agg.ingestEvent(re("memory-keeper", "lesson_contributed"));
      agg.ingestEvent({ event_type: "specialist_spawned", specialist_name: "memory-keeper", timestamp: T });
      const rec = agg.state.reputation.agents["memory-keeper"];
      const ok = !!rec && rec.verifier_pass === 1 && rec.invocations === 1 &&
        rec.score > 0 && !!agg.state.reputation.formula;
      return { actual: `pass=${rec?.verifier_pass}, inv=${rec?.invocations}, score=${rec?.score?.toFixed(4)}`, pass: !!ok };
    },
  },
];
