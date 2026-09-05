#!/usr/bin/env node
// RECORD, not a tool: the script that applied the 2026-09-05 registry audit through the
// validated mutation API (ADR-0066 §Decision 8–9; findings in ./2026-09-05-registry-audit.md).
// Run from the repo root with `node systems/audits/2026-09-05-registry-surgery.mjs`; on an already-
// surgered registry every step fails loudly ("already exists", "unknown system id") and nothing changes.
// Every step re-validates and reverts a change that would leave the ledger invalid.
// One-off registry surgery from the 2026-09-05 audit. Every step goes through the
// validated mutation API, so a step that would break the ledger reverts itself and
// is reported. Re-runnable: already-applied steps fail loudly and are skipped.
import path from "node:path";
import { loadAll } from "../../scripts/lib/systems-map.mjs";
import { addNode, addEdge, setNode, removeNode, removeEdge } from "../../scripts/lib/systems-ops.mjs";

const root = process.cwd();
const G = async () => (await loadAll({ root })).graph;
let ok = 0, failed = 0, reverted = 0;
const log = [];
async function step(label, fn) {
  try {
    const r = await fn(await G());
    if (r && r.ok === false) { reverted++; log.push(`REVERTED ${label}: ${(r.errors || []).slice(0, 2).join(" | ")}`); }
    else { ok++; }
  } catch (err) { failed++; log.push(`FAILED  ${label}: ${err.message}`); }
}
const set = (id, ch) => step(`set ${id} ${JSON.stringify(ch)}`, (g) => setNode(root, g, id, ch));
const add = (f) => step(`add-node ${f.id}`, (g) => addNode(root, g, f));
const edge = (from, how, to, why, o = {}) => step(`add-edge ${from} ${how} ${to}`, (g) => addEdge(root, g, { from, how, to, why, via: o.via, strength: o.strength || "hard", file: o.file }));
const rmE = (from, how, to, via) => step(`remove-edge ${from} ${how} ${to}`, (g) => removeEdge(root, g, { from, how, to, via: via ?? null }));
const rmN = (id) => step(`remove-node ${id}`, (g) => removeNode(root, g, id));
const flip = async (from, how, to, strength, why, via) => { await rmE(from, how, to); await edge(from, how, to, why, { strength, via }); };

const pre = await loadAll({ root });
if (pre.validation.errors.length) { console.error("ledger has errors before surgery — fix runbooks first:\n" + pre.validation.errors.join("\n")); process.exit(2); }
console.log(`start: ${pre.graph.nodes.size} nodes, ${pre.graph.influence.length} edges, ${pre.validation.warnings.length} warnings`);

