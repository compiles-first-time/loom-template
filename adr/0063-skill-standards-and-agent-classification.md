# ADR-0063: Skill authoring/vetting standards + agent risk×capability classification

**Status:** Accepted (architect directive 2026-08-16 — "go ahead and implement everything we have here")
**Date:** 2026-08-16
**Author:** Builder session — approved by Nick
**Confidence:** [H] that the skill population needs a checked standard; [M] on the specific thresholds (500 lines, trigger regex — tune from use); [H] on the classification axes, [M] on individual agent placements (reviewable in the diff)

## Context

The architect's stated architecture for Loom is a chameleon: **a small standing core plus
unbounded on-demand specialization** — dynamically synthesized specialists, cached as
skills, dispatched per task. That matches the tool-scaling evidence (performance follows an
inverted U over routing-surface size; see the 2026-08-16 analysis of the practitioner
corpus against `arXiv:2604.13787` and the enterprise-routing literature), and it has a
direct consequence: **skills become the growth axis, so skill quality becomes the
load-bearing discipline.** A skill costs one index line until invoked; an agent costs
routing surface permanently.

Nothing in Loom checked any property of the skill population. And per the standing lesson
([2026-08-13-an-unchecked-convention-drifts](../lessons-learned/2026-08-13-an-unchecked-convention-drifts.md)),
a convention nothing checks is not a convention — three prior disciplines drifted exactly
this way (ADR-0059/0060/0061).

Separately: Loom classifies **actions** (LR-04) and **models** (ADR-0045) but has never
classified **agents**. There was no answer, anywhere, to "how dangerous is this agent and
what oversight does it therefore need?" — the closest thing was the tools list, which
encodes least privilege but not blast radius or reasoning breadth.

Source material: the twelve-transcript practitioner corpus the architect supplied
(2026-08-15/16), gap-analyzed against the repo before adoption. The transcripts are
practitioner-tier (T4) individually; what was adopted is the subset that either converged
with T1 findings already in the evidence review or was directly verifiable against Loom's
own artifacts. Rejected content is listed in §Alternatives.

## Decision

### 1. Four authoring floors for every skill artifact

Implemented in [`scripts/lib/skill-standards.mjs`](../scripts/lib/skill-standards.mjs);
held by the `skill-standards` soft doctor check across all three populations
(`.claude/commands/`, `.claude/agents/`, `agents/specialists/_registry/`):

| Floor | Rule | Why |
|---|---|---|
| **Description is the trigger** | Agent descriptions must carry when-language; commands need a leading description paragraph; registry summaries need presence + ≤1024 chars (they route via manifest patterns, so no when-language required) | At routing time only name + description are visible, and models under-trigger |
| **Size budget** | ≤500 lines of body; beyond that, split into `references/` (progressive disclosure) | The body competes with everything else in context; only write what the model wouldn't know |
| **Deterministic scripts for fragile steps** | A step that must be exactly right every run is a script the skill says to *run*, never prose the model re-improvises | Probabilistic execution of fragile logic is inconsistent across runs by construction — the ADR-0059 no-inference principle applied to skill bodies. Authoring rule (EAC standard + register), not mechanically checkable |
| **Vet before install** | Third-party skills are untrusted until read in full + Critic-reviewed (LR-01); the mechanical floor scans all skill bodies for embedded RCE patterns, with `<!-- skill-vet: allow -->` as a justified, reviewed exception | A skill is a dependency read by an agent with tool access; public-skill audits report ~35% of ~4,000 scanned with security flaws, 13% critical |

The EAC's SKILL.md gains the authoring standard verbatim — every specialist it synthesizes
is born conforming — plus the **embed-vs-split placement rule** (split when reusable and
independent; embed when tightly coupled and context-dependent).

### 2. Agent classification: risk × capability × lifecycle

Three frontmatter fields on every `.claude/agents/*.md`, held by the
`agent-classification` soft doctor check:

- `risk: low|high` — blast radius of what the agent touches (damage bound, sensitivity,
  whether its outputs propagate into downstream state)
- `capability: low|high` — breadth of autonomous reasoning (predetermined actions vs
  non-deterministic path selection)
- `lifecycle: persistent|ephemeral`
- `hitl: <named human gate>` — **required in the high/high quadrant**

