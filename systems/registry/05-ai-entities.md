# Entities & AI — the cast of the play and the brains that move them

> **Analogy:** the monster manual (enemy definitions), the stage manager sending actors on at their cue (spawning), each actor's script and instincts (AI brain), the townsfolk with jobs (NPCs), and the birth and death certificates every creature carries (actor lifecycle).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| ai_entities | Entities & AI | 1 | — | 1 | spec | orchestrator | actors/; core/ai/; core/spawn/; data/enemies/; data/npcs/ | §6.5 | Enemies, spawning, AI brains, friendly NPCs, actor lifecycle | The cast of the play and the brains that move them |
| enemies | Enemies | 2 | ai_entities | 0 | spec | content-smith | data/enemies/ | §6.5 | EnemyDef content: stats, behavior, loot, biomes, families, abilities | Monster manual pages |
| enemy_defs | Enemy definitions | 3 | enemies | 0 | spec | content-smith | data/enemies/ | §6.5 | One .tres per enemy: scene, health, damage, armor, move_speed, behavior, loot_table, xp, biomes, day_phases | — |
| enemy_stats_scaling | Enemy stat scaling | 3 | enemies | 2 | implied | director/content-smith | data/enemies/; docs/balance_ranges.md | §6.5 | Stat bands by biome tier, night and player count | — |
| enemy_families | Enemy families | 3 | enemies | 1 | implied | content-smith | data/enemies/ | §6.5 biomes | Groups per biome that share art, sounds and behavior | — |
| enemy_abilities | Enemy abilities | 3 | enemies | — | candidate | content-smith | data/enemies/; data/spells/ | §6.3 | Enemies casting SpellDefs; needs an abilities field on §6.5 EnemyDef (spec PR) before it exists | — |
| enemy_factions_hostility | Enemy factions | 3 | enemies | — | candidate | director | data/enemies/ | — | Which enemies fight each other and which ignore players | — |
| elite_rare_variants | Elite and rare variants | 3 | enemies | — | candidate | content-smith | data/enemies/ | — | Named or elite versions with better loot | — |
| spawning | Spawn system | 2 | ai_entities | 1 | spec | orchestrator/world-builder | core/spawn/; scenes/ | §5 actor_spawned, §6.5 biomes and day_phases | Where, when and how many actors appear; emits actor_spawned | The stage manager sending actors on at their cue |
| spawn_points_zones | Spawn points and zones | 3 | spawning | 1 | implied | world-builder | scenes/spawns/ | — | Placed spawn markers and zone volumes | — |
| spawn_rules_biome_phase | Spawn rules by biome and phase | 3 | spawning | 2 | spec | orchestrator | core/spawn/rules.gd | §6.5 biomes, day_phases | Which enemies may spawn where and at which clock phase | — |
| spawn_density_caps | Density caps | 3 | spawning | 2 | implied | orchestrator | core/spawn/density.gd | — | Population limits per zone; the AI director nudges them | — |
| respawn_timers | Respawn timers | 3 | spawning | 2 | implied | orchestrator | core/spawn/respawn.gd | — | Killed spawns return after a timer | — |
| despawn_cleanup | Despawn and cleanup | 3 | spawning | 2 | implied | orchestrator | core/spawn/cleanup.gd | — | Far or stale actors are removed to protect the budget | — |
| pack_spawning | Pack spawning | 3 | spawning | 2 | spec | orchestrator | core/spawn/pack.gd | §6.5 behavior pack | Packs spawn and move together | — |
| ai_brain | AI brain | 2 | ai_entities | 1 | spec | orchestrator | core/ai/ | §6.5 behavior | The behavior verbs plus the senses, movement and targeting under them | The actor's script and instincts |
| behavior_verbs | Behavior verbs | 3 | ai_brain | 1 | spec | orchestrator | core/ai/behaviors/ | §6.5 behavior | passive, territorial, aggressive, pack; each is a verb in core/ | — |
| perception | Perception | 3 | ai_brain | 1 | implied | orchestrator | core/ai/perception.gd | — | Aggro radius, line of sight, reaction to damage and casts | — |
| pathfinding_navmesh | Pathfinding | 3 | ai_brain | 1 | implied | orchestrator | core/ai/path.gd | — | Navigation queries on the baked navmesh | — |
| steering_locomotion | Steering and locomotion | 3 | ai_brain | 1 | implied | orchestrator | core/ai/steer.gd | §6.5 move_speed | Movement along the path on the tick at the enemy's speed | — |
| target_selection | Target selection | 3 | ai_brain | 1 | implied | orchestrator | core/ai/target.gd | — | Picks a target from threat and perception | — |
| leashing_evade | Leashing and evade | 3 | ai_brain | 2 | implied | orchestrator | core/ai/leash.gd | — | Returns home and resets when dragged too far | — |
| ai_director | AI director | 3 | ai_brain | 2 | implied | orchestrator | core/ai/director.gd | §5 listeners | Paces spawns and pressure against the party; dynamic events would be its candidate extension | The dungeon master adjusting the difficulty dial |
| behavior_trees_utility | Behavior trees / utility AI | 3 | ai_brain | — | candidate | orchestrator | core/ai/ | — | A data-driven decision layer beneath the four verbs | — |
| group_tactics | Group tactics | 3 | ai_brain | — | candidate | orchestrator | core/ai/tactics.gd | — | Flanking, focus fire, retreat for packs | — |
| llm_npc_intelligence | LLM-enhanced NPC intelligence | 3 | ai_brain | — | candidate | director | tools/ai/; core/dialogue/ | §4 R4, §9 | Model-driven NPC talk or planning; must run outside the fixed tick because it is nondeterministic | A dungeon master on the radio who never touches the dice |
| npcs | Friendly NPCs | 2 | ai_entities | 3 | spec | quest-writer/orchestrator | actors/npc/; data/npcs/ | §6.7 giver_npc, §6.8 | Characters with jobs: quest givers now, vendors and trainers if approved | The townsfolk with jobs |
| npc_defs | NPC definitions | 3 | npcs | 3 | implied | quest-writer | data/npcs/ | §6.7 | Scene, name, role and dialogue per NPC | — |
| quest_givers | Quest givers | 3 | npcs | 3 | spec | quest-writer | data/npcs/; data/quests/ | §6.7 giver_npc | NPCs that offer and complete quests | — |
| trainers | Trainers | 3 | npcs | — | candidate | director | data/npcs/ | — | NPCs that teach spells or recipes | — |
| npc_schedules_routines | Schedules and routines | 3 | npcs | — | candidate | director | core/ai/schedule.gd | — | Daily routines by clock phase | — |
| companions_pets | Companions and pets | 3 | npcs | — | candidate | director | core/ai/companion.gd | — | Player-owned followers with their own brain | — |
| actor_lifecycle | Actor lifecycle | 2 | ai_entities | 1 | spec | orchestrator | core/state/actors.gd; actors/ | §5, §12 | Ids, prefabs, corpses and the sync hooks every actor shares | Birth and death certificates for every creature |
| actor_prefabs_scenes | Actor prefabs | 3 | actor_lifecycle | 0 | spec | world-builder | actors/enemies/; actors/npcs/ | §6.5 scene | The .tscn per enemy and NPC referenced by EnemyDef.scene; Phase 0 ships one stub capsule so the sample enemy passes G2 | — |
| corpse_handling | Corpse handling | 3 | actor_lifecycle | 2 | implied | orchestrator | core/state/corpse.gd | — | A corpse replaces the actor, holds loot, is cleaned up later | — |
| actor_state_sync_hooks | Actor state sync hooks | 3 | actor_lifecycle | 4 | implied | orchestrator | core/net/ | §12 | Serializable actor state ready for replication | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| enemy_defs | reads | schema_enemy_def | EnemyDef | hard | Every enemy file must match the schema |
| enemy_defs | references | actor_prefabs_scenes | EnemyDef.scene | hard | The enemy names its prefab |
| enemy_defs | references | loot_table_defs | EnemyDef.loot_table | hard | The enemy names its loot table |
| enemy_defs | references | biome_defs | EnemyDef.biomes | hard | The enemy names the biomes it spawns in |
| enemy_defs | reads | balance_ranges | stat ranges | soft | Enemy numbers are anchored to balance ranges |
| enemy_stats_scaling | reads | level_scaling | shared curves | hard | Enemies scale on the same curve family as players |
| enemy_stats_scaling | reads | balance_ranges | bands | hard | Scaling bands are balance data |
| enemy_families | reads | biome_defs | family per biome | hard | Families are grouped by biome |
| enemy_abilities | references | spell_defs_content | spell ids | hard | Enemy abilities are spells |
| enemy_abilities | reads | casting | same casting system | hard | Enemies cast through the same verbs as players |
| enemy_factions_hostility | reads | faction_defs | faction ids | soft | If factions are approved, enemies belong to them |
| elite_rare_variants | extends | enemy_defs | variant of a base enemy | hard | A variant is a base enemy with overrides |
| elite_rare_variants | references | loot_table_defs | better table | hard | Variants name a richer table |
| spawn_points_zones | reads | biome_defs | zone biome | hard | A spawn zone belongs to a biome |
| spawn_points_zones | reads | navmesh_baking | valid ground | soft | Spawns are placed on navigable ground |
| spawn_rules_biome_phase | reads | enemy_defs | EnemyDef.biomes, day_phases | hard | The rules read what each enemy allows |
| spawn_rules_biome_phase | reads | spawn_points_zones | candidate points | hard | Rules pick from placed points |
| spawn_rules_biome_phase | reads | deterministic_sim | seeded choice | hard | Which enemy spawns is a seeded roll |
| spawn_density_caps | reads | spawn_points_zones | per-zone caps | hard | Caps are per zone |
| spawn_density_caps | reads | ai_director | pressure dial | soft | The director raises or lowers caps |
| respawn_timers | reads | timers_cooldowns | tick timers | hard | Respawn is a timer |
| despawn_cleanup | reads | actor_registry | distance and age | hard | Cleanup walks the registry |
| pack_spawning | reads | enemy_defs | behavior pack | hard | Pack enemies spawn as groups |
| behavior_verbs | reads | enemy_defs | EnemyDef.behavior | hard | The enemy names its verb |
| behavior_verbs | reads | fixed_tick_sim | think on tick | hard | AI decides on the tick so replays agree |
| behavior_verbs | reads | perception | senses | hard | Verbs act on what the actor perceives |
| behavior_verbs | reads | target_selection | current target | hard | Aggressive verbs need a target |
| perception | reads | collision_layers | LoS raycasts | hard | Line of sight is a physics query |
| perception | reads | actor_registry | nearby actors | hard | Perception scans actors by id |
| pathfinding_navmesh | reads | navmesh_baking | navigation regions | hard | Paths are found on the baked mesh |
| steering_locomotion | reads | pathfinding_navmesh | path points | hard | Steering follows the path |
| steering_locomotion | reads | physics_collision | collision | hard | Enemies collide with the world |
| steering_locomotion | reads | enemy_defs | EnemyDef.move_speed | hard | Speed is an enemy field |
| target_selection | reads | threat_table | highest threat | soft | Aggressive enemies attack the top of their threat table once it exists in Phase 2; Phase 1 targets the nearest perceived hostile |
| target_selection | reads | perception | visible actors | hard | Only perceived actors can be targeted |
| leashing_evade | reads | spawn_points_zones | home position | hard | The leash is measured from home |
| ai_director | reads | party_membership | player count | soft | Pressure scales with players present |
| ai_director | reads | deterministic_sim | seeded decisions | hard | Director choices are seeded |
| behavior_trees_utility | extends | behavior_verbs | decision layer | hard | Trees refine the verbs, they do not replace them |
| group_tactics | reads | pack_spawning | pack membership | hard | Tactics apply within a pack |
| group_tactics | reads | target_selection | focus target | hard | Focus fire shares a target |
| llm_npc_intelligence | reads | deterministic_sim | outside the tick only | hard | Model output is nondeterministic; it may feed dialogue or planning, never the simulation tick (R4) |
| llm_npc_intelligence | reads | dialogue | generated lines | soft | The most plausible use is dialogue variation |
| llm_npc_intelligence | reads | env_secrets | API key | hard | Any model call needs a key from the environment (R-SEC1) |
| llm_npc_intelligence | gated_by | dependency_policy_r10 | new external service | hard | A model API is a new dependency and needs a spec change |
| npc_defs | reads | schema_npc_def | NpcDef | hard | NPCs need a schema |
| npc_defs | references | actor_prefabs_scenes | scene | hard | The NPC names its prefab |
| npc_defs | references | dialogue_nodes_choices | dialogue id | hard | The NPC names its dialogue |
| quest_givers | references | quest_defs | quest ids | hard | A giver names the quests it offers |
| quest_givers | reads | npc_defs | giver npc | hard | A giver is an NPC |
| trainers | reads | ability_unlocks | teach spell | hard | Training is an unlock source |
| trainers | reads | recipe_unlocks | teach recipe | hard | Training is an unlock source |
| npc_schedules_routines | reads | world_clock_ticks | phase | hard | Routines follow the clock |
| npc_schedules_routines | reads | pathfinding_navmesh | walk between spots | hard | Routines move NPCs |
| companions_pets | reads | behavior_verbs | follower verb | hard | A companion is an actor with a follow verb |
| companions_pets | reads | party_membership | owner | soft | Ownership follows the party |
| actor_prefabs_scenes | reads | character_capsule | proportions | soft | Actors share the 1 m scale and door clearance |
| corpse_handling | reads | despawn_cleanup | cleanup | hard | Corpses are removed by cleanup |
| actor_state_sync_hooks | reads | state_serialization | serializable state | hard | Sync hooks expose the same state the save uses |
| actor_state_sync_hooks | reads | replication | replication api | hard | Hooks are consumed by replication |
| enemy_factions_hostility | reads | reputation_tiers | — | hard | Hostility toward a player follows their standing |
| enemy_factions_hostility | reads | perception | — | hard | Hostile factions attack on sight |
| spawning | reads | actor_registry | — | hard | A spawned actor is registered by id |
| corpse_handling | reads | actor_registry | — | hard | A corpse keeps the dead actor's id |
| behavior_verbs | reads | schema_enemy_def | behavior enum | hard | Every behavior enum value is a verb here (R1) |
| actor_prefabs_scenes | reads | enemy_families | — | soft | Prefabs in a family share a rig and sounds |
| actor_prefabs_scenes | reads | import_hook | — | soft | Real prefabs pass the import hook from Phase 1; the Phase 0 stub capsule does not |
| actor_prefabs_scenes | reads | rigs_skeletons | rig + AnimationTree | soft | Real prefabs carry a rig and an AnimationTree from Phase 1; the Phase 0 stub capsule has none |
| ai_brain | reads | client_server_roles | server-only tick | soft | AI thinks only on the server from Phase 4; until then the local authority runs it |
