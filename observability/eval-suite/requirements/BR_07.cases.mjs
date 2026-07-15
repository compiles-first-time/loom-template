// Canonical BR_07 test cases (ADR-0056 / registry per ADR-0046).
//
// ONE source of truth, consumed by scripts/lib/deliberation.test.mjs, which
// runs each case's `run()` (sync or async), asserts `pass`, and emits a
// `test_case` event with the captured actual. Deterministic + CI-safe: model
// gathering is INJECTED (mock adapters); the LIVE Ollama vote is proven
// separately by examples/deliberation-live.mjs (its result is recorded in the
// BR_07 register's actual_output).

import {
  aggregate,
  capWeights,
  weightedMedian,
  disagreement,
  costGate,
  runDeliberation,
  normalizeVotes,
} from "../../../scripts/lib/deliberation.mjs";

// A vote factory. Distinct `family` ⇒ error-independent.
const v = (answer, family, weight = 1) => ({ agent: `${family}:${answer}`, model: family, family, answer, weight });

export const BR_07_CASES = [
  {
    id: "BR_07", type: "BR", framework_location: "scripts/lib/deliberation.mjs",
    title: "Disciplined multi-LLM decision with calibrated confidence",
    expected_input: "gathered votes (self-consistency + model-diverse)",
    expected_output: "{answer, confidence, method, flags, cost}",
    justification: "Verified efficacy (Du 2305.14325; MoA 2406.04692; self-consistency 2203.11171); Loom's model-agnostic differentiator. Cheap-by-default, cost-gated, robust.",
    async run() {
      const r = aggregate([v("A", "f1"), v("A", "f2"), v("B", "f3")], {});
      const ok = r.answer === "A" && typeof r.confidence === "number" && r.method.includes("vote");
      return { actual: `answer=${r.answer}, conf=${r.confidence.toFixed(3)}, method=${r.method}`, pass: ok };
    },
  },
  {
    id: "BR-07_TR-01", type: "TR", framework_location: "observatory/lib/reputation.mjs",
    title: "Reputation weights available (BR_06) — weighting substrate",
    expected_input: "per-vote reputation weights",
    expected_output: "capped weights sum to 1; no vote > 50% share",
    justification: "The panel's weighting plugs into BR_06's projection; capping keeps it robust (Rule-2-adjacent).",
    run() {
      const w = capWeights([1, 1, 1, 1, 100]); // one huge (adversarial) weight
      const maxShare = Math.max(...w);
      const sum = w.reduce((a, b) => a + b, 0);
      const ok = Math.abs(sum - 1) < 1e-9 && maxShare <= 0.5 + 1e-9;
      return { actual: `maxShare=${maxShare.toFixed(3)}, sum=${sum.toFixed(3)}`, pass: ok };
    },
  },
  {
    id: "BR-07_TR-02", type: "TR", framework_location: "scripts/lib/deliberation-models.mjs",
    title: "Live 2nd model adapter present + degradation contract",
    expected_input: "an adapter returning {ok:false} (unavailable)",
    expected_output: "panel degrades, still returns an answer",
    justification: "Live Ollama vote is genuine (proven by examples/deliberation-live.mjs); here we assert the degradation contract deterministically.",
    async run() {
      const r = await runDeliberation({
        getSamples: async () => [v("A", "claude"), v("A", "claude"), v("B", "claude")],
        panelAdapters: [async () => ({ ok: false, error: "unavailable" })],
        stakes: true, budget: 4,
      });
      const ok = r.answer != null && r.flags.includes("degraded_second_model_unavailable");
      return { actual: `answer=${r.answer}, flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-01", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Confabulation consensus — panel converges on a shared answer with low independence",
    expected_input: "5 unanimous votes, all one family",
    expected_output: "flag confabulation_consensus_suspected; confidence ≤ 0.5; escalate",
    justification: "Handoff's named BE. Diversity is oversold by error correlation (2605.29800) — unanimous ≠ confident when independence is 1.",
    run() {
      const r = aggregate([v("A", "llama"), v("A", "llama"), v("A", "llama"), v("A", "llama"), v("A", "llama")], {});
      const ok = r.flags.includes("confabulation_consensus_suspected") && r.confidence <= 0.5 && r.escalate === true;
      return { actual: `conf=${r.confidence.toFixed(3)}, escalate=${r.escalate}, flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-02", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Low-reputation / compromised agent swings the vote",
    expected_input: "4 diverse votes for A (w=1) + 1 adversarial vote for B (w=100)",
    expected_output: "answer stays A; B cannot dominate",
    justification: "Handoff's named BE. Weight-capping (iterated to 50% breakdown) means one over-weighted/compromised agent can't flip the result (ties to ADR-0053).",
    run() {
      const votes = [v("A", "f1", 1), v("A", "f2", 1), v("A", "f3", 1), v("A", "f4", 1), v("B", "f5", 100)];
      const r = aggregate(votes, { weights: votes.map((x) => x.weight) });
      const ok = r.answer === "A";
      return { actual: `answer=${r.answer} (adversary B w=100 capped), flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-02b", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Compromised agent vs a SPLIT honest panel (single-vote swing)",
    expected_input: "2×A + 2×C (diverse, w1) + 1 adversarial B (w100)",
    expected_output: "adversary B does NOT win; swingable flagged; escalate; low confidence",
    justification: "Critic finding (2026-07-15): weight-capping bounds a vote but a capped adversary can still win a PLURALITY when the honest side is split. Leave-one-out swing detection closes it — a lone vote can't determine the answer.",
    run() {
      const votes = [v("A", "f1", 1), v("A", "f2", 1), v("C", "f3", 1), v("C", "f4", 1), v("B", "f5", 100)];
      const r = aggregate(votes, { weights: votes.map((x) => x.weight) });
      const ok = r.answer !== "B" && r.flags.includes("swingable_by_single_vote") && r.escalate === true && r.confidence <= 0.5;
      return { actual: `answer=${r.answer} (adversary B blocked), conf=${r.confidence.toFixed(3)}, flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-02c", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Single compromised SOURCE splitting into a vote bloc",
    expected_input: "2×A + 2×C (diverse) + 2×B from ONE family 'bad' (w100 each)",
    expected_output: "B does NOT win; swingable flagged; escalate (leave-family-out closes the split-vote evasion)",
    justification: "Critic re-review (2026-07-15): a leave-one-VOTE guard is evaded by one actor casting two heavy votes. The unit is the SOURCE (family) — removing the dominant family's whole bloc restores the honest winner.",
    run() {
      const votes = [v("A", "f1"), v("A", "f2"), v("C", "f3"), v("C", "f4"), v("B", "bad", 100), v("B", "bad", 100)];
      const r = aggregate(votes, { weights: votes.map((x) => x.weight) });
      const ok = r.answer !== "B" && r.flags.includes("swingable_by_single_vote") && r.escalate === true;
      return { actual: `answer=${r.answer} (bloc 'bad' blocked), flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-01b", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Confabulation guard fails CLOSED on unlabeled votes",
    expected_input: "5 unanimous votes with NO family/model label",
    expected_output: "effectiveIndependence 1; confabulation flagged; escalate; conf ≤ 0.5",
    justification: "Critic finding (2026-07-15): a Math.random() fallback made unlabeled votes count as independent (fail-open). Now unlabeled → one shared class (fail-closed), so unlabeled unanimity can't masquerade as high-confidence consensus.",
    run() {
      const r = aggregate([{ answer: "A" }, { answer: "A" }, { answer: "A" }, { answer: "A" }, { answer: "A" }], {});
      const ok = r.effectiveIndependence === 1 && r.flags.includes("confabulation_consensus_suspected") && r.escalate === true && r.confidence <= 0.5;
      return { actual: `indep=${r.effectiveIndependence}, conf=${r.confidence.toFixed(3)}, flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_Degenerate", type: "SE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Degenerate weights (all-but-one zero) don't NaN",
    expected_input: "capWeights([0,0,0,5])",
    expected_output: "no NaN; single positive vote → weight 1",
    justification: "Critic finding (2026-07-15): capping the max to sum-of-others=0 divided by zero → NaN, silently defeating every threshold. Guarded.",
    run() {
      const w = capWeights([0, 0, 0, 5]);
      const ok = w.every((x) => Number.isFinite(x)) && Math.abs(w[3] - 1) < 1e-9;
      return { actual: `weights=[${w.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-03", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Panel invoked on a low-stakes / low-disagreement call (waste)",
    expected_input: "near-unanimous votes, stakes=false",
    expected_output: "costGate → 'cheap'; panel NOT spun up",
    justification: "Equal-compute rebuttal (2604.02460) — don't pay for a panel on an easy call (LR-06).",
    async run() {
      const d = disagreement([v("A", "f1"), v("A", "f2"), v("A", "f3"), v("B", "f4")], [1, 1, 1, 1]);
      const gate = costGate({ disagreement: d, stakes: false });
      let panelCalled = 0;
      const r = await runDeliberation({
        getSamples: async () => [v("A", "claude"), v("A", "claude"), v("A", "claude"), v("A", "claude"), v("B", "claude")],
        panelAdapters: [async () => { panelCalled++; return v("B", "ollama"); }],
        stakes: false, budget: 4,
      });
      const ok = gate === "cheap" && panelCalled === 0 && r.method.startsWith("cheap");
      return { actual: `gate=${gate}, panelCalled=${panelCalled}, method=${r.method}`, pass: ok };
    },
  },
  {
    id: "BR-07_BE-04", type: "BE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Tie / no quorum",
    expected_input: "2 valid votes (below minQuorum=3)",
    expected_output: "flag no_quorum; escalate; confidence 0",
    justification: "A deadlock or too-thin panel must not be returned as a confident answer — escalate.",
    run() {
      const r = aggregate([v("A", "f1"), v("B", "f2")], {});
      const ok = r.flags.includes("no_quorum") && r.escalate === true && r.confidence === 0;
      return { actual: `flags=[${r.flags.join(",")}], escalate=${r.escalate}, conf=${r.confidence}`, pass: ok };
    },
  },
  {
    id: "BR-07_SE-01", type: "SE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Live 2nd model unavailable / timeout",
    expected_input: "panel adapter throws / returns {ok:false}",
    expected_output: "degrade to self-consistency; still answer; flag degraded; escalate",
    justification: "An external model must never break the panel — graceful degradation (honest lower confidence).",
    async run() {
      const r = await runDeliberation({
        getSamples: async () => [v("A", "claude"), v("B", "claude"), v("A", "claude")],
        panelAdapters: [async () => { throw new Error("ECONNREFUSED"); }],
        stakes: true, budget: 4,
      });
      const ok = r.answer != null && r.flags.includes("degraded_second_model_unavailable") && r.escalate === true;
      return { actual: `answer=${r.answer}, flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_SE-02", type: "SE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Malformed / unparseable model output",
    expected_input: "votes incl. {answer:null}, {}, non-object",
    expected_output: "malformed dropped; quorum re-checked on the valid set",
    justification: "Model non-determinism is expected — schema-validate each vote; a garbled response can't corrupt the tally.",
    run() {
      const { valid, dropped } = normalizeVotes([v("A", "f1"), { answer: null }, "junk", v("A", "f2"), v("A", "f3")]);
      const r = aggregate([v("A", "f1"), { answer: null }, "junk", v("A", "f2"), v("A", "f3")], {});
      const ok = dropped.length === 2 && valid.length === 3 && r.answer === "A" && r.flags.includes("dropped_malformed_votes");
      return { actual: `valid=${valid.length}, dropped=${dropped.length}, answer=${r.answer}`, pass: ok };
    },
  },
  {
    id: "BR-07_SE-03", type: "SE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Cost / token blowup",
    expected_input: "budget=1 with high disagreement",
    expected_output: "no panel/debate escalation; cost bounded",
    justification: "LR-06 / ADR-0045 — a hard budget stop aborts escalation; the panel never runs away.",
    async run() {
      let panelCalled = 0;
      const r = await runDeliberation({
        getSamples: async () => [v("A", "claude"), v("B", "claude"), v("C", "claude")], // high disagreement
        panelAdapters: [async () => { panelCalled++; return v("D", "ollama"); }],
        stakes: true, budget: 1, // budget consumed by the cheap pass → no room to escalate
      });
      const ok = panelCalled === 0 && r.cost <= 1;
      return { actual: `panelCalled=${panelCalled}, cost=${r.cost}, method=${r.method}`, pass: ok };
    },
  },
  {
    id: "BR-07_SE-04", type: "SE", framework_location: "scripts/lib/deliberation.mjs",
    title: "Reputation projection missing (BR_06 not yet emitting)",
    expected_input: "no weights supplied",
    expected_output: "uniform weights used + flag uniform_weights_no_reputation",
    justification: "The panel still functions without the reputation substrate — honest degradation, flagged (pluggable weighting seam).",
    async run() {
      const r = await runDeliberation({
        getSamples: async () => [v("A", "f1"), v("A", "f2"), v("B", "f3")],
        panelAdapters: [], stakes: false, budget: 4,
        // weightFor omitted → defaults to () => 1 (uniform)
      });
      const ok = r.flags.includes("uniform_weights_no_reputation");
      return { actual: `flags=[${r.flags.join(",")}]`, pass: ok };
    },
  },
  {
    id: "BR-07_Numeric", type: "---", framework_location: "scripts/lib/deliberation.mjs",
    title: "Numeric answers → robust weighted median",
    expected_input: "[5,5,5,5,1000] with adversarial weight on 1000",
    expected_output: "median 5 (outlier rejected)",
    justification: "Numeric robustness (RoPoLL / geometric-median spirit) — a single extreme numeric vote can't move the aggregate.",
    run() {
      const votes = [
        { answer: 5, family: "f1", weight: 1 }, { answer: 5, family: "f2", weight: 1 },
        { answer: 5, family: "f3", weight: 1 }, { answer: 5, family: "f4", weight: 1 },
        { answer: 1000, family: "f5", weight: 100 },
      ];
      const r = aggregate(votes, { weights: votes.map((x) => x.weight) });
      const ok = r.answer === 5 && r.method === "weighted-median";
      return { actual: `median=${r.answer}, method=${r.method}`, pass: ok };
    },
  },
];
