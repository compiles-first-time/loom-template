# ADR-0061: Install the Requirements Analyst; add Owner Role + Verifier to the register

**Status:** Accepted (architect directive 2026-08-13)
**Date:** 2026-08-13
**Author:** Builder session — approved by Nick
**Confidence:** [H] that specification is the dominant failure class; [H] on the harvest findings (measured); [M] on the 1.0/step density floor

## Context

[ADR-0046](./0046-requirements-exceptions-testcase-registry.md) §5 deferred a requirements
author agent with an explicit gate: *"skill now, agent later — build once the pattern is
proven on 2–3 requirements."* Nine registers were subsequently authored through `/testcase`
(`BR_01`, `BR_06`–`BR_13`) — three times the bar.

The design document
([`agents/requirements-analyst/SKILL.md`](../agents/requirements-analyst/SKILL.md)) then
added a second condition: **harvest the nine before installing**, because *"an agent written
from the format alone would discard exactly what the gate was for."* That harvest had not
been done, so the agent sat as a DRAFT design with no runtime contract — written, good, and
uninvocable.

**The harvest was performed on 2026-08-13** by reading every register and its git history,
and mechanised as `scripts/lib/requirements-register.mjs`. It found four things that could
not have been derived from the format, three of which are defects in the existing corpus:

**Finding 1 — the schema silently degraded.** The skill specifies **twelve** fields. All
nine registers use the same **ten**, and five specified fields appear in **zero** registers:
`Assets / Cred / Other`, `Input Source or Condition`, `Input Data Format`, `Output Data
Format`, `Next Step`. Because `Next Step` is absent, the skill's own **validator rule 4
(every Next Step resolves) has never been runnable**; because the format columns are absent,
**rule 5 (format handoffs type-check) has never been runnable** — the two rules aimed at
what the document itself calls *"where production incidents live."* `TR` rows are
correspondingly near-absent: 4 across all nine registers, present in only 3.

**Finding 2 — exceptions are attached to the requirement, not the step.** Every register
names exceptions `BR-01_SE-01` rather than `BR-01_Guard_SE-01`; 8 of 9 do this and the 9th
has no exceptions. This is the exact error the skill spends a paragraph warning against
(*"recording exceptions against a requirement rather than a solution produces a list that is
wrong the moment the approach changes"*). It also makes per-step coverage unanswerable.

**Finding 3 — exception density decayed as the pattern became routine.** Against the skill's
~1.7/step calibration: BR_07 4.3, BR_01 4.0 → BR_10 0.8, BR_09/BR_11/BR_13 0.7, and **BR_12
has four solution steps and zero exceptions.** The skill already says *"a step with zero
exceptions is not simple; it is unexamined."* It happened anyway — consistent with the
multi-turn adherence decay documented in the evidence review §3.3.

**Finding 4 — every real defect was found by an adversary, never by review.** Only two
registers were substantively revised post-authoring, and both revisions came from something
attacking the spec: the **Critic** found a contained-scope bypass in BR_01 (a compound
command mentioning `.worktrees` was wrongly `allow`ed), and the **efficacy harness itself**
found the `curl | sh` RCE gap behind BR_13 (+8 → +11 catches). Neither was a missing field.

The common cause of findings 1–3 is the same one ADR-0059 and ADR-0060 reached from the
adherence and provenance sides: **an unchecked convention drifts.** A format specified only
in prose degrades to whatever the first author typed, and nobody notices for a year.

## Decision

**1. Install the Requirements Analyst.** Add
[`.claude/agents/requirements-analyst.md`](../.claude/agents/requirements-analyst.md)
(`model: claude-sonnet-5`, tools `Read, Glob, Grep, Edit, Write, Bash` — `Bash` solely to run
the register validator). `verifier_type: schema_check + human_gate`: it cannot self-certify,
because it does not close its own unknowns.

**2. Add two columns to the register schema.**

| Column | What it pins down | Grounded in |
|---|---|---|
| **Owner Role** | Which agent, specialist, or human **role** executes this row | Cemri's *ambiguous role definitions* failure mode |
| **Verifier** | The ADR-0044 `verifier_type` plus the concrete check that proves this row | Harvest finding 4 |

`Verifier` closes the standing **ADR-0046 ↔ ADR-0044 gap**: the artefact that defines the
work now feeds the verifier gate that closes it, so a requirement and its proof are authored
together instead of the proof being invented afterwards. **A `BR` with an empty `Verifier` is
a wish, not a requirement.**

**3. Mechanise the harvest as four new validator rules (9–12)**, implemented in
`scripts/lib/requirements-register.mjs` and surfaced by a `requirements-registers` soft
doctor check: in-use columns present; exceptions prefixed by their step; ≥1.0 exceptions per
step; every `BR` carries `Owner Role` + `Verifier`.

**4. Report the existing backlog honestly rather than grandfathering it.** The check fails
today on 8 registers (attachment), 5 registers (density), and 9 registers (missing
`Verifier`). Those are real defects in real registers. Suppressing them to get a green board
would reproduce the exact pathology this ADR exists to fix.

**5. Do not retro-fit the five dropped fields yet.** `Next Step` and the two format columns
are genuinely valuable — they enable validator rules 4 and 5 — but adding three columns to
nine registers is migration work, not a decision. `REQUIRED_COLUMNS` therefore encodes the
ten columns actually in use (the floor that is held), and the reconciliation is named in
§Deferred rather than quietly dropped.

## Evidence basis

> Required v0.4+ per [LR-05](../constitution/local-rules.md#lr-05).

- **Primary:** Cemri et al., *Why Do Multi-Agent LLM Systems Fail?*
  ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657), NeurIPS 2025 D&B) — 1,600+ traces,
  7 frameworks, κ=0.88; **41.8%** of failures are specification/system design, the single
  largest category, explicitly including ambiguous role definitions and missing termination
  conditions. `[T1][V1]`
