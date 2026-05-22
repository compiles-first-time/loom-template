# L2 — Agent Topology

> **Canonical source:** §B.3 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).

---

## Purpose

Define the project-agnostic base agent set, the supervisor pattern that coordinates them, and the lifecycle for dynamically spawned specialists.

## Supervisor

**Pattern:** Magentic-One — two-ledger (Task Ledger + Progress Ledger).
**Reference:** Fourney et al. (2024), arXiv:2411.04413 `[H]`.

The supervisor **does not execute tasks**. It delegates to base agents or dynamically spawned specialists.

| Ledger | Location | Purpose |
|---|---|---|
| Task Ledger | [`../orchestration/task-ledger.md`](../orchestration/task-ledger.md) | What needs to be done |
| Progress Ledger | [`../orchestration/progress-ledger.md`](../orchestration/progress-ledger.md) | Where each task currently is |

## Base agent set (6 — present in every Loom project)

> **v0.2 runtime/design split per [ADR-0012](../adr/0012-base-subagents.md).** Each base agent has a **design** file at `../agents/<name>/SKILL.md` (full rationale) and a **runtime contract** at `../.claude/agents/<name>.md` (Claude Code subagent — tools, prompt, decline triggers).

| # | Agent | Design | Runtime | Tool scope |
|---|---|---|---|---|
| 1 | HR-Agent | [`../agents/hr/`](../agents/hr/) | [`../.claude/agents/hr.md`](../.claude/agents/hr.md) | Read/Edit/Write on `AGENTS.md` + `agents/specialists/**` |
| 2 | Expert Agent Creator | [`../agents/eac/`](../agents/eac/) | [`../.claude/agents/eac.md`](../.claude/agents/eac.md) | Read/Web/Edit/Write on `agents/specialists/**` + `lessons-learned/**` |
| 3 | Human Replica | [`../agents/human-replica/`](../agents/human-replica/) | [`../.claude/agents/human-replica.md`](../.claude/agents/human-replica.md) | Read/Edit on `agents/human-replica/` + `update-bus/inbox/**` |
| 4 | Critic / Auditor | [`../agents/critic/`](../agents/critic/) | [`../.claude/agents/critic.md`](../.claude/agents/critic.md) | **Read-only on every path** (independence) |
| 5 | Memory-Keeper | [`../agents/memory-keeper/`](../agents/memory-keeper/) | [`../.claude/agents/memory-keeper.md`](../.claude/agents/memory-keeper.md) | Read/Edit/Write on `memory/**` + `update-bus/inbox/` |
| 6 | Constitution Service | [`../agents/constitution-service/`](../agents/constitution-service/) | [`../.claude/agents/constitution-service.md`](../.claude/agents/constitution-service.md) | **Read-only on every path** (no edit path into the constitution) |

Origin: HR / EAC / Human-Replica from Pablo `[transcript][H]`; Critic / Constitution Service from base PRISM spec `[base][M]`; Memory-Keeper centralized in Loom. Claude Code subagent `tools:` frontmatter takes tool names only; path scoping is enforced in each subagent's system prompt.

## Choosing a smaller set

`[research-p1][M]` — per [ADR-0010](../adr/0010-agent-count-by-topology.md), the axis is **task topology**, not governance need:

| If the project's work is… | Recommended set | Why |
|---|---|---|
| **Breadth-first / parallelizable** — heavy research, multi-source aggregation, exploring many branches | `full-6` | Multiple agents genuinely accelerate parallelizable work |
| **Depth-first / sequential** — most coding work, single linear product builds | `minimal-3` (HR-Agent + Critic + Memory-Keeper) | Coordination overhead exceeds parallelism benefit on deep-narrow tasks (Cognition "Don't Build Multi-Agents", 2025) |

Governance need is orthogonal to this choice — the Critic + Constitution Service are present in both modes. Trim a `full-6` project down to `minimal-3` by deleting unused agent directories *and* removing them from [`../AGENTS.md`](../AGENTS.md); growing the other way re-enables the optional directories.

**Equal-budget caveat:** the often-quoted Anthropic +90.2% multi-agent research result (June 2025) was reported **without an equal-token-budget control**. The multi-agent advantage is softer than the headline suggests — some of the gain may be explained by simply having more tokens, not more agents. Cite with this caveat. `[research-p1][M]`

## Specialist agents

