// Multi-LLM deliberation panel — disciplined aggregation core (ADR-0056).
//
// The evidence (handoff 2026-07-15, verified): multi-agent debate helps
// (Du et al. 2305.14325), but simple voting captures most of the gain
// (2508.17536), diversity is oversold by error correlation (2605.29800), and
// single agents match multi-agent under equal compute (2604.02460). So this is
// NOT naive N-model voting on everything. It is:
//   1. cheap by default (self-consistency / weighted vote),
//   2. cost-gated (LR-06) — escalate to a model-diverse panel only on high
//      disagreement / high stakes, add a debate round only if still split,
//   3. reputation-weighted with ROBUST aggregation (weighted median / capped
//      weights) so one bad or compromised agent can't swing the result, and
//   4. honest about error correlation — confidence scales with *effective
//      independence*, not raw vote count (a unanimous single-family panel is a
//      confabulation-consensus risk, not high confidence).
//
// This module is PURE (no I/O). Vote gathering (self-consistency sampling, the
// live 2nd-model call) is injected by the caller (see deliberation-models.mjs
// for the live Ollama adapter) so the aggregation is deterministically testable.

export const DELIBERATION_DEFAULTS = {
  disagreementEscalate: 0.34, // > ~1/3 dissent → escalate past the cheap path
  debateDisagreement: 0.5, // still this split after the panel → one debate round
  weightCapFraction: 0.5, // no single vote may exceed this share of total weight
  minQuorum: 3, // fewer valid votes than this → no-quorum (don't trust a plurality)
  confabulationMinFamilies: 2, // agreement from fewer distinct families than this is suspect
  confabulationConfidenceCap: 0.5, // and its confidence is capped here + escalated
};

// ── Vote hygiene ──────────────────────────────────────────────────────────
// A vote: { agent, model, family?, answer, confidence?, weight? }. `answer`
// must be a non-empty string or a finite number; anything else is malformed
// (SE) and dropped — a garbled model response must not corrupt the tally.
export function normalizeVotes(rawVotes = []) {
  const valid = [];
  const dropped = [];
  for (const v of Array.isArray(rawVotes) ? rawVotes : []) {
    const ok =
      v && typeof v === "object" &&
      ((typeof v.answer === "string" && v.answer.trim() !== "") ||
        (typeof v.answer === "number" && Number.isFinite(v.answer)));
    if (ok) valid.push(v);
    else dropped.push(v);
  }
  return { valid, dropped };
}

// ── Robust weighting ──────────────────────────────────────────────────────
// Cap each weight so no single vote exceeds `maxFraction` of the total, then
// renormalize. This is the reputation-weight cap: a compromised or wildly
// over-reputationed agent cannot dominate the aggregate (Rule-2-adjacent —
// no single actor narrows the outcome). Weights default to 1 (uniform) when a
// reputation projection isn't wired (BR_06 not yet emitting) — honest fallback.
export function capWeights(weights, maxFraction = DELIBERATION_DEFAULTS.weightCapFraction) {
  let w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  let total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 1 / Math.max(1, weights.length));
  // Iteratively cap the current MAX at (maxFraction/(1−maxFraction))·(sum of the
  // others). For the default 0.5 that ratio is 1.0 — i.e. "cap the max at the
  // sum of the rest" — so a single vote can never outweigh the combined others
  // (50% single-actor breakdown), with exact arithmetic (no from-above FP drift
  // that would let a capped adversary win a plurality by a hair).
  const ratio = maxFraction / (1 - maxFraction);
  for (let iter = 0; iter < 200; iter++) {
    let idx = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[idx]) idx = i;
    const allowed = ratio * (total - w[idx]);
    // Never cap to zero: if every OTHER weight is 0, the single positive vote is
    // the only signal — keep it (capping to 0 would collapse total → NaN).
    if (allowed > 0 && w[idx] > allowed + 1e-12) { total += allowed - w[idx]; w[idx] = allowed; }
    else break;
  }
  if (total <= 0) return weights.map(() => 1 / Math.max(1, weights.length));
  return w.map((x) => x / total);
}

