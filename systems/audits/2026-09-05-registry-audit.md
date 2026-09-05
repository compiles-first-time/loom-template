# Registry audit — 2026-09-05 (read-only), and what was done with it

> The record behind the registry changes in [ADR-0066](../../adr/0066-agent-ready-change-discipline.md). A read-only subagent audited `systems/registry/` against GAME_INFRA_SPEC.md and the Director's original list; every "no edge" claim was verified against the influence graph. The fixes were applied through the validated mutation API by [`2026-09-05-registry-surgery.mjs`](./2026-09-05-registry-surgery.mjs) (379 steps, 1 reverted by the validator because a runbook still named a node being merged — fixed and re-applied). Items marked **deferred** are the Director's, not the session's.

## Verdict (auditor's, verified)

Exhaustive against the Director's request: all 62 requested topics resolve to at least one node; every §6 noun has a `spec` P0 schema node and a `spec` P0 content node; 10 of 12 Phase 0 checklist items had nodes. Mostly efficient, but with ~25 near-duplicates, several padding clusters, and 231 nodes of degree ≤ 1 (most structural containers or candidates; ~35 spec/implied parts under-wired). The validator passed clean because its exemptions (`references`, `validates`, `renders`, `listens` excluded from phase and scope checks) hid the real problems.

## A — Coverage vs the Director's list

All 62 items covered. Eight proposed additions, **all applied**: `repo_layout` (spec P0, under `engine_platform`), `harness_adapters` (spec P0, under `agent_harness`), `local_authority_mode` (implied P1, under `command_intents`), `scene_transitions_loading` (implied P2, under `travel`), `revive_downed_state` (candidate, under `character_identity`), `content_version_handshake` (implied P4, under `sessions_players`), `db_backup_snapshots` (implied P4, under `server_database`), `station_defs` (implied P3, under `crafting`).

## B — Status corrections (applied)

- Seven signals were `candidate` while spec/implied systems emit or hard-listen to them → **`implied`**: `structure_placed`, `player_joined`, `player_left`, `level_up`, `boss_phase_changed`, `zone_entered`, `need_threshold_crossed`. `structure_destroyed` stays candidate (its emitter is a candidate); its phase was dropped.
- `raids`, `raid_bosses`, `raid_size_scaling`, `raid_roles_check` were `implied` via "§1 2–10 players", but §1 names boss gates only → **`candidate`**.
- `enemy_abilities` was `implied` but §6.5 EnemyDef has no abilities field → **`candidate`** (needs a spec PR).
- `schema_versioning` → Phase 0 (every P0 def carries `schema_version`); `id_listing_in_pr`, `icon_placeholder_fallback` → Phase 0 (the P0 sample-content PR needs both); `export_presets`, `quest_journal_screen` → `implied`.
- **Deferred:** GUT vs GdUnit4 (a §13 DIRECTOR pick; folded into the `g1_unit_tests_gut` summary, not decided).

## C / I — Duplicates and padding (29 nodes removed, each merged into a survivor)

`engine_version_doc` → `godot_version_pin` · `versioning_changelog` → `changelog` · `world_persistence_sqlite` → `sqlite_world_store` · `graphics_presets` → `graphics_quality_presets` · `character_state_record` → `character_save_state` · `server_metrics_hooks` → `server_health_metrics` · `gameplay_analytics_events` → `gameplay_analytics` · `client_perf_overlay` → `debug_overlays` · `asset_generation_intake` → `asset_intake_pipeline` · `dynamic_events_ai_director` → `ai_director` · `collision_generation_import` → `import_hook` · `physics_tick_settings` → `fixed_tick_sim` · `mounts` → `mounts_travel` · `item_comparison` → `tooltips_item_cards` · `stat_curves_level_scaling` → `level_scaling` · `cooking`, `campfire` → `recipe_defs`, `crafting_station_structures` · `kick_ban_admin` → `server_admin_commands` · `server_config_password` → `server_rules_config` · `seasonal_drops` → `seasonal_rewards` · `content_patches` → `patching_updates` · `mob_faction_hostility` → `enemy_factions_hostility` · `world_chests_containers` → `chests_containers` · `data_dir_as_db`, `content_versioning` → `content_database_git` · `energy_pool`, `rage_pool`, `focus_pool`, `divinity_pool`, `corruption_pool` → one `additional_class_resources` candidate · `party_loot_rules` → `group_loot_rules` · `raid_groups` (removed) · `zoom_orbit`, `camera_collision` → `third_person_rig` · `desktop_builds_win_linux` → `export_presets` · `dedicated_server_distribution` → `dedicated_server_build` · `actor_ids` → `actor_registry` · `save_ids_plus_state` → `state_serialization` · `handmade_world` → `gray_box_island`. Three zero-information `reads id_convention` edges on candidates removed.

