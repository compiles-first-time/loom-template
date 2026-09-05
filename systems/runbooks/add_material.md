# rb_add_material — Add a crafting material (ore, wood, hide, herb …)

## Runbook

| Field | Value |
|---|---|
| Trigger | A profession or recipe design needs a new raw material or intermediate ingredient. A material is an ItemDef plus a way to obtain it plus at least one recipe that consumes it. |
| Primary | materials_ingredients |
| Roles | content-smith; world-builder |
| Director | none — unless the material belongs to a profession (professions are candidates: a DIRECTOR decision and a spec PR first) or needs a new gather tool tier |
| Spec | §6.1 tags, §6.2 inputs, §11, §13 Phase 3 gather/craft loop |
| Not touched | salvage_disassembly: candidate — when approved, salvage tables name materials and this one may be added; gathering_professions: candidate — profession gating of this material waits for the decision |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | run | items | data/items/<id>.tres | `rb_add_item` steps 1–14 and 19–22 done | A material IS an item: tags carry the material family (`ore`, `wood`, `hide`, `herb`), slot none, stack_size high, on_use_effect empty. |
| 2 | decide | — | — | which source yields it: a resource node, a loot table, or both | The Director does not need to decide this, but the PR must say it. |
| 3 | update | resource_nodes | scenes/prefabs/resources/<node>.tscn or its yield table | the node's yield table names the material with a count range | Trees, rocks and plants yield materials; a new material with no node and no loot drop is unobtainable. |
| 4 | check | gather_tools_tiers | data/items/ | the tool tier the node requires exists (axe or pickaxe tier) | A tier-3 ore behind a tier-1 pickaxe is a progression bug, not a data error. |
| 5 | check | node_respawn | core/survival/gathering/respawn.gd | respawn timer of the yielding node fits the material's rarity | Respawn is saved with the world; no code change for a new material. |
| 6 | update | loot_table_defs | data/loot_tables/<table>.tres | an enemy or chest table names the material, when it also drops | Hide comes from animals: the animal's loot table gets an entry. |
| 7 | update | recipe_defs | data/recipes/<recipe>.tres | at least one recipe lists the material in inputs[] | A material nobody consumes is inventory noise. New recipe: `rb_add_recipe`. |
| 8 | check | crafting_stations | data/recipes/ | the consuming recipe's station exists (hands, workbench, forge, campfire) | — |
| 9 | check | loot_economy_tuning | docs/balance_ranges.md | yield counts, drop weights and recipe costs keep the material flow inside the tuning notes | Drop rates and material flow are balance numbers; anchor on comparable materials. |
| 10 | run | g2_data_integrity | tools/validate_data.gd | passes: item, node yield, loot entries and recipe inputs all resolve | — |
| 11 | run | g4_bot_playtest | tools/testing/ | from Phase 1: the bot can gather the node, receive the material and craft the consuming recipe | The scripted gather → craft path is exactly the loop this material joins. |
| 12 | update | changelog | docs/changelog.md | one line naming the material, its sources and its recipes | — |
