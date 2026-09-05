# rb_add_signal — Add or change an EventBus signal (R-EB1)

## Runbook

| Field | Value |
|---|---|
| Trigger | Two systems need to talk and no §5 signal carries the message, or a payload must change. The §5 table IS the API between systems. |
| Primary | event_bus |
| Roles | orchestrator |
| Director | Yes — §5 is a contract (§14): the spec PR needs DIRECTOR approval. Proposed signals already await a row (see `scripts/systems-map.sh validate`). |
| Spec | §5, §4 R2 R6, §12, §14 |
| Not touched | gameplay_analytics: candidate — analytics would subscribe to the bus once approved |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | event_bus | GAME_INFRA_SPEC.md §5 | no existing signal carries the message (read the table and the registry's `sig_*` nodes) | Prefer a payload field on an existing signal over a new signal when the meaning is the same. |
| 2 | decide | — | GAME_INFRA_SPEC.md §5 | DIRECTOR approves the new row: name, payload, emitter, typical listeners | Contract change. |
| 3 | update | game_infra_spec | GAME_INFRA_SPEC.md §5 | the row is in the table in this same PR (R-EB1) | — |
| 4 | update | event_bus | core/events/event_bus.gd | `signal <name>(typed payload)` declared with a one-line docstring | — |
| 5 | update | systems_atlas | systems/registry/00-foundation.md | `add-node --id sig_<name> --parent event_bus --status spec …` plus `add-edge --from <emitter> --how emits --to sig_<name>` and one `listens` edge per listener | `scripts/systems-map.sh validate` cross-checks §5 against the `sig_*` nodes and fails while they disagree. |
| 6 | update | command_intents | core/commands/ | if the signal is player-caused, the intent that leads to it exists (input → simulate → present) | Presentation never emits gameplay signals (R5). |
| 7 | check | event_replication | core/net/replication/ | payload is ids and plain values only — the server can emit it and replicate it to clients later (§12) | Node references in a payload are a Phase 4 rewrite. |
| 8 | check | deterministic_sim | core/ | emission happens inside the fixed tick, from sim code | — |
| 9 | update | g1_unit_tests_gut | tests/unit/events/ | a test asserts the signal fires with the documented payload | — |
| 10 | run | g0_style_parse | . | gdformat, gdlint, headless import pass | — |
| 11 | run | g1_unit_tests_gut | tests/unit/ | passes | — |
| 12 | run | g3_smoke_boot | scenes/main.tscn | boots, zero ERROR lines | — |
| 13 | update | changelog | docs/changelog.md | one line naming the signal | — |