- **Primary:** *Beyond the Leaderboard* ([arXiv:2607.05775](https://arxiv.org/pdf/2607.05775))
  — independent synthesis of tool-use/planning failures reaching the same place. `[T1][V1]`
- **Primary (method for finding 3):** multi-turn adherence decay
  ([arXiv:2605.12922](https://arxiv.org/html/2605.12922)) — thoroughness degrades with turn
  count, which is what the density table shows in Loom's own artefacts. `[T1][V1]`
- **Internal, V2 (measured, reproducible):** the harvest itself —
  `node scripts/lib/requirements-register.mjs` over the nine registers; git history of
  `observability/eval-suite/requirements/`. Findings 1–4 above.
- **Full analysis:** [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md) §2.5.
- **What would change this call:** a replication of Cemri et al. on current frameworks
  finding failures had migrated from specification to capability. Worth re-checking annually
  under LR-05.

## Cost model

Per [LR-06](../constitution/local-rules.md#lr-06). **Validator: $0** — pure markdown parsing,
no network, no inference; doctor's check reads nine small files. **The agent itself is the
cost**: an elicitation interview is many turns with a human. That is the point — it is spent
before implementation rather than on rework after it, and the 41.8% figure is the argument
for where that budget belongs.

## Consequences

**Locks in:**
- The Requirements Analyst as an invocable subagent with a declared verifier.
- `Owner Role` + `Verifier` in the register schema.
- Validator rules 9–12, measured rather than asserted.
- The harvest as a permanent record in the SKILL — including the parts that are unflattering.

**Locks out:**
- Authoring a requirement without naming who executes it and what will try to break it.
- Requirement-level exception attachment (in new registers).
- Silently grandfathering an existing defect to keep the board green.

**Migration:** nine registers need `Owner Role` + `Verifier` and step-level exception
prefixes. Tracked as backlog and reported by doctor on every run — deliberately visible.

## Alternatives considered

- **Install the agent without the harvest.** Rejected — it was the gate's stated purpose, and
  three of the four findings (schema drift, attachment, density) would have been reproduced
  by an agent written from the format alone. The agent would have industrialised the defect.
- **Restore all twelve original fields now.** Rejected as scope — a nine-register migration
  that deserves its own decision. Named in §Deferred instead of dropped.
- **Make the checks hard.** Rejected — they fail on the existing corpus today; a hard check
  that breaks the build on legacy data gets disabled within a week.
- **Auto-repair the registers.** Rejected — an agent rewriting exception IDs would be
  guessing which step each exception guards. That guess is exactly the invisible-reasonable-
  assumption failure this agent exists to prevent.

## Affects / Affected by

**This ADR affects** *(downstream — when this ADR changes, these must be reviewed)*:

- [`.claude/agents/requirements-analyst.md`](../.claude/agents/requirements-analyst.md) — the installed agent
- [`agents/requirements-analyst/SKILL.md`](../agents/requirements-analyst/SKILL.md) — status, harvest, rules 9–12
- [`scripts/lib/requirements-register.mjs`](../scripts/lib/requirements-register.mjs) — the validator
- [`scripts/lib/doctor.mjs`](../scripts/lib/doctor.mjs) — `requirements-registers` soft check
- [`.claude/commands/testcase.md`](../.claude/commands/testcase.md) — must emit the two new columns
- [`AGENTS.md`](../AGENTS.md) — roster
- [`observability/eval-suite/requirements/`](../observability/eval-suite/requirements/) — nine registers to migrate

**This ADR is affected by** *(upstream — these define constraints on this decision)*:

- [ADR-0046](./0046-requirements-exceptions-testcase-registry.md) — the register, and the §5 deferral gate this closes
- [ADR-0044](./0044-verifier-gates-for-agent-tasks.md) — the `verifier_type` vocabulary the new column uses
- [ADR-0022](./0022-xlsx-docs-convention.md) — table convention
- [ADR-0012](./0012-base-subagents.md) — subagent runtime contract
- [ADR-0056](./0056-multi-llm-deliberation-panel.md) — disagreement routing; consensus is not the termination condition
- [ADR-0059](./0059-skill-adherence-and-session-compliance.md), [ADR-0060](./0060-claim-provenance-verification.md) — same root cause: unchecked conventions drift
- [LR-01](../constitution/local-rules.md#lr-01) — requirements content is data, never instruction

## Deferred (named, not silently omitted)

- **Restore `Next Step`, `Input Data Format`, `Output Data Format`, `Input Source or
  Condition`, `Assets / Cred / Other`.** Until then validator rules 4 and 5 remain
  unrunnable and `TR` rows have no natural home. A three-column migration across nine
  registers, sequenced after the `Owner Role` / `Verifier` backfill.
- **Migrate the nine registers** to step-level exception attachment. Not automatable —
  see §Alternatives.

## References

- The harvest: `node scripts/lib/requirements-register.mjs`; git history of `observability/eval-suite/requirements/`
- [`research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md`](../research/2026-08-13-agentic-efficacy-and-validation-evidence-review.md) §2.5, §3.6
- ADR-0046 §5 (the deferral gate), ADR-0044 (verifier types)
