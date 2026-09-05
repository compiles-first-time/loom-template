# rb_add_recipe — Add a crafting recipe (RecipeDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | An item should become craftable, or an existing craft needs a second path. Cooking recipes are ordinary recipes at the campfire station. |
| Primary | recipe_defs |
| Roles | content-smith |
| Director | none — unless the recipe should be gated by a profession or skill (candidates) or needs a station that does not exist yet |
| Spec | §6.2, §5 item_crafted, §8 G2 |
| Not touched | salvage_disassembly: candidate — salvage would run recipes backwards once approved |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_recipe_def | core/schemas/recipe_def.gd | fields needed are in §6.2: output_item, output_count, station, inputs, craft_time_s, unlocked_by | Anything else is `rb_change_schema`. |
| 2 | check | items | data/items/ | output_item and every inputs[].item_id exist | Missing item: `rb_add_item` (or `rb_add_material`) first. |
| 3 | check | crafting_stations | data/recipes/ | station is one that exists near a crafter: hands, workbench, forge, campfire … | A new station name is a station change (StationDef is implied, see `schema_station_def`): stop and add the station first. |
| 4 | check | recipe_unlocks | data/quests/ or data/items/ | unlocked_by is empty (known from start) or a quest id or item id that exists | — |
| 5 | check | balance_anchoring | docs/balance_ranges.md | craft_time_s and input counts sit beside three to five comparable recipes | — |
| 6 | create | recipe_defs | data/_inbox/<id>.json | id is `recipe_<output>` (or `recipe_<output>_<variant>`), schema_version 1 | — |
| 7 | run | json_to_tres_converter | data/recipes/<id>.tres | converter writes the .tres | — |
| 8 | check | crafting_screen | ui/crafting/ | the recipe appears at its station in the crafting screen with correct inputs | No code change for a new recipe; if the screen cannot show a field, that is a UI change. |
| 9 | check | craft_time_queue | core/crafting/craft.gd | craft_time_s runs on the fixed tick and the item_crafted payload is unchanged | Payload change = spec §5 PR (R-EB1). |
| 10 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 11 | run | gm_console | core/debug/console.gd | `give` the inputs, stand at the station, craft; item_crafted fires with station_id | — |
| 12 | update | changelog | docs/changelog.md | one line | — |
