# rb_add_loot_table — Add a loot table (LootTableDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | A new enemy, chest or gather node needs its own drop list, or an existing table needs a variant. |
| Primary | loot_table_defs |
| Roles | content-smith |
| Director | none — boss loot lockouts, pity timers, affixes and the loot economy simulator are candidates |
| Spec | §6.6, §6.5 loot_table, §4 R4 seeded rolls, §8 G2 |
| Not touched | elite_rare_variants: variants name a richer table when they are added; harvest_yield_tables: gather nodes reuse loot tables — attach through rb_add_material step 3; loot_economy_sim: candidate |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_loot_table_def | core/schemas/loot_table_def.gd | entries[] carry item_id, weight, min, max; guaranteed[] carry item_id, count | — |
| 2 | check | items | data/items/ | every item_id exists | Missing: `rb_add_item`. |
| 3 | check | loot_economy_tuning | docs/balance_ranges.md | weights and counts keep drop rates inside the tuning notes | Weights are relative; write the intended percentage in the PR. |
| 4 | create | loot_table_defs | data/_inbox/<id>.json | `loot_<owner>` with entries and guaranteed | — |
| 5 | run | json_to_tres_converter | data/loot_tables/<id>.tres | converter writes the .tres | — |
| 6 | update | enemy_defs | data/enemies/<enemy>.tres | the enemy that drops it names the table | An orphan table is dead data. |
| 7 | update | chests_containers | scenes/prefabs/chests/ or data/building/ | a chest that rolls this table names it | Chests only. |
| 8 | check | weighted_rolls | core/loot/roll.gd | rolls take the seeded RNG; a property test covers weights summing to any positive total | No code change for a new table. |
| 9 | check | guaranteed_drops | core/loot/roll.gd | guaranteed entries drop alongside the roll | — |
| 10 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 11 | run | gm_console | core/debug/console.gd | `spawn` the owner, kill it, see the drop; repeat under a fixed seed for the same result | — |
| 12 | update | changelog | docs/changelog.md | one line | — |