// ── B/H: status and phase corrections ──────────────────────────────────────
for (const s of ["sig_structure_placed", "sig_player_joined", "sig_player_left", "sig_level_up", "sig_boss_phase_changed", "sig_zone_entered", "sig_need_threshold_crossed"]) await set(s, { status: "implied" });
await set("sig_structure_destroyed", { phase: "—" });
for (const r of ["raids", "raid_bosses", "raid_size_scaling", "raid_roles_check"]) await set(r, { status: "candidate", phase: "—" });
await set("raids", { summary: "Encounters sized for 6–10 players with their own bosses; asked for by the Director, not in the spec (§1 names boss gates only)" });
await set("enemy_abilities", { status: "candidate", phase: "—", summary: "Enemies casting SpellDefs; needs an abilities field on §6.5 EnemyDef (spec PR) before it exists" });
await set("schema_versioning", { phase: "0", summary: "schema_version on every def from Phase 0; bumps carry a migration note so old saves and old data still load" });
await set("id_listing_in_pr", { phase: "0" });
await set("icon_placeholder_fallback", { phase: "0" });
await set("schema_station_def", { phase: "0", summary: "RecipeDef.station names a station id; `hands` exists from Phase 0, station structures from Phase 3" });
await set("schema_biome_def", { phase: "0", summary: "data/biomes exists in the layout with no §6 section yet; the Phase 0 sample enemy needs one biome id to reference" });
await set("biome_defs", { phase: "0", summary: "One def per biome; Phase 0 ships one stub so the sample EnemyDef.biomes resolves (G2)" });
await set("actor_prefabs_scenes", { phase: "0", where: "actors/enemies/; actors/npcs/", summary: "The .tscn per enemy and NPC referenced by EnemyDef.scene; Phase 0 ships one stub capsule so the sample enemy passes G2" });
await set("export_presets", { status: "implied" });
await set("quest_journal_screen", { status: "implied" });
await set("handmade_world", { parent: "terrain_biomes" });
// soften the P0 → later-phase sample-content references that are optional or stubbed
await flip("quest_defs", "references", "npc_defs", "soft", "giver_npc is optional (empty = auto-granted); the Phase 0 sample quest has no giver", "giver_npc (optional)");
await flip("objective_types", "references", "npc_defs", "soft", "talk objectives name an npc id; unusable until NPCs land in Phase 3", "talk target_id");
await flip("recipe_defs", "references", "crafting_stations", "soft", "`hands` needs no station structure; other stations exist from Phase 3", "station");
// G2 validates the P0 content nodes, not the later-phase systems around them
await rmE("g2_data_integrity", "validates", "loot"); await edge("g2_data_integrity", "validates", "loot_table_defs", "G2 checks every loot table file: item ids, weights", { via: "loot table files" });
await rmE("g2_data_integrity", "validates", "quests"); await edge("g2_data_integrity", "validates", "quest_defs", "G2 checks every quest file: prereqs, objective targets, rewards, dialogue", { via: "quest files" });
await rmE("g2_data_integrity", "validates", "dialogue"); await edge("g2_data_integrity", "validates", "dialogue_nodes_choices", "G2 checks every dialogue file: gotos resolve, speakers exist", { via: "dialogue files" });
await rmE("g2_data_integrity", "validates", "crafting"); await edge("g2_data_integrity", "validates", "recipe_defs", "G2 checks every recipe file: output, inputs, station, unlock", { via: "recipe files" });
await flip("g4_bot_playtest", "validates", "gathering", "soft", "§8 lists gather in G4 from Phase 1 while §13 lands gathering in Phase 3 — soft until the §8/§13 inconsistency is resolved by a spec PR");
await flip("g4_bot_playtest", "validates", "crafting", "soft", "§8 lists craft in G4 from Phase 1 while §13 lands crafting in Phase 3 — soft until the spec PR");
await flip("g3_smoke_boot", "validates", "gray_box_island", "soft", "Phase 0 boots an empty project; the island is what boots from Phase 1");
// the GM console's real dependencies — hard on purpose: the phase-inversion warnings ARE the console-vs-clock DIRECTOR question (§13 puts the console in P0 and in the Phase 2 map)
await flip("gm_console", "reads", "day_night_cycle", "hard", "`time <phase>` sets the clock; §13 puts the command in Phase 0 and the clock in Phase 3 — DIRECTOR: stub the clock in P0 or move the command", "time <phase>");
await edge("gm_console", "reads", "item_pickup_drop", "`give <item_id> [n]` puts items in the bag through the pickup path; §13 puts the command in P0 and inventory in P2 — DIRECTOR: stub or move", { via: "give" });
await edge("gm_console", "reads", "spawning", "`spawn <enemy_id> [n]` goes through the spawn system", { via: "spawn" });
await edge("gm_console", "reads", "actor_registry", "`tp <x> <y> <z>` moves the player actor by id", { via: "tp" });
await edge("gm_console", "reads", "hot_reload", "§6.9: a converted def is castable through the console without a restart", { strength: "soft" });

