# ADR-0044: Verifier gates for agent tasks

**Status:** Accepted
**Date:** 2026-06-15
**Author:** Builder — approved by Nick
**Confidence:** [H] on verifier principle; [M] on surrogate verifier applicability

## Context

LLM agents perform most reliably on tasks that have an objective verifier — a binary signal confirming correct completion. Without a declared verifier, agent tasks compound errors silently, cannot be caught by the progress ledger, and produce undetectable drift in long-running sessions.

The 2026-06-15 literature validation confirms this at `[H]` confidence across three independent primary sources:
- DeepSeek-R1 RLVR (arXiv:2501.12948): reinforcement learning with binary verifier rewards produces reliable improvement only in verifiable domains.
- Lightman et al. process rewards (arXiv:2305.20050): outcome verification is the binding constraint on model reliability.
- τ-bench (arXiv:2406.12045): even in bounded task domains, agents achieve ~61% pass@1 — performance degrades without explicit verifiers and cannot improve without a binary success signal.

Loom's existing checks (`loom doctor`, hook exit codes, eval suite) implicitly implement verifiers for specific tasks, but no systematic convention requires agents to declare their verifier at design time.

## Decision

Add a `verifier_type:` field to every SKILL.md frontmatter. This is a soft documentation convention enforced by a new `loom doctor` check (`skill-verifier-declared`). Non-compliance emits a warning; it does not fail the build, consistent with L5's transparency-not-blocking philosophy per ADR-0011.

### Verifier types

| `verifier_type` value | Meaning | Example |
|---|---|---|
| `exit_code` | Terminal command exits 0 on success | `collect-credentials`, any script-backed specialist |
| `schema_check` | Output conforms to a declared schema | ADR frontmatter, manifest.yaml, event-log record |
| `test_suite` | A test suite passes | `npm test`, eval-suite rubric |
| `human_gate` | A human explicitly approves before task closes | credential-setup consent protocol, consequential ADRs |
| `surrogate` | Proxy metric approximating success | Position-size ≤5% NAV, drawdown limit (trading) |

A task may declare more than one (e.g., `exit_code + human_gate`). In that case, both must pass.

### Surrogate verifiers

For tasks where ground truth is not available at runtime (trading signals, research quality), a surrogate verifier is the practical equivalent: a measurable proxy that correlates with success. Surrogate verifiers must be declared explicitly — an undeclared surrogate is not a verifier.

### loom doctor check

A new soft check `skill-verifier-declared` scans all `SKILL.md` files under `agents/specialists/_registry/` and `agents/specialists/` for the `verifier_type:` field. Missing files emit a warning.

### L5 orchestration convention

The L5 supervisor must not dispatch an agent task that lacks a declared verifier without first escalating to the architect. Open-ended instructions without a declared verifier (e.g., "manage the portfolio", "fix the codebase") are a doc violation under this ADR.

## Evidence basis

- **Primary:** DeepSeek-R1 / RLVR (arXiv:2501.12948, 2025) — RLVR trains reliably only in domains with binary verifiers; out-of-scope for non-verifiable domains by design. `[primary][H]`
- **Primary:** Lightman et al. process rewards (arXiv:2305.20050, OpenAI/ICLR 2024) — process supervision reaches 78% vs 69% for outcome supervision; both contingent on verifiable ground truth. `[primary][H]`
- **Primary:** τ-bench (arXiv:2406.12045, ICLR 2025) — agents achieve ~61% pass@1 in constrained domains; consistent reliability requires explicit rule-compliance verifiers at each step. `[primary][H]`
- **Corroborating:** Cemri et al. multi-agent failure modes (arXiv:2503.13657) — task verification failures are the primary failure mode in multi-agent pipelines. `[primary][M]`
- **What would change this call:** Evidence that verifier declarations add significant engineering overhead without reliability gain would justify dropping to advisory-only. Current evidence strongly supports the convention.

### External corroboration (2026-08-03)

**Verification-first is a design principle, not just a mechanism.** Five independent external sources, of different types, converge on the same conclusion this ADR reached from the literature: **verification/enforcement infrastructure is the highest-leverage reliability lever for agent systems — invest there before investing in more elaborate instructions or prompts.** `[multi-source][80–95%]`

