# rb_add_enemy — Add an enemy (EnemyDef + actor prefab)

## Runbook

| Field | Value |
|---|---|
| Trigger | A biome, dungeon or quest needs a new creature that an existing AI behavior verb can drive. A boss with phases starts here and continues as `boss_encounters` content. |
| Primary | enemy_defs |
| Roles | content-smith; world-builder |
| Director | none — a new `behavior` is a verb (`rb_add_verb`); enemy factions, hostility tables and enemy spell lists are candidates |
| Spec | §6.5, §6.6, §11, §5 actor_spawned / actor_died, §8 G2 G3 |
| Not touched | elite_rare_variants: a variant is a separate def with overrides — add the base enemy first; encounter_defs: a boss additionally gets an EncounterDef (boss_encounters content), not part of a plain enemy; objective_types: a kill quest naming this enemy is a quest change (rb_add_quest) |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_enemy_def | core/schemas/enemy_def.gd | behavior ∈ passive/territorial/aggressive/pack; biomes and day_phases values exist | — |
| 2 | check | behavior_verbs | core/ai/behaviors/ | the behavior verb exists and needs no new parameters | New parameter or verb: `rb_add_verb`. |
| 3 | check | balance_anchoring | data/enemies/ | three to five comparable enemies read before choosing numbers | — |
| 4 | check | enemy_stats_scaling | docs/balance_ranges.md | health, damage, armor, move_speed, xp sit in the biome tier's band | — |
| 5 | create | loot_table_defs | data/loot_tables/<loot_id>.tres | the table exists before the enemy references it | `rb_add_loot_table` when new. |
| 6 | create | actor_prefabs_scenes | actors/enemies/<id>.tscn | the prefab has the collision, animation state machine and nameplate anchor the family uses | World-builder scope. Copy the family's base scene. |
| 7 | create | model_naming | art/models/enemies/<id>.glb + textures | filename equals the id; passes the import hook (scale, collision, master material) | Placeholder mesh if art is not ready. |
| 8 | create | enemy_defs | data/_inbox/<id>.json | `enemy_<name>`: scene, health, damage, armor, move_speed, behavior, loot_table, xp, biomes, day_phases | — |
| 9 | run | json_to_tres_converter | data/enemies/<id>.tres | converter writes the .tres | — |
| 10 | update | spawn_rules_biome_phase | data/biomes/<biome>.tres or the spawn table | the enemy appears in the spawn set for its biomes and phases | An enemy no spawn rule names never appears outside the console. |
| 11 | check | enemy_families | data/enemies/ | it shares the family's art, sounds and behavior or starts a new family (a system change: `add-node`) | — |
| 12 | check | pack_spawning | core/spawn/packs.gd | pack size and formation rules apply when behavior is pack | Pack behavior only. |
| 13 | check | steering_locomotion | core/ai/steer.gd | move_speed drives steering; the enemy reaches its targets on the navmesh | — |
| 14 | check | loot_rolls_on_death | core/loot/on_death.gd | actor_died rolls the enemy's table; no code change | — |
| 15 | check | xp_award | core/progression/xp.gd | xp value follows the level curve for its tier | — |
| 16 | check | combat_animations | actors/enemies/<id>.tscn | attack, hit and death animations map to the sim-driven timing | — |
| 17 | check | nameplates_floating_text | ui/hud/nameplates/ | the nameplate shows the display_name | No code change. |
| 18 | run | g2_data_integrity | tools/validate_data.gd | passes: scene path, loot table, biomes resolve | — |
| 19 | run | gm_console | core/debug/console.gd | `spawn <id> 1`: it spawns, fights, dies, drops, awards xp; actor_spawned and actor_died fire | — |
| 20 | run | g3_smoke_boot | scenes/main.tscn | 30 s headless boot with the enemy in a spawn set: zero ERROR lines | — |
| 21 | update | changelog | docs/changelog.md | one line | — |
