# rb_add_building_piece — Add a placeable building piece (station, storage, bed, wall, decoration)

## Runbook

| Field | Value |
|---|---|
| Trigger | Phase 3: players need a new thing to place. A piece is a def (cost, snap points, footprint), a prefab, and a saved placed-structure record. |
| Primary | piece_defs |
| Roles | content-smith; world-builder; orchestrator |
| Director | BuildingPieceDef is implied, not in §6 — the first piece needs a spec PR adding it. `structure_placed` / `structure_destroyed` are proposed signals awaiting a §5 row. Strongholds, sieges and structure damage are candidates. |
| Spec | §3 scenes/, §6 (missing section), §10 saves store ids + state, §13 Phase 3 build |
| Not touched | decorations: a decoration is a piece with no function, steps 1–10 are the whole procedure; farm_plots: growth data is a farming change, only when the piece is a plot; structure_damage_repair: candidate; base_defense_sieges: candidate; stronghold_walls_gates: candidate |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | decide | — | GAME_INFRA_SPEC.md §6 | BuildingPieceDef section exists or this PR adds it | Skip once it is in the spec. |
| 2 | check | schema_building_piece_def | core/schemas/building_piece_def.gd | class matches the §6 section: id, display_name, scene, cost[], snap points, footprint, category | — |
| 3 | check | items | data/items/ | every cost[].item_id exists | Missing material: `rb_add_material`. |
| 4 | create | actor_prefabs_scenes | scenes/prefabs/building/<id>.tscn | prefab with collision, snap markers and the interaction trigger for stations/storage/beds | — |
| 5 | create | model_naming | art/models/building/<id>.glb | filename equals the id; the import hook applies scale, collision and the master material | Door openings ≥ 2.2 m (§11). |
| 6 | create | piece_defs | data/_inbox/<id>.json | `piece_<name>`: scene, cost, snap points, footprint, category | — |
| 7 | run | json_to_tres_converter | data/building/<id>.tres | converter writes the .tres | — |
| 8 | check | snap_grid_rules | data/building/<id>.tres | the piece's sockets match the socket types other pieces expose | — |
| 9 | check | structural_integrity | data/building/<id>.tres | support strength set; the piece stands or needs support as intended | — |
| 10 | check | placement_validation | core/building/placement.gd | footprint and snap points validate against terrain and other pieces; material cost is charged from inventory | No code change unless the piece introduces a new snap type. |
| 11 | check | placed_structure_state | core/building/state.gd | the placed record stores piece id + transform + owner + state (§10: ids + state, never the def) | — |
| 12 | check | structure_persistence | core/saving/structures.gd | placing, saving, loading and destroying the piece round-trips | — |
| 13 | check | crafting_station_structures | data/recipes/ | a station piece registers its station id so recipes can name it | Stations only. |
| 14 | check | storage_structures | core/inventory/containers.gd | a storage piece has a container inventory that saves | Storage only. |
| 15 | check | bed_respawn_structure | core/survival/camp/bed.gd | a bed claims a spawn point | Beds only. |
| 16 | check | defensive_structures_walls | data/building/<id>.tres | a wall carries health and snaps to other walls | Walls only. |
| 17 | check | ui_screens | ui/building/ | the piece appears in its build-palette category with cost shown | No code change. |
| 18 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 19 | run | gm_console | core/debug/console.gd | `give` the materials, place the piece, save, load, destroy | — |
| 20 | run | g3_smoke_boot | scenes/main.tscn | boots, zero ERROR lines | — |
| 21 | update | changelog | docs/changelog.md | one line | — |