// Robust scalar central tendency: the weighted median. Breakdown point 50% —
// a single extreme outlier (a compromised numeric vote) cannot move it.
export function weightedMedian(values, weights) {
  const pairs = values.map((v, i) => ({ v, w: weights[i] || 0 })).sort((a, b) => a.v - b.v);
  const total = pairs.reduce((a, b) => a + b.w, 0);
  if (total <= 0) return pairs.length ? pairs[Math.floor(pairs.length / 2)].v : null;
  let cum = 0;
  for (const p of pairs) {
    cum += p.w;
    if (cum >= total / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

// ── Disagreement + independence ───────────────────────────────────────────
// Disagreement ∈ [0,1]. Categorical: 1 − (weight share of the top answer).
// Numeric: normalized mean-abs-deviation from the weighted median.
export function disagreement(votes, weights) {
  if (!votes.length) return 1;
  if (votes.every((v) => typeof v.answer === "number")) {
    const vals = votes.map((v) => v.answer);
    const med = weightedMedian(vals, capWeights(weights)); // capped → outlier-robust
    const scale = Math.abs(med) > 1e-9 ? Math.abs(med) : 1;
    const mad = vals.reduce((a, v) => a + Math.abs(v - med), 0) / vals.length;
    return Math.min(1, mad / scale);
  }
  const t = tally(votes, weights);
  return 1 - (t[0]?.share ?? 0);
}

// Effective independence: distinct error-correlation classes among the votes.
// Labeled votes contribute their `family` (else `model`). UNLABELED votes FAIL
// CLOSED — they collapse into a single "__unlabeled__" class: we cannot prove
// independence we can't see, so unlabeled unanimity is treated as correlated
// (a confabulation risk), never as N independent votes. A panel of 7 votes from
// 1 family has effective independence 1 — the diversity-is-oversold correction
// (2605.29800). (Deterministic — no Math.random.)
export function effectiveIndependence(votes) {
  const classes = new Set();
  let unlabeled = false;
  for (const v of votes) {
    const label = v.family || v.model;
    if (label) classes.add(label);
    else unlabeled = true;
  }
  if (unlabeled) classes.add("__unlabeled__");
  return Math.max(1, classes.size);
}

// ── Tally + aggregate ─────────────────────────────────────────────────────
export function tally(votes, weights) {
  const capped = capWeights(weights, DELIBERATION_DEFAULTS.weightCapFraction);
  const byAnswer = new Map();
  votes.forEach((v, i) => {
    const key = String(v.answer);
    const cur = byAnswer.get(key) || { answer: v.answer, weight: 0, count: 0 };
    cur.weight += capped[i];
    cur.count += 1;
    byAnswer.set(key, cur);
  });
  const total = [...byAnswer.values()].reduce((a, b) => a + b.weight, 0) || 1;
  return [...byAnswer.values()]
    .map((e) => ({ ...e, share: e.weight / total }))
    .sort((a, b) => b.share - a.share || b.count - a.count);
}

// Confidence ∈ [0,1] from agreement, effective independence, and (numeric)
// dispersion. Agreement alone is not enough — N correlated agrees ≈ 1 vote.
export function confidenceOf({ topShare, effIndependence, nValid, dispersion = 0 }) {
  // Independence factor: saturates by ~3 independent classes (diminishing
  // returns — matches "a 9-judge/7-family panel ≈ 2.2 independent votes").
  const indepFactor = 1 - Math.exp(-effIndependence / 2); // 1→0.39, 2→0.63, 3→0.78, 5→0.92
  const base = topShare * indepFactor;
  const dispersionPenalty = Math.min(0.3, Math.max(0, dispersion) * 0.3); // clamp: dispersion never *raises* confidence
  const sampleFactor = nValid >= 3 ? 1 : nValid / 3;
  return Math.max(0, Math.min(1, (base - dispersionPenalty) * sampleFactor));
}

// ── Cost gate (LR-06) ─────────────────────────────────────────────────────
// The lever: don't pay for a panel/debate on an easy call. Cheap self-
// consistency is the default; escalate to a model-diverse panel only on high
// disagreement OR high stakes; add a debate round only if still split AND the
// budget allows. Returns the METHOD the orchestrator should run.
export function costGate({ disagreement: d, stakes = false, budgetRemaining = Infinity, thresholds = {} }) {
  const th = { ...DELIBERATION_DEFAULTS, ...thresholds };
  if (budgetRemaining <= 0) return "cheap"; // hard budget stop — never overspend
  const escalate = d >= th.disagreementEscalate || stakes;
  if (!escalate) return "cheap";
  if (d >= th.debateDisagreement && budgetRemaining > 1) return "debate";
  return "panel";
}

// ── The disciplined aggregation ────────────────────────────────────────────
// Pure: given the gathered votes (+ optional reputation weights), produce the
// answer, a calibrated confidence, and flags. Handles the named failure modes:
//   confabulation_consensus_suspected, no_quorum, tie.
export function aggregate(rawVotes, { weights, thresholds = {} } = {}) {
  const th = { ...DELIBERATION_DEFAULTS, ...thresholds };
  const { valid, dropped } = normalizeVotes(rawVotes);
  const flags = [];
  if (dropped.length) flags.push("dropped_malformed_votes");

  if (valid.length < th.minQuorum) {
    return {
      answer: valid.length ? tally(valid, weightsFor(valid, weights))[0].answer : null,
      confidence: 0, method: "aggregate", escalate: true,
      flags: [...flags, "no_quorum"], nValid: valid.length, votes: valid,
    };
  }

  const w = weightsFor(valid, weights);
  const numeric = valid.every((v) => typeof v.answer === "number");
  const d = disagreement(valid, w);
  const effIndep = effectiveIndependence(valid);

  let answer, topShare, dispersion = 0;
  if (numeric) {
    answer = weightedMedian(valid.map((v) => v.answer), capWeights(w)); // capped → outlier-robust
    dispersion = d;
    topShare = 1 - d; // agreement proxy for numeric
  } else {
    const t = tally(valid, w);
    answer = t[0].answer;
    topShare = t[0].share;
    if (t.length > 1 && Math.abs(t[0].share - t[1].share) < 1e-9) flags.push("tie");
    // Dominant-source swing robustness (the compromised-agent BE). Capping bounds
    // a single VOTE, but a capped adversary can still win the PLURALITY when the
    // honest side is split — and a single actor can evade a leave-one-VOTE check
    // by splitting into several votes (critic 2026-07-15). So the unit is the
    // SOURCE (family): if ONE family controls a strictly-dominant share of weight
    // and is decisive — removing that whole family changes the plurality winner —
    // the result is fragile to that source. Fall back to the leave-that-family-out
    // winner, flag, escalate. This subsumes the single-vote case (each distinct
    // family = one vote) and closes same-source collusion / weight-splitting.
    // Guarded on a UNIQUE heaviest family, so a genuine majority under uniform /
    // diverse weights is never flipped. Two INDEPENDENT colluding families remain
    // out of scope (the honest ≤1-corrupted-source bound) — tracked for ADR-0054.
    if (valid.length > 1) {
      const famWeight = new Map();
      valid.forEach((vv, i) => {
        const fam = vv.family || vv.model || `__vote_${i}__`; // unlabeled → its own source
        famWeight.set(fam, (famWeight.get(fam) || 0) + (w[i] || 0));
      });
      let topFam = null, topW = -Infinity, unique = true;
      for (const [fam, wt] of famWeight) {
        if (wt > topW) { topFam = fam; topW = wt; unique = true; }
        else if (wt === topW) unique = false;
      }
      if (unique && famWeight.size > 1) {
        const looVotes = [], looWeights = [];
        valid.forEach((vv, i) => {
          const fam = vv.family || vv.model || `__vote_${i}__`;
          if (fam !== topFam) { looVotes.push(vv); looWeights.push(w[i]); }
        });
        const looTop = looVotes.length ? tally(looVotes, looWeights)[0] : null;
        if (looTop && String(looTop.answer) !== String(answer)) {
          flags.push("swingable_by_single_vote");
          answer = looTop.answer;
          topShare = looTop.share;
        }
      }
    }
  }

  let confidence = confidenceOf({ topShare, effIndependence: effIndep, nValid: valid.length, dispersion });

  // Confabulation-consensus guard: strong agreement from too few independent
  // families is the "panel converges on a shared WRONG answer" risk. Do not
  // return it as high confidence — cap it and escalate (to debate / human).
  let escalate = flags.includes("tie") || flags.includes("swingable_by_single_vote");
  if (flags.includes("swingable_by_single_vote")) confidence = Math.min(confidence, th.confabulationConfidenceCap);
  if (topShare >= 0.8 && effIndep < th.confabulationMinFamilies) {
    flags.push("confabulation_consensus_suspected");
    confidence = Math.min(confidence, th.confabulationConfidenceCap);
    escalate = true;
  }

  return {
    answer, confidence, method: numeric ? "weighted-median" : "reputation-weighted-vote",
    escalate, flags, nValid: valid.length, effectiveIndependence: effIndep,
    disagreement: d, votes: valid,
  };
}

function weightsFor(votes, weights) {
  if (Array.isArray(weights) && weights.length === votes.length) return weights;
  // Uniform fallback when a reputation projection isn't wired (honest — BR_06
  // may not be emitting yet). Confidence-tagged in the caller as degraded.
  return votes.map((v) => (Number.isFinite(v.weight) && v.weight > 0 ? v.weight : 1));
}

// ── Orchestrator (adapters injected — pure control flow) ───────────────────
// Runs the cost-gated pipeline. `getSamples()` yields the cheap self-consistency
// votes (Claude multi-path — the model-in-the-loop supplies these; this is the
// caller's already-produced reasoning). `panelAdapters` are async fns each
// returning a vote (or {ok:false} to signal an unavailable model). `budget`
// caps the TOTAL model calls (base self-consistency + panel + debate); the gate
// never escalates once the budget is spent. Everything is injected so this is
// deterministically testable; deliberation-models.mjs supplies the LIVE Ollama
// adapter. `onCost` (optional) is invoked with {cost, votes, method} at the end
// so the orchestrator can emit a `loop_cost_summary` (LR-06) without coupling
// this pure module to the event log.
export async function runDeliberation({
  getSamples, panelAdapters = [], weightFor = () => 1,
  stakes = false, budget = 4, thresholds = {}, onCost = null,
} = {}) {
  const th = { ...DELIBERATION_DEFAULTS, ...thresholds };
  const flags = [];
  let cost = 0;

  // 1. Cheap path: self-consistency samples (already-paid Claude reasoning).
  // Wrapped like panelAdapters — an injected callback must never crash the panel.
  let votes;
  try { votes = (await getSamples()) || []; }
  catch { votes = []; flags.push("samples_failed"); }
  cost += 1;
  let { valid } = normalizeVotes(votes);
  let d = valid.length ? disagreement(valid, valid.map((v) => weightFor(v))) : 1;

  // 2. Cost gate.
  let method = costGate({ disagreement: d, stakes, budgetRemaining: budget - cost, thresholds: th });

  // 3. Escalate to a model-diverse panel if the gate says so.
  if (method !== "cheap" && panelAdapters.length) {
    let anyModelUnavailable = false;
    for (const adapter of panelAdapters) {
      if (budget - cost <= 0) { flags.push("budget_exhausted"); break; }
      let res;
      try { res = await adapter(); } catch { res = { ok: false, error: "threw" }; }
      cost += 1;
      if (res && res.ok !== false && res.answer !== undefined) votes.push(res);
      else anyModelUnavailable = true;
    }
    if (anyModelUnavailable) flags.push("degraded_second_model_unavailable");
    ({ valid } = normalizeVotes(votes));
    d = disagreement(valid, valid.map((v) => weightFor(v)));

    // 4. One debate round only if still split and budget remains.
    if (method === "debate" && d >= th.debateDisagreement && budget - cost > 0) {
      flags.push("debate_round_run");
      // A debate round = re-sample with the panel's answers visible. The caller
      // supplies this via getSamples() being debate-aware; we just re-poll.
      let round2;
      try { round2 = (await getSamples({ debate: true, priorVotes: valid })) || []; }
      catch { round2 = []; flags.push("debate_samples_failed"); }
      cost += 1;
      votes = votes.concat(round2);
      ({ valid } = normalizeVotes(votes));
    }
  }

  const weights = valid.map((v) => weightFor(v));
  const usingReputation = weights.some((x) => x !== 1);
  if (!usingReputation) flags.push("uniform_weights_no_reputation");

  const result = aggregate(valid, { weights, thresholds: th });
  const out = {
    ...result,
    method: `${method}:${result.method}`,
    escalate: result.escalate || flags.includes("degraded_second_model_unavailable"),
    flags: [...new Set([...flags, ...result.flags])],
    cost,
  };
  if (typeof onCost === "function") { try { onCost(out); } catch { /* emission is best-effort */ } }
  return out;
}
