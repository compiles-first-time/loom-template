# rb_retire_content — Remove or deprecate a content entry (item, spell, effect, enemy, recipe, quest …)

## Runbook

| Field | Value |
|---|---|
| Trigger | A def should stop existing or be replaced. Ids never change after shipping in a save (R7), so shipped content is deprecated, not deleted. |
| Primary | id_immutability_migrations |
| Roles | content-smith; orchestrator |
| Director | none — unless the content is named in the spec (§6.9 Fireball) or a spec section |
| Spec | §4 R7, §10 save rule, §6 conventions, §8 G2 |
| Not touched | — |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | id_immutability_migrations | docs/migrations.md | has the id ever shipped in a save or a tagged build? | Never shipped: delete. Shipped: deprecate (keep the def, mark it, redirect). |
| 2 | check | data_validator_g2 | tools/validate_data.gd | run G2 after removing the def: every failure is a reference you must fix first | G2 is the reference finder: recipes, loot tables, quests, dialogue, vendors, spawn rules, starting kits. |
| 3 | update | recipe_defs | data/recipes/ | recipes that output or consume it are retired or re-pointed | — |
| 4 | update | loot_table_defs | data/loot_tables/ | entries naming it are removed or re-pointed | — |
| 5 | update | quest_defs | data/quests/ | objectives and rewards naming it are re-pointed | — |
| 6 | update | spawn_rules_biome_phase | data/biomes/ | spawn sets naming a retired enemy are updated | Enemies only. |
| 7 | update | migrations_doc | docs/migrations.md | note: old id → replacement id (or none), the save behavior for players who hold it | — |
| 8 | update | save_migrations | core/saving/migrations.gd | old saves holding the id get the replacement or a refund on load | Shipped content only. |
| 9 | update | content_database_git | data/<noun>/<id>.tres | delete (never shipped) or mark deprecated with the replacement id | — |
| 10 | update | item_icons_models | art/icons/<category>/<id>.png | asset removed with the def, or kept while deprecated | — |
| 11 | run | g2_data_integrity | tools/validate_data.gd | passes: no dangling reference | — |
| 12 | run | g3_smoke_boot | scenes/main.tscn | boots; an old save (if any) loads without ERROR lines | — |
| 13 | update | id_immutability_migrations | systems/registry/ | if a whole system went away: `set-node <id> status=non-goal phase=—` or `remove-node` after `remove-edge` | Content retirement alone changes no registry row. |
| 14 | update | changelog | docs/changelog.md | one line: what was retired and what replaces it | — |
