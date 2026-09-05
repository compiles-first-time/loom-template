# Survival — food, warmth, rest, and the night that comes whether you are ready or not

> **Analogy:** a camping trip. Gauges for the body (needs), the sun's schedule pinned on the wall (day/night), the forest that regrows on its own clock (gathering), the danger signs on the trail (hazards), and the campsite (camp and rest).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| survival | Survival | 1 | — | 3 | spec | orchestrator | core/survival/ | §3 survival, §13 Phase 3 | Needs, the day/night clock, gathering, hazards, camp and rest | A camping trip |
| needs | Needs | 2 | survival | 3 | spec | orchestrator | core/survival/needs.gd | §3 hunger, stamina | Hunger and stamina in the spec; thirst, temperature, rest and sickness as candidates | The fuel and rest gauges of a body |
| hunger | Hunger | 3 | needs | 3 | spec | orchestrator | core/survival/needs.gd | §3 | Drains per tick, restored by food, punishes at thresholds | — |
| stamina_drain_regen | Stamina drain & regen | 3 | needs | 3 | spec | orchestrator | core/survival/needs.gd | §3, §6.3 | Sprint, swim and heavy actions drain the shared stamina pool | — |
| consumables_apply | Consumable application | 3 | needs | 3 | spec | orchestrator | core/survival/consume.gd | §5 item_consumed, §6.1 on_use_effect | Using food or a potion removes the item, applies its effect, emits item_consumed | — |
| need_thresholds_effects | Need thresholds | 3 | needs | 3 | implied | orchestrator | core/survival/thresholds.gd | §6.4 stat_mod | Starving or freezing crosses a threshold that should apply a debuff via the bus, not a call | — |
| thirst | Thirst | 3 | needs | — | candidate | director | core/survival/needs.gd | — | A second consumable-driven gauge | — |
| temperature_exposure | Temperature & exposure | 3 | needs | — | candidate | director | core/survival/exposure.gd | — | Cold and heat by biome, weather, fire and clothing | — |
| rest_sleep | Rest & sleep | 3 | needs | — | candidate | director | core/survival/needs.gd | — | A fatigue gauge restored in beds | — |
| disease_sanity | Disease / sanity | 3 | needs | — | candidate | director | core/survival/ | — | Long-tail afflictions; probably never | — |
| day_night_cycle | Day / night cycle | 2 | survival | 3 | spec | orchestrator | core/survival/day_night.gd | §3 day/night, §5 day_phase_changed | The world clock and its four phases; night is when the world gets dangerous | The sun's schedule pinned on the wall |
| world_clock_ticks | World clock | 3 | day_night_cycle | 3 | spec | orchestrator | core/survival/day_night.gd | §5 | Tick-driven clock, saved with the world; emits day_phase_changed | — |
| phase_transitions | Phase transitions | 3 | day_night_cycle | 3 | spec | orchestrator | core/survival/day_night.gd | §5 | dawn, day, dusk, night thresholds on the clock | — |
| night_danger_scaling | Night danger scaling | 3 | day_night_cycle | 3 | implied | orchestrator | core/survival/day_night.gd | §6.5 day_phases | What night changes: spawn sets and enemy stats | — |
| time_skip_sleep | Sleep to skip time | 3 | day_night_cycle | — | candidate | director | core/survival/day_night.gd | — | Sleeping in a bed advances the clock; needs a party vote in multiplayer | — |
| gathering | Gathering & resource nodes | 2 | survival | 3 | spec | orchestrator/world-builder | core/survival/gather.gd; scenes/prefabs/nodes/ | §13 Phase 3 gather | Trees, rocks and plants that yield materials and regrow | Picking berries and chopping trees; the forest regrows on its own schedule |
| resource_nodes | Resource nodes | 3 | gathering | 3 | implied | orchestrator/world-builder | scenes/prefabs/nodes/ | §13 | Harvestable world objects with a yield table and a respawn timer | — |
| gather_tools_tiers | Gather tool tiers | 3 | gathering | 3 | implied | content-smith | data/items/ | §6.1 tags | Axe and pickaxe tiers gating which nodes can be harvested | — |
| node_respawn | Node respawn | 3 | gathering | 3 | implied | orchestrator | core/survival/gather.gd | — | Depleted nodes return after a timer, saved with the world | — |
| harvest_yield_tables | Harvest yield tables | 3 | gathering | 3 | implied | content-smith | data/loot_tables/ | §6.6 | Node yields reuse loot tables | — |
| fishing | Fishing | 3 | gathering | — | candidate | director | core/survival/ | — | A timing minigame over water | — |
| farming | Farming | 3 | gathering | — | candidate | director | core/survival/farm.gd | — | Planted crops that grow with the clock | — |
| animal_husbandry | Animal husbandry | 3 | gathering | — | candidate | director | core/survival/ | — | Taming and breeding animals | — |
| hazards | Environmental hazards | 2 | survival | 3 | implied | orchestrator | core/survival/hazards.gd | §1 hostile biomes | Falling, drowning, hazardous zones and fire | The danger signs on a hiking trail |
| fall_damage | Fall damage | 3 | hazards | 3 | implied | orchestrator | core/survival/hazards.gd | — | Damage from fall height; a second emitter of actor_damaged | — |
| drowning | Drowning | 3 | hazards | — | candidate | orchestrator | core/survival/hazards.gd | — | Damage once submerged stamina runs out | — |
| biome_hazard_zones | Biome hazard zones | 3 | hazards | — | candidate | world-builder | scenes/; data/biomes/ | — | Poison, cold or dark zones inside a biome | — |
| fire_burning_env | Environmental fire | 3 | hazards | — | candidate | orchestrator | core/survival/hazards.gd | — | Standing in fire applies the burning effect | — |
| camp_rest | Camp & rest | 2 | survival | 3 | implied | orchestrator | core/survival/; data/building/ | §13 Phase 3 | Fire, bed and cooking: the loop that makes survival a home | The campsite: fire, bed, cooking pot |
| bed_spawn_point | Bed as spawn point | 3 | camp_rest | 3 | implied | orchestrator | core/survival/bed.gd | — | Claiming a bed sets the player's respawn location | — |
| rested_bonus | Rested bonus | 3 | camp_rest | — | candidate | director | core/survival/ | — | A buff for resting near fire and bed | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| hunger | reads | fixed_tick_sim | drain per tick | hard | Hunger drains on ticks |
| hunger | reads | consumables_apply | food restores | hard | Eating is how hunger goes back up |
| hunger | reads | balance_ranges | drain rate | soft | Drain rates are balance data |
| stamina_drain_regen | reads | stamina_pool | shared pool | hard | Survival stamina is the same pool combat spends |
| stamina_drain_regen | reads | locomotion | sprint state | hard | Sprinting drains stamina |
| consumables_apply | reads | consumables | ItemDef.on_use_effect | hard | The item names the effect to apply |
| consumables_apply | reads | intent_schema | use-item intent | hard | Using an item is an intent |
| consumables_apply | reads | inventory | remove one | hard | The consumed item leaves the inventory |
| consumables_apply | reads | effect_defs_content | effect id | hard | The effect applied must exist |
| need_thresholds_effects | reads | hunger | thresholds | hard | Thresholds are read off the hunger gauge |
| need_thresholds_effects | reads | temperature_exposure | thresholds | soft | If exposure is approved it feeds the same threshold logic |
| need_thresholds_effects | reads | effect_defs_content | starving, freezing effect ids | hard | The debuffs to request must exist as effects |
| thirst | extends | hunger | second gauge | hard | Thirst is the hunger pattern with different consumables |
| temperature_exposure | reads | biome_defs | climate | hard | Biomes carry a base temperature |
| temperature_exposure | reads | equipment | warmth stats | soft | Clothing would carry warmth |
| rest_sleep | reads | bed_spawn_point | rest in bed | hard | Sleep happens in a bed |
| disease_sanity | extends | need_thresholds_effects | affliction thresholds | soft | Afflictions are threshold effects with their own gauges |
| world_clock_ticks | reads | fixed_tick_sim | tick | hard | The clock counts ticks |
| world_clock_ticks | reads | state_serialization | saved time | hard | The time of day is saved and restored |
| phase_transitions | reads | world_clock_ticks | time of day | hard | Phases are thresholds on the clock |
| phase_transitions | reads | balance_ranges | day length | soft | Day and night lengths are tunable |
| night_danger_scaling | reads | phase_transitions | current phase | hard | Night scaling applies in the night phase |
| night_danger_scaling | reads | enemy_stats_scaling | night multiplier | soft | Night can scale enemy stats |
| time_skip_sleep | reads | bed_spawn_point | in bed | hard | Skipping time requires a bed |
| time_skip_sleep | reads | world_clock_ticks | advance | hard | Sleeping advances the clock |
| time_skip_sleep | reads | party_membership | everyone sleeping | soft | In multiplayer the whole party must agree |
| resource_nodes | reads | biome_defs | node placement per biome | hard | Which nodes appear where is biome data |
| resource_nodes | reads | harvest_yield_tables | yield | hard | Harvesting rolls the node's yield table |
| resource_nodes | reads | intent_schema | gather intent | hard | Harvesting is an intent |
| resource_nodes | reads | gather_tools_tiers | required tool | hard | A node can require a tool tier |
| gather_tools_tiers | references | items | tool tags | hard | Tools are items tagged with a tier |
| gather_tools_tiers | reads | equip_slots | equipped tool | hard | The equipped tool decides what can be gathered |
| node_respawn | reads | timers_cooldowns | respawn timer | hard | Regrowth is a timer |
| node_respawn | reads | state_serialization | depleted set | hard | Depleted nodes are saved so they do not reset on load |
| harvest_yield_tables | references | loot_table_defs | table ids | hard | Yields reuse loot tables |
| harvest_yield_tables | reads | deterministic_sim | seeded roll | hard | Yield rolls on the seeded RNG |
| fishing | reads | water_bodies | fishable water | hard | Fishing needs water |
| fishing | reads | deterministic_sim | seeded catch roll | hard | Catches roll on the seeded RNG |
| farming | reads | farm_plots | plot structures | hard | Crops grow in placed plots |
| farming | reads | world_clock_ticks | growth over days | hard | Growth advances with the clock |
| animal_husbandry | reads | farm_plots | pens | hard | Animals live in placed pens |
| animal_husbandry | reads | spawning | tamed actors | soft | Tamed animals are spawned actors with an owner |
| fall_damage | reads | locomotion | fall height | hard | Fall height comes from the movement state |
| fall_damage | reads | health_pool | apply damage | hard | Fall damage writes to the health pool |
| fall_damage | reads | balance_ranges | height curve | soft | The damage curve is balance data |
| drowning | reads | water_bodies | submerged | hard | Drowning needs water |
| drowning | reads | stamina_pool | breath as stamina | hard | Breath drains the stamina pool |
| biome_hazard_zones | reads | biome_defs | zone definitions | hard | Hazard zones are part of biome data |
| biome_hazard_zones | reads | zone_triggers | enter and exit | hard | Zones are entered through the zone trigger system |
| fire_burning_env | reads | effect_defs_content | burning effect | hard | Standing in fire applies the burning effect |
| bed_spawn_point | reads | bed_respawn_structure | placed bed | hard | A claimable bed is a placed structure |
| bed_spawn_point | reads | state_serialization | claimed bed id | hard | The claim is saved |
| rested_bonus | reads | bed_spawn_point | near bed | hard | The bonus applies near a claimed bed |
| rested_bonus | reads | effect_defs_content | rested effect | hard | The bonus is a status effect |
| temperature_exposure | reads | crafting_station_structures | — | soft | A campfire (a station piece) is a heat source |
| resource_nodes | reads | interaction_system | interact target id | hard | Harvesting is an interact on a node |
