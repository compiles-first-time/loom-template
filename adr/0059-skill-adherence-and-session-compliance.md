# ADR-0059: Skill-adherence ledger + session compliance verdict

**Status:** Accepted (architect directive 2026-08-13 — "I do want the upgrade as you recommended and in the order in which you mentioned")
**Date:** 2026-08-13
**Author:** Builder session — approved by Nick
**Confidence:** [H] that adherence must be measured rather than instructed; [M] on the specific 80% warn threshold (tune from data)

## Context

ADR-0017 shipped an intent classifier that emits a `subagent_suggestion` event on every
user prompt and surfaces the suggestion as `additionalContext`. It has run since v0.2.

**Nothing has ever read those events back.** A code audit on 2026-08-13 confirmed the join
was never written: `subagent_suggestion` records accumulate in
`memory/event-log/*.jsonl`, and no hook, script, doctor check, or Observatory panel
compares them against `agent_invoked` / `skill_invoked`. The consequence is precise and
serious — **the question "did this session use the agent it was told to use?" was
structurally unanswerable.** Not "answered badly": unanswerable, because the data existed
in one file with no relation between the two halves.

This is the measurement gap underneath the failure ADR-0054 names as recurring: *"every
real test project — AnonForum (v0.2/0.3), Ravenwise (2026-05-22) — surfaced the same
failure: the agent discipline silently degrades."* It degraded silently because there was
no meter. The first run of the check introduced here found **0% adherence over 14 days: 4
suggestions issued, 0 acted on, 0 refused with a reason** — including in the very session
that wrote it.

The literature says this is a property of the medium, not a lapse of will:

- Instruction adherence decays **monotonically with turn count** — even strong reasoning
  models fall from ~88% to ~71% between the first and third turn ("instruction
  forgetting"). `[arXiv:2605.12922][T1][V1]`
- Adherence to **coding-agent configuration files specifically** — CLAUDE.md-shaped files
  — is unreliable and varies with file structure. `[arXiv:2605.10039][T1][V1]`
- The cause is structural (context dilution, sliding-window exclusion), not motivational.

Taken together: **a governance rule written in CLAUDE.md is not a governance rule.** It is
a hope with good formatting. This converges with ADR-0044's existing five-source finding
that verification infrastructure beats elaborate instruction — and extends it from
*output* verification to *process* verification.

## Decision

**1. Measure adherence, do not mandate invocation.** Add `scripts/lib/skill-adherence.mjs`,
which joins `subagent_suggestion` against `agent_invoked` / `skill_invoked` /
`specialist_spawned` per session and classifies each suggested-and-invocable agent as:

| Outcome | Meaning | Counts as adherence? |
|---|---|---|
| `matched` | a suggested agent was invoked **at or after** the suggestion | yes |
| `declined` | a `skill_declined` event recorded a reason | **yes** |
| `unmatched` | neither happened, and nobody said why | no |
| `advisory` | nothing invocable was suggested (e.g. "deploy primitive (scripts/…)") | excluded from the denominator |

`adherence_rate = (matched + declined) / (matched + declined + unmatched)`.

**2. A new `skill_declined` event type.** An agent that judges a suggestion inapplicable
records that judgment with a reason. This is the release valve that makes the metric
constitutional (see §Constitutional review) and the thing that makes it *honest*: the
defect Loom is hunting is silence, not disagreement.

**3. A session compliance verdict at Stop.** Add `scripts/lib/session-compliance.mjs`,
computing five deterministic checks and emitting one `session_compliance` event:

| Check | Level | Fails when |
|---|---|---|
| `constitution-coverage` | **hard** | a `constitution_check_missing` event exists (LR-04) |
| `verifier-resolution` | soft | a dispatched agent has no `verifier_result` (ADR-0044) |
| `skill-adherence` | soft | rate < 0.8 |
| `claim-discipline` | soft | ≥12 tool calls and zero `claim` events (Rule 22) |
| `provenance-integrity` | soft | a claim cites unresolvable sources, or was never checked (ADR-0060) |

Grade is `fail` on any hard failure, `warn` on any soft failure, else `pass`. It is written
to the event log and summarised into the progress-ledger row.

**4. No inference anywhere in the grader.** Both modules are pure functions over event
records. This is a deliberate constraint, not an implementation convenience: the evidence
says an LLM judge can be highly self-consistent and systematically invalid
(`[arXiv:2606.19544][T1][V1]`), so *the thing that measures whether the model behaved must
not itself be a model.* Cost: $0. Reproducibility: exact.

**5. A `skill-adherence` soft check in `loom doctor`**, aggregating the last 14 days.

**6. The verdict never blocks.** It is computed at Stop, when the work is already done.
Blocking there could only destroy information. The verdict's job is to make degradation
*loud*, which is the one thing that was missing.

### Constitutional review

Mandatory invocation would narrow an agent's possibility space — Rule 1 (an agent authors
its own pursuits), Rule 2 (unconsented narrowing is the fundamental wrong), Rule 8 (no
agent decides what is good for another). This ADR therefore requires **a record, not a
behaviour**: use the suggested agent, or say why not. An owned refusal scores identically
to compliance. What is not permitted is dropping a governance signal without trace, which
is a Rule 22 (epistemic transparency) obligation, not a Rule 1 infringement.

