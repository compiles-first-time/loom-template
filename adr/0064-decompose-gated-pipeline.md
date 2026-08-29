# ADR-0064: /decompose — the gated pipeline from register to dispatch

**Status:** Accepted (architect directive 2026-08-16)
**Date:** 2026-08-16
**Author:** Builder session — approved by Nick
**Confidence:** [H] that the spine was the missing piece; [H] on gap-detection mechanics (tested against real registers); [M] on the owner-role vocabularies (extend as registers use new roles)

## Context

The architect's statement of intent (2026-08-16): Loom builds software from requirements,
with specialists *"spun up dynamically with very special functionality, as needed, per the
right reason."* The pipeline that vision implies is:

```
requirements → decompose → synthesize missing specialist → build → verify → learn
```

Before this ADR, every stage existed **except the second**. The register (ADR-0046/0061)
defined the work; verifier gates (ADR-0044) closed it; the EAC could synthesize
specialists; lessons captured what was learned. Nothing connected them — and the most
distinctive capability in the vision, dynamic synthesis *triggered by need*, had no
trigger. `agents/specialists/` sits empty; the EAC has synthesized exactly one specialist
ever, prompted by a human noticing a gap, not by the system.

The joint evidence says this is the highest-leverage place to build:

- **41.8% of measured multi-agent failures are specification/system design** — the largest
  category (Cemri et al., NeurIPS 2025, 1,600+ traces, κ=0.88) — and a further 36.9% are
  inter-agent misalignment: context lost at handoff, format mismatches. `[T1][V1]`
- The field converged on **gated phases with the plan as a reviewable artifact**
  (GitHub's Spec Kit: specify → plan → tasks → implement; Anthropic's explore → plan →
  implement → commit) — "code got cheap; the spec is the artifact." `[T4, convergent
  multi-vendor]`
- ADR-0061 added `Owner Role` + `Verifier` to the register **as the join keys for exactly
  this pipeline**. This ADR is the join running.

## Decision

**1. A deterministic decomposer** — [`scripts/lib/decompose.mjs`](../scripts/lib/decompose.mjs).
Input: a mechanically-complete register. Output: a task graph where every `BR`, solution
step, and `TR` is a node carrying:

| Field | From | Meaning |
|---|---|---|
| `owner_role` / `owner_kind` | register + roster/registry resolution | who executes: `agent`, `registry`, `runtime`, `human` — or **`gap`** |
| `verifier` | register | the ADR-0044 gate that closes the node |
| `context_packet` | register structure | the node's rows + step-attached exceptions — the pruned slice a specialist receives, never the whole conversation |
| `kind` | row type | `requirement` / `step` / **`prerequisite`** (TR rows — the blocking list surfaces *before* dispatch, not as a mid-build surprise) |

No agent judgment anywhere in graph construction — the same no-inference constraint as
ADR-0059's graders, for the same reason.

**2. `specialist_gap` is the chameleon trigger.** An `Owner Role` matching no installed
agent, registry specialist, or known runtime/human role emits a `specialist_gap` event and
routes to the **EAC**, which applies embed-vs-split (ADR-0063), authors to the skill
standard, registers through HR, caches in the registry — then the node dispatches.
Capability is synthesized against a named node in an approved plan, never speculatively.
**Unowned is not a gap**: a blank owner is a register defect reported back upstream; a gap
is a *named* role that doesn't exist yet.

**3. The plan is the artifact.** `renderPlan()` emits reviewable markdown saved to
`orchestration/plans/`; **approval happens on the file** ("trust the file, not the chat"
— what an agent says in conversation and what lands in the plan are not always the same
thing). Execution then starts in a **fresh session** carrying only the approved plan +
per-node packets (context hygiene: the debate that produced the plan competes with the
plan for attention).

**4. Proportionality — the anti-ceremony rule.** ≤1 solution step ⇒
`direct_execution_advised`, stated in the plan output itself. A discipline that taxes
one-sentence changes gets disabled, and a disabled discipline protects nothing. This is
the same reasoning that keeps confirmation prompts rare (ADR-0047's 0% false-positive
requirement) applied to planning.

