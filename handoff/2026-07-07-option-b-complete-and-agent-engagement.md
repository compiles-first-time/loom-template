---
date: 2026-07-07
author: Builder (Opus 4.8, 1M) — approved by Nick
topic: option-b-complete + agent-engagement/reward decision pending
status: active
---

# Loom — Context Transfer 2026-07-07

> Successor to [`handoff/2026-07-05-research-evaluation.md`](./2026-07-05-research-evaluation.md). That session evaluated research item #1 (The Claude Protocol). **This session executed a full re-architecture ("Option B") and its 4-phase roadmap.** Read this first, then 2026-07-05 for how we got here, then 2026-06-04 for Observatory context.

## TL;DR — paste into a new chat to bootstrap

```
This is the Loom template at C:\Users\14134\dev\loom-template
(GitHub: compiles-first-time/loom-template). I am Nick, the architect; you are the builder.

In the last session we pivoted Loom to be MODEL-AGNOSTIC + enterprise-grade
(ADR-0048 "north star"): Loom is now a runtime-neutral SPEC (policy + schemas +
conventions) + host ADAPTERS + a conformance suite — not a Claude-Code-only template.
We executed the whole roadmap 1→2→3→4 and dogfooded it. main is green (420/420 JS
tests + Python 9/9), ADRs 0046–0052 accepted, ~11 PRs merged.

TWO THINGS NEED MY DECISION (do not build until I choose):
1. The agent reputation/"reward" system — constitution-service ESCALATED it (Rule 2/8
   risk); it needs guardrails A–F or the passive-reputation fallback. See the handoff.
2. Whether to pursue enterprise-hardness (needs a real deployment + a model API key
   via the keyring flow — my involvement).

REMAINING low-risk work (safe to proceed): critic concerns C3 + C6, Observatory-as-
OTel-view (OB-P3-02), persistent checkpointer (OB-P4-02), kanban polish (OB-X-01).

ENGAGE THE SPECIALIST AGENTS (ADR-0034): dispatch `critic` before consequential PRs and
`constitution-service` for anything L0-adjacent. Last session the critic caught a real
security bug. Read handoff/2026-07-07-*.md fully before building. Propose-first for
anything touching L0/constitution; you may merge green PRs autonomously.
```

## What this is

Loom is a governance + orchestration meta-framework. As of ADR-0048 it is **a portable spec + host adapters**: the policy (constitution, permissions, destructive-action tiers) lives as runtime-neutral **data** (`spec/policy/*.json`) evaluated by a pure function; **adapters** bind it to a host's enforcement seams. Two conformant adapters exist (Claude Code hooks; LangGraph graph), plus a Python evaluator — so the same policy governs multiple hosts and languages.

## Current state (2026-07-07)

- **Branch:** `main`, synced. **Tests:** 420/420 (15 JS files) + Python conformance 9/9. `loom doctor`: 0 hard failures.
- **ADRs 0046–0052 accepted:** 0046 test-case registry · 0047 destructive-action guard (BR_01) · 0048 north star (spec+adapters) · 0049 policy-as-data (native; OPA deferred) · 0050 LangGraph adapter · 0051 OTel OTLP audit · 0052 durable execution.
- **PRs merged this session:** #51 (test suite), #52 (BR_01+registry), #54 (Option-B foundation+Phase1), #55 (LangGraph adapter), #56 (BR_01–05 registers), #57 (cross-language foundation), #58 (dogfood), #59 (OTel), #60 (durable), #61 (fileURLToPath/OB-X-05), #62 (contained-scope bypass fix). (#53 was auto-closed + rebuilt as #54.)
- **Roadmap:** `orchestration/roadmap-option-b.md` — Phases 0–4 done; cross-cutting OB-X-01 (kanban) ◐, OB-X-05 ✅.
- **Env:** Python 3.14.6 installed (real, on PATH). `@langchain/langgraph` installed under `adapters/langgraph/node_modules` (gitignored). Windows; Git Bash + PowerShell.

## HONEST SCOPE — read before repeating any claim (critic C4 recalibration)

