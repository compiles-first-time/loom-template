# L5 — Orchestration

> **Canonical source:** §B.6 of [`../spec/loom-spec-v0.1-full.md`](../spec/loom-spec-v0.1-full.md).

---

## Pattern: Centralized (v1)

| Pattern | Loom verdict |
|---|---|
| **Centralized / Hub-Spoke** | **v1 default** — easy to debug, predictable, auditable, governable under Kernel V6 |
| Mesh / Swarm | v3 escape hatch — hard to debug; hard for Constitution Service to intercept |
| Hybrid | v2 evolution path |

## The two ledgers

| Ledger | File | Schema |
|---|---|---|
| Task Ledger | [`../orchestration/task-ledger.md`](../orchestration/task-ledger.md) | `{task_id, project, agent_assigned, status, dependencies, deadline, created_at, updated_at}` |
| Progress Ledger | [`../orchestration/progress-ledger.md`](../orchestration/progress-ledger.md) | `{task_id, current_step, last_action, next_action, blockers, confidence, valid_from, valid_to}` |

Both are persisted to the project DB and replayable from the [episodic event log](../memory/event-log/).

## Long-running task support

The system must support 35-hour autonomous task chains `[transcript][H]`:

- Heartbeat that doesn't timeout on long tasks
- User can interrupt and redirect at any time (Kernel Rule 1)
- All intermediate state recoverable from event log
- Periodic checkpoints summarized to markdown — the "closing the books" pattern from `[LLM-A][H]`

## Context engineering

> **Canonical default per [ADR-0004](../adr/0004-context-budget.md).**

The supervisor practices **just-in-time context assembly**, not preloading. Concretely, before dispatching a task to an agent the supervisor:

1. **Assembles the agent's context just-in-time** — pulls only the slices relevant to the current task from L3 memory via the retrieval pipeline ([ADR-0003](../adr/0003-retrieval-pipeline.md)); does not preload the agent's full possible context.
2. **Enforces the declared `context-budget:`** from the agent's `SKILL.md` (see [L2](./L2-agents.md#context-budget)) before dispatch. If the assembled context exceeds the budget, the supervisor must compact or re-retrieve, not dispatch.
3. **Triggers compaction for long-running tasks.** The existing "closing the books" checkpoint pattern (see *Long-running task support* above) is the compaction hook: on checkpoint, transient working context is summarized into a structured note in [`../memory/`](../memory/), and the new working context starts from the note rather than the raw history.

`[research-p1][H]` Effective context length runs 1–2 orders of magnitude below the advertised window (NoLiMa, Modarressi et al., ICML 2025). The binding constraint is allocation, not window size. Anthropic's "Effective context engineering for AI agents" (2025) names just-in-time retrieval, compaction, and structured note-taking as the core techniques — Loom adopts all three.

The Critic also performs a pre-dispatch **context admission check** ([ADR-0008](../adr/0008-context-admission-check.md)) on the assembled context.

## Failure patterns to avoid

- *"A major retailer spent 18 months building a perfect system that was obsolete on launch"* — countered by incremental v0.1 → v0.2 cycles
- *"A financial services firm lost $2M due to poor state management"* — countered by event-sourced audit + bi-temporal progress ledger

---

## Open work for this layer

- [ ] Wire supervisor to read/write both ledgers
- [ ] Implement long-running task heartbeat
- [ ] Define checkpoint cadence ("closing the books" interval)
- [ ] Wire just-in-time context assembly + `context-budget:` enforcement per [ADR-0004](../adr/0004-context-budget.md)
- [ ] Hook compaction into the checkpoint cadence (summarize → structured note → resume)
