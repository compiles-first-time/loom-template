# rb_change_movement — Change movement, camera, input translation or movement netcode (ADR-0068)

## Runbook

| Field | Value |
|---|---|
| Trigger | Any change to locomotion, the camera rig, animation state machines, input translation or replication that changes how the player or another actor moves on screen. The feel contract (ADR-0068, proposed R11) is the definition of done: a movement change is finished when G6 passes, not when it compiles. |
| Primary | locomotion |
| Roles | orchestrator; test-pilot |
| Director | Only when a locked setting changes — tick rate, physics interpolation, jitter fix, physics engine, netcode library — because those are §2 / §4 R11 contract changes (§14). |
| Spec | §4 R4 R5 R11 (proposed, ADR-0068), §8 G4 G6, §12, §13 Phase 1 |
| Coverage | direct |
| Not touched | mounts_travel: candidate — riding replaces walking once the DIRECTOR approves it and would then run this same runbook |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | pure_movement_step | actors/player/locomotion.gd | the step is still `(state, intent, tick) → state`: no `get_process_delta_time`, no node paths, no `Time.*`, no global `randf()` inside it (R4, R11) | The one property that keeps replay, server authority and prediction on the same code path. |
| 2 | check | render_interpolation | project.godot | `physics_ticks_per_second = 60`, `physics_interpolation = true`, `physics_jitter_fix = 0` are unchanged; every teleport the change introduces calls `reset_physics_interpolation()` | Changing any of the three is a DIRECTOR decision (§14). |
| 3 | check | input_sampling | core/commands/input.gd | presses are still latched per frame and consumed once per tick; look input still bypasses the tick | A press shorter than a tick must still register. |
| 4 | update | locomotion | actors/player/locomotion.gd | the change itself lives inside the step; speeds, accelerations and jump numbers come from data or `docs/balance_ranges.md`, never literals (R1) | — |
| 5 | check | stamina_drain_regen | core/survival/stamina.gd | the sprint state is exposed exactly as before, or its reader is updated in this PR | — |
| 6 | check | fall_damage | core/survival/fall_damage.gd | fall height is still derived from the movement state; jump or gravity changes re-run its tests | — |
| 7 | check | animation_state_machines | actors/player/animation_tree.tres | every movement state the change adds or renames has an animation state, and states change only from sim state (R5) | — |
| 8 | check | locomotion_blending | art/animations/ | blend parameters (speed, direction) still map onto the new speed ranges | — |
| 9 | update | third_person_rig | actors/player/camera/ | the camera reads `get_global_transform_interpolated()` in `_process` and applies look input per frame; no camera code writes body position or rotation (R5) | Camera changes always run G6b on the reference machine. |
| 10 | check | interpolation_prediction | core/net/replication/ | Phase 4 and later: the predictor and the server call the same step; snapshots still carry the tick they describe; the two-tick buffer is unchanged | Phases 1–3: a note that the step signature did not change is enough. |
| 11 | update | g1_unit_tests_gut | tests/unit/movement/ | a seeded test drives the step for N ticks and asserts the identical end state twice | — |
| 12 | run | determinism_replay_tests | tests/integration/ | the recorded walk replays to the identical state | — |
| 13 | run | g4_bot_playtest | tools/testing/bot.gd | the bot walks, gathers and never falls through the floor | — |
| 14 | run | g6_feel_gate | tools/testing/feel.gd | G6a passes: tick cost, input-to-sim ≤ 1 tick, replay identical, prediction error and corrections under the simulated network within budget; G6b for camera, tick or interpolation changes | Budgets live in `docs/balance_ranges.md`. |
| 15 | run | architecture_rules | core/ | `scripts/systems-map.sh observe --strict`: no R4 violation inside the step, no R5 emit from the camera or animation folders | Fitness checks (ADR-0067). |
| 16 | update | systems_atlas | systems/registry/ | `add-edge` for anything the change newly reads or emits | — |
| 17 | update | changelog | docs/changelog.md | one line: what moved and the G6 numbers it hit | — |