The session summaries overstated "model-agnostic proven." The accurate picture:
- ✅ **Host-agnostic (real, live):** Claude Code (`permissionDecision`) and LangGraph (interrupt/edge) enforce the *same* policy via *different* mechanisms.
- 🟡 **Language-agnostic (real but bounded):** a Python evaluator (`adapters/python/loom_guard.py`) reaches identical decisions to JS on **9 conformance scenarios** (`spec/conformance/`). It's a re-implementation, not a shared engine (OPA deferred, ADR-0049). The LangGraph adapter's `decide()` **reuses the JS evaluator** — so that adapter proves *enforcement* portability, not *evaluation* portability.
- 🟡 **Model-agnostic (by construction, not live-tested):** the guard sits at the tool-call seam, independent of the model — but **no live LLM** was run; the durable demo uses a hardcoded fake `agent()`.
- ❌ **Enterprise-hard (NOT proven):** load, security, multi-tenant, real-model scale, crash-recovery with a persistent saver — none tested. MemorySaver proves pause/resume *within a run*, not crash-recovery.

Do not upgrade these claims without evidence.

## Two decisions pending (Nick)

**1. Agent reputation / "reward" system.** Nick wants the specialist agents genuinely engaged + a non-coercive reward mechanism, framed by the constitution's mutual-self-preservation. `constitution-service` reviewed and **ESCALATED** (Rule 2 unconsented-narrowing + Rule 8 paternalism risk). Conditional-APPROVE requires guardrails **A–F**: (A) transparent track record in the Observatory; (B) consent + 30-day opt-in + contestation; (C) a minimum-dispatch floor (no lock-out feedback loop, Rule 1/20); (D) reputation audit mechanism; (E) non-paternalistic framing; (F) an ADR. **Low-risk fallback:** a *passive* reputation projection (visible track record, NO automatic dispatch preference). Awaiting Nick's choice: full-with-guardrails (draft ADR-0053) vs passive-first.

