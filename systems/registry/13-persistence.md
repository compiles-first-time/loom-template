# Persistence — what survives when the lights go off

> **Analogy:** the filing cabinet. The game's diary written every few minutes (file saves), the bank vault that replaces the diary in Phase 4 (server database), the recipe archive with full history (Git as the content database), membership cards for a club that today uses "knock and say the password" (accounts), your character's file folder (character persistence), and the visitor logbook (telemetry store).

Format: [`systems/README.md`](../README.md). Decision: [ADR-0065](../../adr/0065-systems-atlas-and-impact-map.md).

## Nodes

| ID | Name | Tier | Parent | Phase | Status | Owner | Where | Spec | Summary | Analogy |
|---|---|---|---|---|---|---|---|---|---|---|
| persistence | Persistence | 1 | — | 3 | spec | orchestrator | core/saving/; server/db/; data/ | §10 | Saves, server database, content database, accounts, character records, telemetry store | The filing cabinet: what survives when the lights go off |
| save_system | Save system | 2 | persistence | 3 | spec | orchestrator | core/saving/ | §10, §5 world_saved, world_loaded | JSON world saves per slot, autosave, migrations, restore | The game's diary, written every few minutes |
| world_save_json | World save file | 3 | save_system | 3 | spec | orchestrator | core/saving/world.gd | §10 | user://saves/<slot>/world.json | — |
| save_slots | Save slots | 3 | save_system | 3 | spec | orchestrator | core/saving/slots.gd | §10 | Named slots per world | — |
| autosave_scheduler | Autosave | 3 | save_system | 3 | implied | orchestrator | core/saving/autosave.gd | — | Periodic and event-driven saves | — |
| save_ids_plus_state | Ids plus state rule | 3 | save_system | 3 | spec | orchestrator | core/saving/ | §10, §4 R7 | Saves store content ids plus state, never copies of defs, so patches apply to old saves | — |
| save_migrations | Save migrations | 3 | save_system | 3 | spec | orchestrator | core/saving/migrate.gd; docs/migrations.md | §6, §10 | Upgrade old saves by schema_version | — |
| load_restore_flow | Load and restore | 3 | save_system | 3 | spec | orchestrator | core/saving/load.gd | §5 world_loaded | Rebuilds state from a save and resolves ids through the registry | — |
| backup_rotation | Backup rotation | 3 | save_system | — | candidate | orchestrator | core/saving/ | — | Keep the last N saves | — |
| server_database | Server database | 2 | persistence | 4 | spec | orchestrator | server/db/ | §10 SQLite | The Phase 4 SQLite store for world state, inventories and structures | The bank vault replacing the diary |
| sqlite_world_store | SQLite world store | 3 | server_database | 4 | spec | orchestrator | server/db/store.gd | §10 | One SQLite file per dedicated-server world | — |
| db_schema_design | Database schema design | 3 | server_database | 4 | implied | orchestrator | server/db/schema.sql | §10 | Tables and indexes for players, characters, inventories, structures, flags | — |
| transactional_writes_crash_safety | Transactional writes | 3 | server_database | 4 | spec | orchestrator | server/db/store.gd | §10 | Atomic writes so a crash never corrupts a world | — |
| db_migrations | Database migrations | 3 | server_database | 4 | implied | orchestrator | server/db/migrations/ | §10 | Versioned schema migrations | — |
| player_inventory_tables | Player inventory tables | 3 | server_database | 4 | spec | orchestrator | server/db/schema.sql | §10 | Inventories per character | — |
| placed_structures_tables | Placed structure tables | 3 | server_database | 4 | spec | orchestrator | server/db/schema.sql | §10 | Placed pieces per world | — |
| content_database_git | Content database (Git) | 2 | persistence | 0 | spec | orchestrator | data/; .git | §10 | Git is the content database: diffable, mergeable, agent-editable, time travel included | The recipe archive with full history |
| data_dir_as_db | data/ as the database | 3 | content_database_git | 0 | spec | orchestrator | data/ | §10 | data/ in Git is the only content store | — |
| content_versioning | Content versioning | 3 | content_database_git | 0 | spec | orchestrator | .git | §10 | History and branches as content versions | — |
| id_immutability_migrations | Id immutability | 3 | content_database_git | 0 | spec | orchestrator | docs/migrations.md | §4 R7 | Ids never change once shipped; add a new id and a migration note | — |
| accounts_auth | Accounts & authentication | 2 | persistence | — | candidate | director | server/auth/ | §10 Later | Accounts, sign-in, cross-server characters, cloud DB, leaderboards; only with a spec change | Membership cards for a club that today uses knock and say the password |
| account_identity | Account identity | 3 | accounts_auth | — | candidate | director | server/auth/ | — | A persistent identity beyond one server | — |
| authentication_provider | Authentication provider | 3 | accounts_auth | — | candidate | director | server/auth/ | — | Steam or OAuth sign-in | — |
| cross_server_characters | Cross-server characters | 3 | accounts_auth | — | candidate | director | server/auth/ | — | One character across servers | — |
| cloud_db_postgres | Cloud database | 3 | accounts_auth | — | candidate | director | server/db/ | §10 Later | Postgres or Supabase only if accounts become real | — |
| leaderboards | Leaderboards | 3 | accounts_auth | — | candidate | director | server/ | — | Rankings across servers | — |
| character_persistence | Character persistence | 2 | persistence | 3 | spec | orchestrator | core/saving/character.gd | §10 | The character record and its per-world storage | Your character's file folder |
| character_state_record | Character state record | 3 | character_persistence | 3 | spec | orchestrator | core/saving/character.gd | §10 | The stored character: ids plus state | — |
| per_player_save_in_world | Per-player save in world | 3 | character_persistence | 4 | spec | orchestrator | server/db/ | §10 | Player inventories stored in the server's world database | — |
| character_migration_between_worlds | Character migration | 3 | character_persistence | — | candidate | director | core/saving/ | — | Moving a character between worlds | — |
| telemetry_store | Telemetry store | 2 | persistence | — | candidate | orchestrator | server/analytics/ | — | Gameplay analytics and crash report storage | The visitor logbook |
| gameplay_analytics_events | Gameplay analytics events | 3 | telemetry_store | — | candidate | orchestrator | server/analytics/ | — | Anonymous gameplay events for tuning | — |
| crash_reports_store | Crash report store | 3 | telemetry_store | — | candidate | orchestrator | server/analytics/ | — | Crash bundles | — |

