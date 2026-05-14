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

| # | Agent | Directory | Origin |
|---|---|---|---|
| 1 | HR-Agent | [`../agents/hr/`](../agents/hr/) | Pablo `[transcript][H]` |
| 2 | Expert Agent Creator | [`../agents/eac/`](../agents/eac/) | Pablo `[transcript][H]` |
| 3 | Human Replica | [`../agents/human-replica/`](../agents/human-replica/) | Pablo `[transcript][H]` |
| 4 | Critic / Auditor | [`../agents/critic/`](../agents/critic/) | Base `[base][M]` |
| 5 | Memory-Keeper | [`../agents/memory-keeper/`](../agents/memory-keeper/) | Centralized in Loom |
| 6 | Constitution Service | [`../agents/constitution-service/`](../agents/constitution-service/) | Base `[base][M]` |

## Choosing a smaller set

For solo / minimal projects, see §E.2 of the full spec. The **minimal-3** mode uses HR-Agent + Critic + Memory-Keeper only. Trim by deleting unused agent directories *and* removing them from [`../AGENTS.md`](../AGENTS.md).

## Specialist agents

Created on demand by the EAC; live under [`../agents/specialists/<name>/`](../agents/specialists/). Terminated at end of project lifecycle. Their lessons-learned persist in [`../lessons-learned/`](../lessons-learned/).

## Hallucination firewall

`[transcript][H]` — hallucinations don't cross context-window boundaries. Loom exploits this:
- Constrained role per agent (small instruction set)
- Specialists for single tasks, then terminated
- Critic validates outputs before commit
- Cross-project comms through Human Replica only

`[LLM-A][H]` counter-evidence: O(N²) coordination overhead is real; many deployed multi-agent systems are homogeneous enough that single-model matches. **Prefer the smallest agent set that handles the task.**

## Confidence calibration

Every agent reports confidence on every claim — see thresholds in [`../CLAUDE.md`](../CLAUDE.md). Every agent must be able to answer **"what would raise this to 95%?"**

---

## Open work for this layer

- [ ] Decide full-6 vs minimal-3 for this project (§E.2)
- [ ] Fill in each agent's `SKILL.md` with project-specific scope
- [ ] Test the supervisor's two-ledger workflow with a no-op task