Created on demand by the EAC; live under [`../agents/specialists/<name>/`](../agents/specialists/). Terminated at end of project lifecycle. Their lessons-learned persist in [`../lessons-learned/`](../lessons-learned/).

### Specialist registry (v0.4)

> **Per [ADR-0023](../adr/0023-specialist-registry.md).** Loom v0.4 ships a project-bootstrap specialist registry at [`../agents/specialists/_registry/`](../agents/specialists/_registry/). Two namespaces:
>
> - **Bundled** — [`_registry/<name>/SKILL.md`](../agents/specialists/_registry/) — ships with Loom; updated via template upgrades.
> - **Project-local** — [`<name>/SKILL.md`](../agents/specialists/) — project-specific specialists or overrides (set `extends: _registry/<name>` in frontmatter).
>
> The intent classifier ([`scripts/hooks/_classify.mjs`](../scripts/hooks/_classify.mjs)) reads [`_registry/manifest.yaml`](../agents/specialists/_registry/manifest.yaml) on every user prompt and surfaces specialist suggestions via the UserPromptSubmit hook. Specialist SKILL.md files follow the [xlsx failure-modes convention](../adr/0022-xlsx-docs-convention.md) — SE/BE rows with `Justifications` column.

## Context budget

> **Canonical default per [ADR-0004](../adr/0004-context-budget.md).**

Every agent declares a `context-budget:` field in its `SKILL.md` — a **target maximum of useful tokens, distinct from the model's advertised window**. The L5 supervisor enforces the budget at dispatch (see [L5 Context engineering](./L5-orchestration.md#context-engineering)); the L3 retrieval pipeline ([ADR-0003](../adr/0003-retrieval-pipeline.md)) returns assembled sets that fit it.

`[research-p1][H]` The binding constraint on agent quality is **allocation, not window size**: effective context length runs 1–2 orders of magnitude below the advertised window (NoLiMa, Modarressi et al., ICML 2025 — e.g., a 200K-window model reliably retrieves only ~4K tokens on lexical-overlap-free tasks).

Recommended starting budgets for the six base agents are recorded in their `SKILL.md` files. Specialists declare their own at spawn.

## Hallucination firewall

`[transcript][H]` — hallucinations don't cross context-window boundaries. Loom exploits this:
- Constrained role per agent (small instruction set)
- Specialists for single tasks, then terminated
- Critic validates outputs before commit
- Cross-project comms through Human Replica only

`[LLM-A][H]` counter-evidence: O(N²) coordination overhead is real; many deployed multi-agent systems are homogeneous enough that single-model matches. **Prefer the smallest agent set that handles the task.**

### Pre-dispatch context admission check

> **Canonical default per [ADR-0008](../adr/0008-context-admission-check.md).** The Critic is the post-hoc *output* gate; the admission check is its complementary pre-dispatch *input* gate — a chaperone, not just a proteasome. `[research-p1][M]`

Before an agent runs, its **assembled context** is checked by the Critic for:

1. **Budget compliance** — fits the agent's declared `context-budget:` ([ADR-0004](../adr/0004-context-budget.md)).
2. **Source-tier compliance** — retrieved items come from acceptable source tiers ([ADR-0007](../adr/0007-content-trust-boundary.md); tier definitions in [L7](./L7-extension.md#source-tiering)).
3. **Obvious-pattern check** — screens for obvious prompt-injection and obvious distractor characteristics (near-duplicate but off-topic chunks).

Failures **escalate**; they do not silently run.

## Confidence calibration

Every agent reports confidence on every claim — see thresholds in [`../CLAUDE.md`](../CLAUDE.md). Every agent must be able to answer **"what would raise this to 95%?"**

---

## Open work for this layer

- [ ] Decide full-6 vs minimal-3 for this project (§E.2)
- [ ] Fill in each agent's `SKILL.md` with project-specific scope
- [ ] Test the supervisor's two-ledger workflow with a no-op task
- [ ] Confirm each agent's `context-budget:` field is appropriate for this project's models
- [x] Ship runtime subagents at [`../.claude/agents/`](../.claude/agents/) per [ADR-0012](../adr/0012-base-subagents.md)
- [ ] Wire the Critic's pre-dispatch context admission check per [ADR-0008](../adr/0008-context-admission-check.md) — the Critic subagent declares it as a responsibility; orchestration glue lands in PR-5 (loom doctor) or a later observability PR
