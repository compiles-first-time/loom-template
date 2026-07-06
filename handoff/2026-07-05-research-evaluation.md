---
date: 2026-07-05
author: Builder (claude-sonnet-4-6) — approved by Nick
topic: research-evaluation
status: active
---

# Loom template — Context Transfer 2026-07-05

> Successor to [`handoff/2026-06-04-observatory-context.md`](./2026-06-04-observatory-context.md). Read that one for foundational Observatory context; this doc captures **what changed since 2026-06-04** and sets up the research-evaluation session.

---

## TL;DR — paste into a new chat to bootstrap context

```
This is the Loom template project at C:\Users\14134\dev\loom-template
(GitHub: compiles-first-time/loom-template). I am Nick, the architect.
You are the builder.

Loom is a governance+orchestration meta-framework (L0–L9, Trajectory
Kernel V6, 45 ADRs, 7 LRs, 19 agents). The last two sessions:
(1) patched three Observatory watcher bugs (PR #50, merged); and
(2) wrote a 66-assertion aggregator test suite — 218/218 passing.
Infrastructure is confirmed green.

ONE UNRESOLVED ITEM: observatory/lib/aggregator.test.mjs is written but
NOT YET COMMITTED (it's untracked). Commit it before starting new work.

THE NEXT TASK: Nick has a substantial collection of research links and
materials about improving Loom. He will paste them into the new chat.
Your job: (1) validate each claim is technically accurate,
(2) check compatibility with current Loom architecture,
(3) assess effort vs value, (4) propose a prioritized plan for
anything that passes validation.

Before the research comes in, read CLAUDE.md. Before evaluating
observatory research, read layers/L9-observatory.md. Before governance
research, read layers/L0-constitutional.md.

Do NOT start building anything until Nick pastes the research and you
have completed your evaluation.
```

---

## What this is

Loom template is an opinionated project meta-framework. It ships a governance layer (Trajectory Kernel V6 constitution with 23 rules + local-rules extensions), an L0–L9 architectural layer model, Claude Code hooks that log every tool call to a JSONL event log, a real-time Observatory dashboard (port 4040, zero deps, SSE transport) that renders those events, an Update Bus for async proposals, a LiteLLM proxy for per-agent model routing, and a suite of 19 bundled specialist agents. The purpose is to give AI-assisted software projects a disciplined, auditable, self-correcting backbone that survives context-window resets.

## Who is working on it

**Nick** (nick@ideallab.ai) is the architect and sole decision-maker. He reviews, approves, and merges PRs; the builder (Claude Code) proposes and implements. Nick's escalation bar is: anything that touches L0 constitutional rules, any destructive git operation, any external service spend, any ADR that changes existing agent behavior. Below that bar, the builder proceeds with confidence level ≥80% and logs the decision.

## Repo location

- **Local:** `C:\Users\14134\dev\loom-template`
- **GitHub:** https://github.com/compiles-first-time/loom-template

## Current state (as of 2026-07-05)

- **Loom version:** 0.2.0 (CLAUDE.md), Kernel V6
- **Branch:** `main`, up to date with origin
- **Last commit:** `6f07c3f` — `fix(observatory): patch three watcher gaps — fresh-project deaf, update-bus silent drop, cost panel text`
- **ADRs:** 0001–0045 (0043–0045 most recent, all Accepted)
- **Local-Rules:** LR-01 through LR-07
- **Agents:** 19 bundled specialists
- **Tests:** 218/218 passing (5 suites)

**Uncommitted working tree (do not discard):**
- `orchestration/progress-ledger.md` — modified by Stop hook (session log rows appended automatically; pre-existing, not our changes)
- `tools/discovered-runtime.md` — modified by runtime discovery at session start (pre-existing)
- `observatory/lib/aggregator.test.mjs` — **untracked NEW FILE** written this session; 66 assertions; needs to be committed

## What was accomplished recently

**Session 2026-07-02 → 2026-07-05 (sessions ae52811a, continued):**

- **PR #50 merged (commit 6f07c3f):** Three Observatory watcher bug fixes:
  1. `observatory/server.mjs` — added `mkdirSync(EVENT_LOG_DIR, { recursive: true })` and `mkdirSync(UPDATE_BUS_INBOX, { recursive: true })` in `start()`. Fix: fresh checkouts had no event-log or update-bus dirs, causing watchers to silently bail early with no data.
  2. `observatory/lib/file-watcher.mjs` — `_parseAndEmitUpdateBusItem` now emits `process.stderr.write` warnings when update-bus items are dropped for missing frontmatter or missing `id:` field. Previously: silent drop with zero output.
  3. `observatory/public/js/app.mjs` — Cost panel empty-state rewritten to mention both `session_token_usage` (Stop hook, fires every turn) and `loop_cost_summary` (iterative workflows). Previously: Agentum-specific text that confused users checking for per-turn token data.

