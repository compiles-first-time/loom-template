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

---

## Session log

> Closing-the-books checkpoint per [L5](../layers/L5-orchestration.md). One row per Claude Code session, written by the Stop hook.

| session_id | started | ended | tool_calls | errors | note |
|---|---|---|---|---|---|
| 64b7b6f5-04c9-49d8-8e18-64bb1ccf2144 | 2026-06-14T23:20:54.792Z | 2026-06-14T23:22:22.885Z | 7 | 0 | — |
| 64b7b6f5-04c9-49d8-8e18-64bb1ccf2144 | 2026-06-15T00:04:56.807Z | 2026-06-15T00:07:25.715Z | 18 | 0 | — |
| 64b7b6f5-04c9-49d8-8e18-64bb1ccf2144 | 2026-06-15T00:04:56.807Z | 2026-06-15T00:42:05.969Z | 96 | 0 | — |
| 64b7b6f5-04c9-49d8-8e18-64bb1ccf2144 | 2026-06-15T00:04:56.807Z | 2026-06-15T00:42:13.270Z | 96 | 0 | — |
| 64b7b6f5-04c9-49d8-8e18-64bb1ccf2144 | 2026-06-15T00:04:56.807Z | 2026-06-15T01:17:29.816Z | 96 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T01:43:46.270Z | 15 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T01:44:26.061Z | 15 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T06:13:04.833Z | 45 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T13:27:00.534Z | 98 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T13:41:44.721Z | 127 | 0 | — |
