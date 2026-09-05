# rb_add_verb — Add a new verb (spell delivery, effect kind, AI behavior, objective type)

## Runbook

| Field | Value |
|---|---|
| Trigger | Content wants a *new kind of thing* — a delivery no spell has, an effect kind, an AI behavior, a quest objective type. §3's rule of thumb: that is `core/`, not `data/`. Every enum value in §6 "= a verb that exists in core". |
| Primary | casting |
| Roles | orchestrator; test-pilot |
| Director | Yes — the enum value is a §6 contract change (§14) |
| Spec | §3 placement rule, §4 R1 R2 R4 R5 R6, §6.3 delivery, §6.4 kind, §6.5 behavior, §6.7 objectives.type |
| Not touched | boss_mechanics_library: mechanics fire spells through the casting verbs — a new verb is available to them with no change; combat_sim_harness: candidate; command_validation: Phase 4 — the server reuses the verb's own range and cost checks; enemy_abilities: candidate; ranged_weapons: candidate; target_frames: shows the resolved target — no change for a new verb; target_lock_camera: frames the current target — no change for a new verb |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | systems_content_split | core/ | the need is truly a new verb and not data on an existing one (R1) | A spell that hits harder is data; a spell that chains between targets is a verb. |
| 2 | decide | — | GAME_INFRA_SPEC.md §6 | DIRECTOR approves the enum value and its semantics | — |
| 3 | update | game_infra_spec | GAME_INFRA_SPEC.md §6.x | the enum gains the value in this PR | — |
| 4 | update | casting | core/combat/casting/<verb>.gd (or core/combat/effects/, core/ai/behaviors/, core/quests/objectives.gd) | the verb is a typed, docstringed function that takes the seeded RNG and runs on the fixed tick (R4, R6) | Talks to other systems only via the EventBus (R2). Presentation reads state and reacts; it never mutates (R5). |
| 5 | update | data_schemas | core/schemas/<def>.gd | the enum accepts the value | `rb_change_schema` steps 4–8 if the schema needs a new field for the verb's parameters. |
| 6 | update | data_validator_g2 | tools/validate_data.gd | the validator knows the new enum value | — |
| 7 | update | targeting_modes | core/combat/casting/targeting.gd | a new delivery declares how it targets (self, target, ground, cone …) | Delivery verbs only. |
| 8 | update | element_default_vfx | art/vfx/<verb>/ | a default visual exists for the verb per element, so a def with empty vfx still shows something | Delivery and effect verbs. |
| 9 | update | effect_kinds_verbs | core/combat/effects/<kind>.gd | effect kind verbs implement apply, tick, expire and stacking | Effect kinds only. |
| 10 | update | behavior_verbs | core/ai/behaviors/<behavior>.gd | AI verbs read the actor by id and choose intents; no node paths (§12) | Behavior verbs only. |
| 11 | update | objective_types | core/quests/objectives.gd | an objective type says how its target_id resolves and which signal advances it | Objective types only. |
| 12 | check | crosshair_reticle | ui/hud/crosshair/ | a new targeting mode has a reticle state | Delivery verbs only. |
| 13 | check | action_bars_hotkeys | ui/hud/action_bars/ | the cooldown sweep and cast bar work for the verb | Delivery verbs only. |
| 14 | check | combat_animations | actors/player/animation_tree.tres | a cast animation exists for the verb's timing | Delivery verbs only. |
| 15 | check | projectile_visuals | art/vfx/projectiles/ | a projectile-like verb has a visual that follows the simulated projectile | Projectile-like verbs only. |
| 16 | check | telegraph_decals | core/encounters/mechanics/telegraph.gd | a ground verb can be telegraphed by bosses | Ground verbs only. |
| 17 | update | g1_unit_tests_gut | tests/unit/<area>/ | a seeded test drives the verb and asserts the outcome twice with the same seed (determinism) | — |
| 18 | update | systems_atlas | systems/registry/ | `add-node` for the verb under its system and `add-edge` for what it reads and emits | — |
| 19 | create | spell_defs_content | data/_inbox/<sample>.json | one sample def uses the verb, so G2 and the console exercise it | `rb_add_spell` / `rb_add_status_effect` / `rb_add_enemy` / `rb_add_quest`. |
| 20 | run | g0_style_parse | . | passes | — |
| 21 | run | g1_unit_tests_gut | tests/unit/ | passes | — |
| 22 | run | g2_data_integrity | tools/validate_data.gd | passes with the sample def | — |
| 23 | run | g3_smoke_boot | scenes/main.tscn | boots, zero ERROR lines | — |
| 24 | run | architecture_rules | core/ | `scripts/systems-map.sh observe --strict`: no R2/R4 violations in the new verb, its dependencies declared | Fitness checks (ADR-0067). |
| 25 | update | changelog | docs/changelog.md | one line: the verb and its enum | — |