- **aggregator.test.mjs written (untracked):** 66 assertions covering all 18 EVENT_HANDLERS in the aggregator, activity feed behavior (what records appear / don't appear), SET vs ACCUMULATE cost semantics, cap enforcement (300 activity / 500 test_result / 25 runs), ingestUpdateBusItem dedup, updateUpdateBusDecision, unknown event type robustness, and getState() shape. Committed to disk but not yet git-tracked.

- **Full test suite: 218/218 passing.** Suites:
  - `observatory/lib/aggregator.test.mjs` — 66 assertions (new)
  - `scripts/lib/deploy.test.mjs` — 37
  - `scripts/lib/load-env.test.mjs` — 32
  - `scripts/lib/permissions-classifier.test.mjs` — 60
  - `scripts/lib/wait-for-deploy.test.mjs` — 23

- **Greenlight confirmed.** Infrastructure is sound; observatory live-data pipeline verified; tests comprehensive.

**Earlier sessions (since last handoff 2026-06-04):**
- PR #45–#49: ADR-0043 (cwd-robust hooks), ADR-0044 (verifier gates), ADR-0045 (per-agent model tiers + LiteLLM proxy), `/handoff` skill command, docs layer iterative improvement patterns
- Per-agent model tiers implemented: Haiku for constitution-service/hr/human-replica, Sonnet for 15 engineering agents, Opus for eac
- LiteLLM proxy at `tools/litellm/config.yaml` (start: `scripts/router.ps1 start`)

## The task that needs to continue

**Immediate (do first):** Commit `observatory/lib/aggregator.test.mjs` with a conventional commit message. It's a clean untracked file — no conflicts, no staging needed. Branch: main. Stage with `git add observatory/lib/aggregator.test.mjs`, commit as `test(observatory): 66-assertion aggregator test suite covering all 18 EVENT_HANDLERS`.

**Then: Research evaluation.** Nick will paste research links and materials into the new chat. For each item, the builder should:

1. **Validate accuracy** — is the claim technically correct? Does the research actually say what Nick thinks it says? Check arXiv IDs, dates, methodology. Confidence-tag every assessment.
2. **Check compatibility** — does it fit Loom's architecture? Check against the relevant layer doc (L0–L9). Flag if it requires new infrastructure (new layer, new ADR, new agent).
3. **Assess effort vs value** — rough effort estimate (hours of builder time, token cost of implementation) vs concrete benefit (what improves, by how much, with what evidence).
4. **Propose implementation plan** — for items that pass, write a prioritized list. Use ADR format for consequential changes. Flag items that need specialist consultation per ADR-0034.

The output should be structured as:
- One section per research item/cluster
- Per item: `[Accurate / Partially accurate / Inaccurate]`, `[Compatible / Needs ADR / Incompatible]`, `[Effort: S/M/L]`, `[Recommendation: Build / Defer / Skip]`, rationale
- Final section: prioritized build list (only items that scored Accurate + Compatible + Build)

## Key files to read before building

| File | Why |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Project index, working agreements, confidence calibration, pre-PR checklist |
| [`layers/L9-observatory.md`](../layers/L9-observatory.md) | Observatory architecture — before evaluating any dashboard/monitoring research |
| [`layers/L0-constitutional.md`](../layers/L0-constitutional.md) | Kernel V6 rules — before evaluating any governance/agent-behavior research |
| [`layers/L5-orchestration.md`](../layers/L5-orchestration.md) | Orchestration patterns, verifier convention (ADR-0044), token-cost discipline (LR-06) |
| [`layers/L3-memory.md`](../layers/L3-memory.md) | Memory tiers, RAG pipeline (ADR-0037) — before evaluating retrieval research |
| [`observatory/lib/aggregator.mjs`](../observatory/lib/aggregator.mjs) | 18 EVENT_HANDLERS, cost math, state shape — needed if research touches telemetry |
| [`constitution/local-rules.md`](../constitution/local-rules.md) | LR-01 through LR-07 — operational constraints that affect feasibility |
| [`adr/0045-per-agent-model-routing.md`](../adr/0045-per-agent-model-routing.md) | Model tier decisions and LiteLLM proxy — before evaluating model-routing research |

## Architectural constraints

**Observatory (L9):**
- Zero runtime dependencies — the dashboard is pure Node.js (http, fs, path, events). No external packages. Any feature added must stay dependency-free. The workaround for rich UI is inlining libraries as data-URIs in `public/js/`.
- SSE transport only (no WebSockets). Client reconnects automatically; server pushes incrementally.
- State is in-memory only — no database. Observatory state is rebuilt from JSONL replay on restart. Do not persist aggregator state to disk.

**Hook system:**
- Hooks run synchronously on every tool call. Any hook that takes >200ms will visibly slow Claude Code. Do not add network calls, heavy I/O, or subprocess spawns to pre/post-tool-use hooks.
- `appendEvent()` uses `appendFileSync` — synchronous by design for correctness. Do not change to async.
- Chain-of-thought / model reasoning is NOT accessible from hooks. Hooks see only tool names and args. Prompt content is accessible only in `user-prompt-submit.mjs`.

**Secrets:**
- LR-03: secrets NEVER in chat input or tool args. Always keyring → stdin. Any feature that needs API keys must use the existing `collect-credentials` flow.

**Constitutional rules:**
- Rules 1–8 (L0-constitutional.md §Foundational) are effectively immutable. Research recommending changes to core governance framing needs ADR + Nick approval.
- Rule 19: self-modification only via transparent, auditable, consent-based process. Any research recommending automated self-editing of CLAUDE.md or constitution files requires explicit human gate.
- Rule 20: irreversible/destructive ops require confirmation. Research recommending automated destructive actions needs human_gate verifier per ADR-0044.

**Model routing (ADR-0045):**
- Model IDs in agent frontmatter are pinned strings (e.g., `claude-haiku-4-5-20251001`). They drift as Anthropic releases new models. A future `loom doctor` check (`model-id-current`) is deferred open work — research touching model selection should consider this.

## Past decisions and WHY

- **Decision:** Observatory uses SSE, not WebSockets.
  **Why:** Zero additional server dependencies; SSE is native HTTP; client reconnects are free.
  **Trade-off:** No bidirectional channel — dashboard can't send commands back to server.
  **Evidence:** ADR-0039.

- **Decision:** Aggregator state is in-memory, rebuilt from JSONL replay.
  **Why:** Simplicity; no database dependency; event log is the source of truth.
  **Trade-off:** Observatory startup time grows linearly with event log size (bounded by `replay.days` config, default 7 days).
  **Evidence:** ADR-0039, ADR-0040.

- **Decision:** Haiku for constitution-service, hr, human-replica; Opus only for eac.
  **Why:** Governance agents do mechanical rule-matching — Haiku is 20× cheaper with no quality loss. EAC does deep domain research — frontier model quality is load-bearing.
  **Trade-off:** If Haiku quality degrades on edge cases, constitution-service may miss violations.
  **Evidence:** ADR-0045, arXiv:2406.18665 (RouteLLM).

- **Decision:** `verifier_type:` field required on all SKILL.md (soft, not hard enforcement).
  **Why:** τ-bench shows ~61% pass@1 without verifiers; reliability requires binary success signal.
  **Trade-off:** Documentation overhead; unmigrated SKILL.md files show doctor warnings.
  **Evidence:** ADR-0044, arXiv:2501.12948 (DeepSeek-R1 RLVR), arXiv:2406.12045 (τ-bench).

- **Decision:** Hooks use `process.cwd()` walk-up from hook file location, not CWD.
  **Why:** Subdir launches (from `adr/`, `scripts/`, etc.) silently misrouted events before ADR-0043.
  **Trade-off:** Slight complexity in `_lib.mjs`; depth-capped at 8 levels.
  **Evidence:** ADR-0043.

- **Decision:** RAG pipeline defaults: TF-IDF or BM25 at <10K docs; hybrid BM25+dense at 10K–100K; GraphRAG only at >100K.
  **Why:** Peer-reviewed evidence (ADR-0037) shows BM25 competitive with dense at small scale; GraphRAG costs 2.5× but wins on multi-hop queries at large scale.
  **Trade-off:** GraphRAG adds significant complexity and cost.
  **Evidence:** ADR-0037, arXiv literature review (LR-06).

## Collaboration conventions

- **Nick is architect; builder implements.** Builder proposes via conversation; Nick decides. Nick's approval is required before any PR is opened for consequential changes.
- **PR process:** Builder opens PR; Nick reviews and merges (or builder merges immediately if Nick says "go ahead"). Never self-approve (GitHub blocks it).
- **Commit style:** Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Co-authored-by line added by builder.
- **ADR-first for consequential changes.** Any non-trivial architectural decision gets an ADR in `adr/` before implementation. Builder drafts; Nick accepts.
- **loom doctor must pass before PRs.** Run `node scripts/doctor.mjs` (or `./scripts/doctor.sh`). Hard failures block; warnings are noted in PR description.
- **Claim events for non-trivial assertions.** Emit `{"event_type":"claim",...}` to today's event log via PowerShell `Add-Content` or Bash `echo >>`. See CLAUDE.md §Claim convention.
- **Token-cost awareness (LR-06).** Before multi-agent workflows, estimate cost and surface to Nick. Use cheapest model sufficient. Canary before fleet.
- **Escalation:** If blocked, confused, or confidence <60%, stop and ask. Do not proceed on guesswork.

## Visibility gaps (assessed, not yet built — user decision pending)

These were identified during the observatory test session and explicitly deferred for Nick's decision:

| Gap | Effort | How to build |
|---|---|---|
| Prompt previews (first ~150 chars) | Small | Add `prompt_submitted` event to `scripts/hooks/user-prompt-submit.mjs`; add handler to aggregator |
| Agent spawn relationships | Small–Medium | Parse Agent tool args in `pre-tool-use.mjs`; emit `agent_spawn` event; add aggregator handler + panel |
| Chain of thought / orchestration reasoning | Hard (model cooperation required) | NOT from hooks — requires model to emit explicit `claim` events; aggregator has no `claim` handler yet |
| Token breakdown by task type | Medium | Requires model cooperation + tagging convention |

Do NOT build these without Nick's explicit instruction.

## Do not do

- **Do not commit or push** before confirming the aggregator.test.mjs commit is the only change staged.
- **Do not amend** the last commit — `6f07c3f` is pushed to origin.
- **Do not build** any visibility gap feature without Nick's explicit instruction.
- **Do not start evaluating research** before reading CLAUDE.md first.
- **Do not run multi-agent workflows** without first estimating token cost and getting Nick's approval (LR-06).
- **Do not put secrets in chat** or tool args under any circumstances (LR-03).
- **Do not modify constitutional rules 1–8** — they are immutable under Kernel V6 Rule 19.
- **Do not touch `orchestration/progress-ledger.md` or `tools/discovered-runtime.md`** — they are managed by hooks; hand-editing breaks bi-temporal integrity.
- **Do not install npm packages** in the observatory or hook system. Zero-dependency constraint is load-bearing.

---

## Verbatim implementation prompt

```
This is the Loom template project at C:\Users\14134\dev\loom-template
(GitHub: compiles-first-time/loom-template). I am Nick, the architect.
You are the builder.

REPO STATE (2026-07-05):
- Branch: main, up to date with origin
- Last commit: 6f07c3f "fix(observatory): patch three watcher gaps"
- Tests: 218/218 passing (5 suites)
- Loom version: 0.2.0 / Kernel V6 / 45 ADRs / 7 LRs / 19 agents

FIRST TASK — do this before anything else:
There is one untracked file that was written last session but not committed:
  observatory/lib/aggregator.test.mjs
Commit it to main:
  git add observatory/lib/aggregator.test.mjs
  git commit -m "test(observatory): 66-assertion aggregator test suite covering all 18 EVENT_HANDLERS

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  git push

Then confirm with: node scripts/test.mjs (should show 218/218).

SECOND TASK — research evaluation:
I have a collection of research links and materials about potential improvements
to Loom. I will paste them into the chat. For each item:

1. Validate accuracy — is the claim technically correct? Check methodology,
   sources, confidence. Use the calibration table from CLAUDE.md.
2. Check compatibility — does it fit Loom's L0–L9 architecture? Flag if it
   requires a new layer, new ADR, or new agent.
3. Assess effort vs value — rough hours estimate + token cost vs concrete benefit.
4. Recommend: Build / Defer / Skip, with rationale.

Output format per item:
  [Accurate / Partially accurate / Inaccurate]
  [Compatible / Needs ADR / Incompatible]
  [Effort: S/M/L]
  [Recommendation: Build / Defer / Skip]
  Rationale: ...

Final section: prioritized build list (Accurate + Compatible + Build items only).

BEFORE the research arrives, read:
1. CLAUDE.md (project index + working agreements)
2. layers/L9-observatory.md (if any research touches the dashboard)
3. layers/L0-constitutional.md (if any research touches governance/agents)
4. layers/L3-memory.md (if any research touches memory or RAG)

CONSTRAINTS that affect what's buildable:
- Observatory: zero npm dependencies (inline only); SSE not WebSockets; in-memory state only
- Hooks: no network calls or heavy I/O in pre/post-tool-use (sync, latency-sensitive)
- Secrets: NEVER in chat or tool args (LR-03, keyring/stdin only)
- Multi-agent workflows: estimate token cost first, get my approval (LR-06)
- Constitutional rules 1–8: immutable — don't touch them

Don't start building until the research evaluation is complete and I've approved
the prioritized plan. Propose first; I decide.
```
