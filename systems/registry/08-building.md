# Building — pieces that snap, some of which hold weight

> **Analogy:** LEGO on a grid. The snap-to-grid ruler (placement), the furniture catalog (structures), from a cabin to a castle to a village of cabins (homes and strongholds), who has keys to which doors (ownership), and the property registry (persistence).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| building | Building | 1 | — | 3 | spec | orchestrator | core/building/; data/building/; scenes/prefabs/ | §13 Phase 3 build, §10 placed structures | Placement, structures, homes and strongholds, ownership, persistence | LEGO on a grid: pieces snap, some hold weight |
| placement | Placement | 2 | building | 3 | spec | orchestrator | core/building/placement.gd | §13 Phase 3 | Snapping, validation, preview and material cost; emits structure_placed | The snap-to-grid ruler |
| piece_defs | Building piece definitions | 3 | placement | 3 | implied | content-smith | data/building/ | — | Walls, floors, roofs, doors and stairs as data with cost, sockets and health | — |
| snap_grid_rules | Snap and socket rules | 3 | placement | 3 | implied | orchestrator | core/building/snap.gd | — | Grid size and which sockets connect | — |
| placement_validation | Placement validation | 3 | placement | 3 | implied | orchestrator | core/building/validate.gd | — | Overlap, terrain, permission and cost checks | — |
| build_preview_ghost | Build preview | 3 | placement | 3 | implied | orchestrator | ui/build/; scenes/ | §4 R5 | The translucent preview; presentation only | — |
| structural_integrity | Structural integrity | 3 | placement | — | candidate | director | core/building/integrity.gd | — | Support propagation that makes unsupported builds collapse | — |
| terrain_modification | Terrain modification | 3 | placement | — | candidate | director | core/building/terrain.gd | — | Flattening and digging | — |
| structures | Structures | 2 | building | 3 | spec | orchestrator/content-smith | data/building/; core/building/ | §6.2 station, §10 | Stations, storage, beds, walls, decorations and farm plots as placeable pieces | The furniture catalog |
| crafting_station_structures | Crafting station structures | 3 | structures | 3 | spec | content-smith | data/building/ | §6.2 station | Workbench, forge and campfire as placeable pieces; the campfire also gives warmth and light and hosts cooking recipes | — |
| storage_structures | Storage structures | 3 | structures | 3 | implied | content-smith | data/building/ | — | Chests and racks | — |
| bed_respawn_structure | Bed | 3 | structures | 3 | implied | content-smith | data/building/ | — | The claimable bed | — |
| defensive_structures_walls | Walls and defenses | 3 | structures | 3 | implied | content-smith | data/building/ | — | Walls, gates and palisades | — |
| decorations | Decorations | 3 | structures | — | candidate | content-smith | data/building/ | — | Cosmetic pieces | — |
| farm_plots | Farm plots and pens | 3 | structures | — | candidate | director | data/building/ | — | Plots and pens for farming and animals | — |
| homes_strongholds | Homes, strongholds & player cities | 2 | building | — | candidate | director | core/building/ | — | Designated homes, fortifications, sieges, player towns and settlers | From a cabin to a castle to a village of cabins |
| player_home | Player home | 3 | homes_strongholds | — | candidate | director | core/building/home.gd | — | A designated home with bonuses | — |
| stronghold_walls_gates | Stronghold walls and gates | 3 | homes_strongholds | — | candidate | director | core/building/ | — | Fortifications with gates and towers | — |
| base_defense_sieges | Base defense and sieges | 3 | homes_strongholds | — | candidate | director | core/building/siege.gd | — | Invasions target the base and structures take damage | — |
| player_cities | Player cities | 3 | homes_strongholds | — | candidate | director | core/building/ | — | Many homes forming a settlement | — |
| npc_settlers | NPC settlers | 3 | homes_strongholds | — | candidate | director | core/building/ | — | NPCs that move into player towns | — |
| ownership_permissions | Ownership & permissions | 2 | building | 4 | implied | orchestrator | core/building/permissions.gd | §1 co-op | Who may build, open and destroy | Who has keys to which doors |
| build_permissions | Build permissions | 3 | ownership_permissions | 4 | implied | orchestrator | core/building/permissions.gd | — | Party-based build and destroy rights | — |
| land_claims | Land claims | 3 | ownership_permissions | — | candidate | director | core/building/claims.gd | — | Claimed areas with exclusive rights | — |
| decay_inactive | Decay | 3 | ownership_permissions | — | candidate | director | core/building/decay.gd | — | Abandoned builds decay over game time | — |
| structure_persistence | Structure persistence | 2 | building | 3 | spec | orchestrator | core/saving/structures.gd | §10 placed structures | Placed pieces and their state saved with the world | The property registry |
| placed_structure_state | Placed structure state | 3 | structure_persistence | 3 | spec | orchestrator | core/saving/structures.gd | §10 | Piece id, transform, owner and health per placed piece | — |
| structure_damage_repair | Structure damage and repair | 3 | structure_persistence | — | candidate | director | core/building/damage.gd | — | Structures take damage and can be repaired; emits structure_destroyed | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| piece_defs | reads | schema_building_piece_def | BuildingPieceDef | hard | Pieces need a schema |
| piece_defs | references | items | material cost | hard | A piece names the items it costs |
| piece_defs | reads | import_hook | piece meshes | hard | Piece meshes pass through the import hook |
| snap_grid_rules | reads | piece_defs | sockets | hard | Sockets are defined per piece |
| placement_validation | reads | collision_layers | overlap test | hard | Overlap is a physics query |
| placement_validation | reads | terrain_meshes_heightmap | ground test | hard | Pieces must sit on terrain or other pieces |
| placement_validation | reads | build_permissions | may build here | soft | Permission checks arrive with multiplayer |
| placement_validation | reads | inventory | material cost | hard | Placing consumes materials |
| placement | reads | intent_schema | build intent | hard | Placing is an intent |
| placement | reads | snap_grid_rules | snapped transform | hard | The final transform is snapped |
| placement | reads | placement_validation | allowed | hard | Placement happens only when validation passes |
| build_preview_ghost | renders | placement_validation | valid or invalid | hard | The ghost shows the validation result |
| build_preview_ghost | reads | sim_presentation_split | presentation only | hard | The ghost never writes state (R5) |
| structural_integrity | reads | piece_defs | support values | hard | Support strength is a piece field |
| structural_integrity | reads | placed_structure_state | support graph | hard | Integrity walks the placed pieces |
| terrain_modification | reads | terrain_meshes_heightmap | edits | hard | Modification edits terrain |
| terrain_modification | reads | navmesh_baking | rebake | hard | Changed terrain rebakes navigation |
| crafting_station_structures | extends | piece_defs | station piece | hard | A station is a piece with a station id |
| storage_structures | extends | piece_defs | storage piece | hard | A chest is a piece with a container |
| bed_respawn_structure | extends | piece_defs | bed piece | hard | A bed is a piece with a claim |
| defensive_structures_walls | extends | piece_defs | wall piece | hard | A wall is a piece with health |
| decorations | extends | piece_defs | cosmetic piece | hard | A decoration is a piece with no function |
| farm_plots | extends | piece_defs | plot piece | hard | A plot is a piece that grows things |
| player_home | reads | structures | pieces | hard | A home is a set of structures |
| player_home | reads | bed_respawn_structure | home bed | hard | A home has a bed |
| stronghold_walls_gates | extends | defensive_structures_walls | fortification | hard | Fortifications are walls with gates and towers |
| stronghold_walls_gates | reads | structural_integrity | tall walls | soft | Towers want integrity rules |
| base_defense_sieges | reads | invasion_events | attackers | hard | A siege is an invasion aimed at a base |
| base_defense_sieges | reads | structure_damage_repair | damage | hard | Sieges damage structures |
| player_cities | extends | player_home | many homes | hard | A city is many homes |
| player_cities | reads | land_claims | city bounds | soft | Cities want claims |
| npc_settlers | reads | npc_defs | settlers | hard | Settlers are NPCs |
| npc_settlers | reads | player_cities | where they live | hard | Settlers move into cities |
| build_permissions | reads | party_membership | party rights | hard | Rights follow the party |
| land_claims | reads | build_permissions | claim rights | hard | A claim is a permission area |
| land_claims | reads | zone_triggers | claim bounds | soft | A claim is a zone |
| decay_inactive | reads | world_clock_ticks | time since visit | hard | Decay counts game time |
| decay_inactive | reads | placed_structure_state | pieces to decay | hard | Decay walks the placed pieces |
| placed_structure_state | reads | state_serialization | serializer | hard | Placed pieces are saved by the serializer |
| placed_structure_state | reads | piece_defs | piece ids | hard | The record stores piece ids plus state, never defs |
| structure_damage_repair | reads | placed_structure_state | health | hard | Damage edits the piece's health |
| structure_damage_repair | reads | damage_model | damage numbers | soft | Structure damage reuses the damage formula |
| structure_damage_repair | reads | repair | repair action | soft | Repair restores structure health |
| build_permissions | reads | actor_registry | — | hard | Ownership is by actor id |
| crafting_station_structures | references | station_defs | station id | hard | A station piece names the station it provides |
