# Character — who the player is, what they can do, what they carry

> **Analogy:** the character sheet in a tabletop RPG. Numbers on the sheet (attributes), what the sheet lets you do (abilities), and what is written in the margins (inventory, equipment, progress).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| character | Character | 1 | — | 1 | implied | orchestrator | actors/player/; core/stats/; core/inventory/; core/progression/ | §1, §6.1, §6.3, §6.5 | The player avatar: controller, stats, progression, resources, inventory, equipment, identity | The character sheet in a tabletop RPG |
| player_controller | Player controller & movement | 2 | character | 1 | spec | orchestrator | actors/player/ | §13 Phase 1 | Third-person movement, jumping, interaction; the first thing Phase 1 must make feel good | The driver's seat |
| locomotion | Locomotion | 3 | player_controller | 1 | spec | orchestrator | actors/player/locomotion.gd | §13 Phase 1 | Walk, run, sprint, jump; moves on the fixed tick from move intents | — |
| interaction_system | Interaction | 3 | player_controller | 1 | implied | orchestrator | actors/player/interact.gd | §6.7 talk objective | Use, pick up, talk, harvest: one interact intent resolved against the nearest interactable id | — |
| character_capsule | Character capsule | 3 | player_controller | 1 | spec | orchestrator | actors/player/player.tscn | §11 | 1.8 m capsule, 1 unit = 1 m; doorways at least 2.2 m | — |
| swimming | Swimming | 3 | player_controller | — | candidate | orchestrator | actors/player/ | — | Movement in water bodies; needs water to exist first | — |
| climbing | Climbing | 3 | player_controller | — | candidate | orchestrator | actors/player/ | — | Ledge and cliff climbing | — |
| dodge_roll | Dodge roll | 3 | player_controller | — | candidate | orchestrator | actors/player/ | — | Stamina-costing evade with i-frames; a DIRECTOR feel decision for Phase 1 | — |
| attributes_stats | Attributes & stats | 2 | character | 1 | implied | orchestrator | core/stats/ | §6.1 stats, §6.5 | The numbers: derived stats from gear and effects, resistances, level scaling | The numbers on the character sheet |
| derived_stats | Derived stats | 3 | attributes_stats | 1 | implied | orchestrator | core/stats/derived.gd | §6.1 stats | Damage, armor, attack speed, max health and mana computed from gear, effects and level | — |
| stat_modifiers_stack | Stat modifier stack | 3 | attributes_stats | 2 | implied | orchestrator | core/stats/modifiers.gd | §6.4 stat_mod | Ordered additive and multiplicative modifiers with sources, so removal is exact | Sticky notes on a number, each signed by who added it |
| resistances | Resistances | 3 | attributes_stats | 2 | implied | orchestrator | core/stats/resist.gd | §6.3 element | Per-element resistance values that the damage model applies | — |
| stat_formulas | Stat formulas | 3 | attributes_stats | 1 | implied | orchestrator | core/stats/formulas.gd | — | The pure functions that turn inputs into stats; property-tested | — |
| level_scaling | Level scaling | 3 | attributes_stats | 2 | implied | orchestrator | core/stats/scaling.gd; docs/balance_ranges.md | §6.5 xp | Stat growth per level for players and enemies; the curves live in docs/balance_ranges.md | — |
| primary_attributes | Primary attributes | 3 | attributes_stats | — | candidate | director | core/stats/ | — | Strength, agility, intellect, stamina, spirit as the roots of derived stats; not in the spec | — |
| progression | Progression | 2 | character | 2 | implied | orchestrator | core/progression/ | §6.5 xp, §6.7 rewards.xp | XP, levels, and the rewards for reaching them | The belt system in martial arts |
| xp_award | XP award | 3 | progression | 2 | implied | orchestrator | core/progression/xp.gd | §6.5, §6.7 | XP from kills and quests credited to the right actor | — |
| level_curve | Level curve | 3 | progression | 2 | implied | orchestrator | core/progression/levels.gd | — | XP thresholds per level; emits level up | — |
| level_up_rewards | Level-up rewards | 3 | progression | 2 | implied | orchestrator | core/progression/rewards.gd | — | Stat growth, ability unlocks and points granted per level | — |
| achievements | Achievements | 3 | progression | — | candidate | director | data/achievements/ | — | Trackable feats with rewards; not in the spec | Merit badges |
| titles | Titles | 3 | progression | — | candidate | director | data/titles/ | — | Displayed honorifics earned from achievements | — |
| prestige | Prestige / paragon | 3 | progression | — | candidate | director | core/progression/ | — | Post-cap progression; likely never for a co-op survival game | — |
| classes_specs | Classes & specializations | 2 | character | — | candidate | director | data/classes/ | — | Class definitions, role specs, starting kits; WoW-style but absent from the spec | Choosing a profession at the guild hall |
| class_defs | Class definitions | 3 | classes_specs | — | candidate | director | data/classes/ | — | Data-defined classes with resource type, spell list and armor proficiency | — |
| role_specs | Role specializations | 3 | classes_specs | — | candidate | director | data/classes/ | — | Tank, healer, DPS, support specs inside a class | — |
| class_starting_kit | Class starting kit | 3 | classes_specs | — | candidate | content-smith | data/classes/ | — | Items and spells a new character of the class begins with | — |
| multiclass_rules | Multiclass rules | 3 | classes_specs | — | candidate | director | core/progression/ | — | Whether and how a character mixes classes | — |
| talents | Talents | 2 | character | — | candidate | director | data/talents/ | — | Trees of choices that modify stats and spells; absent from the spec | A skill-tree poster you fill in with stickers |
| talent_trees | Talent trees | 3 | talents | — | candidate | director | data/talents/ | — | Node graphs with prerequisites per class or role | — |
| talent_points | Talent points | 3 | talents | — | candidate | orchestrator | core/progression/talents.gd | — | Points granted per level and spent on nodes | — |
| respec | Respec | 3 | talents | — | candidate | director | core/progression/talents.gd | — | Refunding talent points, possibly for a cost | — |
| talent_modifiers | Talent modifiers | 3 | talents | — | candidate | orchestrator | core/progression/talents.gd | — | How chosen talents change stats and spell fields | — |
| abilities_skills | Abilities & skills | 2 | character | 2 | spec | orchestrator | core/combat/casting/; data/spells/ | §6.3 | The spells a character knows and how they unlock | The recipe book the character has learned |
| spellbook | Spellbook | 3 | abilities_skills | 2 | implied | orchestrator | core/progression/spellbook.gd | §6.3 | The set of spell ids a character can cast | — |
| ability_unlocks | Ability unlocks | 3 | abilities_skills | 2 | implied | orchestrator | core/progression/unlocks.gd | §6.2 unlocked_by | Spells granted by level, quest or item, mirroring the recipe unlock pattern | — |
| skill_ranks | Skill ranks | 3 | abilities_skills | — | candidate | director | data/spells/ | — | Numbered ranks of the same spell with growing magnitude | — |
| weapon_skills | Weapon skills | 3 | abilities_skills | — | candidate | director | core/progression/ | — | Proficiency that grows by using a weapon type | — |
| class_resources | Class resources | 2 | character | 1 | spec | orchestrator | core/stats/resources.gd | §6.3 cost | Health, mana, stamina pools and their regeneration; other pools are candidates | Fuel gauges: different engines burn different fuel |
| health_pool | Health pool | 3 | class_resources | 1 | spec | orchestrator | core/stats/resources.gd | §6.3 cost.resource | Current and max health; the pool death watches | — |
| mana_pool | Mana pool | 3 | class_resources | 2 | spec | orchestrator | core/stats/resources.gd | §6.3 cost.resource | Current and max mana for casters | — |
| stamina_pool | Stamina pool | 3 | class_resources | 1 | spec | orchestrator | core/stats/resources.gd | §6.3, §3 survival | Shared by sprinting, dodging, melee and survival drain | — |
| resource_regen | Resource regeneration | 3 | class_resources | 2 | implied | orchestrator | core/stats/resources.gd | — | Per-tick regen rules with in-combat and resting modifiers | — |
| inventory | Inventory | 2 | character | 2 | spec | orchestrator | core/inventory/ | §5 item_*, §6.1 | Bags, stacks, weight, pickup and drop; the source of item events | The backpack and its pockets |
| bag_slots | Bag slots | 3 | inventory | 2 | implied | orchestrator | core/inventory/bags.gd | §6.1 | Slot grid with capacity; expandable by items | — |
| stacking_rules | Stacking rules | 3 | inventory | 2 | spec | orchestrator | core/inventory/stacks.gd | §6.1 stack_size | Merge and split by stack_size | — |
| weight_encumbrance | Weight & encumbrance | 3 | inventory | 2 | spec | orchestrator | core/inventory/weight.gd | §6.1 weight | Total kg carried and the movement penalty past a limit | — |
| item_pickup_drop | Pickup & drop | 3 | inventory | 2 | implied | orchestrator | core/inventory/pickup.gd | §5 item_acquired | World items enter and leave inventories; emits item_acquired | — |
| container_storage | Container access | 3 | inventory | 3 | implied | orchestrator | core/inventory/containers.gd | §13 Phase 3 | Opening chests and moving items between an inventory and a container | — |
| bank_storage | Bank storage | 3 | inventory | — | candidate | director | core/inventory/ | — | Account-wide or town storage; likely just shared chests in co-op | — |
| loot_bags_on_death | Loot bags on death | 3 | inventory | — | candidate | director | core/inventory/deathbag.gd | §1 hardcore-leaning | Dropping some or all items on death for a corpse run; a DIRECTOR stakes decision | — |
| equipment | Equipment & gear | 2 | character | 1 | spec | orchestrator | core/inventory/equipment.gd | §6.1 slot, §1 gear tiers | Equip slots, gear stat application, tiers and comparison | The wardrobe with labeled hooks |
| equip_slots | Equip slots | 3 | equipment | 1 | spec | orchestrator | core/inventory/equipment.gd | §6.1 slot | head, chest, legs, hands, feet, main_hand, off_hand, trinket | — |
| gear_stats_application | Gear stat application | 3 | equipment | 1 | implied | orchestrator | core/inventory/equipment.gd | §6.1 stats | Equipped item stats feed the modifier stack | — |
| gear_tiers | Gear tiers | 3 | equipment | 2 | spec | content-smith | docs/balance_ranges.md; data/items/ | §1 gear tiers | Progression bands of gear power tied to rarity and biome | — |
| weapon_types | Weapon types | 3 | equipment | 1 | implied | orchestrator | data/items/; core/combat/melee/ | §13 Phase 1 one weapon | Sword, axe, bow and so on as tags that select attack behavior | — |
| durability_repair | Durability | 3 | equipment | — | candidate | director | core/inventory/equipment.gd | — | Gear wears with use and needs repair; a survival-genre staple absent from the spec | — |
| transmog | Transmog | 3 | equipment | — | candidate | director | core/inventory/ | — | Cosmetic appearance override per slot | — |
| set_bonuses | Set bonuses | 3 | equipment | — | candidate | content-smith | data/items/ | — | Bonuses for wearing several pieces of a set | — |
| character_identity | Character identity & lifecycle | 2 | character | 1 | implied | orchestrator | core/saving/; actors/player/ | §10 | Creation, appearance, death and respawn, and the saved character record | Your ID card and your medical record |
| character_creation | Character creation | 3 | character_identity | 1 | implied | orchestrator | ui/creation/; core/state/ | — | Name and starting choices; a class picker only if classes are approved | — |
| respawn_rules | Death & respawn rules | 3 | character_identity | 1 | implied | orchestrator | core/state/respawn.gd | §1 hardcore-leaning | Where and when a dead player returns, and what it costs | — |
| character_save_state | Character save state | 3 | character_identity | 3 | spec | orchestrator | core/saving/character.gd | §10 | The per-character record: ids plus state for inventory, equipment, progression, position | — |
| appearance_customization | Appearance customization | 3 | character_identity | — | candidate | world-builder | actors/player/; art/ | — | Body, face, hair and color choices on the player rig | — |
| multiple_characters_per_world | Multiple characters per world | 3 | character_identity | — | candidate | director | core/saving/ | — | More than one character record per player per world | — |
| additional_class_resources | Further class resources | 3 | class_resources | — | candidate | director | core/stats/resources.gd | — | Energy, rage, focus, divinity and corruption as further pools; each is a §6.3 cost enum value and one DIRECTOR decision | — |
| revive_downed_state | Downed & revive | 3 | character_identity | — | candidate | director | core/combat/downed.gd | — | A downed state that allies can revive before death; the hardcore-stakes question alongside loot_bags_on_death | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| locomotion | reads | physics_collision | collision layers, slopes | hard | Movement is resolved against terrain and prop collision |
| locomotion | reads | intent_dispatch | move intent | hard | Movement applies queued move intents on the tick (§12) |
| locomotion | reads | fixed_tick_sim | tick | hard | Position advances per tick so replays and servers agree |
| locomotion | reads | weight_encumbrance | speed penalty | soft | Carrying too much slows movement |
| interaction_system | reads | intent_schema | interact intent | hard | One interact intent covers pickup, talk, harvest and use |
| interaction_system | reads | actor_registry | target ids | hard | The nearest interactable is resolved by id, not node path |
| character_capsule | reads | game_infra_spec | §11 units | hard | 1 unit = 1 m and the 1.8 m capsule are contract values |
| swimming | reads | water_bodies | water volumes | hard | There is no swimming without water |
| swimming | reads | stamina_pool | drain | hard | Swimming drains stamina; drowning follows |
| climbing | reads | terrain_meshes_heightmap | climbable surfaces | soft | Climbing needs surfaces tagged as climbable |
| dodge_roll | reads | stamina_pool | cost | hard | Dodging spends stamina |
| dodge_roll | reads | hit_detection | i-frames | hard | The roll must be understood by hit detection to grant invulnerability frames |
| derived_stats | reads | gear_stats_application | equipped stats | hard | Gear is the main source of stats |
| derived_stats | reads | stat_modifiers_stack | modifiers | soft | Effects, talents and buffs enter through the stack once effects exist in Phase 2 |
| derived_stats | reads | level_scaling | base stats by level | soft | Level sets the base once progression exists in Phase 2; Phase 1 uses fixed base stats |
| derived_stats | reads | stat_formulas | formulas | hard | Every derived number comes out of a pure formula |
| derived_stats | reads | primary_attributes | attribute roots | soft | If attributes are approved, derived stats grow from them |
| stat_modifiers_stack | reads | effect_kinds_verbs | stat_mod effects | hard | A stat_mod effect pushes a signed modifier for its duration |
| resistances | reads | damage_types_elements | element enum | hard | One resistance value per element the damage model knows |
| stat_formulas | reads | balance_ranges | curve constants | soft | Formula constants are documented as balance ranges |
| level_scaling | reads | level_curve | current level | hard | Scaling is a function of level |
| primary_attributes | reads | class_defs | attribute weights | soft | Classes would weight attributes differently |
| xp_award | reads | enemy_defs | EnemyDef.xp | hard | Kill XP comes from the enemy definition |
| xp_award | reads | quest_defs | QuestDef.rewards.xp | hard | Quest XP comes from the quest definition |
| xp_award | reads | actor_registry | killer_id | hard | XP is credited to the actor named in the event |
| level_curve | reads | xp_award | accumulated xp | hard | Levels are thresholds on XP |
| level_curve | reads | balance_ranges | curve | soft | The curve constants are balance data |
| level_up_rewards | reads | level_curve | new level | hard | Rewards are granted when the level changes |
| achievements | reads | world_state_flags | counters | hard | Achievements are predicates over flags and counters |
| achievements | reads | schema_achievement_def | definition | hard | Achievements would be data like everything else |
| titles | reads | achievements | unlock source | hard | Titles are earned from achievements |
| prestige | reads | level_curve | cap | hard | Prestige begins at the level cap |
| class_defs | reads | schema_class_def | definition | hard | Classes would be data like everything else |
| role_specs | reads | class_defs | parent class | hard | A spec belongs to a class |
| role_specs | reads | roles | tank, healer, dps, support kits | hard | Specs are built from the role kits combat defines |
| class_starting_kit | references | items | item ids | hard | Starting gear must exist as items |
| class_starting_kit | references | spell_defs_content | spell ids | hard | Starting spells must exist as spells |
| multiclass_rules | reads | class_defs | class list | hard | Mixing rules are defined over the classes |
| talent_trees | reads | schema_talent_def | definition | hard | Talents would be data |
| talent_trees | reads | class_defs | tree per class | soft | Trees are usually per class if classes exist |
| talent_points | reads | level_curve | points per level | hard | Points are granted by level |
| respec | reads | talent_points | refund | hard | Respec refunds points |
| respec | reads | wallet | cost | soft | A respec cost needs a currency |
| talent_modifiers | reads | stat_modifiers_stack | modifiers | hard | Talents enter stats through the stack |
| talent_modifiers | reads | spell_defs_content | field overrides | soft | Some talents change spell fields such as cooldown or magnitude |
| spellbook | references | spell_defs_content | spell ids | hard | A spellbook is a list of spell ids |
| spellbook | reads | data_registry_loader | id lookup | hard | Spell ids resolve through the registry |
| ability_unlocks | reads | spellbook | grants | hard | Unlocks add ids to the spellbook |
| ability_unlocks | reads | level_curve | level thresholds | hard | Most unlocks are by level |
| ability_unlocks | references | quest_defs | quest-taught spells | soft | Some spells are taught by quests, mirroring unlocked_by |
| skill_ranks | reads | spellbook | rank per spell | hard | Ranks are stored against known spells |
| weapon_skills | reads | weapon_types | proficiency per type | hard | Proficiency is tracked per weapon type |
| health_pool | reads | derived_stats | max health | hard | Max health is a derived stat |
| mana_pool | reads | derived_stats | max mana | hard | Max mana is a derived stat |
| stamina_pool | reads | derived_stats | max stamina | hard | Max stamina is a derived stat |
| resource_regen | reads | timers_cooldowns | regen ticks | hard | Regen advances on ticks |
| resource_regen | reads | health_pool | regen target | hard | Health regenerates |
| resource_regen | reads | mana_pool | regen target | hard | Mana regenerates |
| resource_regen | reads | stamina_pool | regen target | hard | Stamina regenerates |
| bag_slots | reads | items | ItemDef | hard | Slots hold item ids and counts |
| stacking_rules | reads | items | ItemDef.stack_size | hard | Stack limits come from the item definition |
| weight_encumbrance | reads | items | ItemDef.weight | hard | Weight totals come from item definitions |
| item_pickup_drop | reads | intent_schema | pickup and drop intents | hard | Pickup is an intent like any other action |
| item_pickup_drop | reads | actor_registry | actor ids | hard | Items move between actors named by id |
| container_storage | reads | chests_containers | container inventories | hard | Opening a chest reads its container inventory |
| bank_storage | reads | container_storage | shared container | hard | A bank is a container with special access rules |
| loot_bags_on_death | reads | corpse_handling | corpse location | hard | The bag sits where the corpse is |
| loot_bags_on_death | reads | respawn_rules | penalty rules | hard | What drops is a death-penalty rule |
| equip_slots | reads | items | ItemDef.slot | hard | An item equips only to its declared slot |
| gear_stats_application | reads | item_stats_block | ItemDef.stats | hard | Stats on equipped items become modifiers |
| gear_stats_application | reads | equip_slots | equipped set | hard | Only equipped items count |
| gear_tiers | reads | rarity_tiers | rarity | soft | Tiers usually track rarity |
| gear_tiers | reads | item_levels | item level | soft | If item levels are approved, tiers are bands of them |
| weapon_types | reads | item_categories_tags | tags | hard | Weapon type is a tag on the item |
| durability_repair | reads | damage_model | wear on hit | soft | Durability drops on hits taken and dealt |
| durability_repair | reads | repair | repair action | hard | Worn gear is restored by the repair action |
| transmog | reads | equip_slots | appearance override | hard | Overrides are per slot |
| set_bonuses | reads | equip_slots | equipped set | hard | Bonuses count equipped set pieces |
| character_creation | reads | class_defs | class choice | soft | A class picker only if classes are approved |
| character_creation | reads | appearance_customization | appearance choice | soft | Appearance choices only if customization is approved |
| appearance_customization | reads | rigs_skeletons | player rig | hard | Customization is a set of rig and material variants |
| respawn_rules | reads | bed_spawn_point | spawn location | soft | A claimed bed is the respawn point once beds exist in Phase 3; until then the hub is the only respawn |
| respawn_rules | reads | spawn_hubs | fallback location | hard | Without a bed, the world's default spawn is used |
| respawn_rules | reads | loot_bags_on_death | penalty | soft | If loot bags are approved, respawn applies the drop |
| character_save_state | reads | state_serialization | serializer | hard | The record is written by the state serializer |
| character_save_state | persists | inventory | bags and stacks | hard | Inventory is part of the character record |
| character_save_state | persists | equipment | equipped ids | hard | Equipment is part of the character record |
| character_save_state | persists | progression | xp, level, unlocks | hard | Progression is part of the character record |
| character_save_state | persists | class_resources | current pools | hard | Current health, mana and stamina are saved |
| multiple_characters_per_world | reads | character_save_state | record per character | hard | Multiple records per player per world |
| additional_class_resources | extends | mana_pool | — | soft | Each further pool follows the mana pattern: a max, a current and a regen rule |
| additional_class_resources | reads | schema_spell_def | — | hard | The cost.resource enum must grow before a spell can cost a new resource |
| item_pickup_drop | reads | loot_rolls_on_death | dropped stacks | hard | Rolled drops become pickups at the corpse |
| equip_slots | reads | equipment_items | slot != none | hard | Only items with a slot other than none equip |
| item_pickup_drop | reads | interaction_system | interact target id | hard | Pickup is an interact on a dropped item |
| character_save_state | persists | quests | quest state | hard | Started, completed and objective progress per character |
| character_save_state | persists | needs | — | hard | Hunger and the other needs are saved per character |
| character_save_state | persists | abilities_skills | spellbook | hard | Known spells are saved per character |
| character_save_state | persists | recipe_unlocks | — | hard | Known recipes are saved per character |
| xp_award | reads | party_membership | — | soft | Kill XP is shared with the party |
| item_pickup_drop | reads | stacking_rules | — | hard | Pickups merge into existing stacks |
| revive_downed_state | reads | death_resolution | — | hard | Downed sits between zero health and death |
| revive_downed_state | extends | respawn_rules | — | soft | Revive is an alternative to respawning |
| equip_slots | reads | bag_slots | source and destination slot | soft | Equipping moves an item between a bag slot and an equipment slot; in Phase 1 the one weapon is pre-equipped, bags arrive in Phase 2 |