// ── C/I: near-duplicates and padding (merge into the survivor, then remove) ─
await rmE("engine_version_doc", "reads", "godot_version_pin"); await rmN("engine_version_doc");
await rmE("versioning_changelog", "reads", "changelog"); await rmE("patching_updates", "reads", "versioning_changelog"); await edge("patching_updates", "reads", "changelog", "Patch notes are cut from the changelog"); await rmN("versioning_changelog");
await set("changelog", { summary: "One line per task; version tags are cut from it (spec §7.1: every role may append)" });
await rmE("world_persistence_sqlite", "reads", "sqlite_world_store"); await rmN("world_persistence_sqlite");
await rmE("graphics_presets", "reads", "user_settings_store"); await rmE("settings_screens", "reads", "graphics_presets"); await rmE("graphics_quality_presets", "extends", "graphics_presets");
await edge("graphics_quality_presets", "reads", "user_settings_store", "The chosen preset is a saved setting"); await edge("settings_screens", "reads", "graphics_quality_presets", "The graphics tab lists the presets"); await rmN("graphics_presets");
await rmE("cross_server_characters", "reads", "character_state_record"); await rmE("character_state_record", "persists", "character_save_state"); await rmE("per_player_save_in_world", "reads", "character_state_record"); await rmE("character_migration_between_worlds", "reads", "character_state_record");
await edge("cross_server_characters", "reads", "character_save_state", "A character that moves between servers is its saved state"); await edge("per_player_save_in_world", "reads", "character_save_state", "Each player's record inside the world save"); await edge("character_migration_between_worlds", "reads", "character_save_state", "Migration moves the saved state"); await rmN("character_state_record");
await rmE("server_metrics_hooks", "reads", "tick_rate_sync"); await rmE("server_metrics_hooks", "reads", "sessions_players"); await rmE("server_health_metrics", "reads", "server_metrics_hooks");
await edge("server_health_metrics", "reads", "tick_rate_sync", "Tick rate is the first health metric"); await edge("server_health_metrics", "reads", "sessions_players", "Player count and session churn are health metrics"); await rmN("server_metrics_hooks");
await rmE("leaderboards", "reads", "gameplay_analytics_events"); await rmE("gameplay_analytics_events", "reads", "event_bus"); await rmE("gameplay_analytics", "reads", "gameplay_analytics_events");
await edge("leaderboards", "reads", "gameplay_analytics", "Leaderboards are aggregated analytics"); await edge("gameplay_analytics", "reads", "event_bus", "Analytics subscribe to the bus and record events off the tick"); await rmN("gameplay_analytics_events");
await rmE("client_perf_overlay", "reads", "debug_overlays"); await rmN("client_perf_overlay");
await set("debug_overlays", { summary: "Toggle overlays: actor ids, threat, navmesh, hitboxes, frame time and the client performance readout" });
await rmE("asset_generation_intake", "reads", "import_hook"); await rmE("asset_generation_intake", "reads", "asset_intake_pipeline"); await rmN("asset_generation_intake");
await rmE("dynamic_events_ai_director", "reads", "ai_director"); await rmN("dynamic_events_ai_director");
await set("ai_director", { summary: "Paces spawns and pressure against the party; dynamic events would be its candidate extension" });
await rmE("terrain_meshes_heightmap", "reads", "collision_generation_import"); await rmE("navmesh_baking", "reads", "collision_generation_import"); await rmE("collision_generation_import", "extends", "import_hook");
await edge("navmesh_baking", "reads", "import_hook", "The navmesh bakes on the collision the import hook generated"); await rmN("collision_generation_import");
await rmE("physics_tick_settings", "extends", "project_settings"); await rmN("physics_tick_settings");
await set("fixed_tick_sim", { where: "core/time/tick.gd; project.godot", summary: "Gameplay advances on the fixed physics tick (rate in project.godot); no frame-time math in core/" });
await rmE("mounts", "reads", "locomotion"); await rmE("mounts", "reads", "actor_prefabs_scenes"); await rmE("mounts_travel", "reads", "mounts"); await edge("mounts_travel", "reads", "actor_prefabs_scenes", "A mount is an actor prefab the player rides"); await rmN("mounts");
await rmE("item_comparison", "reads", "gear_stats_application"); await rmE("tooltips_item_cards", "renders", "item_comparison"); await edge("tooltips_item_cards", "reads", "gear_stats_application", "Comparison deltas come from the equipped item's applied stats"); await rmN("item_comparison");
await set("tooltips_item_cards", { summary: "Item cards with stats, rarity color and a comparison against the equipped item" });
await rmE("stat_curves_level_scaling", "reads", "level_curve"); await rmE("stat_curves_level_scaling", "reads", "enemy_stats_scaling"); await rmN("stat_curves_level_scaling");
await set("level_scaling", { where: "core/stats/scaling.gd; docs/balance_ranges.md", summary: "Stat growth per level for players and enemies; the curves live in docs/balance_ranges.md" });
await rmE("campfire", "reads", "cooking"); await rmE("cooking", "reads", "recipe_defs"); await rmN("cooking");
await rmE("temperature_exposure", "reads", "campfire"); await rmE("campfire", "extends", "crafting_station_structures"); await edge("temperature_exposure", "reads", "crafting_station_structures", "A campfire (a station piece) is a heat source", { strength: "soft" }); await rmN("campfire");
await set("crafting_station_structures", { summary: "Workbench, forge and campfire as placeable pieces; the campfire also gives warmth and light and hosts cooking recipes" });
await rmE("kick_ban_admin", "reads", "server_admin_commands"); await rmN("kick_ban_admin");
await set("server_admin_commands", { summary: "Console commands for the host: kick, ban, whitelist and the GM console with admin rights" });
await rmE("join_leave_flow", "reads", "server_config_password"); await rmE("player_slots_cap", "reads", "server_config_password"); await rmE("server_config_password", "reads", "user_settings_store"); await rmE("server_rules_config", "reads", "server_config_password");
await edge("join_leave_flow", "reads", "server_rules_config", "Password and rules are checked on join"); await edge("player_slots_cap", "reads", "server_rules_config", "The slot cap is a server rule"); await edge("server_rules_config", "reads", "user_settings_store", "The host's saved server settings seed the rules", { strength: "soft" }); await rmN("server_config_password");
await set("server_rules_config", { summary: "Password, slot cap, friendly fire, loot rule and PvP flag as one server config" });
await rmE("seasonal_drops", "reads", "holiday_defs"); await rmN("seasonal_drops");
await rmE("content_patches", "reads", "content_versioning"); await rmE("content_patches", "reads", "save_migrations"); await rmN("content_patches");
await set("patching_updates", { where: "docs/release_process.md", summary: "How builds and data-only content patches ship, with save migrations when needed" });
await rmE("mob_faction_hostility", "reads", "enemy_factions_hostility"); await rmE("mob_faction_hostility", "reads", "reputation_tiers"); await rmE("mob_faction_hostility", "reads", "perception");
await edge("enemy_factions_hostility", "reads", "reputation_tiers", "Hostility toward a player follows their standing"); await edge("enemy_factions_hostility", "reads", "perception", "Hostile factions attack on sight"); await rmN("mob_faction_hostility");
await rmE("world_chests_containers", "reads", "loot_table_defs"); await rmE("world_chests_containers", "reads", "timers_cooldowns");
await edge("chests_containers", "reads", "loot_table_defs", "A placed chest may roll a loot table when first opened"); await edge("chests_containers", "reads", "timers_cooldowns", "Loot chests respawn their contents on a timer", { strength: "soft" }); await rmN("world_chests_containers");
await set("chests_containers", { summary: "Placed containers with an inventory, an optional loot table and a respawn timer" });
await rmE("data_dir_as_db", "reads", "content_pipeline"); await rmE("data_dir_as_db", "reads", "plain_text_formats"); await rmE("content_versioning", "reads", "data_dir_as_db"); await rmE("mod_support", "reads", "data_dir_as_db"); await rmE("hotfix_data_only", "reads", "data_dir_as_db");
await edge("content_database_git", "reads", "content_pipeline", "Content enters data/ only through the converter"); await edge("content_database_git", "reads", "plain_text_formats", "data/ is diffable because everything is text"); await edge("mod_support", "reads", "content_database_git", "Mods would be extra data/ trees"); await edge("hotfix_data_only", "reads", "content_database_git", "A data-only hotfix is a data/ commit");
await rmN("data_dir_as_db"); await rmN("content_versioning");
await set("content_database_git", { summary: "data/ in Git is the content database: diffable, mergeable, agent-editable, versioned by commit; ids are immutable once shipped" });
await add({ id: "additional_class_resources", name: "Further class resources", parent: "class_resources", status: "candidate", owner: "director", where: "core/stats/resources.gd", spec: "—", summary: "Energy, rage, focus, divinity and corruption as further pools; each is a §6.3 cost enum value and one DIRECTOR decision", analogy: "—" });
await edge("additional_class_resources", "extends", "mana_pool", "Each further pool follows the mana pattern: a max, a current and a regen rule", { strength: "soft" });
await edge("additional_class_resources", "reads", "schema_spell_def", "The cost.resource enum must grow before a spell can cost a new resource");
await edge("resource_cost_check", "reads", "additional_class_resources", "The cost check would read the new pools", { strength: "soft" });
for (const p of ["energy_pool", "rage_pool", "focus_pool", "divinity_pool", "corruption_pool"]) { await rmE(p, "extends", "mana_pool"); await rmE(p, "reads", "schema_spell_def"); await rmE("resource_cost_check", "reads", p); await rmN(p); }
await rmE("party_loot_rules", "extends", "group_loot_rules"); await rmE("party_loot_rules", "reads", "party_membership"); await rmE("server_rules_config", "reads", "party_loot_rules"); await edge("server_rules_config", "reads", "group_loot_rules", "The server's loot rule is the party's default"); await rmN("party_loot_rules");
await rmE("raid_groups", "reads", "party_membership"); await rmE("raid_groups", "reads", "raid_size_scaling"); await rmN("raid_groups");
await rmE("zoom_orbit", "reads", "input_map_actions"); await rmN("zoom_orbit"); await rmE("camera_collision", "reads", "collision_layers"); await edge("third_person_rig", "reads", "collision_layers", "The camera pulls in when geometry blocks the view"); await rmN("camera_collision");
await set("third_person_rig", { summary: "Follow camera with orbit, zoom and collision pull-in" });
await rmE("desktop_builds_win_linux", "reads", "export_build_pipeline"); await rmN("desktop_builds_win_linux"); await rmE("dedicated_server_distribution", "reads", "dedicated_server_build"); await rmN("dedicated_server_distribution");
for (const c of ["profession_defs", "currency_defs", "holiday_defs"]) await rmE(c, "reads", "id_convention");
await rmE("spawning", "reads", "actor_ids"); await rmE("corpse_handling", "reads", "actor_ids"); await rmE("build_permissions", "reads", "actor_ids"); await rmE("actor_ids", "extends", "actor_registry");
await edge("spawning", "reads", "actor_registry", "A spawned actor is registered by id"); await edge("corpse_handling", "reads", "actor_registry", "A corpse keeps the dead actor's id"); await edge("build_permissions", "reads", "actor_registry", "Ownership is by actor id"); await rmN("actor_ids");
await rmE("save_ids_plus_state", "reads", "id_convention"); await rmE("save_ids_plus_state", "reads", "state_serialization"); await rmN("save_ids_plus_state");
await rmE("handmade_world", "reads", "terrain_meshes_heightmap"); await rmN("handmade_world");

