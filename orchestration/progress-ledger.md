# Progress Ledger

> **Schema:** `{task_id, current_step, last_action, next_action, blockers, confidence, valid_from, valid_to}`
> **Authority:** Supervisor (Magentic-One pattern). Bi-temporal — supports replay.

---

## In-flight progress

| task_id | current_step | last_action | next_action | blockers | confidence | valid_from | valid_to |
|---|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | | |

---

## Conventions

- `confidence` follows the calibration in [`../CLAUDE.md`](../CLAUDE.md): `<60 / 60–80 / 80–95 / >95`
- `valid_from` / `valid_to` form the bi-temporal range — when a row is superseded, `valid_to` is stamped and a new row is added
- `blockers` is a free-text list; if non-empty, status in the task ledger should be `blocked`
