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
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T13:50:51.932Z | 134 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T13:55:52.922Z | 140 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T14:24:09.268Z | 174 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T14:47:23.019Z | 197 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T15:04:16.197Z | 230 | 0 | — |
| e64b069d-aee3-4aba-a6e7-0a2862db7f4a | 2026-06-15T01:32:22.601Z | 2026-06-15T19:35:05.798Z | 253 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T15:42:45.433Z | 25 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T15:51:56.911Z | 28 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T15:54:31.379Z | 35 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T15:54:44.480Z | 35 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T15:59:10.678Z | 37 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T17:19:09.341Z | 46 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T17:19:30.400Z | 48 | 0 | — |
| d3a95963-ea37-512e-9886-6d08179412f5 | 2026-08-02T15:35:35.461Z | 2026-08-02T19:44:08.837Z | 69 | 0 | — |