1. Boris Cherny (head of Claude Code), YC interview: *"verification … is probably the single most important thing that people do not get right."* `[cherny-primary: ycombinator.com/library/UN-boris-cherny-building-claude-code][founder interview — Anthropic is the vendor of Loom's first adapter runtime, so treat as vendor-adjacent; weight comes from the four independent sources below][80–95%]` (secondary report: searchenginejournal.com/head-of-anthropics-claude-code-says-prompt-engineering-not-that-important/584286/)
2. LangChain's harness-tuning playbook — a verify-before-promote eval loop is the engine of its improvement cycle (see ADR-0021 §D). `[langchain-harness: langchain.com/blog/tuning-the-harness-not-the-model-a-nemotron-3-ultra-playbook][vendor self-report]`
3. Every.to "Compound Engineering" — review/verify loop as the compounding step (Tier-4 newsletter; cited for convergence only, not for its productivity numbers — see the METR RCT, arXiv:2507.09089, which contradicts them). `[compound: every.to/guides/compound-engineering][Tier-4]`
4. Stanford DeLM (decentralized agents, VentureBeat 2026-06-16) — compress-**and-verify**: only *verified* findings are shared between agents. `[delm][Tier-3 reporting]`
5. The-Claude-Protocol (github.com/AvivK5498/The-Claude-Protocol, MIT; single-author OSS project) — hooks that *block*, not warn. `[claude-protocol][primary for its own design][60–80%]`

Independent peer-track corroboration that the harness/verification layer dominates outcomes: the agent-evaluation survey (arXiv 2503.16416 — **arXiv preprint, peer-review status unconfirmed**) finds scaffold/harness choice causes **>30%** performance variation on the same model. `[scaffold-survey][preprint][80–95%]`

**Principle (elevated by this corroboration):** *prefer verification infrastructure (verifier gates, enforcing hooks, eval loops) over elaborate instructions.* This was already this ADR's mechanism; the convergence makes it a stated Loom design principle (see the CLAUDE.md working agreement "Verification-first").

*What would raise to >95%:* a controlled Loom eval showing verifier-gated agent tasks beat ungated ones on a fixed golden set (candidate: extend the ADR-0054 efficacy harness).

## Consequences

**Locks in:**
- `verifier_type:` is a required SKILL.md frontmatter field (soft enforcement via loom doctor).
- `loom doctor` gains a new soft check: `skill-verifier-declared`.
- L5 orchestration layer documents the convention and the five verifier types.
- `credential-setup` SKILL.md is the reference implementation for `human_gate + exit_code`.

**Locks out:**
- Nothing. The convention is additive and soft-enforced; existing SKILL.md files without the field emit a warning, not a build failure.

**Migration:** Existing bundled specialists should add `verifier_type:` at next edit. The doctor check surfaces which ones remain un-declared.

## Affects / Affected by

**This ADR affects:**
- [`layers/L5-orchestration.md`](../layers/L5-orchestration.md) — new Verifier contract section
- [`scripts/lib/doctor.mjs`](../scripts/lib/doctor.mjs) — new `checkSkillVerifiers` soft check
- [`agents/specialists/_registry/credential-setup/SKILL.md`](../agents/specialists/_registry/credential-setup/SKILL.md) — adds `verifier_type:` as reference implementation

**This ADR is affected by:**
- [ADR-0011](./0011-claude-code-enforcement-runtime.md) — transparency-not-blocking philosophy; verifier checks are soft, not hard
- [ADR-0015](./0015-loom-doctor.md) — loom doctor extension protocol
- [LR-06](../constitution/local-rules.md#lr-06) — exit conditions must be declared before loop execution; `verifier_type` is the task-level formalization of exit condition
- [`constitution/kernel-v6.md`](../constitution/kernel-v6.md) — Rule 22 (audit trail); verifier outcome must be observable

## References

- Literature validation 2026-06-15 (this session) — synthesizes the three primary sources above
- [`layers/L5-orchestration.md §Verifier contract`](../layers/L5-orchestration.md#verifier-contract) — implementation
- [`scripts/lib/doctor.mjs`](../scripts/lib/doctor.mjs) — `checkSkillVerifiers` function