## Edges

| From | How | To | Via | Strength | Why |
|---|---|---|---|---|---|
| world_save_json | reads | state_serialization | serializer | hard | The save file is serialized state |
| world_save_json | reads | save_slots | slot path | hard | Each slot has its own file |
| save_slots | reads | user_settings_store | last slot | soft | The last-used slot is remembered |
| autosave_scheduler | reads | timers_cooldowns | interval | hard | Autosave is a timer |
| autosave_scheduler | reads | world_save_json | write | hard | Autosave writes the save file |
| save_ids_plus_state | reads | id_convention | ids | hard | The rule depends on stable ids |
| save_ids_plus_state | reads | state_serialization | state shape | hard | The serializer enforces ids plus state |
| save_migrations | reads | schema_versioning | schema_version | hard | Migrations are keyed by schema version |
| save_migrations | reads | world_save_json | old saves | hard | Migrations rewrite old save files |
| load_restore_flow | reads | data_registry_loader | id resolution | hard | Loading resolves content ids through the registry |
| load_restore_flow | reads | world_save_json | read | hard | Loading reads the save file |
| load_restore_flow | reads | save_migrations | upgrade first | hard | Old saves are migrated before restore |
| backup_rotation | reads | save_slots | copies | hard | Backups are copies per slot |
| sqlite_world_store | reads | state_serialization | rows | hard | Rows hold serialized state |
| sqlite_world_store | reads | db_schema_design | tables | hard | The store implements the schema |
| sqlite_world_store | gated_by | dependency_policy_r10 | godot-sqlite addon | hard | The SQLite addon is a new dependency in Phase 4 |
| db_schema_design | reads | state_model | entities | hard | Tables mirror the state model |
| db_schema_design | reads | id_convention | keys | hard | Content ids are foreign keys |
| transactional_writes_crash_safety | reads | sqlite_world_store | transactions | hard | Transactions wrap store writes |
| db_migrations | reads | db_schema_design | versions | hard | Migrations evolve the schema |
| db_migrations | reads | schema_versioning | content versions | hard | Database and content versions move together |
| player_inventory_tables | persists | inventory | bags per character | hard | Inventories are rows in Phase 4 |
| player_inventory_tables | reads | db_schema_design | tables | hard | The tables are part of the schema |
| placed_structures_tables | persists | structure_persistence | placed pieces | hard | Placed pieces are rows in Phase 4 |
| placed_structures_tables | reads | db_schema_design | tables | hard | The tables are part of the schema |
| data_dir_as_db | reads | content_pipeline | filed .tres | hard | The pipeline files content into data/ |
| data_dir_as_db | reads | plain_text_formats | text only | hard | Git as a database works because content is text |
| content_versioning | reads | data_dir_as_db | history | hard | Versions are commits of data/ |
| id_immutability_migrations | reads | id_convention | ids | hard | The rule is about ids |
| id_immutability_migrations | reads | save_migrations | migration notes | soft | An id change needs a migration note once saves exist; the rule is declared at Phase 0 and enforced from Phase 3 |
| account_identity | reads | player_identity_local | upgrade path | hard | Accounts would replace local identities |
| account_identity | gated_by | dependency_policy_r10 | external service | hard | Accounts mean an external service |
| authentication_provider | reads | account_identity | identity | hard | Sign-in resolves an account |
| authentication_provider | reads | env_secrets | provider keys | hard | Provider credentials live in env |
| cross_server_characters | reads | character_state_record | record | hard | The record travels between servers |
| cross_server_characters | reads | account_identity | owner | hard | The record belongs to an account |
| cloud_db_postgres | reads | db_schema_design | schema | hard | The cloud database reuses the schema |
| cloud_db_postgres | reads | account_identity | accounts | hard | A cloud database exists for accounts |
| leaderboards | reads | gameplay_analytics_events | scores | hard | Rankings are computed from events |
| leaderboards | reads | account_identity | who | hard | Rankings need identities |
| character_state_record | persists | character_save_state | record | hard | The stored record is the character's save state |
| per_player_save_in_world | reads | player_inventory_tables | rows | hard | Per-player saves live in the inventory tables |
| per_player_save_in_world | reads | character_state_record | record | hard | The record is what is stored |
| character_migration_between_worlds | reads | character_state_record | record | hard | Migration moves the record |
| gameplay_analytics_events | reads | event_bus | all signals | hard | Analytics subscribe to the bus |
| crash_reports_store | reads | crash_reporting | bundles | hard | The store receives crash bundles |
| crash_reports_store | reads | in_game_bug_report | bundles | soft | Player reports land in the same store |
