---
date: 2026-07-15
author: Builder (Opus 4.8) — approved by Nick
topic: research findings (multi-LLM + agent-ownership) + deliberation-panel decision + pending proof-first work
status: active
---

# Handoff — deliberation panel, verified research, and the Phase-1 backlog

> **Why this exists:** the prior session hit the org monthly token cap. Nick is continuing on a **different Claude account with a high cap**, to actually *do the updates*. This doc + the bootstrap prompt below are the bridge. It supersedes nothing — read [`2026-07-07-option-b-complete-and-agent-engagement.md`](./2026-07-07-option-b-complete-and-agent-engagement.md) for the older baseline and [`2026-07-08-phase1-uipath-3d-visualizer.md`](./2026-07-08-phase1-uipath-3d-visualizer.md) for the process-cartographer kickoff.

## TL;DR — paste into a NEW chat on the high-cap account to bootstrap

```
I'm Nick, the architect; you're the builder. This account has a HIGH token cap —
USE multi-agent workflows freely for the proof-first work, but keep Loom's cost
DISCIPLINE: route fan-out subagents to Sonnet/Haiku not Opus (ADR-0045), cost-gate
multi-agent to high-value decisions (LR-06). Be proof-first and honest — measure,
don't claim; don't overstate scope (ADR-0054).

STEP 0 — clone + orient (order matters):
- git clone both GitHub repos (compiles-first-time/loom-template and
  compiles-first-time/process-cartographer) into sibling folders.
- Open Claude Code INSIDE loom-template (clone FIRST, then open) so Loom's hooks,
  subagents, and the /testcase + /ticket skills register at session start. Verify:
  memory/event-log/ has today's session_start event — if not, restart in the repo
  dir before doing anything else (ADR-0020/0038 cold-start gap).
- Read, in order: this doc; adr/0054-path-to-top-tier-proof-first.md (the program);
  adr/0055-shared-lessons-learned-service.md; adr/0022-xlsx-docs-convention.md
  (Requirements & Exceptions format); adr/0046-requirements-exceptions-testcase-
  registry.md; orchestration/roadmap-to-number-one.md (the scoreboard). Skim
  layers/ + AGENTS.md to understand the codebase. State: main green, ADRs through
  0055, doctor 0 hard failures, suite 420/420.

STEP 1 — PRESENT A TRACKABLE PLAN (propose-first; do NOT build until I approve):
Decompose the "Pending work" below into discrete items. For EACH item author a
Requirements & Exceptions register in Loom's own format (ADR-0022 + ADR-0046 — use
the /testcase skill): the business + technical requirement(s) it satisfies, its SE
(System Exception) + BE (Business Exception) failure modes, expected input →
expected output (actual filled on completion), and the Justifications column. Open
a kanban ticket per item (ADR-0048 OB-X-01 — /ticket skill) so we mark items off as
we go (visible in the Observatory). Present the item list + registers + board for
my approval. (See "How we track the work" below.)

STEP 2 — EXECUTE proof-first (after I approve): work items in priority order. An
item is DONE only when its R&E register PASSES — requirements met, SE/BE exceptions
handled + tested (resilience, accuracy, stability), kept for regression. Move its
ticket across the board as you go. loom doctor + full suite green before every PR;
dispatch the `critic` before consequential commits, `constitution-service` for
L0/mandatory-enforcement; VERIFY agent claims against real tools; the destructive
guard is LIVE (no rm-rf/force-push literals in shell args); never hand-commit
hook-managed files (orchestration/progress-ledger.md, tools/discovered-runtime.md).
You may merge green PRs; propose-first for L0.

Priority items: (1) multi-LLM DELIBERATION PANEL — disciplined version
(reputation-weighted + robust aggregation, cost-gated); ADR first, then build.
(2) Phase-1b: discovery-authored doctor check + cold-start bootstrap fixes.
(3) Lessons-service Phase 0 (ADR-0055): lesson frontmatter schema + local
loom lessons search. (4) optional: finish the deep-research verification (re-run
the bundled deep-research skill). Full detail in "Pending work".
```

## How we track the work (dogfood Loom's own Requirements & Exceptions registry)

Nick's requirement: every work item is tracked in the **Requirements & Exceptions format** so "done" means *resilience, accuracy, stability* — not just "code written." This is Loom governing its own development with its own machinery (and it exercises ADR-0046 on real work):

