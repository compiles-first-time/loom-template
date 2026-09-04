# World — the stage everything happens on

> **Analogy:** the painted backdrop and floor (terrain and biomes), rolling a new board versus a fixed board (world generation), the mood lighting and weather machine (environment), roads and signposts (travel), the towns on the map (places), the laws of physics on the set (physics), and the sidewalks the AI may walk on (navigation).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| world | World | 1 | — | 1 | spec | world-builder | scenes/; data/biomes/; core/world/ | §1, §3, §11 | Terrain and biomes, generation, environment, travel, places, physics, navigation | The stage everything happens on |
| terrain_biomes | Terrain & biomes | 2 | world | 1 | spec | world-builder | scenes/; data/biomes/ | §3 data/biomes, §11 | Biomes and the terrain, vegetation and water that make them | The painted backdrop and floor of the stage |
| biome_defs | Biome definitions | 3 | terrain_biomes | 1 | spec | world-builder | data/biomes/ | §3 | One def per biome: palette slice, climate, enemy families, node sets | — |
| terrain_meshes_heightmap | Terrain meshes | 3 | terrain_biomes | 1 | implied | world-builder | scenes/terrain/ | §11 | Terrain geometry with trimesh collision from the import hook | — |
| gray_box_island | Gray-box island | 3 | terrain_biomes | 1 | spec | world-builder | scenes/main.tscn | §13 Phase 1 | The Phase 1 island: blockout geometry to test feel | — |
| vegetation_placement | Vegetation placement | 3 | terrain_biomes | 1 | implied | world-builder | scenes/ | — | Trees and grass placed per biome | — |
| biome_palette_lighting | Biome palette & light rig | 3 | terrain_biomes | 1 | implied | world-builder | art/; scenes/env/ | §11 art bible | Each biome's palette slice and light rig | — |
| water_bodies | Water bodies | 3 | terrain_biomes | — | candidate | world-builder | scenes/ | — | Lakes, rivers and sea with swim and drown volumes | — |
| caves | Caves | 3 | terrain_biomes | — | candidate | world-builder | scenes/ | — | Underground spaces | — |
| world_generation | World generation | 2 | world | — | candidate | director | core/world/gen/ | — | Procedural terrain from a seed versus the hand-built world the spec starts with | Rolling a new board every game versus a fixed board |
| handmade_world | Hand-built world | 3 | world_generation | 1 | implied | world-builder | scenes/ | §13 Phase 1 | The current path: authored scenes | — |
| world_seed | World seed | 3 | world_generation | — | candidate | orchestrator | core/world/gen/seed.gd | §4 R4 | One seed drives all generation | — |
| procedural_terrain | Procedural terrain | 3 | world_generation | — | candidate | director | core/world/gen/terrain.gd | — | Noise-based terrain and biome placement | — |
| chunk_streaming | Chunk streaming | 3 | world_generation | — | candidate | orchestrator | core/world/gen/chunks.gd | — | Load and unload terrain around players | — |
| poi_placement | Point-of-interest placement | 3 | world_generation | — | candidate | orchestrator | core/world/gen/poi.gd | — | Placing dungeons, villages and landmarks by rule | — |
| resource_distribution | Resource distribution | 3 | world_generation | — | candidate | orchestrator | core/world/gen/resources.gd | — | Placing resource nodes by biome | — |
| environment | Environment | 2 | world | 1 | implied | world-builder | scenes/env/; core/world/ | §5 lighting listener | Lighting, fog, weather and seasons | The mood lighting and the weather machine |
| lighting_day_night | Day/night lighting | 3 | environment | 3 | spec | world-builder | scenes/env/ | §5 day_phase_changed | The light rig follows the clock phase | — |
| fog_atmosphere | Fog & atmosphere | 3 | environment | 1 | implied | world-builder | scenes/env/ | — | Fog and sky per biome | — |
| weather | Weather | 3 | environment | — | candidate | director | core/world/weather.gd | — | Rain, storms and snow with gameplay effects; emits weather_changed | — |
| seasons_calendar | Seasons & calendar | 3 | environment | — | candidate | director | core/world/calendar.gd | — | Long cycles layered over the clock | — |
| travel | Travel | 2 | world | 1 | implied | orchestrator | core/world/; scenes/ | §1 | Terrain rules, zones, markers, maps, and the candidate fast travel, roads, mounts, boats | Roads, signposts, and the bus schedule |
| movement_terrain_rules | Movement terrain rules | 3 | travel | 1 | implied | orchestrator | core/world/terrain_rules.gd | — | Slope limits, surface types, speed modifiers | — |
| zone_triggers | Zone triggers | 3 | travel | 2 | implied | world-builder | scenes/zones/ | §6.7 reach | Volumes that announce entry; emits zone_entered | — |
| markers_waypoints | Markers & waypoints | 3 | travel | 1 | spec | world-builder | scenes/markers/; data/markers/ | §6.7 reach | Named positions quests can target | — |
| map_minimap | Map data | 3 | travel | 2 | implied | orchestrator | core/world/map.gd | — | Discovered areas, markers and positions the map screens render | — |
| fast_travel_portals | Fast travel | 3 | travel | — | candidate | director | core/world/travel.gd | — | Portals or waypoints unlocked by discovery | — |
| roads | Roads | 3 | travel | — | candidate | world-builder | scenes/ | — | Paths that speed travel and guide players | — |
| mounts_travel | Mounted travel | 3 | travel | — | candidate | director | core/world/travel.gd | — | Riding for speed | — |
| boats_ships | Boats & ships | 3 | travel | — | candidate | director | core/world/vehicles.gd | — | Water travel | — |
| fog_of_war_discovery | Map discovery | 3 | travel | — | candidate | orchestrator | core/world/map.gd | — | The map reveals as explored | — |
| places | Places | 2 | world | 1 | implied | world-builder | scenes/; data/ | §7.2 world-builder | Villages, dungeon entrances, hubs, landmarks, and candidate cities | The towns and landmarks on the map |
| villages_settlements | Villages & settlements | 3 | places | 3 | implied | world-builder | scenes/villages/ | §7.2 | NPC settlements with quest givers | — |
| dungeon_entrances | Dungeon entrances | 3 | places | 2 | implied | world-builder | scenes/ | — | Where dungeons connect to the world | — |
| spawn_hubs | Spawn hubs | 3 | places | 1 | implied | world-builder | scenes/ | — | Default player spawn locations | — |
| landmarks_poi | Landmarks | 3 | places | 1 | implied | world-builder | scenes/ | — | Visual anchors for navigation | — |
| cities | Cities | 3 | places | — | candidate | director | scenes/cities/ | — | Large NPC cities beyond village scale | — |
| physics_collision | Physics & collision | 2 | world | 1 | spec | orchestrator | tools/import_post.gd; project.godot | §11 | Collision generation, layers and tick settings | The laws of physics on the set |
| collision_generation_import | Collision on import | 3 | physics_collision | 1 | spec | orchestrator | tools/import_post.gd | §11 | Convex for props, trimesh for terrain, generated automatically | — |
| collision_layers | Collision layers | 3 | physics_collision | 1 | implied | orchestrator | project.godot | — | Layer and mask conventions for actors, terrain, projectiles, triggers | — |
| physics_tick_settings | Physics tick settings | 3 | physics_collision | 1 | spec | orchestrator | project.godot | §4 R4 | The fixed physics rate the sim runs on | — |
| ragdoll | Ragdoll | 3 | physics_collision | — | candidate | world-builder | actors/ | — | Physics death poses; presentation only | — |
| destructibles | Destructibles | 3 | physics_collision | — | candidate | director | scenes/ | — | Breakable props | — |
| navigation | Navigation | 2 | world | 1 | implied | world-builder/orchestrator | scenes/ | — | Navmesh and links the AI walks on | The sidewalks the AI is allowed to walk on |
| navmesh_baking | Navmesh baking | 3 | navigation | 1 | implied | world-builder | scenes/ | — | Baked navigation regions, rebaked when geometry changes | — |
| nav_regions_links | Nav regions & links | 3 | navigation | 1 | implied | world-builder | scenes/ | — | Regions and links across gaps | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| biome_defs | reads | schema_biome_def | BiomeDef | hard | Biomes need a schema |
| biome_defs | reads | art_bible_palette | palette slice | hard | Each biome takes its colors from the art bible |
| terrain_meshes_heightmap | reads | collision_generation_import | trimesh | hard | Terrain collision is generated on import |
| terrain_meshes_heightmap | reads | import_hook | scale and material | hard | Terrain meshes pass through the import hook |
| gray_box_island | reads | terrain_meshes_heightmap | blockout | hard | The island is terrain |
| gray_box_island | reads | spawn_hubs | start point | hard | The island needs a spawn |
| vegetation_placement | reads | biome_defs | per-biome sets | hard | Vegetation is chosen per biome |
| vegetation_placement | reads | import_hook | meshes | hard | Plant meshes pass through the import hook |
| biome_palette_lighting | reads | art_bible_palette | palette | hard | Biome light rigs use art bible colors |
| biome_palette_lighting | reads | biome_defs | per-biome rig | hard | The rig is chosen per biome |
| water_bodies | reads | collision_layers | water volume layer | hard | Water volumes are a collision layer |
| caves | reads | terrain_meshes_heightmap | carved terrain | hard | Caves are terrain |
| caves | reads | navmesh_baking | navigation | hard | Enemies navigate caves |
| handmade_world | reads | terrain_meshes_heightmap | authored terrain | hard | The world is authored terrain scenes |
| world_seed | reads | deterministic_sim | seeded generation | hard | The seed is the root of deterministic generation |
| procedural_terrain | reads | world_seed | seed | hard | Terrain derives from the seed |
| procedural_terrain | reads | biome_defs | biome placement | hard | Generation places biomes |
| procedural_terrain | reads | terrain_meshes_heightmap | output format | hard | Generated terrain must be the same kind of terrain the authored world uses |
| chunk_streaming | reads | procedural_terrain | chunks | hard | Streaming loads generated chunks |
| chunk_streaming | reads | actor_registry | player positions | hard | Chunks load around players |
| poi_placement | reads | world_seed | seed | hard | Placement is seeded |
| poi_placement | reads | landmarks_poi | landmark set | hard | Placement chooses from authored landmarks |
| poi_placement | reads | dungeon_entrances | entrance set | hard | Placement positions dungeon entrances |
| resource_distribution | reads | world_seed | seed | hard | Distribution is seeded |
| resource_distribution | reads | resource_nodes | node prefabs | hard | Distribution places resource nodes |
| lighting_day_night | reads | biome_palette_lighting | rig | hard | The phase shifts the biome's rig |
| fog_atmosphere | reads | biome_defs | per-biome fog | hard | Fog settings are biome data |
| weather | reads | world_clock_ticks | time | hard | Weather changes over time |
| weather | reads | deterministic_sim | seeded transitions | hard | Weather rolls are seeded |
| weather | reads | biome_defs | climate | hard | Biomes constrain weather |
| seasons_calendar | reads | world_clock_ticks | days | hard | Seasons count days |
| movement_terrain_rules | reads | physics_collision | surfaces | hard | Rules read surface and slope from physics |
| movement_terrain_rules | reads | biome_defs | surface types | soft | Biomes can define surfaces |
| zone_triggers | reads | collision_layers | trigger layer | hard | Zones are trigger volumes |
| zone_triggers | reads | biome_defs | zone ids | hard | Zones are named by biome and region |
| markers_waypoints | reads | schema_marker_def | MarkerDef | hard | Markers need a schema |
| markers_waypoints | reads | state_serialization | discovered set | soft | Discovered markers are saved |
| map_minimap | reads | terrain_meshes_heightmap | map image | hard | The map is drawn from terrain |
| map_minimap | reads | markers_waypoints | pins | hard | The map shows markers |
| map_minimap | reads | actor_registry | positions | hard | The map shows player positions |
| fast_travel_portals | reads | world_state_flags | unlocked portals | hard | Portals unlock by flag |
| fast_travel_portals | reads | markers_waypoints | destinations | hard | Destinations are markers |
| roads | reads | terrain_meshes_heightmap | road mesh | hard | Roads are terrain features |
| roads | reads | navmesh_baking | preferred paths | hard | AI should prefer roads |
| roads | reads | movement_terrain_rules | speed bonus | hard | Roads are a surface type |
| mounts_travel | reads | mounts | mount actors | hard | Mounted travel needs mounts |
| mounts_travel | reads | locomotion | rider control | hard | Riding replaces walking |
| boats_ships | reads | water_bodies | water | hard | Boats need water |
| boats_ships | reads | physics_collision | buoyancy and collision | hard | Boats are physics bodies |
| fog_of_war_discovery | reads | map_minimap | revealed areas | hard | Discovery is map state |
| fog_of_war_discovery | reads | state_serialization | saved reveal | hard | Revealed areas are saved |
| villages_settlements | reads | npc_defs | residents | hard | A village is NPCs and their homes |
| villages_settlements | reads | navmesh_baking | walkable | hard | NPCs walk the village |
| dungeon_entrances | reads | dungeon_layouts | destination | hard | An entrance leads to a dungeon |
| dungeon_entrances | reads | zone_triggers | entry volume | hard | Entering is a zone trigger |
| spawn_hubs | reads | markers_waypoints | spawn marker | hard | A hub is a marker |
| landmarks_poi | reads | import_hook | meshes | hard | Landmark meshes pass through the import hook |
| cities | extends | villages_settlements | scale | hard | A city is a large settlement |
| cities | reads | npc_schedules_routines | living city | soft | Cities want routines to feel alive |
| collision_generation_import | extends | import_hook | collision step | hard | Collision generation is one step of the import hook |
| collision_layers | reads | project_settings | layer names | hard | Layers are project settings |
| physics_tick_settings | extends | project_settings | tick rate | hard | The tick rate is a project setting |
| ragdoll | reads | rigs_skeletons | rig | hard | Ragdolls are built on the rig |
| ragdoll | reads | sim_presentation_split | never affects sim | hard | A ragdoll is presentation; it must not move gameplay state (R5) |
| destructibles | reads | damage_model | damage taken | soft | Props take damage |
| destructibles | reads | structure_damage_repair | shared health model | soft | Props and structures share a damage model |
| navmesh_baking | reads | terrain_meshes_heightmap | walkable surfaces | hard | The navmesh is baked from terrain |
| navmesh_baking | reads | collision_generation_import | obstacles | hard | Collision shapes define obstacles |
| nav_regions_links | reads | navmesh_baking | regions | hard | Links connect baked regions |
