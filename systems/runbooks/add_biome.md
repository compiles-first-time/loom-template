# rb_add_biome — Add a biome or zone

## Runbook

| Field | Value |
|---|---|
| Trigger | The world needs a new biome: terrain look, palette, spawn set, gather nodes, zones, ambience. |
| Primary | terrain_biomes |
| Roles | world-builder; content-smith; orchestrator |
| Director | BiomeDef is implied, not in §6 (data/biomes/ exists in §3 with no schema) — the first biome def needs a spec PR. Procedural generation, weather, roads and temperature are candidates. |
| Spec | §3 data/biomes, §6.5 biomes, §11 palette, §13 Phase 1 gray-box island |
| Not touched | enemy_families: a new biome gets an enemy family when its first enemy is added (rb_add_enemy step 10); placement_validation: pieces validate against terrain collision generically, there is no per-biome rule; procedural_terrain: candidate; world_generation: candidate — biomes are hand-placed scenes until decided; roads: candidate; terrain_modification: candidate; weather: candidate; fishing: candidate — needs water rules first; boats_ships: candidate; drowning: follows the swim volumes of step 17, no per-biome data; biome_hazard_zones: candidate; temperature_exposure: candidate |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | decide | — | GAME_INFRA_SPEC.md §6 | BiomeDef section exists or this PR adds it | Skip once it is in the spec. |
| 2 | check | schema_biome_def | core/schemas/biome_def.gd | class matches the §6 section | — |
| 3 | create | terrain_biomes | scenes/world/<biome>.tscn | terrain mesh at 1 unit = 1 m, trimesh collision from the import hook | — |
| 4 | check | art_bible_palette | docs/art_bible.md | the biome's colors come from the 8-base palette and its ramps | Cohesion is the style lock. |
| 5 | create | terrain_biomes | data/_inbox/<id>.json | `biome_<name>`: display_name, palette, spawn set, node set, hazards, ambience | — |
| 6 | run | json_to_tres_converter | data/biomes/<id>.tres | converter writes the .tres | — |
| 7 | update | spawn_rules_biome_phase | data/biomes/<id>.tres | which enemies spawn here and at which day phases | — |
| 8 | update | enemy_defs | data/enemies/<enemy>.tres | every enemy that lives here lists the biome in EnemyDef.biomes | An enemy no biome names never spawns. |
| 9 | update | spawn_points_zones | scenes/world/<biome>.tscn | spawn zones placed and assigned to the biome | — |
| 10 | update | resource_nodes | scenes/world/<biome>.tscn | gather nodes placed with their yield tables | — |
| 11 | update | markers_waypoints | scenes/world/<biome>.tscn | travel and quest markers placed and named | — |
| 12 | update | zone_triggers | scenes/zones/<biome>_*.tscn | zone volumes named by biome and region; zone_entered fires on entry | — |
| 13 | check | navigation | scenes/world/<biome>.tscn | the navmesh bakes and covers walkable ground | — |
| 14 | check | fog_atmosphere | data/biomes/<id>.tres | fog settings set for the biome | — |
| 15 | check | lighting_day_night | scenes/world/<biome>.tscn | day_phase_changed drives the biome's lighting rig | — |
| 16 | check | ambience_zones | audio/ambience/ | an ambience zone covers the biome | — |
| 17 | check | swimming | scenes/world/<biome>.tscn | water bodies carry swim volumes, or the biome has none | Only when the biome has water. |
| 18 | check | map_minimap | scenes/world/<biome>.tscn | the map region for the biome is drawn from its terrain | — |
| 19 | check | enemy_stats_scaling | docs/balance_ranges.md | the biome's tier band is recorded | — |
| 20 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 21 | run | g3_smoke_boot | scenes/main.tscn | the biome loads headless, zero ERROR lines | — |
| 22 | run | g4_bot_playtest | tools/testing/ | the bot walks the biome and never falls through the floor | From Phase 1. |
| 23 | run | g5_vision_review | tools/testing/screenshots | screenshot set reviewed against the art bible | Advisory. |
| 24 | update | changelog | docs/changelog.md | one line | — |
