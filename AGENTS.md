# AGENTS.md — Agent Roster Quick Reference

> **Project:** `<PROJECT_NAME>`
> **Agent set:** `full-6` *(or `minimal-3`; see §E.2 of the spec)*
> **Hard cap:** ~5 KB. Detail goes in each agent's `agents/<name>/SKILL.md`.

---

## Supervisor

**Pattern:** Magentic-One (two-ledger).
**Role:** Routes work; never executes directly. Owns the Task Ledger and Progress Ledger.
**Ledgers:** [`orchestration/task-ledger.md`](./orchestration/task-ledger.md), [`orchestration/progress-ledger.md`](./orchestration/progress-ledger.md).

---

## Base agents (the warp — present in every Loom project)

| Agent | Directory | Role |
|---|---|---|
| **HR-Agent** | [`agents/hr/`](./agents/hr/) | Maintains the roster; creates/retires agents; assigns names |
| **Expert Agent Creator (EAC)** | [`agents/eac/`](./agents/eac/) | Researches APIs/tools by trial-and-error; spawns specialists |
| **Human Replica** | [`agents/human-replica/`](./agents/human-replica/) | User proxy; subscribes to user comms; answers "what would the user do?" |
| **Critic / Auditor** | [`agents/critic/`](./agents/critic/) | Quality gate; reviews outputs; enforces confidence calibration |
| **Memory-Keeper** | [`agents/memory-keeper/`](./agents/memory-keeper/) | Manages all memory subsystems; RAG retrieval; lesson propagation |
| **Constitution Service** | [`agents/constitution-service/`](./agents/constitution-service/) | Validates every action against Kernel V6 |

For the **minimal-3** mode (per §E.2): HR-Agent + Critic + Memory-Keeper. Trim the others if your project doesn't need them.

---

## Specialist agents (the weft — created on demand)

Specialists live under [`agents/specialists/<name>/`](./agents/specialists/) and are spawned by the EAC for single tasks, then **terminated at end of project lifecycle**. Their lessons-learned persist in [`lessons-learned/`](./lessons-learned/).

*(none yet — populated as you go)*

---

## Communication patterns

- **In-process** (v1 default) — agents share the supervisor's memory space; routing is direct.
- **A2A / ACP** — defer to v2 (multi-process or multi-machine; see [L4 spec](./layers/L4-tooling.md)).
- **No direct agent-to-agent across project boundaries.** Cross-project communication goes through the Human Replica.

---

## Lifecycle

| Phase | What happens |
|---|---|
| **Spawn** | HR-Agent registers; SKILL.md / role file written; Constitution Service registers the new agent |
| **Run** | Agent executes within a bounded session; emits Rule-22 trace records on every action |
| **Reconcile** | At end of session, agent writes its updates to markdown self-knowledge + episodic event log |
| **Retire** | HR-Agent removes from roster; lessons-learned promoted; agent directory archived |

---

*Detail per agent lives in `agents/<name>/SKILL.md`. This file is the index.*
