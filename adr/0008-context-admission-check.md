# ADR-0008: Pre-dispatch context admission check (chaperone gate)

**Status:** Accepted
**Date:** 2026-05-18
**Author:** Architect handoff (Phase 1 research) — approved by Nick
**Confidence:** [M]

## Context

The Critic / Auditor is a post-hoc *output* gate: it reviews artifacts before commit. Nothing in v0.1 validates the *context going into* an agent before it runs.

Biology has two complementary quality-control mechanisms:

- **Proteasomes** — destroy spent proteins. Loom already has this as task-level termination and the Critic's post-hoc review.
- **Chaperones** — protect a protein *while* it folds, preventing misfolding before it happens. Loom lacks this.

Given the distractor finding (ADR-0003 — semantically-similar-but-irrelevant content harms accuracy more than random text) and the poisoning finding (ADR-0007 — untrusted retrieved content), the assembled context at dispatch is exactly where "misfolding" begins. A pre-flight check at spawn / dispatch time is the missing chaperone.

This is a sound architectural inference from Phase 1 evidence rather than a citable named component — hence confidence `[M]` rather than `[H]`.

## Decision

Before an agent runs, its **assembled context** passes a lightweight admission check, performed by the Critic at dispatch time. The check verifies:

1. **Budget compliance** — the assembled context fits the agent's declared `context_budget:` (ADR-0004).
2. **Source-tier compliance** — retrieved items in the context come from acceptable source tiers (ADR-0007, with tier definitions in ADR-0009 / L7).
3. **Obvious-pattern check** — the context is screened for obvious prompt-injection patterns and obvious distractor characteristics (e.g., near-duplicate but off-topic chunks).

Failures **escalate**, they do not silently run.

The Critic's responsibilities therefore expand to include this pre-dispatch check, alongside its existing post-hoc output review.

## Implementation (2026-08-04)

Wired per inbox item `audit-adr0008-admission-check-unwired-a1f01` (2026-08 internal audit finding 3 — this had been prose-only since v0.2). The mechanical **floor** of all three axes ships as a pure, tested library: [`scripts/lib/admission-check.mjs`](../scripts/lib/admission-check.mjs) (`admissionCheck({contextText, items, budget})` → `admit | escalate` + findings).

- **Axis 1 (budget):** token estimate vs the declared `context_budget`.
- **Axis 2 (source-tier):** any item tagged with a non-admitted tier (not 1/2/3/internal) escalates.
- **Axis 3 (obvious patterns):** a conservative prompt-injection tell-set. **Semantic distractor detection is deliberately NOT implemented** — it needs the embedding index that doesn't exist yet (empty `memory/vector-index/`; ADR-0055 Phase 1). That axis stays the Critic's judgment call, and the module says so (`judgment_deferred`) rather than pretend a floor it can't provide (capability-claims discipline).

The split mirrors the destructive-guard: obvious cases decided in code, nuance to the agent. A finding **escalates** (never silently proceeds, never hard-blocks), exactly as this ADR's Decision requires.

## Consequences

**Locks in:**
- Every dispatch goes through the Critic at the context boundary, not just the output boundary.
- The Critic touches more agent lifecycle events; its budget should anticipate this.

**Locks out:**
- "Just dispatch with whatever context the assembler returned" — no longer permitted.

**Migration path if it fails:** the check is lightweight by design; if it adds unacceptable latency, individual sub-checks (budget, tier, pattern) can be disabled independently while keeping the others.

## Alternatives considered

- **Output-only review (status quo)** — rejected: distractors and poisoned context have already done their damage by the time the output exists.
- **Dedicated new "Chaperone" agent** — rejected as premature; folding the duty into the Critic keeps the base set at six and respects the L2 "smallest agent set that handles the task" preference.
- **Enforce via the orchestrator alone, not via the Critic** — partially adopted: the orchestrator enforces the *budget* (ADR-0004) at dispatch; the Critic's check covers the *content* axes (tier, pattern) that the orchestrator is not well-positioned to judge.

## References

- [`../scripts/lib/admission-check.mjs`](../scripts/lib/admission-check.mjs) — the mechanical floor (+ `.test.mjs`)
- [`../layers/L2-agents.md`](../layers/L2-agents.md) — Hallucination firewall
- [`../agents/critic/SKILL.md`](../agents/critic/SKILL.md) — extended responsibilities
- [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md) §B.3
- ADR-0003 (distractor caveat), ADR-0004 (budget), ADR-0007 (tier filter), ADR-0009 (tier definitions)

## Affects / Affected by

**This ADR affects:**
- [`../scripts/lib/admission-check.mjs`](../scripts/lib/admission-check.mjs) — the mechanical-floor implementation (+ `.test.mjs`)
- [`../.claude/agents/critic.md`](../.claude/agents/critic.md) — the Critic invokes the floor for the automatable axes
- [`../layers/L2-agents.md`](../layers/L2-agents.md) — pre-dispatch admission-check section references the floor

**This ADR is affected by:**
- [ADR-0004](./0004-context-budget.md) (budget axis), [ADR-0007](./0007-content-trust-boundary.md)/[ADR-0009](./0009-research-standards.md) (tier axis), [ADR-0055](./0055-shared-lessons-learned-service.md) (Phase 1 embedding index the distractor axis waits on)
- `[research-p1][M]` Phase 1 retrieval & context-engineering research synthesis (sound inference, not a citable named component)
