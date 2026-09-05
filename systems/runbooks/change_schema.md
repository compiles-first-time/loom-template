# rb_change_schema — Add, rename or remove a field on a §6 schema

## Runbook

| Field | Value |
|---|---|
| Trigger | Content needs a field, enum value or type the schema lacks, or a field is wrong. A schema is a contract shared by every def of that noun, the converter, the validator, every system that reads the field, and every save. |
| Primary | data_schemas |
| Roles | orchestrator; content-smith; test-pilot |
| Director | Yes — §6 is a contract (§14): the spec PR needs DIRECTOR approval |
| Spec | §6 conventions, §4 R7, §10 save rule, §14 |
| Not touched | achievements: candidate — no defs exist yet; class_defs: candidate; faction_defs: candidate; talent_trees: candidate; additional_class_resources: candidate — the cost.resource enum grows only with a DIRECTOR decision; db_migrations: Phase 4 — content and database versions move together, note the version in docs/migrations.md and the DB migration follows in Phase 4 |

## Steps

| # | Action | System | Artifact | Verify | Note |
|---|---|---|---|---|---|
| 1 | check | data_schemas | GAME_INFRA_SPEC.md §6 | the change cannot be expressed with an existing field, tag or stats key | tags[] and stats{} absorb most "one more field" requests without a schema change. |
| 2 | decide | — | GAME_INFRA_SPEC.md §6 | DIRECTOR approves the field: name, type, required, notes | — |
| 3 | update | game_infra_spec | GAME_INFRA_SPEC.md §6.x | the table row is added/changed in this PR | — |
| 4 | update | schema_versioning | core/schemas/<def>.gd | schema_version bumped by one | Every def carries schema_version; the bump is what migrations key on. |
| 5 | update | migrations_doc | docs/migrations.md | a note: version N → N+1, field, default for old data, save impact | — |
| 6 | update | data_schemas | core/schemas/<def>.gd | the Resource class gains/loses the field with a typed default | — |
| 7 | update | json_to_tres_converter | tools/json_to_tres.gd | converter accepts the new field and fills the default for old JSON | — |
| 8 | update | data_validator_g2 | tools/validate_data.gd | validator checks the field: type, enum, range, referenced ids | — |
| 9 | update | balance_ranges | docs/balance_ranges.md | a numeric field gets an allowed range | — |
| 10 | check | request_to_json | .claude/skills/content-smith/ | the generator prompt and the JSON example show the new field | Agents write JSON from the schema; an outdated example fails the converter. |
| 11 | check | data_registry_loader | core/data/registry.gd | the loader indexes the def type by id unchanged; a renamed id field would break every lookup | — |
| 12 | update | items | data/items/*.tres | every ItemDef carries the field (script the migration, do not hand-edit hundreds of files) | ItemDef changes only — this and steps 13–19 apply per changed noun. |
| 13 | update | recipe_defs | data/recipes/*.tres | every RecipeDef migrated | RecipeDef only. |
| 14 | update | spell_defs_content | data/spells/*.tres | every SpellDef migrated | SpellDef only. |
| 15 | update | effect_defs_content | data/effects/*.tres | every StatusEffectDef migrated | StatusEffectDef only. |
| 16 | update | enemy_defs | data/enemies/*.tres | every EnemyDef migrated | EnemyDef only. |
| 17 | update | loot_table_defs | data/loot_tables/*.tres | every LootTableDef migrated | LootTableDef only. |
| 18 | update | quest_defs | data/quests/*.tres | every QuestDef migrated | QuestDef only. |
| 19 | update | dialogue_nodes_choices | data/dialogue/*.tres | every DialogueDef migrated | DialogueDef only. |
| 20 | update | biome_defs | data/biomes/*.tres | every BiomeDef migrated | BiomeDef only (implied schema). |
| 21 | update | npc_defs | data/npcs/*.tres | every NpcDef migrated | NpcDef only (implied schema). |
| 22 | update | encounter_defs | data/encounters/*.tres | every EncounterDef migrated | EncounterDef only (implied schema). |
| 23 | update | piece_defs | data/building/*.tres | every BuildingPieceDef migrated | BuildingPieceDef only (implied schema). |
| 24 | update | markers_waypoints | data/markers/*.tres | every MarkerDef migrated | MarkerDef only (implied schema). |
| 25 | check | crafting_stations | core/crafting/stations.gd | a StationDef change reaches the station registry | StationDef only (implied schema). |
| 26 | update | station_defs | data/stations/*.tres | every StationDef migrated | StationDef only (implied schema). |
| 27 | check | quest_journal_text | data/quests/*.tres | a QuestDef text field change is reflected in journal_text | QuestDef only. |
| 28 | check | damage_types_elements | core/combat/damage.gd | an element enum change reaches the damage-type table and the resistances | SpellDef / StatusEffectDef element only. |
| 29 | check | effect_kinds_verbs | core/combat/effects/ | a StatusEffectDef.kind enum change has a verb (`rb_add_verb`) | StatusEffectDef only. |
| 30 | check | behavior_verbs | core/ai/behaviors/ | an EnemyDef.behavior enum change has a verb (`rb_add_verb`) | EnemyDef only. |
| 31 | check | objective_types | core/quests/objectives.gd | an objectives.type enum change has a verb (`rb_add_verb`) | QuestDef only. |
| 32 | check | save_migrations | core/saving/migrations.gd | saves store ids + state (§10): a def field change needs a save migration only if the state shape changed | R7: ids never change; new id + migration note instead. |
| 33 | check | state_serialization | core/state/ | serialized state round-trips with the changed def | — |
| 34 | update | systems_atlas | systems/registry/00-foundation.md | `set-node schema_<def> summary=…` and edges for any new reader of the field | — |
| 35 | update | g1_unit_tests_gut | tests/unit/schemas/ | a test loads an old-version def and gets the default | — |
| 36 | run | g0_style_parse | . | passes | — |
| 37 | run | g1_unit_tests_gut | tests/unit/ | passes | — |
| 38 | run | g2_data_integrity | tools/validate_data.gd | passes on the migrated data | — |
| 39 | run | g3_smoke_boot | scenes/main.tscn | boots, loads an old save if one exists, zero ERROR lines | — |
| 40 | update | changelog | docs/changelog.md | one line: schema, version, field | — |
