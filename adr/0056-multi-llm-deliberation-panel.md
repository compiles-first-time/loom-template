# ADR-0056: Multi-LLM deliberation panel — disciplined, cost-gated, robust

**Status:** Accepted (builder + critic + constitution-service, 2026-07-15). Architect (Nick) ratifies on PR merge — non-L0 capability ADR, per the 2026-07-15 handoff's delegated authority ("you may merge green PRs; propose-first for L0").
**Date:** 2026-07-15
**Author:** Builder (Opus 4.8) — from the 2026-07-15 handoff deliberation-panel decision + verified research
**Confidence:** [H] that disciplined multi-LLM helps and naive N-model voting does not; [M] on the exact thresholds (tune with the eval harness, ADR-0054 Phase 1a)

---

## Context

The handoff's #1 build: a multi-LLM deliberation panel. The temptation is naive "ask N models and vote." The verified research (handoff 2026-07-15, adversarial 3-vote check) says do **not**:

- Multi-agent debate genuinely helps (Du et al. 2305.14325: arithmetic 67→81.8, GSM8K 77→85; MoA 2406.04692 beats GPT-4o on AlpacaEval; self-consistency 2203.11171: +17.9 GSM8K). **But:**
- Simple **voting captures most of the debate gain** (2508.17536) — debate ≈ voting in many settings.
- **Diversity is oversold by error correlation** (2605.29800): a 9-judge/7-family panel ≈ ~2.2 independent votes; panels underperformed truly-independent voting by 8–22 pts.
- **Under equal compute, single agents match multi-agent** (2604.02460) — some "multi-agent gains" are just more tokens.
- **Aggregation design matters**: reliability-weighted + robust aggregation (geometric-median / RoPoLL, tolerates ≤50% corruption) + structured adjudication beat naive vote/mean.

So the disciplined design is: cheap by default, escalate only when it pays, weight by reputation, aggregate robustly, and price confidence in *effective independence* not raw N. This is also a natural expression of Loom's model-agnostic multi-agent architecture — a genuine differentiator.

## Decision

Build a **disciplined deliberation panel**, not naive N-model voting:

1. **Cheap by default.** Start with self-consistency (Claude multi-path, already-paid reasoning) + a reputation-weighted vote.
2. **Cost-gated (LR-06).** Escalate to a model-diverse panel only on high disagreement OR high stakes; add ONE debate round only if still split AND budget remains. A hard budget stop aborts escalation. `costGate()` returns `cheap | panel | debate`.
3. **Reputation-weighted + ROBUST aggregation.** Weights come from ADR-0053's passive projection (BR_06); they are **capped so no single vote exceeds the sum of the others** (iterated → 50% single-actor breakdown). Numeric answers use a weighted median (outlier-robust, 50% breakdown). For categorical answers, a **leave-dominant-source-out** check means a single compromised SOURCE (agent/family) — even splitting into multiple votes — cannot swing the plurality: if removing the strictly-heaviest family changes the winner, the honest leave-that-family-out answer is used, flagged `swingable_by_single_vote`, and escalated. Scope (honest): this covers **one** corrupted source; two *independent* colluding families remain out of scope for v1 (tracked for the ADR-0054 eval harness), and the guard cannot distinguish a legitimately-decisive high-reputation vote from a compromised one — it conservatively escalates either.
4. **Confidence priced on effective independence.** Confidence scales with the number of distinct error-correlation classes (`family`/`model`), not raw vote count — a unanimous single-family panel is flagged `confabulation_consensus_suspected`, its confidence capped, and it is **escalated** rather than returned as high-confidence.
5. **Model-diverse, honestly.** The second arm is a **live** non-Claude model (local Ollama `llama3` via `deliberation-models.mjs`); the Claude arm is model-in-the-loop (self-consistency samples). An unavailable second model **degrades** gracefully (self-consistency only, flagged, lower confidence) — it never breaks the panel.

Pure aggregation lives in `scripts/lib/deliberation.mjs`; model adapters in `scripts/lib/deliberation-models.mjs`; the definition-of-done register is `BR_07` (12 cases, incl. the two named BE failure modes). A live end-to-end run is `examples/deliberation-live.mjs`.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary evidence** (verified against primary sources, handoff 2026-07-15): Du et al. arXiv 2305.14325; Mixture-of-Agents arXiv 2406.04692; self-consistency arXiv 2203.11171. `[arxiv][H]`
- **Corroborating / disciplining** (treated as strong leads, re-verify at high cap per handoff): voting≈debate arXiv 2508.17536; diversity/error-correlation arXiv 2605.29800; equal-compute rebuttal arXiv 2604.02460; robust aggregation (BT-σ / geometric-median RoPoLL). `[arxiv][M]`
- **Corroborating (internal):** [ADR-0053](./0053-agent-reputation-and-dispatch.md) (reputation weighting substrate), [ADR-0045](./0045-per-agent-model-routing.md) (per-agent model routing + cost), [ADR-0048](./0048-north-star-model-agnostic-spec-and-adapters.md) (model-agnostic architecture this expresses). `[internal][H]`
- **What would change this call:** a high-cap re-run of the `deep-research` skill that *refutes* the voting≈debate or error-correlation findings (currently unverified-but-primary-sourced), or an eval-harness measurement (ADR-0054 1a) showing the panel underperforms single-agent self-consistency under equal token budget — either would justify narrowing the panel to self-consistency only.