**Deferred (kept, judged distinct):** `data_validator_g2` vs `g2_data_integrity` (the tool vs the gate, linked by `extends`); `bed_spawn_point` vs `bed_respawn_structure` (rule vs piece); `container_storage` vs `chests_containers`; `id_immutability_migrations` (the persistence-side rule, primary of `rb_retire_content`); the six `*_sync` parts (informative one-liners; the missing domains were added as edges on `sync_domains` instead).

## D / F — Missing couplings (~100 edges added or re-pointed)

Functional: `effect_kinds_verbs listens item_consumed` (a consumable's `on_use_effect` is applied on the existing §5 signal, R2); `cast_timing reads spellbook`; `item_pickup_drop reads loot_rolls_on_death`; `equip_slots reads bag_slots`, `reads equipment_items`; `gm_console reads item_pickup_drop | spawning | actor_registry` (hard) and `hot_reload` (soft); the interaction system consumed by pickup, dialogue, resource nodes and containers; prefabs read rigs; encounter defs reference the mechanics library; effect defs reference icon conventions.
Persistence: `world_save_json persists world_state_flags`; `character_save_state persists quests | needs | abilities_skills | recipe_unlocks`.
Multiplayer: `sync_domains transports loot | crafting | progression | equipment | gathering | world_state_flags`; `ai_brain` and `boss_phases` read `client_server_roles` (soft until Phase 4).
Presentation and audio: `sfx_events listens actor_damaged | actor_died`; `death_screen listens actor_died`; debug overlays render the navmesh and hitboxes.
Gates and pipeline: `data_validator_g2 reads model_naming | actor_prefabs_scenes` (+ `schema_versioning`, `icon_placeholder_fallback` soft); `json_to_tres_converter reads schema_conventions`; `pr_gates_workflow` and `export_build_pipeline read godot_version_pin`; each `schema_*` node gained its verb-side reader (`effect_kinds_verbs reads schema_status_effect_def`, `behavior_verbs reads schema_enemy_def`, …).
Weakly wired parts: one meaningful edge each for ~20 spec/implied tier-3 parts (`respawn_timers listens actor_died`, `save_migrations reads migrations_doc`, `graphics_quality_presets reads min_recommended_specs`, …).
**Deferred:** `cast_timing calls <delivery verbs>` (would trip the R2-smell check on paths; the deliveries are wired through `spell_defs_content`); localization edges beyond two soft ones (localization is a candidate); D30 — `reads <x>_defs` implies lookup through `data_registry_loader`; documented in `systems/README.md` rather than adding 30 edges.

## E — `Where` precision (~40 nodes)

Bare `core/`, `actors/`, `scenes/`, `audio/`, `ui/`, `tools/`, `docs/` replaced with the file or subdirectory the system owns (`core/time/tick.gd`, `core/commands/intent.gd`, `scenes/terrain/nav/`, `art/animations/; actors/`, `audio/default_bus_layout.tres`, `.github/pull_request_template.md`, …) so `which <path>` inverts them. **Deferred to the Director (spec §3 amendment):** `data/building/`, `data/npcs/`, `data/encounters/`, `data/markers/`, `data/dungeons/`, `data/stations/` and the top-level `server/` are not listed in §3.

## G — Ownership vs §7.1 write scopes

**Applied** where the registry was wrong: `replay_recorder` → orchestrator; `data_validator_g2`, `g2_data_integrity` → orchestrator/test-pilot; `economy`, `loot` → content-smith/orchestrator; `narrative` → quest-writer/orchestrator; `world`, `environment` → world-builder/orchestrator; `operations`, `validation_gates` → test-pilot/orchestrator; balance-document nodes → director/content-smith; `id_listing_in_pr` → orchestrator; test-pilot tooling moved under `tools/testing/`.
**Deferred to the Director (spec seams):** §7.1 grants nobody `actors/**` (9 animation/prefab nodes), `audio/**` (5), `data/npcs/**` (3), `data/dungeons/`, `data/markers/`; §7.2 has content-smith write `art/_inbox/icon_requests.md`, which §7.1 does not grant.

## H — Phase sanity

**Applied:** the Phase 0 sample-content chain made consistent — `schema_station_def` P0 (`hands` exists from P0), `schema_biome_def`, `biome_defs`, `actor_prefabs_scenes` P0 (one stub each for the sample enemy); `quest_defs → npc_defs` soft (giver optional); `objective_types → npc_defs` soft; `recipe_defs → crafting_stations` soft; G2 retargeted to the P0 content nodes; G4 gather/craft rows soft with the §8/§13 inconsistency in the `why`; G3 → island soft.
**Kept visible on purpose:** the four `gm_console` phase inversions (inventory P2, spawning P1, actor registry P1, clock P3) — the Phase 0 console question for the Director.
**Deferred:** `navmesh_baking listens structure_placed` (a listener before its signal simply never fires).