// ── D: missing edges between coupled systems ───────────────────────────────
await edge("effect_kinds_verbs", "listens", "sig_item_consumed", "The effects system applies ItemDef.on_use_effect on the existing §5 signal instead of survival calling combat (R2)");
await edge("cast_timing", "reads", "spellbook", "Only known spells cast", { via: "known spell ids" });
await edge("item_pickup_drop", "reads", "loot_rolls_on_death", "Rolled drops become pickups at the corpse", { via: "dropped stacks" });
await edge("equip_slots", "reads", "bag_slots", "Equipping moves an item between a bag slot and an equipment slot", { via: "source and destination slot" });
await edge("equip_slots", "reads", "equipment_items", "Only items with a slot other than none equip", { via: "slot != none" });
await edge("item_pickup_drop", "reads", "interaction_system", "Pickup is an interact on a dropped item", { via: "interact target id" });
await edge("dialogue_runner", "reads", "interaction_system", "Talking is an interact on an NPC", { via: "interact target id" });
await edge("resource_nodes", "reads", "interaction_system", "Harvesting is an interact on a node", { via: "interact target id" });
await edge("chests_containers", "reads", "interaction_system", "Opening a container is an interact", { via: "interact target id" });
await edge("actor_prefabs_scenes", "reads", "rigs_skeletons", "Every prefab carries a rig and an AnimationTree", { via: "rig + AnimationTree" });
await edge("locomotion_blending", "renders", "steering_locomotion", "Enemy walk cycles follow the steering speed");
await edge("encounter_defs", "references", "boss_mechanics_library", "Every mechanic an encounter names must exist as a verb (R1)", { via: "mechanics[]" });
await edge("effect_defs_content", "references", "icon_conventions", "StatusEffectDef.icon is required (§6.4) and named by id", { via: "icon" });
await edge("world_save_json", "persists", "world_state_flags", "Quest counters, boss gates and flags survive a reload", { via: "flags and counters" });
await edge("character_save_state", "persists", "quests", "Started, completed and objective progress per character", { via: "quest state" });
await edge("character_save_state", "persists", "needs", "Hunger and the other needs are saved per character");
await edge("character_save_state", "persists", "abilities_skills", "Known spells are saved per character", { via: "spellbook" });
await edge("character_save_state", "persists", "recipe_unlocks", "Known recipes are saved per character");
for (const [d, why] of [["loot", "Loot rolls are server-owned; clients never roll"], ["crafting", "Craft timers and outputs are server-owned"], ["progression", "XP and levels are server-owned"], ["equipment", "Equipped state replicates from the server"], ["gathering", "Node depletion and yields are server-owned"], ["world_state_flags", "Flags and counters replicate as a snapshot"]]) await edge("sync_domains", "transports", d, `${why}; no dedicated sync part yet`);
await edge("ai_brain", "reads", "client_server_roles", "AI thinks only on the server tick", { via: "server-only tick" });
await edge("boss_phases", "reads", "client_server_roles", "Boss phases advance only on the server");
await edge("threat_table", "listens", "sig_actor_healed", "Healing adds threat against the healer", { strength: "soft" });
await edge("sfx_events", "listens", "sig_actor_damaged", "Hit sounds play on damage events");
await edge("sfx_events", "listens", "sig_actor_died", "Death sounds play on the event");
await edge("string_tables", "reads", "dialogue_nodes_choices", "Dialogue text would be string keys", { strength: "soft" });
await edge("string_tables", "reads", "quest_journal_text", "Journal text would be string keys", { strength: "soft" });
await edge("data_validator_g2", "reads", "model_naming", "G2 checks that every model path exists and is named by id", { via: "model paths" });
await edge("data_validator_g2", "reads", "actor_prefabs_scenes", "G2 checks that EnemyDef.scene exists", { via: "scene path" });
await edge("data_validator_g2", "reads", "schema_versioning", "G2 rejects a schema_version the current class does not know", { strength: "soft" });
await edge("json_to_tres_converter", "reads", "schema_conventions", "id, display_name and schema_version are required on every def", { via: "conventions" });
await edge("recipe_defs", "references", "materials_ingredients", "Recipe inputs are usually materials", { via: "inputs[].item_id", strength: "soft" });
await edge("temperature_exposure", "listens", "sig_day_phase_changed", "Nights are colder", { strength: "soft" });
await edge("pr_gates_workflow", "reads", "godot_version_pin", "CI installs the pinned engine version");
await edge("export_build_pipeline", "reads", "godot_version_pin", "Builds use the pinned engine version");
await edge("server_admin_commands", "reads", "player_identity_local", "Kicks and bans need an identity to name");
await edge("debug_overlays", "renders", "navmesh_baking", "The navmesh overlay draws the baked mesh", { strength: "soft" });
await edge("debug_overlays", "renders", "hit_detection", "The hitbox overlay draws the sim's shapes", { strength: "soft" });
await edge("item_icons_models", "reads", "placeholder_assets", "An item without art points at the placeholder", { strength: "soft" });
await edge("data_validator_g2", "reads", "icon_placeholder_fallback", "G2 accepts the placeholder path as existing", { strength: "soft" });
await edge("party_roles", "reads", "roles", "A party role is a combat role", { strength: "soft" });
await edge("xp_award", "reads", "party_membership", "Kill XP is shared with the party", { strength: "soft" });
for (const k of ["healing_kit", "dps_kit", "tanking_kit"]) await edge(k, "references", "spell_defs_content", "A role kit is a set of spell ids", { via: "spell ids" });
await edge("telegraph_decals", "extends", "boss_mechanics_library", "Telegraph is one of the library's mechanic verbs");
// ── F: weakly wired parts ──────────────────────────────────────────────────
await edge("g0_style_parse", "validates", "plain_text_formats", "The headless import rejects binaries outside art/ and audio/", { strength: "soft" });
await edge("effect_kinds_verbs", "reads", "schema_status_effect_def", "Every kind enum value is a verb here (R1)", { via: "kind enum" });
await edge("behavior_verbs", "reads", "schema_enemy_def", "Every behavior enum value is a verb here (R1)", { via: "behavior enum" });
await edge("crafting_stations", "reads", "schema_recipe_def", "RecipeDef.station names a station", { via: "station", strength: "soft" });
await edge("weighted_rolls", "reads", "schema_loot_table_def", "The roll reads entries and weights", { via: "entries shape", strength: "soft" });
await edge("dialogue_runner", "reads", "schema_dialogue_def", "The runner follows goto and stops at end", { via: "goto end", strength: "soft" });
await edge("item_pickup_drop", "reads", "stacking_rules", "Pickups merge into existing stacks");
await edge("objective_types", "references", "quest_items", "Collect objectives usually name quest items", { strength: "soft" });
await edge("damage_formula", "reads", "resistances_application", "Mitigation is a step of the formula", { via: "mitigation step" });
await edge("effect_kinds_verbs", "reads", "effect_stacking", "Apply consults the stacking rule before adding an instance");
await edge("actor_prefabs_scenes", "reads", "enemy_families", "Prefabs in a family share a rig and sounds", { strength: "soft" });
await edge("respawn_timers", "listens", "sig_actor_died", "A kill starts the respawn timer");
await edge("fog_atmosphere", "listens", "sig_weather_changed", "Fog density follows the weather", { strength: "soft" });
await edge("lore_voice_check", "reads", "lore_additions", "New lore is checked against the voice", { strength: "soft" });
await edge("projectile_visuals", "reads", "element_default_vfx", "Trails follow the element default", { strength: "soft" });
await edge("minimap_compass_hud", "renders", "objective_tracking", "Objective pins on the compass", { strength: "soft" });
await edge("death_screen", "listens", "sig_actor_died", "Opens on the local player's death (R5: reacts, never mutates)");
await edge("spawn_replication", "listens", "sig_actor_spawned", "The §5 Phase 4 note: server-emitted spawns replicate to clients");
await edge("db_migrations", "reads", "transactional_writes_crash_safety", "Migrations run inside a transaction", { strength: "soft" });
await edge("graphics_quality_presets", "reads", "min_recommended_specs", "The medium preset is defined at the recommended spec");
await edge("loom_doctor_gate", "reads", "loom_secrets_doctor", "The governance job runs the secrets scan");
await edge("pr_review_flow", "reads", "tech_debt_log", "R9: unrelated debt is filed, not fixed", { strength: "soft" });
await edge("save_migrations", "reads", "migrations_doc", "Every migration has a note");
await edge("asset_intake_pipeline", "reads", "icon_generation_prompts", "Filed prompts are what asset generation picks up");
await edge("pr_review_flow", "reads", "id_listing_in_pr", "The PR template requires the id listing");

