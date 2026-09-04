# Encounters — the set-piece scenes: bosses, dungeons, raids, world events

> **Analogy:** the final exam of a biome (a boss), the haunted house with rooms that unlock in order (a dungeon), the whole team on the field for the championship (a raid), and the surprise fire drill (a world event).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| encounters | Encounters | 1 | — | 2 | spec | orchestrator | core/encounters/; data/encounters/; scenes/dungeons/ | §1 boss gates | Boss fights, dungeons, raids and world events | The set-piece scenes of the play |
| boss_encounters | Boss encounters | 2 | encounters | 2 | spec | orchestrator/content-smith | core/encounters/; data/encounters/ | §1 boss gates | Data-defined fights with phases and mechanics; beating one opens a gate | The final exam of a biome |
| encounter_defs | Encounter definitions | 3 | boss_encounters | 2 | implied | content-smith | data/encounters/ | §1 | Boss enemy, phases, mechanics list, arena, gate flag | — |
| boss_phases | Boss phases | 3 | boss_encounters | 2 | implied | orchestrator | core/encounters/phases.gd | — | Health-percent or timer transitions; emits boss_phase_changed | — |
| boss_mechanics_library | Boss mechanics library | 3 | boss_encounters | 2 | implied | orchestrator | core/encounters/mechanics/ | — | Reusable verbs: telegraph, add wave, enrage, stack, spread, interrupt, tank swap | A deck of mechanic cards any boss can draw from |
| telegraph_decals | Telegraphs | 3 | boss_encounters | 2 | implied | orchestrator | core/encounters/mechanics/telegraph.gd | §6.3 aoe_radius_m | Danger shapes announced before an AoE lands | — |
| boss_gates_progression | Boss gates | 3 | boss_encounters | 2 | spec | orchestrator | core/encounters/gates.gd | §1 boss gates | A defeated boss sets a world flag that unlocks the next region | — |
| boss_arena_rules | Boss arena rules | 3 | boss_encounters | 2 | implied | world-builder | scenes/arenas/ | — | Arena bounds, entry conditions, reset on wipe | — |
| raid_bosses | Raid bosses | 3 | boss_encounters | 4 | implied | orchestrator | core/encounters/ | §1 2–10 players | Bosses tuned for the whole server | — |
| enrage_timers | Enrage timers | 3 | boss_encounters | — | candidate | director | core/encounters/mechanics/ | — | Soft or hard enrage after a time limit | — |
| world_bosses | World bosses | 3 | boss_encounters | — | candidate | director | core/encounters/ | — | Roaming open-world bosses | — |
| dungeons | Dungeons | 2 | encounters | 2 | implied | world-builder | scenes/dungeons/; data/dungeons/ | §7.2 world-builder | Built places with scripted doors, traps, puzzles and a boss at the end | The haunted house with rooms that unlock in order |
| dungeon_layouts | Dungeon layouts | 3 | dungeons | 2 | implied | world-builder | scenes/dungeons/ | — | Hand-built dungeon scenes | — |
| dungeon_scripting | Dungeon scripting | 3 | dungeons | 3 | implied | orchestrator | core/encounters/dungeon.gd | §6.8 conditions | Doors, traps and puzzles driven by conditions and flags | — |
| keys_gates | Keys and gates | 3 | dungeons | 2 | implied | orchestrator | core/encounters/gates.gd | — | Key items and boss flags that open doors | — |
| difficulty_tiers | Difficulty tiers | 3 | dungeons | — | candidate | director | data/dungeons/ | — | Scaled versions of the same dungeon | — |
| instancing | Instancing | 3 | dungeons | — | candidate | director | core/net/ | — | Private copies per group versus one shared world; a Phase 4 architecture decision | — |
| procedural_dungeons | Procedural dungeons | 3 | dungeons | — | candidate | director | core/world/gen/ | — | Layouts generated from room pieces and a seed | — |
| raids | Raids | 2 | encounters | 4 | implied | orchestrator | core/encounters/raid.gd | §1 2–10 players | Encounters sized for the whole server | The whole team on the field for the championship |
| raid_size_scaling | Raid size scaling | 3 | raids | 4 | implied | orchestrator | core/encounters/raid.gd | — | Health and mechanics scale with player count | — |
| raid_roles_check | Raid roles check | 3 | raids | 4 | implied | orchestrator | core/encounters/raid.gd | — | Warns when the group lacks a role | — |
| raid_lockouts | Raid lockouts | 3 | raids | — | candidate | director | core/encounters/raid.gd | — | Weekly resets on rewards | — |
| world_events | World events | 2 | encounters | — | candidate | director | core/events_world/ | — | Invasions and timed events that change the world for a while | The surprise fire drill |
| invasion_events | Invasion events | 3 | world_events | — | candidate | director | core/events_world/invasion.gd | — | Waves that attack a player base | — |
| event_scheduler | Event scheduler | 3 | world_events | — | candidate | orchestrator | core/events_world/schedule.gd | — | Clock-driven, seeded event timing | — |
| dynamic_events_ai_director | Director-driven events | 3 | world_events | — | candidate | orchestrator | core/ai/director.gd | — | Events fired by the AI director's pacing | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| encounter_defs | reads | schema_encounter_def | EncounterDef | hard | Encounters need a schema |
| encounter_defs | references | enemy_defs | boss enemy id | hard | The boss is an enemy |
| encounter_defs | references | boss_arena_rules | arena id | soft | An encounter names its arena |
| boss_phases | reads | encounter_defs | phase list | hard | Phases are defined in the encounter |
| boss_phases | reads | health_pool | health percent | hard | Most transitions trigger on health |
| boss_phases | reads | fixed_tick_sim | timer phases | hard | Timer transitions count ticks |
| boss_mechanics_library | reads | casting | boss spells | hard | Mechanics fire spells through the casting verbs |
| boss_mechanics_library | reads | status_effects | applied debuffs | hard | Mechanics apply effects |
| boss_mechanics_library | reads | spawning | add waves | hard | Add waves are spawns |
| boss_mechanics_library | reads | threat_table | tank swap | hard | Tank swaps manipulate threat |
| boss_mechanics_library | reads | condition_grammar | trigger conditions | soft | Mechanic triggers can be conditions |
| telegraph_decals | reads | ground_aoe_delivery | radius and point | hard | A telegraph shows the AoE that is coming |
| telegraph_decals | reads | timers_cooldowns | warning time | hard | The warning is a timer |
| boss_gates_progression | reads | world_state_flags | gate flags | hard | A gate is a flag set on victory |
| boss_gates_progression | reads | encounter_defs | gate flag name | hard | The encounter names the flag it sets |
| boss_arena_rules | reads | zone_triggers | arena bounds | hard | The arena is a zone |
| boss_arena_rules | reads | leashing_evade | reset on leave | hard | Leaving the arena resets the boss |
| raid_bosses | extends | boss_encounters | server-scale variant | hard | A raid boss is a boss encounter with raid scaling |
| raid_bosses | reads | raid_size_scaling | scaling | hard | Numbers scale with players |
| enrage_timers | reads | boss_phases | timer phase | hard | Enrage is a timed phase |
| world_bosses | extends | boss_encounters | roaming variant | hard | A world boss is a boss without an arena |
| world_bosses | reads | spawn_rules_biome_phase | spawn rules | hard | World bosses spawn by rule |
| dungeon_layouts | reads | terrain_biomes | biome context | soft | Dungeons belong to a biome |
| dungeon_layouts | reads | navmesh_baking | navigation | hard | Enemies must navigate the dungeon |
| dungeon_layouts | reads | import_hook | meshes | hard | Dungeon geometry passes through the import hook |
| dungeon_scripting | reads | condition_evaluator | conditions | hard | Doors and traps evaluate conditions |
| dungeon_scripting | reads | world_state_flags | flags | hard | Puzzle state is flags |
| keys_gates | references | items | key item ids | hard | Keys are items |
| keys_gates | reads | boss_gates_progression | boss flags | hard | Some doors open on a boss flag |
| difficulty_tiers | reads | enemy_stats_scaling | tier multipliers | hard | Tiers scale enemy stats |
| instancing | reads | net_architecture | server model | hard | Instancing is a server-side architecture choice |
| instancing | reads | state_serialization | per-instance state | hard | Each instance has its own state |
| procedural_dungeons | reads | deterministic_sim | seeded layout | hard | Generated layouts are seeded |
| procedural_dungeons | reads | dungeon_layouts | room pieces | hard | Generation assembles authored pieces |
| raid_size_scaling | reads | player_slots_cap | player count | hard | Scaling reads the live player count |
| raid_size_scaling | reads | enemy_stats_scaling | multipliers | hard | Scaling reuses the stat bands |
| raid_roles_check | reads | party_roles | roles present | soft | The check reads party roles if they exist |
| raid_lockouts | reads | world_state_flags | lockout flags | hard | A lockout is a flag |
| raid_lockouts | reads | world_clock_ticks | reset time | hard | Lockouts reset on the clock |
| invasion_events | reads | spawning | waves | hard | Waves are spawns |
| invasion_events | reads | event_scheduler | timing | hard | Invasions are scheduled |
| invasion_events | reads | structures | target base | soft | Invasions target player structures |
| event_scheduler | reads | world_clock_ticks | clock | hard | Events are timed on the clock |
| event_scheduler | reads | deterministic_sim | seeded timing | hard | Event timing is seeded |
| dynamic_events_ai_director | reads | ai_director | pacing | hard | The director decides when to fire |