## Cost model

> Required per [LR-06](../constitution/local-rules.md#lr-06) — this ADR introduces a multi-agent fan-out.

- **Which LLM calls are iterative:** self-consistency sampling (N Claude paths), then optional model-diverse panel votes (1 live second-model call), then an optional single debate round.
- **Exit condition:** the cost gate — cheap path unless disagreement ≥ threshold or stakes; a hard `budget` ceiling caps total model calls; at most ONE debate round.
- **Estimated token bound (typical):** the cheap path only (self-consistency, no panel) for the majority of low-disagreement calls ≈ 1× a single self-consistency pass.
- **Estimated token bound (worst case):** self-consistency + panel adapters + one debate round, bounded by `budget` (default 4 model calls).
- **Cost multiplier vs single-pass baseline:** ~1× on easy calls (cheap path), up to ~3–4× only on the high-disagreement/high-stakes minority the gate escalates. Route the fan-out arms to cheaper models (ADR-0045); the local Ollama second model is ~free.

## Consequences

**Locks in:** cheap-by-default + cost-gated escalation; reputation-weighted **robust** aggregation (capped weights / weighted median) so a single actor can't swing a decision; confidence priced on effective independence (error-correlation honesty); graceful degradation when the second model is down; a live, genuinely non-Claude vote as the model-diverse arm.

**Locks out:** naive "N models always vote"; treating unanimity as confidence regardless of independence; a mean/plurality that a single over-weighted or compromised vote can dominate; a panel that hard-fails when an external model is unavailable.

**Migration/fallback:** additive — a library + register. If the eval harness (ADR-0054 1a) shows no lift over self-consistency under equal compute, narrow to the cheap path only; nothing else regresses.

## Alternatives considered

- **Naive N-model majority vote on everything.** Rejected — voting≈debate but *un*-gated spend, and error correlation makes N models ≪ N independent votes (2605.29800; 2604.02460).
- **Mean / unweighted plurality aggregation.** Rejected — not robust; one compromised or over-weighted vote swings it. Weighted median + capped weights instead.
- **Elaborate multi-round debate machinery up front.** Rejected for v1 — reserve it; a single debate round only when the gate says the disagreement warrants it.
- **Assume N distinct models = N independent votes.** Rejected — budget for error correlation; discount confidence by effective independence.

## Affects / Affected by

**This ADR affects** *(downstream)*:
- `scripts/lib/deliberation.mjs` — the aggregation core (cost gate, robust weighting, confidence).
- `scripts/lib/deliberation-models.mjs` — live model adapters (Ollama; keyring path for hosted models).
- `observability/eval-suite/requirements/BR_07.md` — the register (definition-of-done).
- `examples/deliberation-live.mjs` — the live end-to-end proof.
- `adr/0054-path-to-top-tier-proof-first.md` — feeds the efficacy axis (an eval harness will measure the panel's lift).

**This ADR is affected by** *(upstream)*:
- `adr/0053-agent-reputation-and-dispatch.md` — supplies the reputation weights (BR_06); the panel caps them for robustness.
- `adr/0045-per-agent-model-routing.md` — route fan-out arms to cheaper models.
- `adr/0048-north-star-model-agnostic-spec-and-adapters.md` — the model-agnostic architecture this expresses.
- `constitution/local-rules.md` — LR-06 (cost-gated multi-agent).
- `constitution/kernel-v6.md` — Rule 22 (every claim carries provenance + confidence; the panel returns calibrated confidence + flags).

## References

- Handoff `handoff/2026-07-15-deliberation-panel-and-research-findings.md` — the decision + verified research.
- arXiv 2305.14325, 2406.04692, 2203.11171 (efficacy); 2508.17536, 2605.29800, 2604.02460 (discipline). `[arxiv][H/M]`
- ADR-0053 (reputation), ADR-0045 (routing), ADR-0048 (model-agnostic), ADR-0054 (proof-first efficacy axis).