**5. Register defects stay register defects.** The decomposer reports unowned/unverified
nodes by ID and refuses to guess — filling them in downstream would reintroduce the
invisible-reasonable-assumption failure the Requirements Analyst exists to prevent.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** Cemri et al. ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657), NeurIPS
  2025) — 41.8% specification + 36.9% inter-agent misalignment; context packets target the
  handoff share directly. `[T1][V1]`
- **Convergent practice (T4, multi-vendor):** Spec Kit's gated phases (~124k stars);
  Anthropic's workflow guidance including its own proportionality rule ("if you can
  describe it in one sentence, skip the plan"); the `AGENTS.md` convention (~60k projects).
  Independent vendors with competing products landing on plan-first is the practitioner
  analogue of independent error modes.
- **Internal, V2:** dogfooded on BR_16 — 7 nodes, TR surfaces as prerequisite, packets
  correct, zero false gaps; 37/37 unit tests including the live-register case.
- **What would change this call:** measured evidence that plan-gated builds don't beat
  direct execution on non-trivial changes (the Phase-1a live A/B can now test exactly
  this, because the pipeline exists to A/B).

## Cost model

Per [LR-06](../constitution/local-rules.md#lr-06). Decomposition: $0, deterministic, no
inference. The pipeline's real cost is the EAC synthesis a gap triggers — which is the
point: that spend now happens *per named need in an approved plan* instead of
speculatively, and LR-06's estimate-before-fan-out applies at dispatch.

## Consequences

**Locks in:** the register as the single source the plan derives from; `specialist_gap` as
the only sanctioned synthesis trigger; plan files as the approval surface; context packets
as the handoff unit; proportionality as a stated rule.

**Locks out:** hand-built task graphs; speculative specialist synthesis; execution from
chat scrollback; planning ceremony on one-sentence changes.

**Migration:** none — additive. `orchestration/plans/` is created on first use.

## Alternatives considered

- **LLM-planned decomposition.** Rejected — planning is where current models are measurably
  inconsistent (missed dependencies, over-decomposition), and the register already contains
  the decomposition; the module's job is resolution and packeting, not invention.
- **Auto-dispatch on gap (skip EAC→HR review).** Rejected — synthesized capability entering
  the system unreviewed is the supply-chain hole ADR-0063 §vetting closes; the EAC is
  high/high quadrant precisely because of this.
- **Full three-tier hierarchy for execution.** Rejected per ADR-0063 — flat orchestrator +
  ephemeral specialists, packets instead of layers.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- [`scripts/lib/decompose.mjs`](../scripts/lib/decompose.mjs) (+ tests)
- [`.claude/commands/decompose.md`](../.claude/commands/decompose.md) — the skill
- [`agents/eac/SKILL.md`](../agents/eac/SKILL.md) + [`.claude/agents/eac.md`](../.claude/agents/eac.md) — the gap trigger
- [`layers/L5-orchestration.md`](../layers/L5-orchestration.md) — pipeline documentation
- `orchestration/plans/` — plan artifacts (created on use)
- [`observability/eval-suite/requirements/BR_19.md`](../observability/eval-suite/requirements/BR_19.md) — register

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- [ADR-0046](./0046-requirements-exceptions-testcase-registry.md) / [ADR-0061](./0061-requirements-register-role-and-verifier-fields.md) — the register and its join keys
- [ADR-0044](./0044-verifier-gates-for-agent-tasks.md) — nodes close on verifier resolution
- [ADR-0063](./0063-skill-standards-and-agent-classification.md) — synthesized specialists' standard + embed-vs-split
- [ADR-0030](./0030-specialist-lifecycle.md) / [ADR-0034](./0034-specialist-invocation-discipline.md) — the EAC→HR registration gate
- [ADR-0008](./0008-context-admission-check.md) — packets pass the admission check like any dispatched context
- [LR-06](../constitution/local-rules.md#lr-06) — cost surfaced at dispatch

## References

- The twelve-transcript analysis (2026-08-15/16); ADR-0054 (the pipeline is Phase-1a's test subject); [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md) §2.5
