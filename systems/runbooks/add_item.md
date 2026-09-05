# rb_add_item — Add an item (ItemDef)

## Runbook

| Field | Value |
|---|---|
| Trigger | A new item is needed: equipment, consumable, material, quest item, tool or key. Materials continue with `rb_add_material`. |
| Primary | items |
| Roles | content-smith; world-builder |
| Director | none — unless the item needs a new slot, rarity, stat key, tag that systems filter on, or any field §6.1 lacks (then `rb_change_schema` and a spec PR first) |
| Spec | §6.1, §11 icons, §8 G2, §4 R1 R7 |
| Not touched | class_starting_kit: candidate (classes are not in the spec) — when approved, starting kits reference item ids and this item may be added there; colorblind_modes: only a new rarity tier changes the rarity colors, a new item does not; item_upgrades_enchanting: candidate, not in the spec; npc_vendors_stores: candidate (vendors are not in the spec) — when approved, stock lists reference item ids; objective_types: a quest that collects this item is a quest change, see rb_add_quest; piece_defs: a building piece that costs this item is a piece change, see rb_add_building_piece; quest_rewards: a quest that rewards this item is a quest change, see rb_add_quest; seasonal_rewards: candidate (live events are not in the spec) |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | schema_item_def | core/schemas/item_def.gd | every field you need is in §6.1 | Need a field, slot, rarity or enum value that does not exist? Stop: `rb_change_schema` (spec PR) before any data. |
| 2 | check | id_convention | data/items/ | `grep -r "<id>" data/` finds nothing | Id is `item_<snake_name>`, globally unique, never reused (R7). Once shipped in a save it is immutable. |
| 3 | check | balance_anchoring | docs/balance_ranges.md | weight and every stat inside the allowed range | Read three to five comparable ItemDefs before choosing numbers; G2 enforces the ranges. |
| 4 | create | items | data/_inbox/<id>.json | JSON carries id, display_name, schema_version 1, description, icon, stack_size, weight, rarity, slot, tags, stats, on_use_effect | The generator side of the loop: agents write JSON, never .tres by hand. |
| 5 | run | json_to_tres_converter | data/items/<id>.tres | `godot --headless -s tools/json_to_tres.gd` writes the .tres and empties the inbox entry | Converter validates against §6.1 first; a schema mismatch fails here, not at runtime. |
| 6 | create | item_icons_models | art/icons/items/<id>.png (256×256, transparent); optional art/models/items/<id>.glb | icon path in the def exists; filename equals the id | Models pass through the import hook (scale, collision, master material) automatically. |
| 7 | check | icon_placeholder_fallback | art/_inbox/ | G2 passes with the placeholder path until the real icon lands | No icon yet? Point at the placeholder and file a one-line prompt so asset generation can pick it up. |
| 8 | check | consumables_apply | data/effects/<on_use_effect>.tres | the effect id resolves (G2) | Only when on_use_effect is set. Missing effect: `rb_add_status_effect` first. |
| 9 | check | equip_slots | data/items/<id>.tres | slot is a §6.1 enum value; stack_size is 1 when slot is not none | Only for equipment. |
| 10 | check | gear_stats_application | data/items/<id>.tres | every key in stats is a known stat key that becomes a modifier | Unknown stat key = silently ignored stat. Add the key to the stats block vocabulary first if it is new (that is a system change). |
| 11 | check | stacking_rules | data/items/<id>.tres | stack_size is sane for the kind (materials stack, equipment does not) | — |
| 12 | check | weight_encumbrance | data/items/<id>.tres | weight is in kg and inside the balance range | — |
| 13 | check | weapon_types | data/items/<id>.tres | tags carry exactly one weapon type tag | Only when tags include weapon. |
| 14 | check | weapon_attack_speed | data/items/<id>.tres | stats.attack_speed set for weapons | Only when tags include weapon. |
| 15 | update | loot_table_defs | data/loot_tables/<table>.tres | the item is obtainable: a loot table, a recipe, a gather node or a vendor names it | An unobtainable item is a bug G2 cannot see. Write which source in the PR. |
| 16 | update | recipe_defs | data/recipes/ | crafted items have a recipe (`rb_add_recipe`); materials are an input somewhere | — |
| 17 | check | gather_tools_tiers | data/items/<id>.tres | tool tier tag present so resource nodes accept the tool | Only for axes, pickaxes and other gathering tools. |
| 18 | check | keys_gates | data/encounters/ | the gate or door that this key opens references the key id | Only for key items. |
| 19 | check | tooltips_item_cards | ui/tooltips/ | description is 1–2 sentences and renders in the card | No code change unless the card needs a field it has never shown. |
| 20 | run | g2_data_integrity | tools/validate_data.gd | `godot --headless -s tools/validate_data.gd` passes | Unique id, references resolve, icon and model paths exist, enums legal, numbers in range. |
| 21 | run | gm_console | core/debug/console.gd | `give <id> 1` puts the item in the bag; hot-reload made it usable without a restart | The whole point of the architecture: JSON → castable/usable in one loop. |
| 22 | check | bag_slots | core/inventory/bags.gd | `give <id> 5` stacks or fills slots as stack_size says | — |
| 23 | update | changelog | docs/changelog.md | one line: date · role · item id · source | — |
| 24 | check | item_categories_tags | systems/registry/04-economy.md | a new tag that systems must filter on is a system change: `add-node` under items plus an edge from each reader | Most items add no tag vocabulary; then nothing to do here. |