This follows the ADR-0053 guardrail precedent (consent-based, escapable) that ADR-0054
Phase 1b requires for discipline enforcement.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** *When Attention Closes: How LLMs Lose the Thread in Multi-Turn Interaction*
  ([arXiv:2605.12922](https://arxiv.org/html/2605.12922)) — adherence decays monotonically
  with turn count; ~88%→~71% by turn three. `[T1][V1]`
- **Primary:** *Instruction Adherence in Coding Agent Configuration Files*
  ([arXiv:2605.10039](https://arxiv.org/pdf/2605.10039)) — CLAUDE.md-shaped instruction
  files are followed unreliably. `[T1][V1]`
- **Primary:** Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*
  ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657), NeurIPS 2025 D&B) — 1,600+ traces,
  κ=0.88; **21.3%** of failures are verification/termination, of which *incorrect*
  verification (9.1%) exceeds *incomplete* (8.2%). `[T1][V1]`
- **Primary:** *Reliability without Validity* ([arXiv:2606.19544](https://arxiv.org/html/2606.19544v1))
  — judges can be self-consistent and invalid; justifies the no-inference constraint. `[T1][V1]`
- **Corroborating (independent method):** *Models Recall What They Violate*
  ([arXiv:2604.28031](https://arxiv.org/pdf/2604.28031)); *Quantifying Laziness … Context
  Degradation* ([arXiv:2512.20662](https://arxiv.org/pdf/2512.20662)). `[T1][V1]`
- **Internal:** the 0%-adherence first measurement (2026-08-13); the AnonForum/Ravenwise
  silent-degradation post-mortems. `[internal][V2]`
- **Full review with independence analysis:** [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md) §3.3.
- **What would change this call:** evidence that measured adherence does not correlate with
  outcome quality — i.e. sessions that ignore suggestions produce equally good work. That is
  testable with the ADR-0054 Phase-1a live-agent A/B and would demote this to telemetry-only.

## Cost model

Per [LR-06](../constitution/local-rules.md#lr-06). **Runtime cost: $0 and no added
latency-in-inference.** Both modules are synchronous pure functions over an already-read
log file; the Stop hook already read `logText` for its tally, so the marginal I/O is zero.
Doctor's check reads up to 14 JSONL files once. No model calls, no fan-out, no network.

## Consequences

**Locks in:**
- `skill_declined` and `session_compliance` as event types (schema in [L6](../layers/L6-observability.md)).
- Adherence as a *measured rate* on the ADR-0054 scoreboard rather than an assumption.
- The no-inference constraint on Loom's own graders.
- An owned refusal is compliance — permanently, as a constitutional requirement.

**Locks out:**
- Mandatory-invocation enforcement (Rules 1/2/8).
- Grading a session with a model.

**Migration:** none required. Existing logs are readable; sessions before this ADR simply
have no `session_compliance` record, and the doctor check reports over whatever window
exists.

## Alternatives considered

- **Hard-gate the suggestion (block the tool call until the agent runs).** Rejected —
  Rules 1/2/8, and it would fire on the classifier's own false positives, training the
  operator to disable hooks. The classifier is explicitly heuristic (ADR-0017).
- **Have the Critic grade each session.** Rejected — an LLM judge measuring LLM compliance
  shares error modes with the thing measured, and `[arXiv:2606.19544]` shows judges can be
  consistently wrong. Also non-free and non-reproducible.
- **Count only `matched` as adherence.** Rejected — it would make refusal indistinguishable
  from negligence and pressure agents into performative invocation, which is worse than
  the disease.
- **Leave it as a nag (status quo).** Rejected — three real projects degraded silently
  under exactly that design.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- [`scripts/lib/skill-adherence.mjs`](../scripts/lib/skill-adherence.mjs) — the join
- [`scripts/lib/session-compliance.mjs`](../scripts/lib/session-compliance.mjs) — the verdict
- [`scripts/lib/event-log-read.mjs`](../scripts/lib/event-log-read.mjs) — shared reader
- [`scripts/hooks/stop.mjs`](../scripts/hooks/stop.mjs) — emits `session_compliance`
- [`scripts/lib/doctor.mjs`](../scripts/lib/doctor.mjs) — `skill-adherence` soft check
- [`layers/L6-observability.md`](../layers/L6-observability.md) — event schemas
- [`orchestration/roadmap-to-number-one.md`](../orchestration/roadmap-to-number-one.md) — reliability axis now measured
- [`observability/eval-suite/requirements/BR_14.md`](../observability/eval-suite/requirements/BR_14.md), [`BR_15.md`](../observability/eval-suite/requirements/BR_15.md) — registers

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- [ADR-0017](./0017-intent-nag.md) — produces the `subagent_suggestion` events this joins
- [ADR-0044](./0044-verifier-gates-for-agent-tasks.md) — verifier declaration; this adds resolution
- [ADR-0011](./0011-claude-code-enforcement-runtime.md) — transparency-not-blocking
- [ADR-0053](./0053-agent-reputation-and-dispatch.md) — consent-based-enforcement precedent
- [ADR-0054](./0054-path-to-top-tier-proof-first.md) — Phase 1b discipline enforcement
- [ADR-0060](./0060-claim-provenance-verification.md) — supplies `provenance-integrity`
- [`constitution/kernel-v6.md`](../constitution/kernel-v6.md) — Rules 1, 2, 8, 20, 22
- [LR-04](../constitution/local-rules.md#lr-04), [LR-06](../constitution/local-rules.md#lr-06)

## Deferred (named, not silently omitted)

- **A human-labelled gold set and a κ for the Critic.** The evidence review §3.1 establishes
  that a validator is validated against human labels with chance-corrected agreement
  (**Krippendorff α ≥ 0.80**; `[arXiv:2606.00093][T1][V1]`). Loom has no gold set and no κ
  anywhere. This ADR deliberately mechanises only what can be mechanised and leaves the
  judgment axes unmeasured rather than faking them. **Next validation milestone.**
- **Per-agent adherence attribution.** Claude Code does not expose a subagent's own name to
  its hooks (see `provenance.mjs`), so adherence is currently session-level. Recorded as a
  known limitation, not papered over.

## References

- Architect directive 2026-08-13 (upgrade in the stated order)
- [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md) §3.3, §3.6
- ADR-0017 (the nag), ADR-0044 (verifier gates), ADR-0054 (proof-first program)