- **Per item → a test-case register** (`/testcase`, ADR-0046, in the ADR-0022 xlsx convention): the **business + technical requirements** it satisfies; **SE** (System Exception) and **BE** (Business Exception) rows; **expected input → expected output** (actual filled on completion); and the **Justifications** column (why each handler/decision is load-bearing). The register is the **definition-of-done** and is kept for regression.
- **Per item → a kanban ticket** (`/ticket`, ADR-0048 OB-X-01) moved across the board as work proceeds — the "mark it off" view, visible in the Observatory.
- **Proof-first (ADR-0054):** an item closes only when its register *passes* — the SE/BE exceptions are actually handled + tested, not merely enumerated. Example: for the *deliberation panel*, BE rows include "panel converges on a shared wrong answer (confabulation consensus)" and "a low-reputation/compromised agent swings the vote"; the robust-aggregation design is the handler, and the register's expected-output is what the test asserts.

Present the plan — items + their registers + the board — for approval before building anything.

## What changed since 2026-07-08

- **process-cartographer dogfood HELD** — the first Loom dogfood that didn't silently degrade (doctor green throughout, discovery authored + critic-reviewed, EAC authored a `uipath-xaml` non-web specialist). Scoreboard: Reliability "held once" ✅, Domain-reach P2b proven ✅.
- **Upstream fixes applied** (PR #76): fixed a real `bootstrap.ps1` PS-5.1 crash (`Get-Date -AsUTC`) + a `router.ps1` `??` bug (found by the new check); shipped a **`ps1-portability` doctor check**; promoted 3 upstream lessons.
- **`model-id-current` doctor check** (PR #73) + `spec/policy/model-ids.json` — model-ID rot can't silently recur.
- **ADR-0055 accepted** — the shared Lessons-Learned Service (relevance-pull / on-demand-search / dedup-push). Design proposal lives in `docs/proposals/lessons-learned-service.md`.
- **Deep-research pass run** (findings below) — verified the multi-LLM and agent-ownership claims against primary sources.

## Research findings (verified against primary sources — CAPTURE, don't re-derive)

> Adversarial 3-vote verification. **6 claims CONFIRMED 3-0, zero refuted**; the skeptical/cost claims errored on the token cap (unverified, NOT refuted) — a high-cap re-run of the `deep-research` skill can finish them.

**CONFIRMED (multi-LLM efficacy is real):**
- Multi-agent debate (Du et al. 2023, arXiv 2305.14325): arithmetic 67→81.8% (+14.8), GSM8K 77→85% (+8), biography factuality 66→73.8%, MMLU 63.9→71.1%.
- Mixture-of-Agents (Wang et al. 2024, arXiv 2406.04692): an open-source ensemble beats GPT-4o on AlpacaEval, 65.1 vs 57.5.
- Self-consistency (Wang et al. 2022, arXiv 2203.11171): +17.9 GSM8K, +11 SVAMP, +12.2 AQuA (single-model, multi-path majority vote).

**UNVERIFIED-BUT-PRIMARY-SOURCED (the "how", and the cost skepticism — treat as strong leads, re-verify at high cap):**
- Simple majority **voting** captures most of the "debate" gain; debate ≈ voting in many settings (arXiv 2508.17536).
- **Diversity is oversold by error correlation**: a 9-judge/7-family panel ≈ only ~2.2 independent votes; panels underperformed truly-independent voting by 8–22 pts; "best single judge ≈ the panel" in some conditions (arXiv 2605.29800).
- **Equal-compute rebuttal**: single agents matched/beat multi-agent on multi-hop reasoning **under equal token budget** (arXiv 2604.02460) — some "multi-agent gains" are just more compute.
- **Aggregation design matters**: reliability-*weighted* aggregation (BT-σ) + robust aggregation (geometric-median "RoPoLL", tolerates 50% corrupted) + structured adjudication beat naive vote/mean. Reputation-weighting has empirical support → validates ADR-0053.
- **Medical**: Medprompt-style ensembling reached medical-benchmark SOTA (Nori et al. 2023, arXiv 2311.16452).

**Agent ownership (legal reality, primary sources — SOLID):** AI cannot hold copyright (D.C. Circuit *Thaler v. Perlmutter*; SCOTUS cert denied Mar 2026), cannot be a patent inventor (Fed. Cir. *Thaler v. Vidal*; UK Supreme Court agrees on DABUS), and works-made-for-hire / joint-authorship are foreclosed (US Copyright Office); even prompts-alone don't confer human authorship. **The only viable path: a human-steward model** — rights vest in the human; "agent ownership" becomes a transparent internal **contribution ledger** (Loom already has the substrate in ADR-0053 provenance/reputation), allocating recognition/value, not legal title.

## Deliberation-panel decision (the #1 build)

**Build it — the disciplined version the evidence supports, NOT naive N-model voting on everything.** Design (write as an ADR first):
- **Reputation-weighted + robust aggregation** (geometric-median-style, so one bad/compromised agent can't swing it), NOT naive mean/vote. Ties to ADR-0053.
- **Cost-gated to high-stakes / high-disagreement decisions** (LR-06) — cheap methods (self-consistency / weighted vote) as the default; add a debate round only when disagreement is high.
- **Model-diverse panel** (Claude + a 2nd model) — but budget for error-correlation; don't assume N models = N independent votes.
- Reserve elaborate debate machinery; start with the verified-cheap methods.
This is also a natural expression of Loom's model-agnostic multi-agent architecture — a genuine differentiator.

## Pending work (priority order)

1. **Deliberation panel** — ADR + implementation (above).
2. **Phase-1b reliability** (from process-cartographer lessons, kill silent-degradation):
   - `discovery-authored` doctor check — flag `discovery/*.md` that still contain template placeholder strings (stamped ≠ authored). Note: skip/guard so it doesn't fire on loom-template itself (which has no project discovery/ dir).
   - Cold-start bootstrap fixes — louder "hooks/subagents NOT active this session" banner + a `bootstrapped_this_session` marker (lesson: `2026-07-10-first-governed-session-cold-start.md`).
   - The `model-id-current` check's proposed sibling is done; the `context-budget/context_budget` field naming was unified 2026-07-08.
3. **Lessons-service Phase 0** (ADR-0055) — standardize lesson frontmatter (`id`/`domain`/`stack`/`platform`/`provenance`) + ship `loom lessons search` over local files. Zero-infra.
4. **ADR-0053 reputation** — step 1 (passive projection) still unbuilt; the panel's reputation-weighting depends on it. Build passive projection first; preferential dispatch only after its guardrails (constitution-service).
5. **process-cartographer M3/M4** — requirement/exception confidence overlay (M3), then runtime-log overlay (M4). Its own repo.
6. **Loom v2 direction** (strategic, larger) — NOT a from-scratch rebuild; a *proof-first refactor* keeping the kernel + proven primitives, rebuilding the weak parts: enforced-not-advisory discipline, born-governed instantiation, spec-over-infra native, memory-compounding as core. Each capability ships with its eval + enforcement or doesn't ship.

## Cost + model-routing guidance (you have a high cap — spend it well, not wastefully)

Real data from the prior session: the deep-research pass = ~2.07M tokens **on Opus** ≈ ~$20–30. Rates: Opus 4.8 $5/$25 per M, Sonnet 5 $3/$15 ($2/$10 intro), Haiku 4.5 $1/$5; no 1M premium; cache reads ~0.1×. **The lever:** route fan-out subagents to Sonnet/Haiku (ADR-0045) — 2–5× cheaper — and reserve multi-agent for high-value decisions (LR-06). Design/ADR work in the main loop is cheapest. These are Loom's shipped disciplines; keep them even with headroom.

## Constraints / idioms (unchanged)

- **Destructive guard is LIVE** — destructive ops (`rm -rf`, force-push, `DROP`) → ask/deny via the PreToolUse hook (ADR-0047). Don't put destructive literals in shell tool-call commands.
- **Hook-managed files** — `orchestration/progress-ledger.md`, `tools/discovered-runtime.md` — never hand-commit (restore drift with `git checkout --` before committing).
- **ADR discipline** — consequential choices get an ADR (v0.4+ template: Evidence basis + Affects sections; the `bidirectional-adr-links` + `adr-template-conformance` doctor checks enforce it). Merge stacked PRs with `--rebase`.
- **LR-03** — secrets never in chat/args; keyring via `collect-credentials`.
- **Honest scope** — don't overstate. "Model-agnostic" is host-agnostic-real / model-agnostic-by-construction (no live non-Claude run yet); enterprise-hardness unproven. Verify read-only agents' environment claims (a critic once hallucinated a `git status`).

## The two repos
- **loom-template** — `github: compiles-first-time/loom-template` (the framework; do the updates here).
- **process-cartographer** — `github: compiles-first-time/process-cartographer` (the Phase-1 proof project; UiPath REFramework → 3D city visualizer; MVP built, M3/M4 pending).
