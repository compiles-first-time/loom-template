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

## Failure patterns to avoid

- *"A major retailer spent 18 months building a perfect system that was obsolete on launch"* — countered by incremental v0.1 → v0.2 cycles
- *"A financial services firm lost $2M due to poor state management"* — countered by event-sourced audit + bi-temporal progress ledger

---

## Open work for this layer

- [ ] Wire supervisor to read/write both ledgers
- [ ] Implement long-running task heartbeat
- [ ] Define checkpoint cadence ("closing the books" interval)