// ── A: missing systems ─────────────────────────────────────────────────────
await add({ id: "repo_layout", name: "Repository layout (§3)", parent: "engine_platform", phase: "0", status: "spec", owner: "orchestrator/director", where: "project.godot; .gdignore", spec: "§3, §13 item 2", summary: "The §3 directory layout: res:// root with core/ data/ scenes/ actors/ ui/ art/ audio/ tests/ tools/ addons/; where the Godot root sits beside Loom's governance folders (.gdignore them, or move the game under game/) is an open DIRECTOR question", analogy: "—" });
await edge("repo_layout", "reads", "game_infra_spec", "§3 defines the layout", { via: "§3" });
await edge("systems_content_split", "reads", "repo_layout", "core/ versus data/ is the R1 boundary");
await add({ id: "harness_adapters", name: "Harness adapters (CLAUDE.md, AGENTS.md)", parent: "agent_harness", phase: "0", status: "spec", owner: "orchestrator", where: "CLAUDE.md; AGENTS.md; .claude/; .agents/", spec: "Appendix B, §13 item 2", summary: "The always-loaded adapters that point any harness at the spec, the session ritual, the write scopes and the atlas", analogy: "—" });
await edge("harness_adapters", "reads", "game_infra_spec", "The adapters restate the spec's digest and point at it");
await edge("harness_adapters", "reads", "systems_atlas", "The ritual runs validate, which, checklist and impact");
await add({ id: "local_authority_mode", name: "Local authority mode", parent: "command_intents", phase: "1", status: "implied", owner: "orchestrator", where: "core/commands/authority.gd", spec: "§12", summary: "Phases 1–3: the local game is its own authority and applies intents directly; the seam a Phase 4 server replaces", analogy: "—" });
await edge("local_authority_mode", "reads", "intent_dispatch", "Intents dispatch locally until a server owns them");
await edge("client_server_roles", "extends", "local_authority_mode", "Phase 4 replaces the local authority with server roles");
await add({ id: "scene_transitions_loading", name: "Scene transitions & loading", parent: "travel", phase: "2", status: "implied", owner: "orchestrator", where: "core/world/scene_loader.gd; scenes/loading.tscn", spec: "§3 scenes/", summary: "Loading and switching scenes — entering a dungeon, a loading screen — while actor state crosses the switch as data", analogy: "—" });
await edge("dungeon_entrances", "reads", "scene_transitions_loading", "Entering a dungeon loads its scene");
await edge("scene_transitions_loading", "reads", "state_serialization", "Actor state crosses the switch as serialized data");
await add({ id: "revive_downed_state", name: "Downed & revive", parent: "character_identity", phase: "—", status: "candidate", owner: "director", where: "core/combat/downed.gd", spec: "—", summary: "A downed state that allies can revive before death; the hardcore-stakes question alongside loot_bags_on_death", analogy: "—" });
await edge("revive_downed_state", "reads", "death_resolution", "Downed sits between zero health and death");
await edge("revive_downed_state", "extends", "respawn_rules", "Revive is an alternative to respawning", { strength: "soft" });
await add({ id: "content_version_handshake", name: "Content version handshake", parent: "sessions_players", phase: "4", status: "implied", owner: "orchestrator", where: "core/net/session/version.gd", spec: "§10, §12", summary: "Client and server compare build and data/ versions on join; a mismatch is refused with a clear message", analogy: "—" });
await edge("content_version_handshake", "reads", "join_leave_flow", "The check runs during join");
await edge("content_version_handshake", "reads", "content_database_git", "The data/ version is what is compared");
await add({ id: "db_backup_snapshots", name: "Database backups", parent: "server_database", phase: "4", status: "implied", owner: "orchestrator", where: "server/db/backup.gd", spec: "§10", summary: "Scheduled snapshots of the SQLite world file with rotation; the crash-safety half of §10", analogy: "—" });
await edge("db_backup_snapshots", "reads", "sqlite_world_store", "Snapshots copy the store file between transactions");
await add({ id: "station_defs", name: "Station definitions", parent: "crafting", phase: "3", status: "implied", owner: "content-smith", where: "data/stations/", spec: "§6.2 station", summary: "One def per crafting station id (hands, workbench, forge, campfire): display name, the piece that provides it, the recipes it hosts", analogy: "—" });
await edge("station_defs", "reads", "schema_station_def", "Every station file must match the schema");
await edge("crafting_stations", "reads", "station_defs", "The station registry is built from the defs");
await edge("crafting_station_structures", "references", "station_defs", "A station piece names the station it provides", { via: "station id" });

