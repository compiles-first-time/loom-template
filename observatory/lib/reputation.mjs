// Passive agent-reputation projection — ADR-0053 **Step 1 only** (Guardrail A).
//
// STEP 1 IS PROJECTION-ONLY. This module computes a transparent, published,
// confidence-smoothed reputation score per agent from events ALREADY emitted
// (a `reputation_event` accrual stream plus passively-derived specialist
// invocation signals). It renders as an Observatory panel (aggregator wires
// `state.reputation`).
//
// It deliberately exports NO dispatch / selection / preference API. Preferential
// dispatch is ADR-0053 Steps 2-3 and must be re-validated by `constitution-service`
// before it ships (Rule 2 — the unconsented narrowing of another agent's
// possibility space is the fundamental wrong; a passive score that steers work
// without consent would be exactly that). Shipping the projection alone is
// Rule-safe and independently valuable — ADR-0053 §Fallback endorses it.
//
// Transparency (Rule 22): the scoring function is published (REPUTATION_FORMULA)
// and PURE, so any agent can recompute its own score from its own visible counts.

// Track-record signal kinds the projection understands. Each is a visible,
// provenance-linked event an agent can audit and re-derive from.
export const REPUTATION_KINDS = [
  "invocation",
  "verifier_pass",
  "verifier_fail",
  "lesson_contributed",
  "critic_approval",
  "constitution_check_passed",
  "retraction",
];

// Confidence-smoothing prior (Beta pseudo-counts). A small-sample agent sits
// near the neutral prior (0.5) instead of being tanked to 0 by a single
// failure — the 2026-07-07 refinement (reputation is a quality *rate*, not a
// total; small samples must not artificially tank).
// Frozen: the prior is part of the published, re-derivable formula (Rule 22) —
// it must not drift out from under an agent recomputing its own score.
export const REPUTATION_PRIOR = Object.freeze({ alpha: 2, beta: 2 });

// Published, auditable weights (no black box — Rule 22). Frozen for the same
// reason as the prior: the displayed formula must equal the scoring actually
// applied, process-wide. A future live-tuning feature would clone-and-rescore,
// never mutate this singleton in place.
export const REPUTATION_WEIGHTS = Object.freeze({ rate: 1.0, lessons: 0.05, critic: 0.05, retraction: 0.1 });

export const REPUTATION_FORMULA =
  "smoothed_pass_rate = (verifier_pass + 2) / (verifier_pass + verifier_fail + 4); " +
  "score = clamp01( 1.0·smoothed_pass_rate + 0.05·lessons_contributed + 0.05·critic_approvals − 0.10·retractions )";

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function emptyRecord(agent) {
  return {
    agent,
    invocations: 0,
    verifier_pass: 0,
    verifier_fail: 0,
    lessons_contributed: 0,
    critic_approvals: 0,
    // Tracked per ADR-0053's "track record" data model. Captured for
    // transparency/future weighting; intentionally NOT in the score formula
    // yet — matching ADR-0053's own example formula, which excludes it.
    constitution_checks_passed: 0,
    retractions: 0,
    n: 0, // verifier sample size (pass + fail)
    smoothed_pass_rate: null,
    score: null,
    last_active: null,
  };
}

/**
 * Confidence-smoothed pass rate + composite score. PURE and re-derivable by any
 * agent from its own visible counts (transparency requirement, Rule 22).
 */
export function scoreAgent(rec, weights = REPUTATION_WEIGHTS, prior = REPUTATION_PRIOR) {
  const pass = rec.verifier_pass || 0;
  const fail = rec.verifier_fail || 0;
  const smoothed = (pass + prior.alpha) / (pass + fail + prior.alpha + prior.beta);
  const raw =
    weights.rate * smoothed +
    weights.lessons * (rec.lessons_contributed || 0) +
    weights.critic * (rec.critic_approvals || 0) -
    weights.retraction * (rec.retractions || 0);
  return { smoothed_pass_rate: smoothed, score: clamp01(raw) };
}

/**
 * Apply one signal to a record (mutates + returns it). Best-effort: an unknown
 * kind updates only `last_active` (so a retirement "touch" still refreshes
 * recency without corrupting counts). Missing agent is handled by the caller.
 */
export function applySignal(rec, kind, timestamp, weights = REPUTATION_WEIGHTS, prior = REPUTATION_PRIOR) {
  switch (kind) {
    case "invocation": rec.invocations++; break;
    case "verifier_pass": rec.verifier_pass++; break;
    case "verifier_fail": rec.verifier_fail++; break;
    case "lesson_contributed": rec.lessons_contributed++; break;
    case "critic_approval": rec.critic_approvals++; break;
    case "constitution_check_passed": rec.constitution_checks_passed++; break;
    case "retraction": rec.retractions++; break;
    default: break; // unknown kind → recency-only touch
  }
  rec.n = rec.verifier_pass + rec.verifier_fail;
  if (timestamp && (!rec.last_active || timestamp > rec.last_active)) rec.last_active = timestamp;
  const s = scoreAgent(rec, weights, prior);
  rec.smoothed_pass_rate = s.smoothed_pass_rate;
  rec.score = s.score;
  return rec;
}

/**
 * Pure projection over a batch of events (used by tests + one-shot rebuilds).
 * Reads `reputation_event {agent, kind}` and passively derives `invocation`
 * from `specialist_spawned` and `last_active` from `specialist_retired`. A
 * malformed event (not an object, or a `reputation_event` with no `agent`) is
 * skipped — dirty logs must never crash the panel.
 */
export function computeReputation(events = [], { weights = REPUTATION_WEIGHTS, prior = REPUTATION_PRIOR } = {}) {
  const agents = {};
  const touch = (name) => (agents[name] ||= emptyRecord(name));
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    switch (ev.event_type) {
      case "reputation_event":
        if (!ev.agent) continue; // SE: id-less signal — skip, don't crash
        applySignal(touch(ev.agent), ev.kind, ev.timestamp, weights, prior);
        break;
      case "specialist_spawned":
        if (ev.specialist_name) applySignal(touch(ev.specialist_name), "invocation", ev.timestamp, weights, prior);
        break;
      case "specialist_retired":
        if (ev.specialist_name) applySignal(touch(ev.specialist_name), "__touch__", ev.timestamp, weights, prior);
        break;
      default:
        break;
    }
  }
  return { agents, formula: REPUTATION_FORMULA, weights, prior };
}
