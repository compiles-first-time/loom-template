# Task Ledger

> **Schema:** `{task_id, project, agent_assigned, status, dependencies, deadline, created_at, updated_at}`
> **Authority:** Supervisor (Magentic-One pattern). All entries are also replayable from the [event log](../memory/event-log/).
> **Generation:** the HR work-graph generator ([ADR-0029](../adr/0029-hr-work-graph.md)) regenerates this markdown mirror from `orchestration/work-graph.json`.

---

## Active tasks

| task_id | agent_assigned | status | dependencies | deadline | created_at | updated_at |
|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | |

## Status legend

- `pending` — not yet started
- `in_progress` — actively being worked
- `blocked` — waiting on dependency or external signal
- `completed` — finished and acknowledged
- `cancelled` — abandoned with reason

---

## Recently completed

*(last 10; older entries roll off into the event log)*

| task_id | agent_assigned | completed_at | notes |
|---|---|---|---|
| *(none yet)* | | | |
