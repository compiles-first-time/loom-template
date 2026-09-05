# Foundation — the engine, the rules of construction, and the wiring

> **Analogy:** the building code plus the electrical panel of the house. Every other domain plugs into this one; nothing here is "gameplay", and everything in gameplay breaks if this moves.
>
> This file is the registry's source of truth for the **EventBus** (spec §5). Signals are nodes named `sig_*` under `event_bus`; emitter and listener wiring lives in this file's Edges table so that adding a signal is one table edit here plus the §5 row the spec requires (R-EB1). `scripts/systems-map.sh validate` cross-checks the two.

Format: [`systems/README.md`](../README.md). Tool: `scripts/systems-map.sh`. Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| foundation | Foundation | 1 | — | 0 | spec | orchestrator | core/; tools/; project.godot | §2, §3, §4, §5, §6, §12 | Engine, architecture rules, EventBus, schemas, content pipeline, time, state, debug tools | The building code plus the electrical panel: every room plugs into it, nobody lives in it |
| engine_platform | Engine & Build | 2 | foundation | 0 | spec | orchestrator | project.godot; addons/; docs/ENGINE_VERSION.txt | §2 | Godot 4.x pinned, project settings, export presets, addon policy | The foundation slab and the power company |
| godot_version_pin | Godot version pin | 3 | engine_platform | 0 | spec | director | docs/ENGINE_VERSION.txt | §2, §13 | Exact engine version recorded at Phase 0; upgrades are a DIRECTOR decision | — |
| project_settings | Project settings | 3 | engine_platform | 0 | implied | orchestrator | project.godot | §2, §4 | Autoloads, physics tick rate, collision layers, input map, rendering method | — |
| export_presets | Export presets | 3 | engine_platform | 1 | implied | orchestrator | export_presets.cfg | §1, §2 | Windows and Linux desktop builds, plus the headless server preset in Phase 4 | — |
| addon_management | Addon management | 3 | engine_platform | 0 | spec | orchestrator | addons/ | §2, §4 R10 | Third-party plugins (GUT, godot-mcp); adding one requires a spec-change PR | — |
| gdscript_static_typing | GDScript static typing + lint | 3 | engine_platform | 0 | spec | orchestrator | core/; tools/; gdlintrc | §2, §4 R6 | Static typing, one-line docstrings, gdformat and gdlint as the style law | — |
| architecture_rules | Architecture rules (R1–R10) | 2 | foundation | 0 | spec | orchestrator | GAME_INFRA_SPEC.md; core/ | §4 | The constitution of the codebase, enforced by gates and by refusal | The building code |
| systems_content_split | Systems / content split (R1) | 3 | architecture_rules | 0 | spec | orchestrator | core/; data/ | §4 R1 | Code never hardcodes content; data never contains logic | Kitchen staff and recipe cards |
| plain_text_formats | Plain text everything (R3) | 3 | architecture_rules | 0 | spec | orchestrator | scenes/; data/ | §4 R3 | Scenes, resources, config and data are text and committed to Git | — |
| deterministic_sim | Deterministic simulation (R4) | 3 | architecture_rules | 1 | spec | orchestrator | core/util/rng.gd; core/ | §4 R4 | Seeded RNG passed in, fixed physics tick, no wall-clock inside core/ | Same dice, same seed, same game every time |
| sim_presentation_split | Simulation / presentation split (R5) | 3 | architecture_rules | 1 | spec | orchestrator | core/; ui/; scenes/ | §4 R5, §12 | Input → simulate → present; presentation reads state and never mutates it | The scoreboard shows the game; it never plays it |
| id_convention | ID convention (R7) | 3 | architecture_rules | 0 | spec | orchestrator | data/ | §4 R7, §11 | snake_case ids with category prefix, immutable once shipped in a save | Social security numbers for content |
| event_bus | EventBus | 2 | foundation | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | The autoload every system emits on and listens to; its signal table is the API between systems | The group chat every department reads; nobody phones anyone directly |
| sig_actor_spawned | actor_spawned | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | actor_id, kind | — |
| sig_actor_damaged | actor_damaged | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | target_id, source_id, amount, damage_type | — |
| sig_actor_healed | actor_healed | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | target_id, source_id, amount | — |
| sig_actor_died | actor_died | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | actor_id, killer_id | — |
| sig_spell_cast | spell_cast | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | caster_id, spell_id, target_id, target_pos | — |
| sig_effect_applied | effect_applied | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | target_id, effect_id, duration_s, source_id | — |
| sig_effect_expired | effect_expired | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | target_id, effect_id | — |
| sig_item_acquired | item_acquired | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | actor_id, item_id, count | — |
| sig_item_consumed | item_consumed | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | actor_id, item_id, count | — |
| sig_item_crafted | item_crafted | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | actor_id, item_id, count, station_id | — |
| sig_quest_started | quest_started | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | quest_id | — |
| sig_quest_objective_progressed | quest_objective_progressed | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | quest_id, objective_index, progress, required | — |
| sig_quest_completed | quest_completed | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | quest_id | — |
| sig_day_phase_changed | day_phase_changed | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | phase: dawn, day, dusk, night | — |
| sig_world_saved | world_saved | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | slot | — |
| sig_world_loaded | world_loaded | 3 | event_bus | 0 | spec | orchestrator | core/events/event_bus.gd | §5 | slot | — |
| sig_structure_placed | structure_placed (proposed) | 3 | event_bus | 3 | implied | orchestrator | core/events/event_bus.gd | — | actor_id, structure_id, position; building has no signal in §5 yet | — |
| sig_structure_destroyed | structure_destroyed (proposed) | 3 | event_bus | — | candidate | orchestrator | core/events/event_bus.gd | — | structure_id, cause | — |
| sig_player_joined | player_joined (proposed) | 3 | event_bus | 4 | implied | orchestrator | core/events/event_bus.gd | — | player_id, character_id | — |
| sig_player_left | player_left (proposed) | 3 | event_bus | 4 | implied | orchestrator | core/events/event_bus.gd | — | player_id, reason | — |
| sig_level_up | level_up (proposed) | 3 | event_bus | 2 | implied | orchestrator | core/events/event_bus.gd | — | actor_id, level | — |
| sig_currency_changed | currency_changed (proposed) | 3 | event_bus | — | candidate | orchestrator | core/events/event_bus.gd | — | actor_id, currency_id, delta | — |
| sig_reputation_changed | reputation_changed (proposed) | 3 | event_bus | — | candidate | orchestrator | core/events/event_bus.gd | — | actor_id, faction_id, delta, tier | — |
| sig_boss_phase_changed | boss_phase_changed (proposed) | 3 | event_bus | 2 | implied | orchestrator | core/events/event_bus.gd | — | encounter_id, phase_index | — |
| sig_weather_changed | weather_changed (proposed) | 3 | event_bus | — | candidate | orchestrator | core/events/event_bus.gd | — | weather_id, intensity | — |
| sig_zone_entered | zone_entered (proposed) | 3 | event_bus | 3 | implied | orchestrator | core/events/event_bus.gd | — | actor_id, zone_id | — |
| sig_need_threshold_crossed | need_threshold_crossed (proposed) | 3 | event_bus | 3 | implied | orchestrator | core/events/event_bus.gd | — | actor_id, need_id, threshold; how survival asks effects for a starving debuff without calling it | — |
| sig_trade_completed | trade_completed (proposed) | 3 | event_bus | — | candidate | orchestrator | core/events/event_bus.gd | — | buyer_id, seller_id, items, currency | — |
| data_schemas | Data schemas (the nouns) | 2 | foundation | 0 | spec | orchestrator | core/schemas/ | §6 | Resource class definitions every content file must match | The blank recipe-card templates |
| schema_conventions | Schema conventions | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/def_base.gd | §6 | Every def carries id, display_name, schema_version; canonical storage is .tres | — |
| schema_versioning | Schema versioning + migrations | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/; docs/migrations.md | §6, §10 | schema_version on every def from Phase 0; bumps carry a migration note so old saves and old data still load | Edition numbers on a textbook |
| schema_item_def | ItemDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/item_def.gd | §6.1 | id, description, icon, model, stack_size, weight, rarity, slot, tags, stats, on_use_effect | — |
| schema_recipe_def | RecipeDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/recipe_def.gd | §6.2 | output_item, output_count, station, inputs, craft_time_s, unlocked_by | — |
| schema_spell_def | SpellDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/spell_def.gd | §6.3 | cast_time_s, cooldown_s, cost, range_m, delivery, effects, element, vfx, sfx | — |
| schema_status_effect_def | StatusEffectDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/status_effect_def.gd | §6.4 | kind, magnitude, tick_interval_s, duration_s, stacking, element | — |
| schema_enemy_def | EnemyDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/enemy_def.gd | §6.5 | scene, health, damage, armor, move_speed, behavior, loot_table, xp, biomes, day_phases | — |
| schema_loot_table_def | LootTableDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/loot_table_def.gd | §6.6 | entries with weight and min/max, guaranteed drops | — |
| schema_quest_def | QuestDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/quest_def.gd | §6.7 | giver_npc, prereqs, objectives, rewards, dialogue, journal_text | — |
| schema_dialogue_def | DialogueDef | 3 | data_schemas | 0 | spec | orchestrator | core/schemas/dialogue_def.gd | §6.8 | nodes with speaker, text, choices, goto, condition | — |
| schema_biome_def | BiomeDef (implied) | 3 | data_schemas | 0 | implied | orchestrator | core/schemas/biome_def.gd | §3 data/biomes | data/biomes exists in the layout with no §6 section yet; the Phase 0 sample enemy needs one biome id to reference | — |
| schema_npc_def | NpcDef (implied) | 3 | data_schemas | 3 | implied | orchestrator | core/schemas/npc_def.gd | §6.7 giver_npc | Quests name an npc id and objectives can talk to one; nothing defines an NPC | — |
| schema_marker_def | MarkerDef (implied) | 3 | data_schemas | 1 | implied | orchestrator | core/schemas/marker_def.gd | §6.7 reach | reach objectives target a marker id; markers need a definition | — |
| schema_station_def | StationDef (implied) | 3 | data_schemas | 0 | implied | orchestrator | core/schemas/station_def.gd | §6.2 station | RecipeDef.station names a station id; `hands` exists from Phase 0, station structures from Phase 3 | — |
| schema_building_piece_def | BuildingPieceDef (implied) | 3 | data_schemas | 3 | implied | orchestrator | core/schemas/building_piece_def.gd | §13 Phase 3 build | Placeable pieces need cost, snapping, footprint and health | — |
| schema_encounter_def | EncounterDef (implied) | 3 | data_schemas | 2 | implied | orchestrator | core/schemas/encounter_def.gd | §1 boss gates | A boss fight is data: phases, mechanics, arena, gate unlocked | — |
| schema_class_def | ClassDef (candidate) | 3 | data_schemas | — | candidate | director | core/schemas/class_def.gd | — | Classes are not in the spec; needs a DIRECTOR decision | — |
| schema_talent_def | TalentDef (candidate) | 3 | data_schemas | — | candidate | director | core/schemas/talent_def.gd | — | Talent trees are not in the spec | — |
| schema_faction_def | FactionDef (candidate) | 3 | data_schemas | — | candidate | director | core/schemas/faction_def.gd | — | Factions and reputation are not in the spec | — |
| schema_achievement_def | AchievementDef (candidate) | 3 | data_schemas | — | candidate | director | core/schemas/achievement_def.gd | — | Achievements are not in the spec | — |
| content_pipeline | Content pipeline | 2 | foundation | 0 | spec | orchestrator | tools/json_to_tres.gd; tools/validate_data.gd; data/_inbox/ | §6, §6.9, §8 G2 | inbox JSON → converter → validator → data/ .tres, with hot-reload at runtime | The mailroom and the quality inspector between generators and the shelf |
| inbox_json | data/_inbox JSON drop | 3 | content_pipeline | 0 | spec | content-smith | data/_inbox/ | §6 | Raw JSON from agents and generators lands here, one file per def | The in-tray |
| json_to_tres_converter | JSON → .tres converter | 3 | content_pipeline | 0 | spec | orchestrator | tools/json_to_tres.gd | §6 | Validates against the schema, converts, files the .tres in data/ | — |
| data_validator_g2 | Data validator (G2) | 3 | content_pipeline | 0 | spec | orchestrator/test-pilot | tools/validate_data.gd | §8 G2 | Unique ids, references resolve, icon and model paths exist, enums legal, numbers in range | The inspector who checks every card against the catalog |
| data_registry_loader | Runtime data registry | 3 | content_pipeline | 0 | implied | orchestrator | core/data/registry.gd | §6.9, §10 | id → def lookup for every schema, the only way code finds content | The library card catalog |
| hot_reload | Hot reload | 3 | content_pipeline | 2 | spec | orchestrator | core/data/ | §6.9 | Newly converted defs become usable without a restart | — |
| time_and_tick | Time & scheduling | 2 | foundation | 1 | spec | orchestrator | core/time/ | §4 R4 | Fixed simulation tick, timers and cooldowns, pause rules | The factory clock every machine runs on |
| fixed_tick_sim | Fixed-tick simulation loop | 3 | time_and_tick | 1 | spec | orchestrator | core/time/tick.gd; project.godot | §4 R4, §12 | Gameplay advances on the fixed physics tick (rate in project.godot); no frame-time math in core/ | — |
| timers_cooldowns | Timers & cooldowns | 3 | time_and_tick | 1 | implied | orchestrator | core/time/timers.gd | §6.2, §6.3 | Tick-based timers shared by cooldowns, craft time, respawns, effect durations | — |
| pause_rules | Pause & game speed | 3 | time_and_tick | 1 | implied | orchestrator | core/time/pause.gd | §12 | Single-player pause; no pause once a server owns time in Phase 4 | — |
| command_intents | Command / intent events | 2 | foundation | 1 | spec | orchestrator | core/commands/ | §12 | Player actions enter the sim as intents, the shape a server will receive later | Order tickets: the waiter writes the order, the kitchen decides what happens |
| intent_schema | Intent schema | 3 | command_intents | 1 | spec | orchestrator | core/commands/intent.gd | §12 | Typed intents: move, interact, cast spell_id at target, use item, build piece | — |
| intent_dispatch | Intent dispatch | 3 | command_intents | 1 | spec | orchestrator | core/commands/dispatch.gd | §12 | Intents are queued and applied on the tick by the owning system | — |
| intent_validation | Intent validation | 3 | command_intents | 1 | implied | orchestrator | core/commands/validate.gd | §12 | Illegal intents are rejected before they touch state; the server does this in Phase 4 | — |
| state_model | Serializable game state | 2 | foundation | 1 | spec | orchestrator | core/state/ | §12, §10 | All gameplay state lives in serializable data keyed by id, never only in nodes | The ledger: what the game is lives in the books, not in the furniture |
| actor_registry | Actor registry | 3 | state_model | 1 | spec | orchestrator | core/state/actors.gd | §12 | Logic references actors by id, never by node path | — |
| world_state_flags | World state flags | 3 | state_model | 2 | implied | orchestrator | core/state/flags.gd | §6.7, §6.8 | Boolean and counter flags quests, dialogue and gates read and set | — |
| state_serialization | State serialization | 3 | state_model | 3 | spec | orchestrator | core/state/serialize.gd | §10, §12 | Dictionaries and resources round-trip to JSON storing ids plus state | — |
| condition_grammar | Condition grammar | 2 | foundation | 3 | spec | orchestrator | core/conditions/ | §6.8 | The small expression language dialogue, quests and scripted sequences evaluate | A tiny rulebook language: has key AND quest done |
| condition_parser | Condition parser | 3 | condition_grammar | 3 | spec | orchestrator | core/conditions/parser.gd | §6.8 | Parses the grammar defined in Phase 3 into an evaluable tree | — |
| condition_evaluator | Condition evaluator | 3 | condition_grammar | 3 | spec | orchestrator | core/conditions/eval.gd | §6.8 | Evaluates against quest, item and flag state; pure and deterministic | — |
| debug_tools | Debug & GM tools | 2 | foundation | 0 | spec | orchestrator | core/debug/console.gd | §3, §13 | The console and overlays that make the content loop fast | The backstage door and the control booth |
| gm_console | GM console | 3 | debug_tools | 0 | spec | orchestrator | core/debug/console.gd | §13 | give, spawn, tp, time; disabled on public servers | — |
| debug_overlays | Debug overlays | 3 | debug_tools | 1 | implied | orchestrator | core/debug/overlays.gd | §13 | Toggle overlays: actor ids, threat, navmesh, hitboxes, frame time and the client performance readout | — |
| in_game_bug_report | In-game bug report | 3 | debug_tools | — | candidate | orchestrator | core/debug/report.gd | — | One key captures screenshot, log tail, position and save into a report bundle | The incident form with a photo attached |
| replay_recorder | Input replay recorder | 3 | debug_tools | — | candidate | orchestrator | core/debug/replay.gd | §4 R4 | Determinism makes intent logs replayable: record once, reproduce any bug | The black box flight recorder |
| config_settings | Settings & configuration | 2 | foundation | 1 | implied | orchestrator | core/settings/; user://settings.cfg | §1 | User settings store and the presets other systems read | The thermostat panel |
| user_settings_store | User settings store | 3 | config_settings | 1 | implied | orchestrator | core/settings/store.gd | — | Persisted key-value settings with defaults and validation | — |
| keybinding_config | Keybinding config | 3 | config_settings | 1 | implied | orchestrator | core/settings/input.gd | — | Rebindable actions persisted per user | — |
| audio_settings | Audio settings | 3 | config_settings | 1 | implied | orchestrator | core/settings/audio.gd | — | Bus volumes and mute per user | — |
| localization | Localization & text | 2 | foundation | — | candidate | orchestrator | data/locale/ | — | String tables, fonts and locale switching; every display string routed through a key | Subtitles in another language for the same film |
| string_tables | String tables | 3 | localization | — | candidate | orchestrator | data/locale/ | — | display_name and description keys resolved per locale | — |
| font_pipeline | Font pipeline | 3 | localization | — | candidate | world-builder | art/fonts/ | — | Fonts covering the locales shipped, with fallback | — |
| locale_switch | Locale switch | 3 | localization | — | candidate | orchestrator | core/settings/ | — | Runtime locale change without restart | — |
| repo_layout | Repository layout (§3) | 3 | engine_platform | 0 | spec | orchestrator/director | project.godot; .gdignore | §3, §13 item 2 | The §3 directory layout: res:// root with core/ data/ scenes/ actors/ ui/ art/ audio/ tests/ tools/ addons/; where the Godot root sits beside Loom's governance folders (.gdignore them, or move the game under game/) is an open DIRECTOR question | — |
| local_authority_mode | Local authority mode | 3 | command_intents | 1 | implied | orchestrator | core/commands/authority.gd | §12 | Phases 1–3: the local game is its own authority and applies intents directly; the seam a Phase 4 server replaces | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| event_bus | reads | game_infra_spec | §5 signal table | hard | The §5 table IS the signal API; the autoload implements it and changes ship in the same PR (R-EB1) |
| data_schemas | reads | game_infra_spec | §6 schema tables | hard | Every schema field is specified in §6; the class scripts implement the tables |
| architecture_rules | reads | game_infra_spec | §4 | hard | R1–R10 are defined by the spec; the codebase enforces them |
| addon_management | gated_by | dependency_policy_r10 | spec-change PR | hard | No addon enters addons/ without a §2 or §9 edit approved by the DIRECTOR |
| gdscript_static_typing | validates | architecture_rules | gdlint rules | soft | Lint encodes R6 mechanically so the rule is measured, not assumed |
| export_presets | reads | project_settings | export_presets.cfg | hard | Presets bundle the project settings and feature tags per platform |
| json_to_tres_converter | reads | data_schemas | class_name scripts | hard | The converter validates each inbox file against the schema it names |
| json_to_tres_converter | reads | inbox_json | data/_inbox/*.json | hard | The converter consumes exactly what lands in the inbox |
| data_validator_g2 | reads | data_schemas | enum values, required fields | hard | G2 checks enum legality and required fields against the schema definitions |
| data_validator_g2 | reads | id_convention | prefix rules | hard | G2 checks that every id follows the category-prefix convention |
| data_validator_g2 | reads | balance_ranges | docs/balance_ranges.md | hard | G2 rejects numbers outside the documented balance ranges |
| data_validator_g2 | reads | icon_conventions | res://art/icons/<category>/<id>.png | hard | G2 checks the icon path exists and its filename equals the content id |
| data_registry_loader | reads | data_schemas | .tres class_name | hard | The registry indexes every def type by id at load |
| data_registry_loader | reads | systems_content_split | id lookups only | hard | Code finds content only through the registry, never by hardcoding |
| hot_reload | reads | data_registry_loader | reload hook | hard | Hot reload re-indexes the registry after the converter files a new def |
| fixed_tick_sim | reads | project_settings | physics ticks per second | hard | The tick rate is a project setting; every duration in the sim is measured in it |
| fixed_tick_sim | reads | deterministic_sim | R4 | hard | The fixed tick is one half of determinism; seeded RNG is the other |
| timers_cooldowns | reads | fixed_tick_sim | tick counter | hard | Timers count ticks so they replay identically |
| pause_rules | reads | fixed_tick_sim | tick gate | hard | Pause stops the tick; nothing else may stop time |
| intent_dispatch | reads | intent_schema | typed intents | hard | Dispatch switches on the intent type |
| intent_dispatch | reads | fixed_tick_sim | apply on tick | hard | Intents apply on the tick boundary so order is deterministic |
| intent_validation | reads | intent_schema | typed intents | hard | Validation is per intent type |
| state_serialization | reads | actor_registry | ids | hard | Serialized state references actors by id |
| state_serialization | reads | id_convention | content ids | hard | Saves store content ids plus state, never copies of defs (R7) |
| state_serialization | reads | schema_versioning | schema_version | hard | A save records the schema versions it was written against |
| world_state_flags | reads | actor_registry | flag owners | soft | Some flags are per actor |
| condition_parser | reads | game_infra_spec | §6.8 grammar (Phase 3) | hard | The grammar is defined in the spec before the parser exists |
| condition_evaluator | reads | condition_parser | expression tree | hard | Evaluates what the parser produced |
| condition_evaluator | reads | world_state_flags | flag lookups | hard | Conditions test flags |
| condition_evaluator | reads | inventory | has item checks | hard | Conditions test inventory contents |
| condition_evaluator | reads | quests | quest state | hard | Conditions test quest started or completed |
| gm_console | reads | data_registry_loader | id lookups for give and spawn | hard | give and spawn resolve ids through the registry |
| gm_console | reads | intent_schema | console commands become intents | soft | From Phase 1 console commands enter the sim as intents like player actions; the Phase 0 console may call the registry directly (dev-only) |
| debug_overlays | renders | actor_registry | ids and positions | soft | Overlays draw what the registry knows |
| debug_overlays | renders | threat_aggro | threat table | soft | The threat overlay reads the threat table for the selected enemy |
| in_game_bug_report | reads | save_system | current save snapshot | hard | A report bundles the world save so the bug can be reloaded |
| in_game_bug_report | reads | replay_recorder | recent intents | soft | A report attaches the last minutes of intents when the recorder is on |
| replay_recorder | reads | intent_dispatch | intent log | hard | The recorder logs intents as dispatched |
| replay_recorder | reads | deterministic_sim | R4 | hard | Replay only works because the sim is deterministic |
| keybinding_config | reads | user_settings_store | bindings | hard | Bindings persist in the settings store |
| audio_settings | reads | user_settings_store | volumes | hard | Volumes persist in the settings store |
| string_tables | reads | id_convention | string keys derived from ids | soft | Localized display names key off the content id |
| locale_switch | reads | user_settings_store | locale | hard | The chosen locale is a setting |
| spawning | emits | sig_actor_spawned | — | hard | The spawn system announces every actor it creates |
| objective_tracking | listens | sig_actor_spawned | — | soft | Escort and spawn-based objectives watch spawns |
| ai_director | listens | sig_actor_spawned | — | soft | The director counts live actors to pace pressure |
| damage_model | emits | sig_actor_damaged | — | hard | Every resolved hit is published for UI, VFX and AI |
| fall_damage | emits | sig_actor_damaged | — | hard | Environmental damage is a second emitter; §5 lists only combat, so the Emitted-by column needs updating (R-EB1) |
| nameplates_floating_text | listens | sig_actor_damaged | — | hard | Floating combat numbers come from damage events |
| impact_effects | listens | sig_actor_damaged | — | hard | Hit VFX play on damage events |
| threat_table | listens | sig_actor_damaged | — | hard | Damage dealt adds threat against the target |
| perception | listens | sig_actor_damaged | — | soft | Being hit wakes up a passive or territorial AI |
| healing_model | emits | sig_actor_healed | — | hard | Every resolved heal is published |
| health_resource_bars | listens | sig_actor_healed | — | hard | Health bars animate on heals |
| nameplates_floating_text | listens | sig_actor_healed | — | soft | Heal numbers float too |
| death_resolution | emits | sig_actor_died | — | hard | Death is the most listened-to moment in the game |
| objective_tracking | listens | sig_actor_died | — | hard | Kill objectives count deaths by enemy id |
| loot_rolls_on_death | listens | sig_actor_died | — | hard | Loot rolls when something dies |
| xp_award | listens | sig_actor_died | — | hard | XP is awarded to the killer on death |
| hit_reactions_death_anims | listens | sig_actor_died | — | hard | The death animation plays on the event, never on a direct call (R5) |
| threat_table | listens | sig_actor_died | — | hard | Threat entries are dropped when either side dies |
| corpse_handling | listens | sig_actor_died | — | hard | A corpse replaces the actor on death |
| respawn_rules | listens | sig_actor_died | — | hard | Player death starts the respawn flow |
| reputation_sources | listens | sig_actor_died | — | soft | Killing faction members changes standing (candidate) |
| cast_timing | emits | sig_spell_cast | — | hard | Casting announces a completed cast |
| element_default_vfx | listens | sig_spell_cast | — | hard | Cast VFX are chosen by element on the event |
| sfx_events | listens | sig_spell_cast | — | hard | Cast sounds play on the event |
| perception | listens | sig_spell_cast | — | soft | AI reacts to casts (interrupt or dodge behaviors) |
| effect_kinds_verbs | emits | sig_effect_applied | — | hard | Applying an effect is announced with its duration |
| buff_bars | listens | sig_effect_applied | — | hard | Buff bars add an icon per applied effect |
| buff_debuff_visuals | listens | sig_effect_applied | — | hard | Persistent VFX attach on apply |
| effect_duration_expiry | emits | sig_effect_expired | — | hard | Expiry is announced so UI and VFX can detach |
| buff_bars | listens | sig_effect_expired | — | hard | Buff bars remove the icon |
| buff_debuff_visuals | listens | sig_effect_expired | — | hard | Persistent VFX detach on expiry |
| item_pickup_drop | emits | sig_item_acquired | — | hard | Any inventory gain is announced |
| objective_tracking | listens | sig_item_acquired | — | hard | Collect objectives count acquisitions |
| notifications_toasts | listens | sig_item_acquired | — | soft | A toast shows what was picked up |
| consumables_apply | emits | sig_item_consumed | — | hard | Using a consumable announces it |
| needs | listens | sig_item_consumed | — | hard | Food and drink restore needs on the event |
| inventory_screen | listens | sig_item_consumed | — | soft | The inventory screen refreshes counts |
| craft_time_queue | emits | sig_item_crafted | — | hard | A finished craft announces the output and its station |
| objective_tracking | listens | sig_item_crafted | — | hard | Craft objectives count crafts |
| notifications_toasts | listens | sig_item_crafted | — | soft | A toast confirms the craft |
| sfx_events | listens | sig_item_crafted | — | soft | A craft sound plays |
| quests | emits | sig_quest_started | — | hard | Starting a quest is announced |
| quest_journal_screen | listens | sig_quest_started | — | hard | The journal adds the quest |
| dialogue | listens | sig_quest_started | — | soft | Dialogue can branch on active quests |
| objective_tracking | emits | sig_quest_objective_progressed | — | hard | Progress ticks are announced with progress and required |
| notifications_toasts | listens | sig_quest_objective_progressed | — | hard | The tracker shows 3/5 wolves |
| quests | emits | sig_quest_completed | — | hard | Completion is announced |
| quest_journal_screen | listens | sig_quest_completed | — | hard | The journal moves the quest to done |
| quest_rewards | listens | sig_quest_completed | — | hard | Rewards are granted on completion |
| xp_award | listens | sig_quest_completed | — | hard | Quest XP is awarded on completion |
| reputation_sources | listens | sig_quest_completed | — | soft | Quests change faction standing (candidate) |
| world_clock_ticks | emits | sig_day_phase_changed | — | hard | The clock announces dawn, day, dusk and night |
| lighting_day_night | listens | sig_day_phase_changed | — | hard | Lighting shifts per phase |
| spawn_rules_biome_phase | listens | sig_day_phase_changed | — | hard | Night spawns switch on |
| ai_brain | listens | sig_day_phase_changed | — | soft | Some behaviors change at night |
| ambience_zones | listens | sig_day_phase_changed | — | soft | Ambient audio changes with the phase |
| save_system | emits | sig_world_saved | — | hard | A completed save is announced with its slot |
| save_system | emits | sig_world_loaded | — | hard | A completed load is announced with its slot |
| notifications_toasts | listens | sig_world_saved | — | soft | A saved toast |
| notifications_toasts | listens | sig_world_loaded | — | soft | A loaded toast |
| placement | emits | sig_structure_placed | — | hard | Building announces a placed piece (proposed signal) |
| structure_persistence | listens | sig_structure_placed | — | hard | Placed pieces are recorded for saving |
| navmesh_baking | listens | sig_structure_placed | — | hard | Navigation must rebake around new geometry |
| objective_tracking | listens | sig_structure_placed | — | soft | A build objective type would count placements (candidate objective type) |
| structure_damage_repair | emits | sig_structure_destroyed | — | hard | Destruction is announced (proposed signal) |
| structure_persistence | listens | sig_structure_destroyed | — | hard | Destroyed pieces are removed from the record |
| navmesh_baking | listens | sig_structure_destroyed | — | hard | Navigation rebakes when geometry is removed |
| join_leave_flow | emits | sig_player_joined | — | hard | The session announces a joined player (proposed signal) |
| join_leave_flow | emits | sig_player_left | — | hard | The session announces a departed player (proposed signal) |
| party_membership | listens | sig_player_joined | — | hard | The party adds the player |
| party_membership | listens | sig_player_left | — | hard | The party removes the player |
| group_frames | listens | sig_player_joined | — | hard | Group frames add a portrait |
| text_chat | listens | sig_player_joined | — | soft | A joined line in chat |
| level_curve | emits | sig_level_up | — | hard | Reaching a threshold announces the new level (proposed signal) |
| notifications_toasts | listens | sig_level_up | — | soft | A level-up toast |
| ability_unlocks | listens | sig_level_up | — | hard | Abilities unlock at levels |
| talent_points | listens | sig_level_up | — | hard | A talent point per level (candidate) |
| wallet | emits | sig_currency_changed | — | hard | Any currency delta is announced (proposed signal) |
| inventory_screen | listens | sig_currency_changed | — | soft | The coin display refreshes |
| reputation_sources | emits | sig_reputation_changed | — | hard | Standing changes are announced (proposed signal) |
| faction_unlocks_vendors | listens | sig_reputation_changed | — | hard | Unlocks open when a tier is crossed |
| notifications_toasts | listens | sig_reputation_changed | — | soft | A standing toast |
| boss_phases | emits | sig_boss_phase_changed | — | hard | A phase transition is announced (proposed signal) |
| boss_frames | listens | sig_boss_phase_changed | — | hard | The boss frame shows the phase |
| telegraph_visuals | listens | sig_boss_phase_changed | — | soft | Telegraph sets change per phase |
| music_system | listens | sig_boss_phase_changed | — | soft | Music intensifies per phase |
| weather | emits | sig_weather_changed | — | hard | Weather transitions are announced (proposed signal) |
| temperature_exposure | listens | sig_weather_changed | — | hard | Cold snaps and storms change exposure |
| ambience_zones | listens | sig_weather_changed | — | soft | Rain and wind ambience |
| lighting_day_night | listens | sig_weather_changed | — | soft | Overcast dims the light rig |
| zone_triggers | emits | sig_zone_entered | — | hard | Crossing a zone boundary is announced (proposed signal) |
| objective_tracking | listens | sig_zone_entered | — | hard | reach objectives complete on zone entry |
| ambience_zones | listens | sig_zone_entered | — | hard | Ambient beds switch per zone |
| notifications_toasts | listens | sig_zone_entered | — | soft | The zone name banner |
| music_system | listens | sig_zone_entered | — | soft | Region music |
| need_thresholds_effects | emits | sig_need_threshold_crossed | — | hard | Survival announces starving, freezing, exhausted (proposed signal) |
| effect_kinds_verbs | listens | sig_need_threshold_crossed | — | hard | The effects system applies the matching debuff instead of survival calling it (R2) |
| health_resource_bars | listens | sig_need_threshold_crossed | — | soft | The HUD flashes the need icon |
| player_trade | emits | sig_trade_completed | — | hard | A completed trade is announced (proposed signal) |
| inventory_screen | listens | sig_trade_completed | — | soft | Inventory refreshes after a trade |
| objective_tracking | listens | sig_trade_completed | — | soft | A trade objective type could count trades |
| gm_console | reads | day_night_cycle | time <phase> | hard | `time <phase>` sets the clock; §13 puts the command in Phase 0 and the clock in Phase 3 — DIRECTOR: stub the clock in P0 or move the command |
| gm_console | reads | item_pickup_drop | give | hard | `give <item_id> [n]` puts items in the bag through the pickup path; §13 puts the command in P0 and inventory in P2 — DIRECTOR: stub or move |
| gm_console | reads | spawning | spawn | hard | `spawn <enemy_id> [n]` goes through the spawn system |
| gm_console | reads | actor_registry | tp | hard | `tp <x> <y> <z>` moves the player actor by id |
| gm_console | reads | hot_reload | — | soft | §6.9: a converted def is castable through the console without a restart |
| effect_kinds_verbs | listens | sig_item_consumed | — | hard | The effects system applies ItemDef.on_use_effect on the existing §5 signal instead of survival calling combat (R2) |
| threat_table | listens | sig_actor_healed | — | soft | Healing adds threat against the healer |
| sfx_events | listens | sig_actor_damaged | — | hard | Hit sounds play on damage events |
| sfx_events | listens | sig_actor_died | — | hard | Death sounds play on the event |
| string_tables | reads | dialogue_nodes_choices | — | soft | Dialogue text would be string keys |
| string_tables | reads | quest_journal_text | — | soft | Journal text would be string keys |
| data_validator_g2 | reads | model_naming | model paths | hard | G2 checks that every model path exists and is named by id |
| data_validator_g2 | reads | actor_prefabs_scenes | scene path | hard | G2 checks that EnemyDef.scene exists |
| data_validator_g2 | reads | schema_versioning | — | soft | G2 rejects a schema_version the current class does not know |
| json_to_tres_converter | reads | schema_conventions | conventions | hard | id, display_name and schema_version are required on every def |
| temperature_exposure | listens | sig_day_phase_changed | — | soft | Nights are colder |
| debug_overlays | renders | navmesh_baking | — | soft | The navmesh overlay draws the baked mesh |
| debug_overlays | renders | hit_detection | — | soft | The hitbox overlay draws the sim's shapes |
| data_validator_g2 | reads | icon_placeholder_fallback | — | soft | G2 accepts the placeholder path as existing |
| respawn_timers | listens | sig_actor_died | — | hard | A kill starts the respawn timer |
| fog_atmosphere | listens | sig_weather_changed | — | soft | Fog density follows the weather |
| death_screen | listens | sig_actor_died | — | hard | Opens on the local player's death (R5: reacts, never mutates) |
| spawn_replication | listens | sig_actor_spawned | — | hard | The §5 Phase 4 note: server-emitted spawns replicate to clients |
| repo_layout | reads | game_infra_spec | §3 | hard | §3 defines the layout |
| systems_content_split | reads | repo_layout | — | hard | core/ versus data/ is the R1 boundary |
| local_authority_mode | reads | intent_dispatch | — | hard | Intents dispatch locally until a server owns them |
