# rb_add_npc — Add a friendly NPC (NpcDef + actor prefab)

## Runbook

| Field | Value |
|---|---|
| Trigger | A quest giver or story character is needed. Vendors, trainers, settlers and daily routines are candidates and need a decision first. |
| Primary | npc_defs |
| Roles | quest-writer; world-builder; orchestrator |
| Director | NpcDef is implied, not in §6 — the first NPC needs a spec PR adding §6.x NpcDef (scene, display_name, role, dialogue, quests). Roles beyond quest giver are candidates. |
| Spec | §6.7 giver_npc, §6.8 speaker, §3 actors/, §11 |
| Not touched | trainers: candidate; npc_vendors_stores: candidate; npc_schedules_routines: candidate; barks_ambient_lines: candidate; npc_settlers: candidate; villages_settlements: placing the NPC in a settlement is a village change; objective_types: a talk quest naming this NPC is a quest change (rb_add_quest) |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | decide | — | GAME_INFRA_SPEC.md §6 | NpcDef schema section exists or this PR adds it | DIRECTOR approves the schema (§14). Skip once it is in the spec. |
| 2 | check | schema_npc_def | core/schemas/npc_def.gd | the class matches the §6 section | `rb_change_schema` if a field is missing. |
| 3 | create | actor_prefabs_scenes | actors/npcs/<id>.tscn | prefab with interaction trigger, nameplate anchor, idle animation | — |
| 4 | create | model_naming | art/models/npcs/<id>.glb | filename equals the id; passes the import hook and the art bible palette | Placeholder allowed. |
| 5 | create | dialogue_nodes_choices | data/dialogue/<dialogue_id>.tres | the NPC's greeting tree exists (`rb_add_dialogue`) | — |
| 6 | create | npc_defs | data/_inbox/<id>.json | `npc_<name>`: scene, display_name, role, dialogue, quests[] | — |
| 7 | run | json_to_tres_converter | data/npcs/<id>.tres | converter writes the .tres | — |
| 8 | update | spawn_points_zones | scenes/<zone>.tscn | the NPC is placed (or spawned) where the design says | World-builder scope. |
| 9 | update | quest_defs | data/quests/<quest>.tres | quests this NPC gives name it as giver_npc (`rb_add_quest`) | — |
| 10 | check | quest_givers | data/npcs/<id>.tres | the NPC's quest list matches the quests that name it | — |
| 11 | check | lore_voice_check | docs/lore_bible.md | name follows the naming conventions; role fits the lore | — |
| 12 | run | g2_data_integrity | tools/validate_data.gd | passes | — |
| 13 | run | g3_smoke_boot | scenes/main.tscn | boots with the NPC placed; zero ERROR lines; interaction opens the dialogue | — |
| 14 | update | changelog | docs/changelog.md | one line | — |