// ── E: Where precision ─────────────────────────────────────────────────────
const wheres = {
  time_and_tick: "core/time/", timers_cooldowns: "core/time/timers.gd", pause_rules: "core/time/pause.gd", deterministic_sim: "core/util/rng.gd; core/",
  intent_schema: "core/commands/intent.gd", intent_dispatch: "core/commands/dispatch.gd", intent_validation: "core/commands/validate.gd", schema_conventions: "core/schemas/def_base.gd",
  spawn_points_zones: "scenes/spawns/", spawn_hubs: "scenes/markers/", vegetation_placement: "scenes/terrain/", roads: "scenes/terrain/", water_bodies: "scenes/terrain/", caves: "scenes/terrain/",
  dungeon_entrances: "scenes/prefabs/", landmarks_poi: "scenes/prefabs/", destructibles: "scenes/prefabs/", navmesh_baking: "scenes/terrain/nav/; tools/bake_navmesh.gd", nav_regions_links: "scenes/terrain/nav/",
  animation_state_machines: "actors/player/animation_tree.tres; actors/", locomotion_blending: "art/animations/; actors/", combat_animations: "art/animations/; actors/", hit_reactions_death_anims: "art/animations/; actors/",
  sim_driven_timing: "actors/player/anim_controller.gd", ik_procedural: "art/animations/; actors/", facial_emotes: "art/animations/; actors/",
  audio: "audio/; audio/default_bus_layout.tres", spatial_audio_mix_buses: "audio/default_bus_layout.tres", subtitles: "ui/hud/subtitles.tscn", lod_texture_budgets: "docs/art_bible.md",
  gear_tiers: "docs/balance_ranges.md; data/items/", pr_review_flow: ".github/pull_request_template.md", id_listing_in_pr: ".github/pull_request_template.md",
  write_scope_enforcement: "scripts/write-scope-check.sh; .github/workflows/gates.yml", converter_gate_run: "data/_inbox/; data/", flaky_test_policy: ".github/workflows/gates.yml; tests/",
  steam_platform: "addons/godotsteam/", min_recommended_specs: "docs/hardware_targets.md", benchmark_scene: "tools/testing/benchmark.tscn", loot_economy_sim: "tools/testing/balance/loot_sim.gd", combat_sim_harness: "tools/testing/balance/combat_sim.gd",
};
for (const [id, where] of Object.entries(wheres)) await set(id, { where });

// ── G: owners that can write their Where ───────────────────────────────────
const owners = {
  replay_recorder: "orchestrator", data_validator_g2: "orchestrator/test-pilot", g2_data_integrity: "orchestrator/test-pilot", economy: "content-smith/orchestrator", loot: "content-smith/orchestrator",
  narrative: "quest-writer/orchestrator", world: "world-builder/orchestrator", environment: "world-builder/orchestrator", onboarding_tutorial: "quest-writer/orchestrator",
  operations: "test-pilot/orchestrator", validation_gates: "test-pilot/orchestrator", element_matrix: "director/content-smith", loot_economy_tuning: "director/content-smith", enemy_stats_scaling: "director/content-smith", id_listing_in_pr: "orchestrator",
};
for (const [id, owner] of Object.entries(owners)) await set(id, { owner });

const post = await loadAll({ root });
console.log(`\ndone: ${ok} ok · ${failed} failed · ${reverted} reverted`);
for (const l of log) console.log("  " + l);
console.log(`\nend: ${post.graph.nodes.size} nodes, ${post.graph.influence.length} edges, ${post.validation.errors.length} errors, ${post.validation.warnings.length} warnings, registry ${post.hash}`);