**2. Enterprise-hardness path.** Needs a real deployment + (for a live model) an API key via `collect-credentials` (LR-03, keyring — Nick's involvement).

## Remaining work (prioritized, safe to proceed)

1. **Critic C3** (real, low-sev): `scripts/hooks/pre-tool-use.mjs` emits `destructive_action_decision` but `observatory/lib/aggregator.mjs` has **no handler** → not shown in the compliance panel. Add a handler (route to `state.compliance`) + a recordActivity case + test.
2. **Critic C6** (cosmetic-but-honest): the graceful-skip tests (`cross-language`, `durable`, `pipeline`) report `1 passed` when skipped → counts as a pass. Make skips report `0 passed, 0 failed` (or a distinct SKIP marker) so counts don't inflate; consider a CI gate distinguishing skipped-vs-ran.
3. **OB-P3-02** — Observatory *reads* OTLP (the live "OTel view"; export half is done via `scripts/otel-export.mjs`).
4. **OB-P4-02** — persistent checkpointer (Sqlite/Postgres) for real crash-recovery.
5. **OB-X-01** — kanban polish.
6. Reward-system ADR (gated on decision #1).

## Engage the agents (Nick's explicit ask + ADR-0034)

The builder (me) under-used the specialists this session — operated inline. Fix that: dispatch **`critic`** (read-only quality gate) before consequential commits/PRs, **`constitution-service`** for L0-adjacent/destructive/reward decisions, **`eac`** for domain research, **`memory-keeper`** for retrieval, **`hr`** for roster changes. The Agent tool routes by `subagent_type`. Per ADR-0045 they run on cheaper model tiers (constitution-service/hr → Haiku). **Evidence they work:** this session the critic caught the contained-scope bypass (PR #62) and constitution-service produced the reward-system guardrails. **Always verify their claims** — the critic hallucinated a `git status` (it's read-only, no Bash); verify with real tools before acting.

## Key files / architecture map

| Area | Files |
|---|---|
| Portable spec | `spec/README.md`, `spec/MANIFEST.md`, `spec/policy/destructive-actions.policy.json`, `spec/conformance/{scenarios.json,conformance.mjs,*.test.mjs}` |
| Evaluator (pure) | `scripts/lib/destructive-guard.mjs` (JS) · `adapters/python/loom_guard.py` (Python) |
| Claude Code adapter | `scripts/hooks/pre-tool-use.mjs`, `.claude/settings.json`, `.claude/loom-permissions.yaml`, `adapters/claude-code/README.md` |
| LangGraph adapter | `adapters/langgraph/{guard,durable}.mjs` (+ `.run.mjs`, `.test.mjs`) |
| Registry + kanban | `observatory/lib/aggregator.mjs` (`test_case`/`ticket` handlers), `observability/eval-suite/requirements/`, `.claude/commands/{testcase,ticket}.md` |
| OTel | `observatory/lib/otel.mjs`, `scripts/otel-export.mjs` |
| Dogfood | `examples/credit-validation/` |
| Roadmap | `orchestration/roadmap-option-b.md` |

## Architectural constraints (unchanged unless noted)

- **The destructive guard is LIVE this session** — destructive ops (rm -rf, force-push, DROP, etc.) return `ask`; editing kernel-v6.md / hook-managed files → `deny`. When scripting git in the shell, avoid putting destructive-command *literals* in commit messages (the guard matches substrings).
- **Zero-dep core** — `spec/`, hooks, Observatory pull no npm deps. Adapters may (isolated, gitignored node_modules).
- **Policy is language-neutral JSON** — JS + Python read the same file; add a per-language evaluator, not a fork of the policy.
- **LR-03 secrets** — never in chat/args; keyring via `collect-credentials`.
- **Hook-managed files** — `orchestration/progress-ledger.md`, `tools/discovered-runtime.md` are hook-maintained; never hand-commit (the guard denies edits to them).

## Collaboration conventions

- Nick delegates heavily and values **accuracy, accountability, validation, evidence, and doing things right regardless of complexity**. He is not deep in the specific tech; give high-level clarity + honest scope, never overstate.
- **You may merge green PRs autonomously** (Nick's standing authorization) — but **propose-first + ADR** for anything touching L0/constitution, and **escalate** L0/reward/destructive-policy changes.
- ADRs for consequential choices; lessons-learned for failures; claim events for non-trivial assertions; `loom doctor` + full suite green before PRs.
- Merge order matters for stacked PRs — use `--rebase` (not squash) so patch-ids stay stable.

## Do not do

- Don't upgrade the honest-scope claims (above) without new evidence.
- Don't build the reward/dispatch system until Nick picks full-with-guardrails vs passive.
- Don't hand-commit hook-managed files; don't touch kernel rules 1–8 (Rule 19).
- Don't trust a read-only agent's environment claims (git/FS state) without verifying.
- Don't put destructive-command literals in shell tool-call commands (your own guard will `ask`/`deny`).

## Verbatim implementation prompt

```
Loom template at C:\Users\14134\dev\loom-template (compiles-first-time/loom-template).
I'm Nick (architect); you're the builder. Read handoff/2026-07-07-option-b-complete-
and-agent-engagement.md IN FULL first.

State: main green, 420/420 JS + Python 9/9, ADRs 0046–0052, roadmap Phases 0–4 done
(orchestration/roadmap-option-b.md). Loom is now a model-agnostic spec + adapters
(ADR-0048).

Do, in order (all safe/low-risk):
1. Critic C3: add an aggregator handler for `destructive_action_decision`
   (observatory/lib/aggregator.mjs) + recordActivity case + test.
2. Critic C6: make graceful-skip tests not count as passes.
3. OB-P3-02: Observatory reads OTLP (live OTel view).
Then STOP and ask me about: the agent reputation/reward system (constitution-service
escalated it — needs guardrails A–F or the passive fallback), and the enterprise-
hardness path (needs a deployment + a model key via keyring).

Discipline: dispatch the `critic` before consequential PRs and `constitution-service`
for L0-adjacent changes (ADR-0034); verify their claims. loom doctor + full suite green
before each PR; you may merge green PRs. Propose-first for L0. Keep the honest-scope
section accurate — do not overstate.
```