The quadrants and their consequences are documented in [L2](../layers/L2-agents.md#risk--capability-classification-adr-0063).
The high/high focus quadrant must name its human gate; high-capability *task-scoped* work
should be ephemeral (Rule 20 — a standing high/high agent is a standing irreversible
surface). This gives the chameleon's synthesized specialists their constitutional basis:
they are the ephemeral high-capability quadrant done deliberately.

All 21 installed agents are classified in this change. Placements worth review flags:
`memory-keeper` and `research-scout` are `risk: high` at low capability (memory poisoning
and external-content ingestion both propagate); `auth`/`oauth`/`ci` are `risk: high`
(security-critical output; pipelines can deploy); the three high/high agents —
`credential-setup` (ephemeral), `human-replica`, `eac` — each carry their existing human
gate, now named in frontmatter.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary (routing-surface degradation):** ToolOmni ([arXiv:2604.13787](https://arxiv.org/pdf/2604.13787)) —
  inverted-U over tool count (62.8% @1 → 78.3% @5 → 73.2% @9); enterprise routing
  stress tests at 49–741 tools show 7–85% drops ([arXiv:2606.17519](https://arxiv.org/pdf/2606.17519)). `[T1][V1]`
- **Primary (why deterministic floors):** *Reliability without Validity*
  ([arXiv:2606.19544](https://arxiv.org/html/2606.19544v1)) via ADR-0059 — the same
  principle applied to skill bodies. `[T1][V1]`
- **Practitioner corpus:** the 2026-08 transcript set (skills best practices; risk×capability
  quadrants) — `[T4]`, adopted only where convergent with the above or verifiable in-repo.
  The ~35%/13% skill-audit figures are from this corpus and are **uncorroborated** —
  labeled as such in L4; the vetting posture is justified by LR-01 alone even if the
  numbers are off.
- **Internal, V2:** the checker runs green on all 39 skill artifacts and 21 agents after
  one real fix (a description without when-language, caught on first run).
- **What would change this call:** evidence that description phrasing does not affect
  trigger rates (drop floor 1 to advisory); a measured skill population where >500-line
  bodies outperform split ones (raise the budget).

## Cost model

Per [LR-06](../constitution/local-rules.md#lr-06). $0 — pure text checks, no network, no
inference; doctor reads ~40 small files. The classification itself was a one-time
21-file frontmatter edit.

## Consequences

**Locks in:** the four floors for every future skill (EAC-synthesized ones are born
conforming); classification frontmatter on every installed agent; `hitl:` as a required,
named gate in the high/high quadrant; third-party skills as vetted dependencies.

**Locks out:** unbounded skill bodies; caption-style agent descriptions; installing an
outside skill without reading it; a high/high agent with an unnamed human gate.

**Migration:** none — the live repo conforms as of this change.

## Alternatives considered

- **Hierarchical three-tier agent org (from the same corpus).** Rejected — the transcript
  itself names the telephone-game failure mode, and the flat orchestrator + ephemeral
  specialists pattern is what the field converged on. Loom keeps its topology.
- **Enforce when-language on registry summaries.** Rejected — registry routing is
  manifest-pattern-based (ADR-0023), so the requirement would nag without improving routing.
- **A `medium` tier on the axes.** Rejected — a 2×2 forces the conversation the middle
  value lets you avoid; LR-04 already grades enforcement finely at the action level.
- **Hard-gating the checks.** Rejected per the ADR-0061 precedent — new standards report
  before they break builds.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- [`scripts/lib/skill-standards.mjs`](../scripts/lib/skill-standards.mjs) (+ tests)
- [`scripts/lib/doctor.mjs`](../scripts/lib/doctor.mjs) — `skill-standards`, `agent-classification`
- [`.claude/agents/*.md`](../.claude/agents/) — classification frontmatter (21 files)
- [`agents/eac/SKILL.md`](../agents/eac/SKILL.md) — authoring standard + embed-vs-split
- [`layers/L2-agents.md`](../layers/L2-agents.md) — quadrant table
- [`layers/L4-tooling.md`](../layers/L4-tooling.md) — skill vetting policy
- [`observability/eval-suite/requirements/BR_18.md`](../observability/eval-suite/requirements/BR_18.md) — register

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- [ADR-0023](./0023-specialist-registry.md) — registry format and manifest routing
- [ADR-0044](./0044-verifier-gates-for-agent-tasks.md) — `verifier_type` remains required alongside the new fields
- [ADR-0045](./0045-per-agent-model-routing.md) — model tiers compose with capability tiers
- [ADR-0059](./0059-skill-adherence-and-session-compliance.md) — no-inference principle
- [LR-01](../constitution/local-rules.md#lr-01) — third-party skill bodies are retrieved content
- [`constitution/kernel-v6.md`](../constitution/kernel-v6.md) — Rule 20 (ephemeral high/high), Rule 22

## References

- The twelve-transcript analysis (this session, 2026-08-15/16); [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md)
- ADR-0048 (model-agnostic north star — portable skills serve it), ADR-0061 (report-don't-grandfather precedent)
